import type { Context } from 'hono';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { raw } from 'hono/html';
import {
    handleAdmin,
    handleAdminItemsWithoutRelated,
    handleAdminItemsWithoutSqid,
    handleAdminUnindexedFeeds,
    handleAdminUnindexedItems,
    handleAdminUnvectorizedItems,
    handleDeleteDuplicatesByTitle,
    handleDeleteDuplicatesByUrl,
    handleDuplicateItems,
    handleGenerateMissingItemSqids,
} from './admin';
import { handleGenerateRelated, handleVectorize, vectorizeAndStoreItem } from './ai';
import type { Bindings } from './bindings';
import {
    generateInitialRelatedFeeds,
    generateRelatedFeedsFromRelatedItems,
    regenerateRelatedFeeds,
    regenerateTopItemsCacheForFeed,
    updateFeed,
} from './feeds';
import {
    handleLogin,
    handleLoginPOST,
    handleLogout,
    handleMyAccount,
    handleMyAccountPreferencesPOST,
    handleResetPassword,
    handleResetPasswordPOST,
    handleSetPasswordPOST,
    handleSignup,
    handleSignupPOST,
    handleVerifyEmail,
} from './handlers/account/handleMyAccount';
import { handleBlog } from './handlers/feeds/blog';
import { handleBlogs } from './handlers/feeds/blogs';
import {
    handleBlogsNew,
    handleBlogsNewPOST,
    handleFeedsCacheRebuild,
    handleFeedsDelete,
    handleFeedsGlobalCacheRebuild,
    handleFeedsGlobalIndex,
    handleFeedsIndexing,
    handleFeedsItemsGlobalIndex,
    handleFeedsItemsIndexing,
    handleFeedsRebuildRelatedFeeds,
    handleFeedsUpdate,
} from './handlers/feeds/feedAdmin';
import { handleFeedsSubscribe, handleFeedsUnsubscribe } from './handlers/feeds/feedSubscribePartial';
import { handleOPMLGlobal } from './handlers/feeds/opmlGlobal';
import { handleOPMLSubscribed } from './handlers/feeds/opmlSubscribed';
import { handleFavicon } from './handlers/handleFavicon';
import { handleRobotsTxt } from './handlers/handleRobotsTxt';
import { handleGlobal } from './handlers/items/global';
import { handleHomeForGuest } from './handlers/items/homeGuest';
import { handleItem } from './handlers/items/item';
import {
    handleItemRefresh,
    handleItemsAddItemByUrlPOST,
    handleItemsAddItembyUrl,
    handleItemsDeletePOST,
    handleRegenerateRelatedItemsNew,
    regenerateRelatedForItem,
} from './handlers/items/itemAdmin';
import { handleItemsAddToFavorites, handleItemsRemoveFromFavorites } from './handlers/items/itemFavorites';
import {
    handleItemsListsAddPOST,
    handleItemsListsNewForm,
    handleItemsListsNewPOST,
    handleItemsListsRemovePOST,
} from './handlers/items/itemListActions';
import { handleItemsLists } from './handlers/items/itemListPartial';
import { handleItemReaderView } from './handlers/items/itemReaderView';
import { handleMyAll } from './handlers/items/my';
import { handleMyFavorites } from './handlers/items/myFavorites';
import { handleMyFriendfeed } from './handlers/items/myFriendfeed';
import { handleMySubscriptions } from './handlers/items/mySubscriptions';
import { handleListsSingle } from './handlers/lists/list';
import { handleListsSingleDeletePOST } from './handlers/lists/listPartials';
import { handleLists } from './handlers/lists/lists';
import { handleOpensearchXML } from './handlers/search/opensearchXML';
import { handleSearch } from './handlers/search/search';
import { about } from './handlers/staticPages/about';
import { changelog } from './handlers/staticPages/changelog';
import { handleDonate } from './handlers/staticPages/donate';
import { handleSuggestBlog, handleSupport } from './handlers/staticPages/feedback';

import { handleUpgrade } from './handlers/staticPages/upgrade';
import { handleUsersSingle } from './handlers/users/user';
import { handleUsersFollowPOST, handleUsersUnfollowPOST } from './handlers/users/userFollowPartials';
import { handleUsers } from './handlers/users/users';
import { deleteUnverifiedAccounts } from './handlers/users/usersDeletion';
import { renderHTML } from './htmltools';
import { HomePageSubsectionPreference, type MFQueueMessage } from './interface';
import {
    generateMissingItemSqids,
    refreshItemsMissingRelated,
    refreshItemsMissingVector,
    regenerateListOfItemIds,
    scrapeIndexVectorizeItem,
} from './items';
import {
    adminRequiredMiddleware,
    authCheckMiddleware,
    authRequiredMiddleware,
    basicContextMiddleware,
    paidSubscriptionRequiredMiddleware,
    stripeMiddleware,
} from './middlewares';
import { enqueueRegenerateRelatedCacheForAllItems, enqueueUpdateAllFeeds } from './queue';
import { updateFeedIndex, updateFeedItemsIndex, updateItemIndex } from './search';
import {
    handleBillingCancel,
    handleBillingSuccess,
    handleStripeCreateCheckoutSessionPOST,
    handleStripeCustomerPortalPOST,
    handleStripeWebhook,
} from './stripe';

