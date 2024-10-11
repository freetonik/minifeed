import { Context, Env, Hono } from "hono";
import { raw } from "hono/html";
import {
    handle_create_mblog_POST,
    handle_login,
    handle_login_POST,
    handle_logout,
    handle_my_account,
    handle_signup,
    handle_signup_POST,
    handle_verify_email,
    test_passwords,
} from "./account";
import { handle_admin } from "./admin";
import { Bindings } from "./bindings";
import { changelog } from "./changelog";
import { handle_feedback, handle_suggest_blog } from "./feedback";
import {
    blogsNewHandler,
    blogsNewPostHandler,
    feedsCacheRebuildHandler,
    feedsDeleteHandler,
    feedsGlobalCacheRebuildHandler,
    feedsGlobalIndexHandler,
    feedsIndexHandler,
    feedsScrapeHandler,
    feedsSubscribeHandler,
    feedsUnsubscribeHandler,
    feedsUpdateHandler,
    handle_blogs,
    handle_blogs_single,
    regenerateTopItemsCacheForFeed,
    updateFeed,
} from "./feeds";
import { renderHTML } from "./htmltools";
import {
    handle_global,
    handle_items_lists,
    handle_items_lists_POST,
    handle_items_lists_add_POST,
    handle_items_lists_new_POST,
    handle_items_lists_new_form,
    handle_items_lists_remove_POST,
    handle_items_single,
    handle_my,
    handle_my_favorites,
    handle_my_friendfeed,
    handle_my_subscriptions,
    itemDeleteHandler,
    itemsAddItemByUrlPostHandler,
    itemsAddItembyUrlHandler,
    itemsAddToFavoritesHandler,
    itemsIndexHandler,
    itemsRemoveFromFavoritesHandler,
    itemsScrapeHandler,
} from "./items";
import { handle_mblog, handle_mblog_POST, mblogRSSHandler, handle_mblog_post_single, handle_mblog_post_edit, handle_mblog_post_edit_POST, handle_mblog_post_delete } from "./mblogs";
import {
    adminRequiredMiddleware,
    authMiddleware,
    authRequiredMiddleware,
    subdomainMiddleware,
} from "./middlewares";
import { enqueueScrapeAllItemsOfFeed, enqueueUpdateAllFeeds } from "./queue";
import { scrapeItem } from "./scrape";
import {
    handle_search,
    updateFeedIndex,
    updateItemIndex
} from "./search";
import {
    handle_users_single,
    usersFollowPostHandler,
    usersHandler,
    usersUnfollowPostHandler,
} from "./users";
import { handle_lists, handle_lists_single, handle_lists_single_delete_POST } from "./lists";
import { about } from "./about";

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

app.get("/robots.txt", async (c) => c.text("User-agent: *\nAllow: /"));

app.use("*", authMiddleware);
// all routes below this line require authentication
app.use("/my/*", authRequiredMiddleware);
app.use("/feeds/:feed_sqid/subscribe", authRequiredMiddleware);
app.use("/feeds/:feed_sqid/unsubscribe", authRequiredMiddleware);
app.use("/items/:feed_sqid/favorite", authRequiredMiddleware);
app.use("/items/:feed_sqid/unfavorite", authRequiredMiddleware);

app.use("/items/:item_sqid/lists", authMiddleware);
app.use("/items/:item_sqid/lists/new", authMiddleware);
app.use("/items/:item_sqid/lists/:list_sqid/add", authMiddleware);
app.use("/items/:item_sqid/lists/:list_sqid/remove", authMiddleware);

// all routes below this line require admin privileges
app.use("/b/*", adminRequiredMiddleware);
app.use("/my/account/create_mblog", adminRequiredMiddleware);
app.use("/blogs/:feed_sqid/new", adminRequiredMiddleware);
app.use("/blogs/:feed_sqid/new", adminRequiredMiddleware);
app.use("/feeds/:feed_sqid/delete", adminRequiredMiddleware);
app.use("/feeds/:feed_sqid/update", adminRequiredMiddleware);
app.use("/feeds/:feed_sqid/scrape", adminRequiredMiddleware);
app.use("/feeds/:feed_sqid/index", adminRequiredMiddleware);
app.use("/feeds/:feed_sqid/rebuild_cache", adminRequiredMiddleware);
app.use("/feeds/index", adminRequiredMiddleware);
app.use("/feeds/rebuild_cache", adminRequiredMiddleware);

