import type { Context, Env } from 'hono';
import { Hono } from 'hono';
import { raw } from 'hono/html';
import { about } from './about';
import {
    handleLogin,
    handleLoginPOST,
    handleLogout,
    handleMyAccount,
    handleNewMblogPost,
    handleResentVerificationEmailPOST,
    handleResetPassword,
    handleResetPasswordPOST,
    handleSetPasswordPOST,
    handleSignup,
    handleSignupPOST,
    handleVerifyEmail,
} from './account';
import { handleAdmin, handleAdminItemsWithoutSqid, handleAdminUnvectorizedItems } from './admin';
import { handleGenerateRelated, handleVectorize, vectorizeAndStoreItem } from './ai';
import type { Bindings } from './bindings';
import { changelog } from './changelog';
import { handleFeedback, handleSuggestBlog } from './feedback';
import {
    handleBlogs,
    handleBlogsNew,
    handleBlogsNewPOST,
    handleBlogsSingle,
    handleFeedsCacheRebuild,
    handleFeedsDelete,
    handleFeedsGlobalCacheRebuild,
    handleFeedsGlobalIndex,
    handleFeedsIndexing,
    handleFeedsScrape,
    handleFeedsSubscribe,
    handleFeedsUnsubscribe,
    handleFeedsUpdate,
    regenerateTopItemsCacheForFeed,
    updateFeed,
} from './feeds';
import { renderHTML } from './htmltools';
import type { MFQueueMessage } from './interface';
import {
    handleGlobal,
    handleItemsAddItemByUrlPOST,
    handleItemsAddItembyUrl,
    handleItemsAddToFavorites,
    handleItemsDelete,
    handleItemsIndexing,
    handleItemsLists,
    handleItemsListsAddPOST,
    handleItemsListsNewForm,
    handleItemsListsNewPOST,
    handleItemsListsRemovePOST,
    handleItemsRemoveFromFavorites,
    handleItemsScraping,
    handleItemsSingle,
    handleMy,
    handleMyFavorites,
    handleMyFriendfeed,
    handleMySubscriptions,
    regenerateRelatedCacheForItem,
} from './items';
import { handleLists, handleListsSingle, handleListsSingleDeletePOST } from './lists';
import {
    handleBlogItemEditPOST,
    handleMblog,
    handleMblogDeletePOST,
    handleMblogEditItem,
    handleMblogItemSingle,
    handleMblogPOST,
    handleMblogRss,
} from './mblogs';
import {
    adminRequiredMiddleware,
    authCheckMiddleware,
    authRequiredMiddleware,
    subdomainMiddleware,
} from './middlewares';
import {
    enqueueRegenerateAllItemsRelatedCache,
    enqueueScrapeAllItemsOfFeed,
    enqueueUpdateAllFeeds,
    enqueueVectorizeStoreAllItems,
} from './queue';
import { scrapeItem } from './scrape';
import { handleSearch, updateFeedIndex, updateItemIndex } from './search';
import { handleUsers, handleUsersFollowPOST, handleUsersSingle, handleUsersUnfollowPOST } from './users';

// ///////////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////////////
// /////////////////////////////////////////////////////////////////
// ————————————————————————————————————————————————————————————————>>>>
// \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
// \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
// \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

// main app handles the root paths
const app = new Hono<{ Bindings: Bindings }>({
    strict: false,
});

app.get('/robots.txt', async (c) => c.text('User-agent: *\nAllow: /'));

app.use('*', authCheckMiddleware);
// all routes below this line require authentication
app.use('/my/*', authRequiredMiddleware);
app.use('/feeds/:feed_sqid/subscribe', authRequiredMiddleware);
app.use('/feeds/:feed_sqid/unsubscribe', authRequiredMiddleware);
app.use('/items/:feed_sqid/favorite', authRequiredMiddleware);
app.use('/items/:feed_sqid/unfavorite', authRequiredMiddleware);

app.use('/items/:item_sqid/lists', authCheckMiddleware);
app.use('/items/:item_sqid/lists/new', authCheckMiddleware);
app.use('/items/:item_sqid/lists/:list_sqid/add', authCheckMiddleware);
app.use('/items/:item_sqid/lists/:list_sqid/remove', authCheckMiddleware);

// all routes below this line require admin privileges
app.use('/my/account/create_mblog', adminRequiredMiddleware);
app.use('/blogs/:feed_sqid/new', adminRequiredMiddleware);
app.use('/blogs/:feed_sqid/new', adminRequiredMiddleware);
app.use('/feeds/:feed_sqid/delete', adminRequiredMiddleware);
app.use('/feeds/:feed_sqid/update', adminRequiredMiddleware);
app.use('/feeds/:feed_sqid/scrape', adminRequiredMiddleware);
app.use('/feeds/:feed_sqid/index', adminRequiredMiddleware);
app.use('/feeds/:feed_sqid/rebuild_cache', adminRequiredMiddleware);
app.use('/feeds/index', adminRequiredMiddleware);
app.use('/feeds/rebuild_cache', adminRequiredMiddleware);

