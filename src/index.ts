import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { renderAddFeedForm, renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers'
import { extract } from '@extractus/feed-extractor'
import { stripTags } from 'bellajs'

import { itemsAll, itemsMy, itemsMySubs, itemsMyFollows, itemsSingle, itemsAddToFavorites, itemsRemoveFromFavorites, itemsScrape } from './items'
import { feedsAll, feedsSingle, feedsSubscribe, feedsUnsubscribe, feedsDelete, enqueueFeedsUpdate, enqueueFeedsScrape } from './feeds'
import { usersAll, usersSingle, usersFollow, usersUnfollow } from './users'
import { loginOrCreateAccount, loginPost, accountMy, logout, signupPost } from './account'
import { indexMultipleDocuments, search } from './search'
import { absolitifyImageUrls, feedIdToSqid, getFeedIdByRSSUrl, getRSSLinkFromUrl, getRootUrl, getText } from './utils'
import { adminMiddleware, authMiddleware, userPageMiddleware } from './middlewares';
import { changelog } from './changelog';
import { extractRSS } from './feed_extractor';

type Bindings = {
    DB: D1Database;
    FEED_UPDATE_QUEUE: Queue;

    TYPESENSE_API_KEY: string;
    TYPESENSE_API_KEY_SEARCH: string;
    TYPESENSE_ITEMS_COLLECTION: string;
    TYPESENSE_BLOGS_COLLECTION: string;
    TYPESENSE_CLUSTER: string;
    MAE_SERVICE_API_KEY: string
}


const app = new Hono<{ Bindings: Bindings }>()

// static files
app.get('/static/*', serveStatic({ root: './' }))

// middlewares
app.use('*', authMiddleware); 

app.use('/my/*', userPageMiddleware); 
app.use('/feeds/:feed_sqid/subscribe', userPageMiddleware);
app.use('/feeds/:feed_sqid/unsubscribe', userPageMiddleware);
app.use('/items/:feed_sqid/favorite', userPageMiddleware);
app.use('/items/:feed_sqid/unfavorite', userPageMiddleware);

app.use('/feeds/:feed_sqid/delete', adminMiddleware);
app.use('/feeds/:feed_sqid/update', adminMiddleware);
app.use('/feeds/:feed_sqid/scrape', adminMiddleware);
app.use('/items/:item_sqid/scrape', adminMiddleware);

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
app.get('/feeds/new', async (c) => {
    if (!c.get('USER_ID')) return c.redirect('/login')
    return c.html(renderHTML("Add new feed", html`${renderAddFeedForm()}`, c.get('USERNAME'), 'feeds'))
});
app.post('/feeds/new', async (c) => {
    const body = await c.req.parseBody();
    const url = body['url'].toString();
    let rssUrl;
    try {
        rssUrl = await addFeed(c, url); 
    } catch (e: any) {
        return c.html(renderHTML("Add new feed", html`${renderAddFeedForm(url, e.toString())}`, c.get('USERNAME'), 'feeds'))
    }

    // RSS url is found
    if (rssUrl) {
        const feedId = await getFeedIdByRSSUrl(c, rssUrl)
        const sqid = feedIdToSqid(feedId)
        return c.redirect(`/feeds/${sqid}`, 301)
    }
    return c.text("Something went wrong")
});

app.get('/feeds/:feed_sqid', feedsSingle)
app.post('/feeds/:feed_sqid/subscribe', feedsSubscribe)
app.post('/feeds/:feed_sqid/unsubscribe', feedsUnsubscribe)
app.post('/feeds/:feed_sqid/delete', feedsDelete)
app.post('/feeds/:feed_sqid/update', enqueueFeedsUpdate)
app.post('/feeds/:feed_sqid/scrape', enqueueFeedsScrape)

app.get('/items/:item_sqid', itemsSingle)
app.post('/items/:item_sqid/favorite', itemsAddToFavorites)
app.post('/items/:item_sqid/unfavorite', itemsRemoveFromFavorites)
app.post('/items/:item_sqid/scrape', itemsScrape)

app.get('/users', usersAll)
app.get('/users/:username', usersSingle)
app.post('/users/:username/follow', usersFollow)
app.post('/users/:username/unfollow', usersUnfollow)

app.get('/about/changelog', async (c) => {
    return c.html(renderHTML("Changelog | minifeed", raw(changelog)))
});


// INTERNAL FUNCTIONS
// add new feed to DB
async function addFeed(c, url: string) {
    let RSSUrl = await getRSSLinkFromUrl(url);
    const r = await extractRSS(RSSUrl);
    
    // if url === rssUrl that means the submitted URL was RSS URL, so retrieve site URL from RSS; otherwise use submitted URL as site URL
    const attemptedSiteUrl = (r.link && r.link.length > 0) ? r.link : getRootUrl(url)
    const siteUrl = (url === RSSUrl) ? attemptedSiteUrl : url
    const verified = (c.get('USER_ID') === 1) ? 1 : 0

    const dbQueryResult = await c.env.DB.prepare("INSERT INTO feeds (title, url, rss_url, verified) values (?, ?, ?, ?)").bind(r.title, siteUrl, RSSUrl, verified).all()

    if (dbQueryResult['success'] === true) {
        if (r.entries) {
            const feedId = dbQueryResult['meta']['last_row_id'];
            await c.env.FEED_UPDATE_QUEUE.send(
                {
                    'type': 'feed_update',
                    'feed_id': feedId
                }
            );
        }
        return RSSUrl
    }
}

async function updateAllFeeds(env: Bindings) {
    const { results: feeds } = await env.DB.prepare("SELECT feed_id, rss_url FROM feeds").all();
    for (const feed of feeds) {
        console.log(`Initiating feed update job for feed: ${feed['feed_id']} (${feed['rss_url']})`)
        await env.FEED_UPDATE_QUEUE.send(
            {
                'type': 'feed_update',
                'feed_id': feed['feed_id']
            }
        );
    }
}

async function updateFeed(env: Bindings, feedId: Number) {
    // get RSS url of feed
    const { results: feeds } = await env.DB.prepare("SELECT * FROM feeds WHERE feed_id = ?").bind(feedId).all();
    const RSSUrl = String(feeds[0]['rss_url']);

    // fetch RSS content
    const r = await extractRSS(RSSUrl);

    // get URLs of existing items from DB
    const { results: existingItems } = await env.DB.prepare("SELECT url FROM items WHERE feed_id = ?").bind(feedId).all();
    const existingUrls = existingItems.map(obj => obj.url);

    // if remote RSS entries exist
    if (r.entries) {
        // filter out existing ones and add them to Db
        const newItemsToBeAdded = r.entries.filter(entry => !existingUrls.includes(entry.link));
        if (newItemsToBeAdded.length) await addItemsToFeed(env, newItemsToBeAdded, feedId)
        console.log(`Updated feed ${feedId} (${RSSUrl}), fetched items: ${r.entries.length}, of which new items added: ${newItemsToBeAdded.length}`)
        return
    }
    console.log(`Updated feed ${feedId} (${RSSUrl}), no items fetched`)
}

async function scrapeItem(env: Bindings, item_id: Number) {
    // get item URL
    const { results: items } = await env.DB.prepare("SELECT url FROM items WHERE item_id = ?").bind(item_id).all();
    const item_url = String(items[0]['url']);
    console.log(`Scraping item ${item_id} (${item_url})`);
    let req;
    const maeServiceUrl = `https://mae.deno.dev/?apikey=${env.MAE_SERVICE_API_KEY}&url=${item_url}`
    try {
        req = await fetch(maeServiceUrl);
    } catch (err) {
        throw new Error(`Cannot fetch url: ${maeServiceUrl}`)
    }
    const articleInfo = await req.text();
    console.log(articleInfo)
    const content = JSON.parse(articleInfo).data.content;

    await env.DB.prepare("UPDATE items SET content_html_scraped = ? WHERE item_id = ?").bind(content, item_id).run();
}

async function enqueueScrapeAllItemsOfFeed(env: Bindings, feedId: Number) {
    const { results: items } = await env.DB.prepare("SELECT item_id, url FROM items WHERE feed_id = ?").bind(feedId).all();
    for (const item of items) {
        await env.FEED_UPDATE_QUEUE.send(
            {
                'type': 'item_scrape',
                'item_id': item['item_id']
            }
        );
    }
}

async function addItemsToFeed(env: Bindings, items: Array<any>, feedId: Number) {
    if (!items.length) return

    // get feed title
    const { results: feeds } = await env.DB.prepare("SELECT title, url FROM feeds WHERE feed_id = ?").bind(feedId).all();
    const feedTitle = feeds[0]['title'];
    const feedUrl = String(feeds[0]['url']);

    const stmt = env.DB.prepare("INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)");
    let binds: any[] = [];
    
    let searchDocuments: any[] = [];
    items.forEach((item: any) => {
        let link = item.link || item.guid || item.id;
        // if link does not start with http, it's probably a relative link, so we need to absolutify it
        if (!link.startsWith('http')) {
            link = new URL(link, feedUrl).toString();
        }
        let content_html = 
            item['content_from_content'] || 
            item['content_from_content_encoded'] || 
            item['content_from_description'] || 
            item['content_from_content_html'] || '';
        content_html = getText(content_html);
        content_html = absolitifyImageUrls(content_html, link);

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
    await indexMultipleDocuments(env, searchDocuments);
    await enqueueScrapeAllItemsOfFeed(env, feedId);
}

// MAIN EXPORT
export default {
    fetch: app.fetch,

    // consumer of queue FEED_UPDATE_QUEUE
    async queue(batch: MessageBatch<any>, env: Bindings) {
        // let messages = JSON.stringify(batch.messages);
        console.log(`Received batch of ${batch.messages.length} messages`);
        for (const message of batch.messages) {
            if (message.body['type'] == 'feed_update') {
                const feed_id = message.body.feed_id; 
                try {
                    await updateFeed(env, feed_id);
                } catch (e: any) {
                    console.log(`Error updating feed ${feed_id}: ${e.toString()}`);
                }
            } 
            else if (message.body['type'] == 'feed_scrape') {
                const feed_id = message.body.feed_id; 
                try {
                    await enqueueScrapeAllItemsOfFeed(env, feed_id);
                } catch (e: any) {
                    console.log(`Error scraping feed ${feed_id}: ${e.toString()}`);
                }
            }           
            else if (message.body['type'] == 'item_scrape') {
                const item_id = message.body.item_id; 
                try {
                    await scrapeItem(env, item_id);
                } catch (e: any) {
                    console.log(`Error scraping item ${item_id}: ${e.toString()}`);
                }
            }
            
        }
    },

    // cron
    async scheduled(event: any, env: Bindings, ctx: any) {
        await updateAllFeeds(env)
    },
};