// ————————————————————————————————————————————————————————————————>>>>

// main app handles the root paths
const app = new Hono<{ Bindings: Bindings }>({ strict: false });

// string[]
app.use('*', csrf());
app.use('*', basicContextMiddleware);
app.use('*', authCheckMiddleware);

app.get('/robots.txt', handleRobotsTxt);

const handleNotFound = (c: Context) => {
    c.status(404);
    return c.html(renderHTML(c, '404 | minifeed', raw(`<div class="flash">Page not found.</div>`)));
};

const handleError = (err: Error, c: Context) => {
    c.status(422);
    return c.html(renderHTML(c, 'Error | minifeed', raw(`<div class="flash">${err}</div>`)));
};

app.notFound(handleNotFound);
app.onError(handleError);

// APP ROUTES
app.get('/', async (c: Context) => {
    const user_id = c.get('USER_ID');
    if (!user_id) return c.redirect('/welcome');
    const user = await c.env.DB.prepare('SELECT default_homepage_subsection FROM user_preferences WHERE user_id = ?')
        .bind(user_id)
        .first();
    c.set('ACTIVE_PAGE', 'my'); // basicContextMiddleware does not handle this logic
    switch (user?.default_homepage_subsection) {
        case HomePageSubsectionPreference.SUBSCRIPTIONS:
            return handleMySubscriptions(c);
        case HomePageSubsectionPreference.FAVORITES:
            return handleMyFavorites(c);
        case HomePageSubsectionPreference.FRIENDFEED:
            return handleMyFriendfeed(c);
        default:
            return handleMyAll(c);
    }
});
app.get('/all', handleMyAll);

// BACKWARDS COMPATIBILITY ROUTES
app.get('/my', (c: Context) => c.redirect('/'));
app.get('/my/subscriptions', (c: Context) => c.redirect('/subscriptions'));
app.get('/my/friendfeed', (c: Context) => c.redirect('/friendfeed'));
app.get('/my/favorites', (c: Context) => c.redirect('/favorites'));
app.get('/my/account', (c: Context) => c.redirect('/account'));

app.get('/welcome', handleHomeForGuest);

app.get('/subscriptions', authRequiredMiddleware, handleMySubscriptions);
app.get('/friendfeed', authRequiredMiddleware, handleMyFriendfeed);
app.get('/favorites', authRequiredMiddleware, handleMyFavorites);
app.get('/account', authRequiredMiddleware, handleMyAccount);
app.post('/account/preferences', authRequiredMiddleware, handleMyAccountPreferencesPOST);
// app.post('/account/resend_verification_link', handleResentVerificationEmailPOST);

app.get('/verify_email', handleVerifyEmail);

// STRIPE
app.post('/account/billing/create-checkout-session', stripeMiddleware, handleStripeCreateCheckoutSessionPOST);
app.post('/account/billing/customer-portal', stripeMiddleware, handleStripeCustomerPortalPOST);
app.get('/account/billing/success', handleBillingSuccess);
app.get('/account/billing/cancel', handleBillingCancel);
app.post('/account/billing/webhook', stripeMiddleware, handleStripeWebhook);

// ADMIN ROUTES
// all routes below this line require admin privileges
app.use('/admin/*', adminRequiredMiddleware);
app.get('/admin', handleAdmin);
app.get('/admin/unvectorized_items', handleAdminUnvectorizedItems);
app.get('/admin/unindexed_items', handleAdminUnindexedItems);
app.get('/admin/unindexed_feeds', handleAdminUnindexedFeeds);

app.get('/admin/items_without_sqid', handleAdminItemsWithoutSqid);
app.get('/admin/items_without_sqid/generate', handleGenerateMissingItemSqids);
app.get('/admin/items_without_related', handleAdminItemsWithoutRelated);
app.get('/admin/vectorize', handleVectorize);
app.get('/admin/generate_related/:type', handleGenerateRelated);
app.get('/admin/duplicates', handleDuplicateItems);

app.post('/admin/feeds/:feed_sqid/delete', handleFeedsDelete);
app.post('/admin/feeds/:feed_sqid/delete_duplicates_by_title', handleDeleteDuplicatesByTitle);
app.post('/admin/feeds/:feed_sqid/delete_duplicates_by_url', handleDeleteDuplicatesByUrl);
app.post('/admin/feeds/:feed_sqid/update', handleFeedsUpdate);
app.post('/admin/feeds/:feed_sqid/index', handleFeedsIndexing);
app.post('/admin/feeds/:feed_sqid/index_items', handleFeedsItemsIndexing);
app.post('/admin/feeds/:feed_sqid/rebuild_cache', handleFeedsCacheRebuild);
app.post('/admin/feeds/:feed_sqid/rebuild_related_blogs', handleFeedsRebuildRelatedFeeds);
app.post('/admin/feeds/index_items', handleFeedsItemsGlobalIndex);
app.post('/admin/feeds/index', handleFeedsGlobalIndex);
app.post('/admin/feeds/rebuild_cache', handleFeedsGlobalCacheRebuild);

