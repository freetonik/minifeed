import { Hono } from 'hono'
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import { html } from 'hono/html'
import { XMLParser } from 'fast-xml-parser'

type Bindings = {
	DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

async function authMiddleware(c, next) {
	const userToken = getCookie(c, 'minifeed_user_token')
	if (userToken) {
		const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE token = ?")
			.bind(userToken).all()
		if (results.length > 0) {
			c.set('UserId', results[0]['user_id'])
		}
	}
	await next()
}

app.use('*', authMiddleware)


app.get('/', (c) => {
	const user = c.get('UserId')
	return c.text(`User: ${user}`)
});

app.get('/all', async (c) => {
	const { results } = await c.env.DB.prepare("SELECT * from items").run();
	let list = ''
	results.forEach((item: any) => {
		list = list + `<li><a href="${item.url}">${item.title}</a> (${item.feedId})</li>`
	})
	return c.html(
		`${list}`)
})

app.get('/f/add', async (c) => {
	if (!c.get('UserId')) return c.redirect('/login')
	return c.html(
		html`<!DOCTYPE html>
	<form action="/f/add" method="POST">
	  <label for="url">Feed URL:</label><br>
	  <input type="text" id="url" name="url" value=""><br>
	  <input type="submit" value="Submit">
	</form>`) 
});

app.post('/f/add', async (c) => {
	// const r = fetchFeed(c)
	const body = await c.req.parseBody();
	const url = body['url'].toString();
	await addFeed(c, url)
	await fetchFeed(c, url)
	return c.text("OK")
});

// app.get('/login', async (c) => {
// 	const new_uuid = crypto.randomUUID();
// });
//
app.post('/login', async (c) => {
	const body = await c.req.parseBody();
	// todo: check KV, create user, set cookie
	return c.text('ok');
	const new_token = body['token'];
});

//
// INTERNAL SERVICE ENDPOINTS
app.post('/service/fetch_feed', async (c) => {
	const body = await c.req.parseBody();
	const url = body['url'].toString();
	return await fetchFeed(c, url);
});

async function addFeed(c, rssUrl) {
	let req;
	try {
		req = await fetch(rssUrl);
	} catch (err) {
		return
	}
	const rssText = await req.text();

	const parser = new XMLParser();

	let rssJson;
	try {
		rssJson = parser.parse(rssText, true);
	} catch (err) {
		return
	}

	const title = rssJson.rss.channel.title
	const url = rssJson.rss.channel.link
	await c.env.DB.prepare("INSERT INTO feeds (title, url, rss_url) values (?, ?, ?)").bind(title, url, rssUrl).run()
}

async function fetchFeed(c, url) {
	const parser = new XMLParser();

	let req;
	try {
		req = await fetch(url);
	} catch (err) {
		c.status(422)
		return c.body('Invalid URL')
	}
	const rssText = await req.text();

	let rssJson;
	try {
		rssJson = parser.parse(rssText, true);
	} catch (err) {
		c.status(422)
		return c.body('Invalid RSS')
	}

	const items = rssJson.rss.channel.item;

	const { results } = await c.env.DB.prepare("SELECT * FROM feeds WHERE rss_url = ? LIMIT 1").bind(url).all();
	const feedId = results[0]['feed_id'];

	const { results: existingItems } = await c.env.DB.prepare(
		"SELECT url FROM items WHERE feed_id = ?"
	).bind(feedId).all();
	const existingUrls = existingItems.map(obj => obj.Url);

	const filteredItems = items.filter(obj => !existingUrls.includes(obj.link));

	console.log(`FeedId: ${feedId}, adding new items: ${filteredItems.length}`);

	if (filteredItems.length > 0) {
		let binds: any[] = [];
		const stmt = c.env.DB.prepare("INSERT INTO items (feed_id, title, url) values (?, ?, ?)");

		filteredItems.forEach((item: any) => {
			binds.push(stmt.bind(1, item.title, item.link));
		});

		await c.env.DB.batch(binds);
		c.status(201);
		return c.body('OK');
	}
	c.status(200);
	return c.body('OK');
}

export default app
