import { Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { html, raw } from 'hono/html'
import { XMLParser } from 'fast-xml-parser'
import { renderAddFeedForm, renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers'
import { getRssUrlsFromHtmlBody } from 'rss-url-finder'
import { extract } from '@extractus/feed-extractor'

import { itemsAll, itemsMy, itemsMySubs, itemsMyFollows, itemsSingle } from './items'
import { feedsAll, feedsSingle, feedsSubscribe, feedsUnsubscribe } from './feeds'
import { usersAll, usersSingle, usersFollow, usersUnfollow } from './users'
import { idToSqid } from './utils'

type Bindings = {
	DB: D1Database;
	FEED_UPDATE_QUEUE: Queue;
}

const app = new Hono<{ Bindings: Bindings }>()

async function authMiddleware(c: Context<any, any, {}>, next: () => any) {
	const userToken = getCookie(c, 'minifeed_user_token')
	if (userToken) {
		const { results } = await c.env.DB.prepare("SELECT * FROM users WHERE token = ?")
			.bind(userToken).all()
		if (results.length) {
			c.set('USER_ID', results[0]['user_id'])
		}
	}
	await next()
}

app.use('*', authMiddleware)
app.get('/static/*', serveStatic({ root: './' }))

// APP ROUTES
app.get('/', (c) => {return c.redirect('/all', 301) })
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

app.get('/test', async (c) => {
	if (!c.get('USER_ID')) return c.redirect('/login')
	// await fetchAllFeeds(c.env)
	return c.text('ok')
})

app.get('/c/f/add', async (c) => {
	if (!c.get('USER_ID')) return c.redirect('/login')
	return c.html(renderHTML("Add new feed", html`${raw(renderAddFeedForm())}`))
});

app.post('/c/f/add', async (c) => {
	const body = await c.req.parseBody();
	const url = body['url'].toString();
	let rssUrl;
	try {
		rssUrl = await addFeed(c, url)
	} catch (e) {
		return c.html(renderHTML("Add new feed", html`${raw(renderAddFeedForm(url, e.toString()))}`))
	}
	if (rssUrl) {
		const feedId = await getFeedIdByRSSUrl(c, rssUrl)
		await c.env.FEED_UPDATE_QUEUE.send(feedId);
		const sqid = idToSqid(feedId)
		return c.redirect(`/feeds/${sqid}`, 301)
	}
	return c.text("Something went wrong")
});


// INTERNAL FUNCTIONS
async function getRSSLinkFromUrl(url:string) {
	let req;
	try {
		req = await fetch(url);
	} catch (err) {
		throw new Error(`Cannot fetch url: ${url}`)
	}
	const pageContent = await req.text();
	
	if (!pageContent.length) throw new Error(`Empty content at url: ${url}`)

	// the content of the page is HTML, try to find RSS link
	if (pageContent.includes('<html') || pageContent.includes('<!DOCTYPE html>')) {
		const rssUrlObj = getRssUrlsFromHtmlBody(pageContent)
		if (!rssUrlObj.length || !rssUrlObj[0]['url']) throw new Error(`Cannot find RSS link in HTML of URL: ${url}`)
		let foundRSSLink = rssUrlObj[0]['url']
		// the found rss link may be relative or absolute; handle both cases here
		if (foundRSSLink.substring(0, 4) != "http") {
			if (url.substring(url.length - 1) != "/") foundRSSLink = url + '/' + foundRSSLink;
			else foundRSSLink = url + foundRSSLink;
		}
		return foundRSSLink
	}

	// otherwise assume the url is direct RSS url, so just return it
	return url
}

async function getFeedIdByRSSUrl(c: Context, rssUrl: string) {
	const { results } = await c.env.DB.prepare("SELECT feed_id FROM feeds where rss_url = ?").bind(rssUrl).all()
	return results[0]['feed_id']
}

async function addFeed(c, url:string) {
	let req;
	let rssUrl = await getRSSLinkFromUrl(url)
	const r = await extract(rssUrl)

	// if url === rssUrl that means the submitted URL was feed URL, so retrieve site URL from feed; otherwise use submitted URL as site URL
	const siteUrl = (url === rssUrl) ? r.link : url

	const dbQueryResult = await c.env.DB.prepare("INSERT INTO feeds (title, url, rss_url) values (?, ?, ?)").bind(r.title, siteUrl, rssUrl).all()

	if (dbQueryResult['success'] === true) {
		// if (r.entries) {
		// 	const feedId = await getFeedIdByRSSUrl(c, rssUrl)
		// 	addItemsToFeed(c.env, r.entries, feedId)
		// }
		const feedId = await getFeedIdByRSSUrl(c, rssUrl)
		// await c.env.FEED_UPDATE_QUEUE.send(feedId);
		return rssUrl
	}
	return
}

async function fetchAllFeeds(env:Bindings) {
	const { results: feeds } = await env.DB.prepare("SELECT feed_id, rss_url FROM feeds").all();
	for (const feed of feeds) {
		console.log(`Initiating feed update job for feed: ${feed['feed_id']} (${feed['rss_url']})`)
		await env.FEED_UPDATE_QUEUE.send(feed['feed_id']);
	}
}

async function fetchFeed(env:Bindings, feedId: Number) {
	const parser = new XMLParser();

	// get RSS url of feed
	const { results: feeds } = await env.DB.prepare("SELECT * FROM feeds WHERE feed_id = ?").bind(feedId).all();
	const rssURL = feeds[0]['rss_url']

	// fetch RSS content
	const r = await extract(rssURL)

	// get URLs of existing items from DB
	const { results: existingItems } = await env.DB.prepare( "SELECT url FROM items WHERE feed_id = ?").bind(feedId).all();
	const existingUrls = existingItems.map(obj => obj.url);

	// if RSS entries exist
	if (r.entries) {
		// filter out existing ones
		const newItemsToBeAdded = r.entries.filter(entry => !existingUrls.includes(entry.link));
		if (newItemsToBeAdded.length) await addItemsToFeed(env, newItemsToBeAdded, feedId)
		console.log(`Updated feed ${feedId} (${rssURL}), fetched items: ${r.entries.length}, of which new items added: ${newItemsToBeAdded.length}`)
		return
	}
	console.log(`Updated feed ${feedId} (${rssURL}), no items fetched`)
}

async function addItemsToFeed(env:Bindings, items:Array<any>, feedId: Number) {
	if (!items.length) return
	const stmt = env.DB.prepare("INSERT INTO items (feed_id, title, url, pub_date, content) values (?, ?, ?, ?, ?)");
	let binds: any[] = [];
	items.forEach((item: any) => {
		binds.push(stmt.bind(feedId, item.title, item.link, item.published, item.description));
	});
	await env.DB.batch(binds);
}


// MAIN EXPORT
export default {
  fetch: app.fetch,

  // consumer of queue
  async queue(batch: MessageBatch<any>, env: Bindings) {
    let messages = JSON.stringify(batch.messages);
    console.log(`Started processing job: ${messages}`);

    for (const message of batch.messages) {
      const feedId = message.body;
	    await fetchFeed(env, feedId)
    }

  },

  // cron
  async scheduled(event: any, env: Bindings, ctx: any) {
    await fetchAllFeeds(env)
  },
};