app.use("/items/:item_sqid/scrape", adminRequiredMiddleware);
app.use("/items/:item_sqid/index", adminRequiredMiddleware);
app.use("/items/:item_sqid/delete", adminRequiredMiddleware);

app.use("/admin", adminRequiredMiddleware);

const handleNotFound = (c: Context<any, any, {}>) => {
    return c.html(
        renderHTML(
            "404 | minifeed",
            raw(`<div class="flash">Page not found.</div>`),
            c.get("USERNAME"),
        ),
    );
};

const handleError = (err: any, c: Context<any, any, {}>) => {
    return c.html(
        renderHTML(
            "Error | minifeed",
            raw(`<div class="flash flash-red">${err}.</div>`),
            c.get("USERNAME"),
        ),
    );
};

app.notFound(handleNotFound);
app.onError(handleError);

// APP ROUTES
app.get("/", (c: any) => {
    if (!c.get("USER_ID")) return c.redirect("/global");
    return c.redirect("/my");
});

app.get("/admin", handle_admin);
app.get("/search", handle_search);
app.get("/global", handle_global);
app.get("/feedback", handle_feedback);
app.get("/suggest", handle_suggest_blog);

app.get("/login", handle_login);
app.get("/signup", handle_signup);
app.post("/login", handle_login_POST);
app.post("/signup", handle_signup_POST);
app.get("/logout", handle_logout);

app.get("/my", handle_my);
app.get("/my/subscriptions", handle_my_subscriptions);
app.get("/my/friendfeed", handle_my_friendfeed);
app.get("/my/favorites", handle_my_favorites);
app.get("/my/account", handle_my_account);
app.post("/my/account/create_mblog", handle_create_mblog_POST);
app.get("/verify_email", handle_verify_email);

app.post("/items/:item_sqid/delete", itemDeleteHandler);

app.get("/blogs", handle_blogs);
app.get("/blogs/new", blogsNewHandler);
app.post("/blogs/new", blogsNewPostHandler);
app.get("/blogs/:feed_sqid/new", itemsAddItembyUrlHandler);
app.post("/blogs/:feed_sqid/new", itemsAddItemByUrlPostHandler);

app.get("/blogs/:feed_sqid", handle_blogs_single);
app.post("/feeds/:feed_sqid/subscribe", feedsSubscribeHandler);
app.post("/feeds/:feed_sqid/unsubscribe", feedsUnsubscribeHandler);

app.post("/feeds/:feed_sqid/delete", feedsDeleteHandler);
app.post("/feeds/:feed_sqid/update", feedsUpdateHandler);
app.post("/feeds/:feed_sqid/scrape", feedsScrapeHandler);
app.post("/feeds/:feed_sqid/index", feedsIndexHandler);
app.post("/feeds/:feed_sqid/rebuild_cache", feedsCacheRebuildHandler);
app.post("/feeds/index", feedsGlobalIndexHandler);
app.post("/feeds/rebuild_cache", feedsGlobalCacheRebuildHandler);


app.get("/podcasts", (c: any) => { return c.html(renderHTML("Podcasts | minifeed", raw("Coming soon"), c.get("USERNAME"), "podcasts",),); });
app.get("/channels", (c: any) => { return c.html(renderHTML("Channels | minifeed", raw("Coming soon"), c.get("USERNAME"), "channels",),); });

app.get("/items/:item_sqid", handle_items_single);
app.get("/items/:item_sqid/lists", handle_items_lists);
app.get("/items/:item_sqid/lists/new", handle_items_lists_new_form);
app.post("/items/:item_sqid/lists", handle_items_lists_new_POST);
app.post("/items/:item_sqid/lists/:list_sqid/add", handle_items_lists_add_POST);
app.post("/items/:item_sqid/lists/:list_sqid/remove", handle_items_lists_remove_POST);

app.post("/items/:item_sqid/favorite", itemsAddToFavoritesHandler);
app.post("/items/:item_sqid/unfavorite", itemsRemoveFromFavoritesHandler);
app.post("/items/:item_sqid/scrape", itemsScrapeHandler);
app.post("/items/:item_sqid/index", itemsIndexHandler);

