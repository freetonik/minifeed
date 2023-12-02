import { Hono } from 'hono'
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import { html, raw } from 'hono/html'
import { XMLParser } from 'fast-xml-parser'
import { renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers'
import Sqids from 'sqids'

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

app.get('/all', async (c) => {
	// const user = c.get('USER_ID')
	// return c.text(`User: ${user}`)
	const { results } = await c.env.DB
		.prepare("SELECT items.item_id, items.title AS item_title, items.url AS item_url, feeds.title AS feed_title FROM items JOIN feeds ON items.feed_id = feeds.feed_id")
		.run();

	let list = `<h1>All items</h1>`
	results.forEach((item: any) => {
		list += `<li><a href="${item.item_url}">${item.item_title}</a> (${item.feed_title})</li>`
	})
	return c.html(renderHTML("All items", html`${raw(list)}`))
})

app.get('/my', async (c) => {
	const userId = c.get('USER_ID')
	const { results } = await c.env.DB
		.prepare(`
			SELECT items.item_id, items.title, items.url
			FROM items
			JOIN subscriptions ON items.feed_id = subscriptions.feed_id
			WHERE subscriptions.user_id = ?

			UNION

      SELECT items.item_id, items.title, items.url
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      WHERE followings.follower_user_id = ?

			`)
		.bind(userId, userId)
		.all();

	console.log(results)
	let list = `<h1>All items</h1>`
	results.forEach((item: any) => {
		list += `<li><a href="${item.url}">${item.title}</a> (${item.feed_title})</li>`
	})
	return c.html(renderHTML("All items", html`${raw(list)}`))
})


app.get('/feeds', async (c) => {
	// const user = c.get('USER_ID')
	// return c.text(`User: ${user}`)
	const { results } = await c.env.DB
		.prepare("SELECT * from feeds")
		.run();

	let list = `<h1>All feeds</h1>`
	results.forEach((feed: any) => {
		const sqid = idToSqid(feed.feed_id)
		list += `<li><a href="/feeds/${sqid}">${feed.title}</a> (<a href="${feed.url}">Site</a> / <a href="${feed.rss_url}">RSS</a>)</li>`
	})
	return c.html(renderHTML("All items", html`${raw(list)}`))
})


app.get('/feeds/:feed_sqid', async (c) => {
	// TODO: we're assuming that feed always has items; if feed has 0 items, this will return 404, but maybe we want to
	// show the feed still as "processing"; use https://developers.cloudflare.com/d1/platform/client-api/#batch-statements
	const feedSqid = c.req.param('feed_sqid')
	const feedId = sqidToId(feedSqid);
	const userId = c.get('USER_ID') || "0";
	const { results } = await c.env.DB
		.prepare(`
			SELECT items.item_id, items.title AS item_title, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.url AS feed_url, feeds.feed_id, subscriptions.subscription_id
			FROM items 
			JOIN feeds ON items.feed_id = feeds.feed_id 
			LEFT JOIN subscriptions ON feeds.feed_id = subscriptions.feed_id
			WHERE (subscriptions.user_id = ? OR subscriptions.user_id IS NULL)
				AND feeds.feed_id = ? 
			ORDER BY items.pub_date DESC`)
		.bind(userId, feedId)
		.all();

	LOG(results)
	if (results.length === 0) return c.notFound();
	const tmp = results[0];
	const feedTitle = tmp['feed_title']
	const feedUrl = tmp['feed_url']
	const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };
	const subscriptionButtonText = tmp['subscription_id'] ? "unsubscribe" : "subscribe";

	let list = `<h1>${feedTitle}</h1><p><a href="${feedUrl}">${feedUrl}</a></p>
	<span id="subscription">
		<button hx-post="/feeds/${feedSqid}/${subscriptionButtonText}"
	    hx-trigger="click"
	    hx-target="#subscription"
	    hx-swap="outerHTML">
	    ${subscriptionButtonText}
		</button>
	</span>
	`
	results.forEach((item: any) => {
	  const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)
	  const postSqid = idToSqid(item.item_id, 10)
		list += `<li><a href="${item.item_url}">${item.item_title}</a> / <a href="/posts/${postSqid}">read</a> <time>${postDate}</time></li>`
	})
	return c.html(renderHTML("All items", html`${raw(list)}`))
})


app.post('/feeds/:feed_sqid/subscribe', async (c) => {
	if (!c.get('USER_ID')) return c.redirect('/login');
	const userId = c.get('USER_ID');
	const feedSqid = c.req.param('feed_sqid')
	const feedId = sqidToId(feedSqid);
	let result

	try {
		result = await c.env.DB.prepare("INSERT INTO subscriptions (user_id, feed_id) values (?, ?)").bind(userId, feedId).run()
	} catch (err) {
		c.status(400);
		return c.body('bad request');
	}
	console.log(result);
	if (result.success) {
		c.status(201);
		return c.html(`
			<span id="subscription">
				<button hx-post="/feeds/${feedSqid}/unsubscribe"
			    hx-trigger="click"
			    hx-target="#subscription"
			    hx-swap="outerHTML">
			    unsubscribe
				</button>
			</span>
		`);
	}
	return c.html(`
			<span id="subscription">
				"Error"
			</span>
		`);
})

app.post('/feeds/:feed_sqid/unsubscribe', async (c) => {
	if (!c.get('USER_ID')) return c.redirect('/login');
	const userId = c.get('USER_ID');
	const feedSqid = c.req.param('feed_sqid')
	const feedId = sqidToId(feedSqid);

	try {
		await c.env.DB.prepare("DELETE FROM subscriptions WHERE user_id = ? AND feed_id = ?").bind(userId, feedId).all()
	} catch (err) {
		c.status(400);
		return c.html(`
			<span id="subscription">
				"Error"
			</span>
		`);
	}
	c.status(201);
	return c.html(`
			<span id="subscription">
				<button hx-post="/feeds/${feedSqid}/subscribe"
			    hx-trigger="click"
			    hx-target="#subscription"
			    hx-swap="outerHTML">
			    subscribe
				</button>
			</span>
		`);
})

app.get('/posts/:item_sqid', async (c) => {
	const item_id = parseInt(sqidToId(c.req.param('item_sqid'), 10), 10);
	const { results } = await c.env.DB
		.prepare(`
			SELECT items.item_id, items.title AS item_title, items.content, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.feed_id FROM items 
			JOIN feeds ON items.feed_id = feeds.feed_id 
			WHERE items.item_id = ? 
			ORDER BY items.pub_date DESC`
		)
		.bind(item_id)
		.run();

	if (results.length === 0) return c.notFound();
	const item = results[0];
	const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };

  const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)

	let list = `<h1>${item.item_title}</h1><p><time>${postDate}</time></p>`
	list += `<a href="${item.item_url}">${item.item_title}</a> / <a href="/i/${item.item_id}">read</a> </li><div class="post-content">${item.content}</div>`

	return c.html(renderHTML("All items", html`${raw(list)}`))
})

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

function idToSqid(id:number, length:number = 5): string {
	const sqids = new Sqids({minLength: length, alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',})
	return sqids.encode(id.toString().split('').map(char => parseInt(char, 10)))
}

function sqidToId(sqid:string, length:number = 5): number {
	const sqids = new Sqids({minLength: length, alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',})
	if(sqid.length != length) return 0;
	return parseInt(sqids.decode(sqid).join(), 10)
}

const LOG = (a) => console.log(a)

export default app
