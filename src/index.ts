import type { Context } from 'hono';
import { Hono } from 'hono';
import { raw } from 'hono/html';
import { about } from './about';
import {
    handleLogin,
    handleLoginPOST,
    handleLogout,
    handleMyAccount,
    handleResentVerificationEmailPOST,
    handleResetPassword,
    handleResetPasswordPOST,
    handleSetPasswordPOST,
    handleSignup,
    handleSignupPOST,
    handleVerifyEmail,
} from './account';
import {
    handleAdmin,
    handleAdminItemsWithoutSqid,
    handleAdminUnindexedItems,
    handleAdminUnvectorizedItems,
} from './admin';
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
    handleFeedsItemsGlobalIndex,
    handleFeedsItemsIndexing,
    handleFeedsScrape,
    handleFeedsSubscribe,
    handleFeedsUnsubscribe,
    handleFeedsUpdate,
    regenerateTopItemsCacheForFeed,
    updateFeed,
} from './feeds';
import { handleFavicon } from './handlers/handleFavicon';
import { handleOpensearchXML } from './handlers/search/handleOpensearchXML';
import { handleSearch } from './handlers/search/handleSearch';
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
import { adminRequiredMiddleware, authCheckMiddleware, authRequiredMiddleware } from './middlewares';
import {
    enqueueRegenerateAllItemsRelatedCache,
    enqueueScrapeAllItemsOfFeed,
    enqueueUpdateAllFeeds,
    enqueueVectorizeStoreAllItems,
} from './queue';
import { scrapeItem } from './scrape';
import { updateFeedIndex, updateFeedItemsIndex, updateItemIndex } from './search';
import { handleUsers, handleUsersFollowPOST, handleUsersSingle, handleUsersUnfollowPOST } from './users';

// ————————————————————————————————————————————————————————————————>>>>

// main app handles the root paths
const app = new Hono<{ Bindings: Bindings }>({
    strict: false,
});

app.get('/robots.txt', async (c) => c.text('User-agent: *\nAllow: /'));

app.use('*', authCheckMiddleware);
// all routes below this line require authentication
app.use('/my/*', authRequiredMiddleware);
// all routes below this line require admin privileges
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

// ADMIN ROUTES
app.get('/admin', handleAdmin);
app.get('/admin/unvectorized_items', handleAdminUnvectorizedItems);
app.get('/admin/unindexed_items', handleAdminUnindexedItems);
app.get('/admin/items_without_sqid', handleAdminItemsWithoutSqid);
app.get('/admin/vectorize', handleVectorize);
app.get('/admin/generate_related', handleGenerateRelated);

app.post('/admin/feeds/:feed_sqid/delete', handleFeedsDelete);
app.post('/admin/feeds/:feed_sqid/update', handleFeedsUpdate);
app.post('/admin/feeds/:feed_sqid/scrape', handleFeedsScrape);
app.post('/admin/feeds/:feed_sqid/index', handleFeedsIndexing);
app.post('/admin/feeds/:feed_sqid/index_items', handleFeedsItemsIndexing);
app.post('/admin/feeds/:feed_sqid/rebuild_cache', handleFeedsCacheRebuild);
app.post('/admin/feeds/index_items', handleFeedsItemsGlobalIndex);
app.post('/admin/feeds/index', handleFeedsGlobalIndex);
app.post('/admin/feeds/rebuild_cache', handleFeedsGlobalCacheRebuild);

app.get('/admin/blogs/:feed_sqid/new', handleItemsAddItembyUrl);
app.post('/admin/blogs/:feed_sqid/new', handleItemsAddItemByUrlPOST);
app.get('/admin/blogs/new', handleBlogsNew);
app.post('/admin/blogs/new', handleBlogsNewPOST);

app.post('/admin/items/:item_sqid/delete', handleItemsDelete);
app.post('/admin/items/:item_sqid/scrape', handleItemsScraping);
app.post('/admin/items/:item_sqid/index', handleItemsIndexing);

