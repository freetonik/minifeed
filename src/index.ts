import { Hono } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers';
import { globalFeedHandler, myItemsHandler, mySubscriptionsHandler, myFollowsHandler, itemsSingleHandler, itemsAddToFavoritesHandler, itemsRemoveFromFavoritesHandler, itemsScrapeHandler, myFavoritesHandler, itemsIndexHandler, recordAllItemSqidsHandler, recordAllBlogSqidsHandler } from './items';
import { blogsSingleHandler, feedsSubscribeHandler, feedsUnsubscribeHandler, feedsDeleteHandler, feedsUpdateHandler, feedsScrapeHandler, blogsNewHandler, blogsNewPostHandler, updateFeed, blogsHandler, feedsIndexHandler } from './feeds';
import { usersHandler, usersSingleHandler, usersFollowPostHandler, usersUnfollowPostHandler } from './users';
import { loginHandler, loginPostHandler, myAccountHandler, logoutHandler, signupPostHandler, myAccountVerifyEmailHandler } from './account';
import { searchHandler, updateFeedIndex, updateItemIndex, upsertSingleDocument } from './search';
import { adminMiddleware, authMiddleware, userPageMiddleware } from './middlewares';
import { changelog } from './changelog';
import { Bindings } from './bindings';
import { enqueueScrapeAllItemsOfFeed, enqueueUpdateAllFeeds } from './queue';
import { scrapeItem } from './scrape';
import { feedbackHandler } from './feedback';

const app = new Hono<{ Bindings: Bindings }>({strict: false})


app.get('/static/*', serveStatic({ root: './' }))
app.get('/robots.txt', async (c) => c.text("User-agent: *\nAllow: /"))
app.get('/favicon.ico', async (c) => c.redirect('/static/favicons/favicon.ico'))

app.use('*', authMiddleware); 
// all routes below this line require authentication
app.use('/my/*', userPageMiddleware); 
app.use('/feeds/:feed_sqid/subscribe', userPageMiddleware);
app.use('/feeds/:feed_sqid/unsubscribe', userPageMiddleware);
app.use('/items/:feed_sqid/favorite', userPageMiddleware);
app.use('/items/:feed_sqid/unfavorite', userPageMiddleware);

// all routes below this line require admin privileges
app.use('/feeds/:feed_sqid/delete', adminMiddleware);
app.use('/feeds/:feed_sqid/update', adminMiddleware);
app.use('/feeds/:feed_sqid/scrape', adminMiddleware);
app.use('/feeds/:feed_sqid/index', adminMiddleware);

app.use('/items/:item_sqid/scrape', adminMiddleware);
app.use('/items/:item_sqid/index', adminMiddleware);
app.use('/items/record_all_sqids', adminMiddleware);
app.use('/blogs/record_all_sqids', adminMiddleware);

app.notFound((c) => {
    return c.html(renderHTML("404 | minifeed",  raw(`<div class="flash flash-blue">Page not found.</div>`), c.get('USERNAME')));
})

app.onError((err, c) => {
    return c.html(renderHTML("Error | minifeed",  raw(`<div class="flash flash-red">ERROR: ${err}.</div>`), c.get('USERNAME')));
})

// APP ROUTES
app.get('/', (c: any) => {
    if (!c.get('USER_ID')) return c.redirect('/global');
    return c.redirect('/my')
})
app.get('/search', searchHandler)
app.get('/global', globalFeedHandler)
app.get('/feedback', feedbackHandler)

app.get('/login', loginHandler);
app.get('/logout', logoutHandler);
app.post('/signup', signupPostHandler);
app.post('/login', loginPostHandler);

app.get('/my', myItemsHandler)
app.get('/my/subscriptions', mySubscriptionsHandler)
app.get('/my/friendfeed', myFollowsHandler)
app.get('/my/favorites', myFavoritesHandler)
app.get('/my/account', myAccountHandler)
app.get('/verify_email', myAccountVerifyEmailHandler)

app.get('/blogs', blogsHandler)
app.get('/blogs/new', blogsNewHandler)
app.post('/blogs/new', blogsNewPostHandler)
app.get('/blogs/record_all_sqids', recordAllBlogSqidsHandler)
app.get('/blogs/:feed_sqid', blogsSingleHandler)
app.post('/feeds/:feed_sqid/subscribe', feedsSubscribeHandler)
app.post('/feeds/:feed_sqid/unsubscribe', feedsUnsubscribeHandler)
app.post('/feeds/:feed_sqid/delete', feedsDeleteHandler)
app.post('/feeds/:feed_sqid/update', feedsUpdateHandler)
app.post('/feeds/:feed_sqid/scrape', feedsScrapeHandler)
app.post('/feeds/:feed_sqid/index', feedsIndexHandler)

app.get('/podcasts', (c: any) => {
    return c.html(renderHTML("Podcasts | minifeed", raw("Coming soon"), c.get('USERNAME'), 'podcasts'));
});

app.get('/channels', (c: any) => {
    return c.html(renderHTML("Channels | minifeed", raw("Coming soon"), c.get('USERNAME'), 'channels'));
});
app.get('/items/record_all_sqids', recordAllItemSqidsHandler)

app.get('/items/:item_sqid', itemsSingleHandler)
app.post('/items/:item_sqid/favorite', itemsAddToFavoritesHandler)
app.post('/items/:item_sqid/unfavorite', itemsRemoveFromFavoritesHandler)
app.post('/items/:item_sqid/scrape', itemsScrapeHandler)
app.post('/items/:item_sqid/index', itemsIndexHandler)

app.get('/users', usersHandler)
app.get('/users/:username', usersSingleHandler)
app.post('/users/:username/follow', usersFollowPostHandler)
app.post('/users/:username/unfollow', usersUnfollowPostHandler)

app.get('/about/changelog', async (c) => c.html(renderHTML("Changelog | minifeed", raw(changelog), c.get('USERNAME'))));

// MAIN EXPORT
export default {
    fetch: app.fetch,  // normal processing of requests

    async queue(batch: MessageBatch<any>, env: Bindings) { // consumer of queue FEED_UPDATE_QUEUE
        for (const message of batch.messages) {
            switch (message.body['type']) {
                case 'feed_update':
                    try { await updateFeed(env, message.body.feed_id); } 
                    catch (e: any) { console.log(`Error updating feed ${message.body.feed_id}: ${e.toString()}`); }
                    break;
                case 'feed_scrape':
                    try { await enqueueScrapeAllItemsOfFeed(env, message.body.feed_id); } 
                    catch (e: any) { console.log(`Error scraping feed ${message.body.feed_id}: ${e.toString()}`); }
                    break;
                case 'item_scrape':
                    try { await scrapeItem(env, message.body.item_id); } 
                    catch (e: any) { console.log(`Error scraping item ${message.body.item_id}: ${e.toString()}`); }
                    break;
                case 'item_index':
                    try { await updateItemIndex(env, message.body.item_id); } 
                    catch (e: any) { console.log(`Error indexing item ${message.body.item_id}: ${e.toString()}`); }
                    break;
                case 'feed_index':
                    try { await updateFeedIndex(env, message.body.feed_id); } 
                    catch (e: any) { console.log(`Error indexing feed ${message.body.feed_id}: ${e.toString()}`); }
                    break;
            }
        }
    },

    async scheduled(event: any, env: Bindings, ctx: any) { // cron
        await enqueueUpdateAllFeeds(env)
    },
};