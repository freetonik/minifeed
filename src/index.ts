import { Hono } from 'hono'
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import { html, raw } from 'hono/html'
import { XMLParser } from 'fast-xml-parser'
import { renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers'

import { itemsAll, itemsMy, itemsMySubs, itemsMyFollows, itemsSingle } from './items'
import { feedsAll, feedsSingle, feedsSubscribe, feedsUnsubscribe } from './feeds'
import { usersAll, usersSingle, usersFollow, usersUnfollow } from './users'

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
			c.set('USER_ID', results[0]['user_id'])
		}
	}
	await next()
}

app.use('*', authMiddleware)
app.get('/static/*', serveStatic({ root: './' }))

// APP ROUTES
app.get('/all', itemsAll) // all posts

app.get('/my', itemsMy)
app.get('/my/subs', itemsMySubs)
app.get('/my/follows', itemsMyFollows)

app.get('/feeds', feedsAll)
app.get('/feeds/:feed_sqid', feedsSingle)
app.post('/feeds/:feed_sqid/subscribe', feedsSubscribe)
app.post('/feeds/:feed_sqid/unsubscribe', feedsUnsubscribe)

app.get('/users', usersAll)
app.get('/users/:username', usersSingle)
app.post('/users/:username/follow', usersFollow)
app.post('/users/:username/unfollow', usersUnfollow)

app.get('/items/:item_sqid', itemsSingle)

app.get('/c/f/add', async (c) => {
	if (!c.get('USER_ID')) return c.redirect('/login')
	const inner = `
	<h1>New feed</h1>
	<form action="/c/f/add" method="POST">
		<label for="url">Blog URL:</label><br>
	  <input type="text" id="url" name="url" value=""><br>
	  <label for="url">Feed URL:</label><br>
	  <input type="text" id="rssUrl" name="rssUrl" value=""><br>
	  <input type="submit" value="Submit">
	</form>` 
	return c.html(renderHTML("All items", html`${raw(inner)}`))
});

app.post('/c/f/add', async (c) => {
	// const r = fetchFeed(c)
	const body = await c.req.parseBody();
	const url = body['url'].toString();
	const rssUrl = body['rssUrl'].toString();
	const f = await addFeed(c, url, rssUrl)
	console.log(f)
	if (f['success'] === true) {
		const feedId = await getFeedIdByRSSUrl(c, rssUrl)
		console.log(feedId)
		await fetchFeed(c, feedId)
		return c.redirect(`/feeds/${feedId}`, 301)
	}
	return c.text("Something went wrong")
});


app.post('/login', async (c) => {
	const body = await c.req.parseBody();
	// todo: check KV, create user, set cookie
	return c.text('ok');
	const new_token = body['token'];
});

//
// INTERNAL SERVICE ENDPOINTS
app.get('/service/fetch_feed/:feed_id', async (c) => {
	const feedId = c.req.param('feed_id');
	const r = await fetchFeed(c, feedId);
	if (r === 201) return c.text("New items added")
	else if (r === 200) return c.text("No new items added")
	else return c.text("Error")
});

// INTERNAL FUNCTIONS

async function getFeedIdByRSSUrl(c, rssUrl) {
	const { results } = await c.env.DB.prepare("SELECT feed_id FROM feeds where rss_url = ?").bind(rssUrl).all()
	return results[0]['feed_id']
}

async function addFeed(c, url, rssUrl) {
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

	console.log(rssJson)

	let title;
	if (rssJson.rss && rssJson.rss.channel) {title = rssJson.rss.channel.title}
	else if (rssJson.feed) {title = rssJson.feed.title}

	return await c.env.DB.prepare("INSERT INTO feeds (title, url, rss_url) values (?, ?, ?)").bind(title, url, rssUrl).all()
}

async function fetchFeed(c, feedId: Number) {
	const parser = new XMLParser();

	const { results: feeds } = await c.env.DB.prepare("SELECT * FROM feeds WHERE feed_id = ?").bind(feedId).all();
	const url = feeds[0]['rss_url']
	const req = await fetch(url);
	const rssText = await req.text();
	const rssJson = parser.parse(rssText, true);
	let items;
	if (rssJson.rss && rssJson.rss.channel) items = rssJson.rss.channel.item;
	else if (rssJson.feed) items = rssJson.feed.entry;

	const { results: existingItems } = await c.env.DB.prepare( "SELECT url FROM items WHERE feed_id = ?").bind(feedId).all();
	const existingUrls = existingItems.map(obj => obj.url);

	let newItemsToBeAdded = 0;
	if (items.length > 0) {
		let binds: any[] = [];
		const stmt = c.env.DB.prepare("INSERT INTO items (feed_id, title, url, pub_date, content) values (?, ?, ?, ?, ?)");

		items.forEach((item: any) => {
			console.log(item)
			let pubDate;
			if (item.pubDate) pubDate = new Date(item.pubDate).toISOString();
			else if (item.published) pubDate = new Date(item.published).toISOString();
			
			let link;
			if (item.link) link = item.link;
			else if (item.id) link = item.id;

			let content;
			if (item['content:encoded']) content = item['content:encoded']
			else if (item.description) content = item.description
			else if (item.content) content = item.content


			if (!existingUrls.includes(link)) {
				newItemsToBeAdded += 1;
				binds.push(stmt.bind(feedId, item.title, link, pubDate, content));
			}
		});

		if (newItemsToBeAdded > 0) {
			await c.env.DB.batch(binds);
			return 201
		} else return 200
	}
	return 200
}


export default app