// NORMAL ROUTES
app.get('/search', handleSearch);
app.get('/global/:listingType?', handleGlobal);
app.get('/feedback', handleFeedback);
app.get('/suggest', handleSuggestBlog);
app.get('/opensearch.xml', handleOpensearchXML);
app.get('/favicon.ico', handleFavicon);

app.get('/login', handleLogin);
app.post('/login', handleLoginPOST);
app.get('/reset_password', handleResetPassword);
app.post('/reset_password', handleResetPasswordPOST);
app.post('/set_password', handleSetPasswordPOST);
app.get('/signup', handleSignup);
app.post('/signup', handleSignupPOST);
app.get('/logout', authRequiredMiddleware, handleLogout);

app.get('/my', handleMy);
app.get('/my/subscriptions', handleMySubscriptions);
app.get('/my/friendfeed', handleMyFriendfeed);
app.get('/my/favorites', handleMyFavorites);
app.get('/my/account', handleMyAccount);
app.post('/my/account/resend_verification_link', handleResentVerificationEmailPOST);
app.get('/verify_email', handleVerifyEmail);

app.get('/blogs/:feed_sqid', handleBlogsSingle);
app.get('/blogs', handleBlogs);
app.get('/blogs/by/:listingType?', handleBlogs);

app.post('/feeds/:feed_sqid/subscribe', authRequiredMiddleware, handleFeedsSubscribe);
app.post('/feeds/:feed_sqid/unsubscribe', authRequiredMiddleware, handleFeedsUnsubscribe);

app.get('/items/:item_sqid', handleItemsSingle);
app.get('/items/:item_sqid/lists', authRequiredMiddleware, handleItemsLists);
app.get('/items/:item_sqid/lists/new', authRequiredMiddleware, handleItemsListsNewForm);
app.post('/items/:item_sqid/lists', authRequiredMiddleware, handleItemsListsNewPOST);
app.post('/items/:item_sqid/lists/:list_sqid/add', authRequiredMiddleware, handleItemsListsAddPOST);
app.post('/items/:item_sqid/lists/:list_sqid/remove', authRequiredMiddleware, handleItemsListsRemovePOST);

app.post('/items/:item_sqid/favorite', authRequiredMiddleware, handleItemsAddToFavorites);
app.post('/items/:item_sqid/unfavorite', authRequiredMiddleware, handleItemsRemoveFromFavorites);

app.get('/lists', handleLists);
app.get('/lists/:list_sqid', handleListsSingle);
app.post('/lists/:list_sqid/delete', authRequiredMiddleware, handleListsSingleDeletePOST);

app.get('/users', handleUsers);
app.get('/users/:username', handleUsersSingle);
app.post('/users/:username/follow', authRequiredMiddleware, handleUsersFollowPOST);
app.post('/users/:username/unfollow', authRequiredMiddleware, handleUsersUnfollowPOST);

app.get('/about', async (c: Context) => c.html(renderHTML('About | minifeed', raw(about), c.get('USER_LOGGED_IN'))));
app.get('/about/changelog', async (c: Context) =>
    c.html(renderHTML('Changelog | minifeed', raw(changelog), c.get('USER_LOGGED_IN'))),
);

app.get('/podcasts', (c: Context) => {
    return c.html(renderHTML('Podcasts | minifeed', raw('Coming soon'), c.get('USER_LOGGED_IN'), 'podcasts'));
});
app.get('/channels', (c: Context) => {
    return c.html(renderHTML('Channels | minifeed', raw('Coming soon'), c.get('USER_LOGGED_IN'), 'channels'));
});

// MAIN EXPORT
export default {
    fetch: app.fetch, // normal processing of requests

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

                case 'feed_items_index':
                    if (message.body.feed_id) {
                        try {
                            await updateFeedItemsIndex(env, message.body.feed_id);
                        } catch (e: unknown) {
                            console.log(
                                `Error indexing feed ${message.body.feed_id}: ${e instanceof Error ? e.message : String(e)}`,
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
