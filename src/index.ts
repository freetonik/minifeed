import { Hono } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { serveStatic } from 'hono/cloudflare-workers';
import { globalFeed, itemsMy, itemsMySubs as itemsMySubscriptions, itemsMyFollows as itemsMyFriendfeed, itemsSingle, itemsAddToFavorites, itemsRemoveFromFavorites, itemsScrape, itemsMyFavorites } from './items';
import { blogsSingle, feedsSubscribe, feedsUnsubscribe, feedsDelete, enqueueFeedsUpdate, enqueueFeedsScrape, blogsNew, blogsNewPost, updateFeed, blogsAll } from './feeds';
import { usersAll, usersSingle, usersFollow, usersUnfollow } from './users';
import { loginOrCreateAccount, loginPost, accountMy, logout, signupPost } from './account';
import { search } from './search';
import { adminMiddleware, authMiddleware, userPageMiddleware } from './middlewares';
import { changelog } from './changelog';
import { Bindings } from './bindings';
import { enqueueScrapeAllItemsOfFeed, enqueueUpdateAllFeeds } from './queue';
import { scrapeAndIndex } from './scrape';
import { feedback } from './feedback';

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
app.get('/search', search)
app.get('/global', globalFeed)
app.get('/feedback', feedback)

app.get('/login', loginOrCreateAccount);
app.get('/logout', logout);
app.post('/signup', signupPost);
app.post('/login', loginPost);

app.get('/my', itemsMy)
app.get('/my/subscriptions', itemsMySubscriptions)
app.get('/my/friendfeed', itemsMyFriendfeed)
app.get('/my/favorites', itemsMyFavorites)
app.get('/my/account', accountMy)

app.get('/blogs', blogsAll)
app.get('/blogs/new', blogsNew)
app.post('/blogs/new', blogsNewPost)

app.get('/blogs/:feed_sqid', blogsSingle)
app.post('/feeds/:feed_sqid/subscribe', feedsSubscribe)
app.post('/feeds/:feed_sqid/unsubscribe', feedsUnsubscribe)
app.post('/feeds/:feed_sqid/delete', feedsDelete)
app.post('/feeds/:feed_sqid/update', enqueueFeedsUpdate)
app.post('/feeds/:feed_sqid/scrape', enqueueFeedsScrape)

app.get('/podcasts', (c) => {
    return c.html(renderHTML("Podcasts | minifeed", raw("Coming soon"), c.get('USERNAME'), 'podcasts'));
});

app.get('/channels', (c) => {
    return c.html(renderHTML("Channels | minifeed", raw("Coming soon"), c.get('USERNAME'), 'channels'));
});

app.get('/items/:item_sqid', itemsSingle)
app.post('/items/:item_sqid/favorite', itemsAddToFavorites)
app.post('/items/:item_sqid/unfavorite', itemsRemoveFromFavorites)
app.post('/items/:item_sqid/scrape', itemsScrape)

app.get('/users', usersAll)
app.get('/users/:username', usersSingle)
app.post('/users/:username/follow', usersFollow)
app.post('/users/:username/unfollow', usersUnfollow)

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