app.get('/admin/blogs/:feed_sqid/new', handleItemsAddItembyUrl);
app.post('/admin/blogs/:feed_sqid/new', handleItemsAddItemByUrlPOST);

app.post('/admin/items/:item_sqid/delete', handleItemsDeletePOST);
app.post('/admin/items/:item_sqid/refresh', handleItemRefresh);
app.post('/admin/items/:item_sqid/regen-related-items', handleRegenerateRelatedItemsNew);

// NORMAL ROUTES
app.get('/search', handleSearch);
app.get('/global/:listingType?', handleGlobal);
app.get('/support', handleSupport);
app.get('/donate', handleDonate);
app.get('/upgrade', handleUpgrade);
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

app.get('/blogs/opml.xml', handleOPMLGlobal);
app.get('/blogs/new', authRequiredMiddleware, paidSubscriptionRequiredMiddleware, handleBlogsNew);
app.post('/blogs/new', authRequiredMiddleware, paidSubscriptionRequiredMiddleware, handleBlogsNewPOST);
app.get('/blogs/:feed_sqid', handleBlog);
app.get('/blogs', handleBlogs);
app.get('/blogs/by/:listingType?', handleBlogs);
app.get('/blogs/by/subscribed/opml.xml', authRequiredMiddleware, handleOPMLSubscribed);



app.post('/feeds/:feed_sqid/subscribe', authRequiredMiddleware, handleFeedsSubscribe);
app.post('/feeds/:feed_sqid/unsubscribe', authRequiredMiddleware, handleFeedsUnsubscribe);

app.get('/items/:item_sqid', handleItem);
app.get('/items/:item_sqid/reader', authRequiredMiddleware, handleItemReaderView);
app.get('/items/:item_sqid/lists', authRequiredMiddleware, handleItemsLists);
app.get(
    '/items/:item_sqid/lists/new',
    authRequiredMiddleware,
    paidSubscriptionRequiredMiddleware,
    handleItemsListsNewForm,
);
app.post(
    '/items/:item_sqid/lists',
    authRequiredMiddleware,
    paidSubscriptionRequiredMiddleware,
    handleItemsListsNewPOST,
);
app.post(
    '/items/:item_sqid/lists/:list_sqid/add',
    authRequiredMiddleware,
    paidSubscriptionRequiredMiddleware,
    handleItemsListsAddPOST,
);
app.post(
    '/items/:item_sqid/lists/:list_sqid/remove',
    authRequiredMiddleware,
    paidSubscriptionRequiredMiddleware,
    handleItemsListsRemovePOST,
);

app.post('/items/:item_sqid/favorite', authRequiredMiddleware, handleItemsAddToFavorites);
app.post('/items/:item_sqid/unfavorite', authRequiredMiddleware, handleItemsRemoveFromFavorites);

app.get('/lists', handleLists);
app.get('/lists/:list_sqid', handleListsSingle);
app.post(
    '/lists/:list_sqid/delete',
    authRequiredMiddleware,
    paidSubscriptionRequiredMiddleware,
    handleListsSingleDeletePOST,
);

app.get('/users', handleUsers);
app.get('/users/:username', handleUsersSingle);
app.post('/users/:username/follow', authRequiredMiddleware, handleUsersFollowPOST);
app.post('/users/:username/unfollow', authRequiredMiddleware, handleUsersUnfollowPOST);

app.get('/about', async (c: Context) => c.html(renderHTML(c, 'About | minifeed', raw(about))));
app.get('/about/changelog', async (c: Context) => c.html(renderHTML(c, 'Changelog | minifeed', raw(changelog))));

// MAIN EXPORT
export default {
    fetch: app.fetch, // normal processing of requests

    async queue(batch: MessageBatch<MFQueueMessage>, env: Bindings) {
        // consumer of queues FEED_UPDATE_QUEUE, ITEM_VECTORIZE_QUEUE
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

                case 'item_scrape':
                    if (message.body.item_id) await scrapeIndexVectorizeItem(env, message.body.item_id);
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

                case 'feed_regenerate_related':
                    if (message.body.feed_id) await generateRelatedFeedsFromRelatedItems(env, message.body.feed_id);
                    break;

                case 'item_regenerate_related':
                    if (message.body.item_id) await regenerateRelatedForItem(env, message.body.item_id);
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
        switch (event.cron) {
            case '0 * * * *':
                // Every hour
                await enqueueUpdateAllFeeds(env);
                break;
            case '0 */2 * * *':
                // Every 2 hours
                await generateInitialRelatedFeeds(env);
                await refreshItemsMissingRelated(env);
                await refreshItemsMissingVector(env);
                await generateMissingItemSqids(env);
                break;
            case '45 0 * * *':
                // Every night at 00:45
                await deleteUnverifiedAccounts(env);
                await regenerateRelatedFeeds(env);
                await enqueueRegenerateRelatedCacheForAllItems(env);
                await regenerateListOfItemIds(env); // used for random feed
                // TODO: remove sessions older than 1 year
                break;
        }
    },
};