app.get("/lists", handle_lists);
app.get("/lists/:list_sqid", handle_lists_single);
app.post("/lists/:list_sqid/delete", handle_lists_single_delete_POST);

app.get("/users", usersHandler);
app.get("/users/:username", handle_users_single);
app.post("/users/:username/follow", usersFollowPostHandler);
app.post("/users/:username/unfollow", usersUnfollowPostHandler);

app.get("/about", async (c: Context<any, any, {}>) =>
    c.html(renderHTML("About | minifeed", raw(about), c.get("USERNAME"))),
);
app.get("/about/changelog", async (c: Context<any, any, {}>) =>
    c.html(renderHTML("Changelog | minifeed", raw(changelog), c.get("USERNAME"))),
);

const subdomainApp = new Hono<{ Bindings: Bindings }>({
    strict: false,
});
subdomainApp.use("*", authMiddleware);
subdomainApp.use("*", subdomainMiddleware);

subdomainApp.get("/", handle_mblog);
subdomainApp.post("/", handle_mblog_POST)

subdomainApp.get("/rss", mblogRSSHandler)
subdomainApp.get("/:post_slug", handle_mblog_post_single);
subdomainApp.get("/:post_slug/edit", handle_mblog_post_edit);
subdomainApp.post("/:post_slug/edit", handle_mblog_post_edit_POST)
subdomainApp.post("/:post_slug/delete", handle_mblog_post_delete)

subdomainApp.notFound(handleNotFound);
subdomainApp.onError(handleError);
subdomainApp.get("/robots.txt", async (c) => c.text("User-agent: *\nAllow: /"));

// Main app to route based on Host
const appMain = new Hono<{ Bindings: Bindings }>({
    strict: false,
});

appMain.all("*", async (c: Context<any, any, {}>, next: () => any) => {
    const host = c.req.raw.headers.get("host"); // Cloudflare Workers use lowercase 'host'
    if (host) {
        if (host.split(".").length === 3) {  // if subdomain is in the form of sub.example.com
            return await subdomainApp.fetch(c.req, c.env, c.ctx);
        }
        // Default to root app for the main domain (example.com)
        return await app.fetch(c.req, c.env, c.ctx);
    }
    return await app.fetch(c.req, c.env, c.ctx);
});

// MAIN EXPORT
export default {
    fetch: (req: Request, env: Env, ctx: ExecutionContext) => appMain.fetch(req, env, ctx), // normal processing of requests

    async queue(batch: MessageBatch<any>, env: Bindings) {
        // consumer of queue FEED_UPDATE_QUEUE
        for (const message of batch.messages) {
            switch (message.body["type"]) {
                case "feed_update":
                    try {
                        await updateFeed(env, message.body.feed_id);
                    } catch (e: any) {
                        console.log(`Error updating feed ${message.body.feed_id}: ${e.toString()}`,);
                    }
                    break;

                case "feed_scrape":
                    try {
                        await enqueueScrapeAllItemsOfFeed(env, message.body.feed_id);
                    } catch (e: any) {
                        console.log(`Error scraping feed ${message.body.feed_id}: ${e.toString()}`,);
                    }
                    break;

                case "item_scrape":
                    try {
                        await scrapeItem(env, message.body.item_id);
                    } catch (e: any) {
                        console.log(`Error scraping item ${message.body.item_id}: ${e.toString()}`,);
                    }
                    break;

                case "item_index":
                    try {
                        await updateItemIndex(env, message.body.item_id);
                    } catch (e: any) {
                        console.log(`Error indexing item ${message.body.item_id}: ${e.toString()}`,);
                    }
                    break;

                case "feed_index":
                    try {
                        await updateFeedIndex(env, message.body.feed_id);
                    } catch (e: any) {
                        console.log(`Error indexing feed ${message.body.feed_id}: ${e.toString()}`,);
                    }
                    break;

                case "feed_update_top_items_cache":
                    try {
                        await regenerateTopItemsCacheForFeed(env, message.body.feed_id);
                    } catch (e: any) {
                        console.log(`Error regenerating top items cache for feed ${message.body.feed_id}: ${e.toString()}`,);
                    }
                    break;
            }
        }
    },

    async scheduled(event: any, env: Bindings, ctx: any) {
        // cron
        await enqueueUpdateAllFeeds(env);
    },
};