app.use('/items/:item_sqid/scrape', adminRequiredMiddleware);
app.use('/items/:item_sqid/index', adminRequiredMiddleware);
app.use('/items/:item_sqid/delete', adminRequiredMiddleware);

app.use('/admin', adminRequiredMiddleware);
app.use('/admin/*', adminRequiredMiddleware);

const handleNotFound = (c: Context) => {
    return c.html(renderHTML('404 | minifeed', raw(`<div class="flash">Page not found.</div>`), c.get('USERNAME')));
};

const handleError = (err: Error, c: Context) => {
    return c.html(renderHTML('Error | minifeed', raw(`<div class="flash flash-red">${err}.</div>`), c.get('USERNAME')));
};

app.notFound(handleNotFound);
app.onError(handleError);

// APP ROUTES
app.get('/', (c: Context) => {
    if (!c.get('USER_ID')) return c.redirect('/global');
    return c.redirect('/my');
});

app.get('/admin', handleAdmin);
app.get('/admin/unvectorized_items', handleAdminUnvectorizedItems);
app.get('/admin/items_without_sqid', handleAdminItemsWithoutSqid);
app.get('/admin/vectorize', handleVectorize);
app.get('/admin/generate_related', handleGenerateRelated);
app.get('/search', handleSearch);
app.get('/global/:listingType?', handleGlobal);
app.get('/feedback', handleFeedback);
app.get('/suggest', handleSuggestBlog);

app.get('/login', handleLogin);
app.get('/reset_password', handleResetPassword);
app.post('/reset_password', handleResetPasswordPOST);
app.post('/set_password', handleSetPasswordPOST);
app.get('/signup', handleSignup);
app.post('/login', handleLoginPOST);
app.post('/signup', handleSignupPOST);
app.get('/logout', handleLogout);

app.get('/my', handleMy);
app.get('/my/subscriptions', handleMySubscriptions);
app.get('/my/friendfeed', handleMyFriendfeed);
app.get('/my/favorites', handleMyFavorites);
app.get('/my/account', handleMyAccount);
app.post('/my/account/create_mblog', handleNewMblogPost);
app.post('/my/account/resend_verification_link', handleResentVerificationEmailPOST);
app.get('/verify_email', handleVerifyEmail);

app.post('/items/:item_sqid/delete', handleItemsDelete);

app.get('/blogs/:listingType?', handleBlogs);
app.get('/blogs/new', handleBlogsNew);
app.post('/blogs/new', handleBlogsNewPOST);
app.get('/blogs/:feed_sqid/new', handleItemsAddItembyUrl);
app.post('/blogs/:feed_sqid/new', handleItemsAddItemByUrlPOST);

app.get('/blogs/:feed_sqid', handleBlogsSingle);
app.post('/feeds/:feed_sqid/subscribe', handleFeedsSubscribe);
app.post('/feeds/:feed_sqid/unsubscribe', handleFeedsUnsubscribe);

app.post('/feeds/:feed_sqid/delete', handleFeedsDelete);
app.post('/feeds/:feed_sqid/update', handleFeedsUpdate);
app.post('/feeds/:feed_sqid/scrape', handleFeedsScrape);
app.post('/feeds/:feed_sqid/index', handleFeedsIndexing);
app.post('/feeds/:feed_sqid/rebuild_cache', handleFeedsCacheRebuild);
app.post('/feeds/index', handleFeedsGlobalIndex);
app.post('/feeds/rebuild_cache', handleFeedsGlobalCacheRebuild);

app.get('/podcasts', (c: Context) => {
    return c.html(renderHTML('Podcasts | minifeed', raw('Coming soon'), c.get('USERNAME'), 'podcasts'));
});
app.get('/channels', (c: Context) => {
    return c.html(renderHTML('Channels | minifeed', raw('Coming soon'), c.get('USERNAME'), 'channels'));
});

app.get('/items/:item_sqid', handleItemsSingle);
app.get('/items/:item_sqid/lists', handleItemsLists);
app.get('/items/:item_sqid/lists/new', handleItemsListsNewForm);
app.post('/items/:item_sqid/lists', handleItemsListsNewPOST);
app.post('/items/:item_sqid/lists/:list_sqid/add', handleItemsListsAddPOST);
app.post('/items/:item_sqid/lists/:list_sqid/remove', handleItemsListsRemovePOST);

