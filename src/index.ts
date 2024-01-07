import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { renderAddFeedForm, renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers'
import { extract } from '@extractus/feed-extractor'
import { stripTags } from 'bellajs'

import { itemsAll, itemsMy, itemsMySubs, itemsMyFollows, itemsSingle, itemsDelete } from './items'
import { feedsAll, feedsSingle, feedsSubscribe, feedsUnsubscribe } from './feeds'
import { usersAll, usersSingle, usersFollow, usersUnfollow } from './users'
import { loginOrCreateAccount, loginPost, accountMy, logout, signupPost } from './account'
import { indexMultipleDocuments, search } from './search'
import { absolitifyImageUrls, feedIdToSqid, getFeedIdByRSSUrl, getRSSLinkFromUrl, getText, idToSqid } from './utils'
import { adminMiddleware, authMiddleware, userPageMiddleware } from './middlewares';

type Bindings = {
	DB: D1Database;
	FEED_UPDATE_QUEUE: Queue;
}

const app = new Hono<{ Bindings: Bindings }>()

// static files
app.get('/static/*', serveStatic({ root: './' }))

// middlewares
app.use('*', authMiddleware); 
app.use('/my/*', userPageMiddleware); 
app.use('/feeds/:feed_sqid/delete', adminMiddleware)

// APP ROUTES
app.get('/', (c) => {
	if (!c.get('USER_ID')) return c.redirect('/all');
	return c.redirect('/my')
})
app.get('/search', search)
app.get('/all', itemsAll) // all posts

app.get('/login', loginOrCreateAccount);
app.get('/logout', logout);
app.post('/signup', signupPost);
app.post('/login', loginPost);

app.get('/my', itemsMy)
app.get('/my/account', accountMy)
app.get('/my/subs', itemsMySubs)
app.get('/my/follows', itemsMyFollows)

app.get('/feeds', feedsAll)
app.get('/feeds/:feed_sqid', feedsSingle)
app.post('/feeds/:feed_sqid/subscribe', feedsSubscribe)
app.post('/feeds/:feed_sqid/unsubscribe', feedsUnsubscribe)
app.post('/feeds/:feed_sqid/delete', itemsDelete)

app.get('/users', usersAll)
app.get('/users/:username', usersSingle)
app.post('/users/:username/follow', usersFollow)
app.post('/users/:username/unfollow', usersUnfollow)

app.get('/items/:item_sqid', itemsSingle)

app.get('/c/f/add', async (c) => {
	if (!c.get('USER_ID')) return c.redirect('/login')
	return c.html(renderHTML("Add new feed", html`${raw(renderAddFeedForm())}`))
});

app.post('/c/f/add', async (c) => {
	const body = await c.req.parseBody();
	const url = body['url'].toString();
	let rssUrl;
	try {
		rssUrl = await addFeed(c, url); 
	} catch (e: any) {
		return c.html(renderHTML("Add new feed", html`${raw(renderAddFeedForm(url, e.toString()))}`))
	}

	// RSS url is found
	if (rssUrl) {
		const feedId = await getFeedIdByRSSUrl(c, rssUrl)
		// await c.env.FEED_UPDATE_QUEUE.send(feedId); 
		const sqid = feedIdToSqid(feedId)
		return c.redirect(`/feeds/${sqid}`, 301)
	}
	return c.text("Something went wrong")
});


// INTERNAL FUNCTIONS
// add new feed to DB
async function addFeed(c, url: string) {
	let rssUrl = await getRSSLinkFromUrl(url);
	const r = await extract(rssUrl, {
		descriptionMaxLen: 0,
		getExtraEntryFields: (feedEntry) => {
			const { 
				// this is plaintext of description, which may come from anything
				description: content_from_description,
				
				// if both description and content present, `description` is taken from description and we lose content, so here we save it
				// also, content is for ATOM format
				content: content_from_content, 

				// this is for RSS format and RDF format
				"content:encoded": content_from_content_encoded, 
				
				// for JSON format
				content_html: content_from_content_html,

			} = feedEntry
			return {
				content_from_description, content_from_content_encoded, content_from_content, content_from_content_html
			}
		}
	});

	// if url === rssUrl that means the submitted URL was feed URL, so retrieve site URL from feed; otherwise use submitted URL as site URL
	const siteUrl = (url === rssUrl) ? r.link : url

	const dbQueryResult = await c.env.DB.prepare("INSERT INTO feeds (title, url, rss_url) values (?, ?, ?)").bind(r.title, siteUrl, rssUrl).all()

	if (dbQueryResult['success'] === true) {
		if (r.entries) {
			const feedId = await getFeedIdByRSSUrl(c, rssUrl)
			await addItemsToFeed(c.env, r.entries, feedId)
		}
		return rssUrl
	}
	return
}

async function updateAllFeeds(env: Bindings) {
	const { results: feeds } = await env.DB.prepare("SELECT feed_id, rss_url FROM feeds").all();
	for (const feed of feeds) {
		console.log(`Initiating feed update job for feed: ${feed['feed_id']} (${feed['rss_url']})`)
		await env.FEED_UPDATE_QUEUE.send(feed['feed_id']);
	}
}

async function updateFeed(env: Bindings, feedId: Number) {
	// get RSS url of feed
	const { results: feeds } = await env.DB.prepare("SELECT * FROM feeds WHERE feed_id = ?").bind(feedId).all();
	const rssURL = feeds[0]['rss_url'];

	// fetch RSS content
	const r = await extract(rssURL, {
		descriptionMaxLen: 0
	});

	// get URLs of existing items from DB
	const { results: existingItems } = await env.DB.prepare("SELECT url FROM items WHERE feed_id = ?").bind(feedId).all();
	const existingUrls = existingItems.map(obj => obj.url);

	// if remote RSS entries exist
	if (r.entries) {
		// filter out existing ones and add them to Db
		const newItemsToBeAdded = r.entries.filter(entry => !existingUrls.includes(entry.link));
		if (newItemsToBeAdded.length) await addItemsToFeed(env, newItemsToBeAdded, feedId)
		console.log(`Updated feed ${feedId} (${rssURL}), fetched items: ${r.entries.length}, of which new items added: ${newItemsToBeAdded.length}`)
		return
	}
	console.log(`Updated feed ${feedId} (${rssURL}), no items fetched`)
}

async function addItemsToFeed(env: Bindings, items: Array<any>, feedId: Number) {
	if (!items.length) return

	// get feed title
	const { results: feeds } = await env.DB.prepare("SELECT title FROM feeds WHERE feed_id = ?").bind(feedId).all();
	const feedTitle = feeds[0]['title'];

	const stmt = env.DB.prepare("INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)");
	let binds: any[] = [];
	
	let searchDocuments: any[] = [];
	items.forEach((item: any) => {
		const link = item.link || item.guid || item.id;
		let content_html = 
			item['content_from_content'] || 
			item['content_from_content_encoded'] || 
			item['content_from_description'] || 
			item['content_from_content_html'] || '';
		content_html = getText(content_html);
		content_html = absolitifyImageUrls(content_html, item.link);

		searchDocuments.push({
			'title': item.title,
			'content': stripTags(content_html),
			'type': 'blog',
			// non-searchable fields
			'url': link,
			'pub_date': item.published,
			'feed_id': feedId,
			'feed_title': feedTitle
		})
		binds.push(stmt.bind(feedId, item.title, link, item.published, item.description, content_html));
	});

	const resultsOfInsertion = await env.DB.batch(binds);
	let searchDocumentsWalker = 0;
	resultsOfInsertion.forEach((result: any) => {
		if (result['success']) {
			// add last_row_id to each item in searchDocuments as item_id
			searchDocuments[searchDocumentsWalker]['item_id'] = result['meta']['last_row_id'];
			searchDocumentsWalker += 1
		} 
	});
	await indexMultipleDocuments(searchDocuments)
}


// MAIN EXPORT
export default {
	fetch: app.fetch,

	// consumer of queue FEED_UPDATE_QUEUE
	async queue(batch: MessageBatch<any>, env: Bindings) {
		let messages = JSON.stringify(batch.messages);
		console.log(`Started processing job: ${messages}`);

		for (const message of batch.messages) {
			const feedId = message.body; // feedId is the body of the message
			await updateFeed(env, feedId)
		}

	},

	// cron
	async scheduled(event: any, env: Bindings, ctx: any) {
		await updateAllFeeds(env)
	},
};