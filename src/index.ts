import { Hono } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers';
import { globalFeedHandler, myItemsHandler, mySubscriptionsHandler, myFollowsHandler, itemsSingleHandler, itemsAddToFavoritesHandler, itemsRemoveFromFavoritesHandler, itemsScrapeHandler, myFavoritesHandler } from './items';
import { blogsSingleHandler, feedsSubscribeHandler, feedsUnsubscribeHandler, feedsDeleteHandler, enqueueFeedsUpdate, enqueueFeedsScrape, blogsNewHandler, blogsNewPostHandler, updateFeed, blogsHandler } from './feeds';
import { usersHandler, usersSingleHandler, usersFollowPostHandler, usersUnfollowPostHandler } from './users';
import { loginHandler, loginPostHandler, myAccountHandler, logoutHandler, signupPostHandler } from './account';
import { searchHandler } from './search';
import { adminMiddleware, authMiddleware, userPageMiddleware } from './middlewares';
import { changelog } from './changelog';
import { Bindings } from './bindings';
import { enqueueScrapeAllItemsOfFeed, enqueueUpdateAllFeeds } from './queue';
import { scrapeAndIndex } from './scrape';
import { feedbackHandler } from './feedback';

const app = new Hono<{ Bindings: Bindings }>()

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
app.use('/items/:item_sqid/scrape', adminMiddleware);

// APP ROUTES
app.get('/', (c) => {
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

app.get('/blogs', blogsHandler)
app.get('/blogs/new', blogsNewHandler)
app.post('/blogs/new', blogsNewPostHandler)

app.get('/blogs/:feed_sqid', blogsSingleHandler)
app.post('/feeds/:feed_sqid/subscribe', feedsSubscribeHandler)
app.post('/feeds/:feed_sqid/unsubscribe', feedsUnsubscribeHandler)
app.post('/feeds/:feed_sqid/delete', feedsDeleteHandler)
app.post('/feeds/:feed_sqid/update', enqueueFeedsUpdate)
app.post('/feeds/:feed_sqid/scrape', enqueueFeedsScrape)

app.get('/podcasts', (c) => {
    return c.html(renderHTML("Podcasts | minifeed", raw("Coming soon"), c.get('USERNAME'), 'podcasts'));
});

app.get('/channels', (c) => {
    return c.html(renderHTML("Channels | minifeed", raw("Coming soon"), c.get('USERNAME'), 'channels'));
});

app.get('/items/:item_sqid', itemsSingleHandler)
app.post('/items/:item_sqid/favorite', itemsAddToFavoritesHandler)
app.post('/items/:item_sqid/unfavorite', itemsRemoveFromFavoritesHandler)
app.post('/items/:item_sqid/scrape', itemsScrapeHandler)

app.get('/users', usersHandler)
app.get('/users/:username', usersSingleHandler)
app.post('/users/:username/follow', usersFollowPostHandler)
app.post('/users/:username/unfollow', usersUnfollowPostHandler)

app.get('/about/changelog', async (c) => c.html(renderHTML("Changelog | minifeed", raw(changelog))));

// MAIN EXPORT
export default {
    fetch: app.fetch,  // normal processing of requests

    async queue(batch: MessageBatch<any>, env: Bindings) { // consumer of queue FEED_UPDATE_QUEUE
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
                    await scrapeAndIndex(env, item_id);
                } catch (e: any) {
                    console.log(`Error scraping item ${item_id}: ${e.toString()}`);
                }
            }
        }
    },

    async scheduled(event: any, env: Bindings, ctx: any) { // cron
        await enqueueUpdateAllFeeds(env)
    },
};