app.post('/items/:item_sqid/favorite', handleItemsAddToFavorites);
app.post('/items/:item_sqid/unfavorite', handleItemsRemoveFromFavorites);
app.post('/items/:item_sqid/scrape', handleItemsScraping);
app.post('/items/:item_sqid/index', handleItemsIndexing);

app.get('/lists', handleLists);
app.get('/lists/:list_sqid', handleListsSingle);
app.post('/lists/:list_sqid/delete', handleListsSingleDeletePOST);

app.get('/users', handleUsers);
app.get('/users/:username', handleUsersSingle);
app.post('/users/:username/follow', handleUsersFollowPOST);
app.post('/users/:username/unfollow', handleUsersUnfollowPOST);

app.get('/about', async (c: Context) => c.html(renderHTML('About | minifeed', raw(about), c.get('USERNAME'))));
app.get('/about/changelog', async (c: Context) =>
    c.html(renderHTML('Changelog | minifeed', raw(changelog), c.get('USERNAME'))),
);

const subdomainApp = new Hono<{ Bindings: Bindings }>({
    strict: false,
});
subdomainApp.use('*', authCheckMiddleware);
subdomainApp.use('*', subdomainMiddleware);

subdomainApp.get('/', handleMblog);
subdomainApp.post('/', handleMblogPOST);

subdomainApp.get('/rss', handleMblogRss);
subdomainApp.get('/:post_slug', handleMblogItemSingle);
subdomainApp.get('/:post_slug/edit', handleMblogEditItem);
subdomainApp.post('/:post_slug/edit', handleBlogItemEditPOST);
subdomainApp.post('/:post_slug/delete', handleMblogDeletePOST);

subdomainApp.notFound(handleNotFound);
subdomainApp.onError(handleError);
subdomainApp.get('/robots.txt', async (c) => c.text('User-agent: *\nAllow: /'));

// Main app to route based on Host
const appMain = new Hono<{ Bindings: Bindings }>({
    strict: false,
});

appMain.all('*', async (c: Context, next) => {
    const host = c.req.raw.headers.get('host'); // Cloudflare Workers use lowercase 'host'
    if (host) {
        if (host.split('.').length === 3) {
            // if subdomain is in the form of sub.example.com
            return await subdomainApp.fetch(c.req.raw, c.env);
        }
        // Default to root app for the main domain (example.com)
        return await app.fetch(c.req.raw, c.env);
    }
    return await app.fetch(c.req.raw, c.env);
});

// MAIN EXPORT
export default {
    fetch: (req: Request, env: Env, ctx: ExecutionContext) => appMain.fetch(req, env, ctx), // normal processing of requests

    async queue(batch: MessageBatch<MFQueueMessage>, env: Bindings) {
        // consumer of queue FEED_UPDATE_QUEUE
        for (const message of batch.messages) {
            switch (message.body.type) {
                case 'feed_update':
                    if (message.body.feed_id) {
                        try {
                            await updateFeed(env, message.body.feed_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error updating feed ${message.body.feed_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'feed_scrape':
                    if (message.body.feed_id) {
                        try {
                            await enqueueScrapeAllItemsOfFeed(env, message.body.feed_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error scraping feed ${message.body.feed_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'item_scrape':
                    if (message.body.item_id) {
                        try {
                            await scrapeItem(env, message.body.item_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error scraping item ${message.body.item_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'item_index':
                    if (message.body.item_id) {
                        try {
                            await updateItemIndex(env, message.body.item_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error indexing item ${message.body.item_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'feed_index':
                    if (message.body.feed_id) {
                        try {
                            await updateFeedIndex(env, message.body.feed_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error indexing feed ${message.body.feed_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'feed_update_top_items_cache':
                    if (message.body.feed_id) {
                        try {
                            await regenerateTopItemsCacheForFeed(env, message.body.feed_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error regenerating top items cache for feed ${message.body.feed_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'item_update_related_cache':
                    if (message.body.item_id) {
                        try {
                            await regenerateRelatedCacheForItem(env, message.body.item_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error regenerating related items cache for item ${message.body.item_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;

                case 'item_vectorize_store':
                    if (message.body.item_id) {
                        try {
                            await vectorizeAndStoreItem(env, message.body.item_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error vectorizing and storing item ${message.body.item_id}: ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    }
                    break;
            }
        }
    },

    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        // update feeds
        await enqueueUpdateAllFeeds(env);
        // vectorize
        await enqueueVectorizeStoreAllItems(env);
        // generate related items cache
        await enqueueRegenerateAllItemsRelatedCache(env);
    },
};
