import { html, raw } from "hono/html";
import { addItemsToFeed } from "./feeds";
import {
    renderAddItemByURLForm,
    renderHTML,
    renderItemShort,
    render_my_subsections,
} from "./htmltools";
import { enqueueItemIndex, enqueueItemScrape } from "./queue";
import { scrapeURLIntoObject } from "./scrape";
import {
    absolutifyImageUrls,
    feedSqidToId,
    getRootUrl,
    itemIdToSqid,
    itemSqidToId,
    sanitizeHTML
} from "./utils";

export const handle_global = async (c: any) => {
    const userId = c.get("USER_ID") || -1;
    const user_logged_in = userId != -1;
    const itemsPerPage = 30;
    const page = Number(c.req.query("p")) || 1;
    const offset = page * itemsPerPage - itemsPerPage;
    const { results, meta } = await c.env.DB.prepare(
        `
        SELECT items.item_id, items.item_sqid, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
        WHERE items.item_sqid IS NOT 0 AND feeds.type = 'blog'
        ORDER BY items.pub_date DESC
        LIMIT ? OFFSET ?`,
    )
        .bind(userId, itemsPerPage, offset)
        .run();

    let list = ``;
    if (!user_logged_in) {
        list += `<div class="flash">
    <strong>Minifeed</strong> is a curated blog reader and blog search engine.
    We collect humans-written blogs to make them discoverable and searchable.
    Sign up to subscribe to blogs, follow people, save favorites, or start your own blog.
    <br><br>
    ↓ Below is a global feed of all items from all blogs.
    </div>`;
    } else {
        list += `<div class="flash">
    ↓ Below is a global feed of all items from all blogs.
    </div>`
    }

    list += ``;

    if (!results.length)
        list += `<p><i>Nothing exists on minifeed yet...</i></p>`;

    results.forEach((item: any) => {
        const itemTitle = item.favorite_id
            ? `★ ${item.item_title}`
            : item.item_title;

        list += renderItemShort(
            item.item_sqid,
            itemTitle,
            item.item_url,
            item.feed_title,
            item.feed_sqid,
            item.pub_date,
            item.description,
        );
    });

    if (results.length) list += `<a href="?p=${page + 1}">More</a></p>`;
    return c.html(
        renderHTML(
            "Global feed | minifeed",
            html`${raw(list)}`,
            c.get("USERNAME"),
            "global",
            "",
            "",
            false,
            userId == 1 ? `${meta.duration} ms., ${meta.rows_read} rows read` : ``
        ),
    );
};

// // MY HOME FEED: subs + favorites + friendfeed
export const handle_my = async (c: any) => {
    const itemsPerPage = 30;
    const page = Number(c.req.query("p")) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const userId = c.get("USER_ID");

    const { results, meta } = await c.env.DB.prepare(
        `
    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN subscriptions ON items.feed_id = subscriptions.feed_id
    JOIN feeds ON items.feed_id = feeds.feed_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    WHERE items.item_sqid IS NOT 0 AND subscriptions.user_id = ? AND feeds.type = 'blog'

    UNION

    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN subscriptions ON items.feed_id = subscriptions.feed_id
    JOIN feeds ON items.feed_id = feeds.feed_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    JOIN followings ON subscriptions.user_id = followings.followed_user_id
    WHERE items.item_sqid IS NOT 0 AND followings.follower_user_id = ? AND feeds.type = 'blog'

    UNION

    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN feeds ON items.feed_id = feeds.feed_id
    JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    WHERE items.item_sqid IS NOT 0 AND feeds.type = 'blog'

    ORDER BY items.pub_date DESC

    LIMIT ? OFFSET ?
    `,
    )
        .bind(userId, userId, userId, userId, userId, itemsPerPage, offset)
        .all();


    let list = `
    ${render_my_subsections("my")}
    `;
    if (results.length) {
        results.forEach((item: any) => {
            let title = item.favorite_id ? `★ ${item.title}` : item.title;
            list += renderItemShort(
                item.item_sqid,
                title,
                item.url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        });
        list += `<p><a href="?p=${page + 1}">More</a></p>`;
    } else {
        if (page == 1) {
            list += `Your home is empty :-( <br>Subscribe to some <strong><a href="/blogs">blogs</a></strong> or follow some <strong><a href="/users">users</a></strong>.`;
        }
    }


    return c.html(
        renderHTML(
            "My feed | minifeed",
            html`${raw(list)}`,
            c.get("USERNAME"),
            "my",
            "",
            "",
            false,
            userId == 1 ? `${meta.duration} ms., ${meta.rows_read} rows read` : ``
        ),
    );
};

export const handle_my_subscriptions = async (c: any) => {
    const itemsPerPage = 30;
    const page = Number(c.req.query("p")) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const userId = c.get("USER_ID");
    const { results, meta } = await c.env.DB.prepare(
        `
    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN subscriptions ON items.feed_id = subscriptions.feed_id
    JOIN feeds ON items.feed_id = feeds.feed_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    WHERE items.item_sqid IS NOT 0 AND subscriptions.user_id = ?
    ORDER BY items.pub_date DESC
    LIMIT ? OFFSET ?
    `,
    )
        .bind(userId, userId, itemsPerPage, offset)
        .all();

    let list = ` ${render_my_subsections("subscriptions")}
    <div class="main">
    `;
    if (results.length) {
        results.forEach((item: any) => {
            let title = item.favorite_id ? `★ ${item.title}` : item.title;
            list += renderItemShort(
                item.item_sqid,
                title,
                item.url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        });
        list += `<p><a href="?p=${page + 1}">More</a></p></div>`;
    } else {
        if (page == 1) {
            list += `Your have no subscriptions :-( <br>Subscribe to some <strong><a href="/blogs">blogs</a></strong>.`;
        }
        list += `</div>`;
    }
    return c.html(
        renderHTML(
            "My subscriptions",
            html`${raw(list)}`,
            c.get("USERNAME"),
            "my",
            "",
            "",
            false,
            userId == 1 ? `${meta.duration} ms., ${meta.rows_read} rows read` : ``
        ),
    );
};

export const handle_my_friendfeed = async (c: any) => {
    const itemsPerPage = 30;
    const page = Number(c.req.query("p")) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const userId = c.get("USER_ID");
    const { results, meta } = await c.env.DB.prepare(
        `
    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN subscriptions ON items.feed_id = subscriptions.feed_id
    JOIN feeds ON items.feed_id = feeds.feed_id
    JOIN followings ON subscriptions.user_id = followings.followed_user_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    WHERE items.item_sqid IS NOT 0 AND followings.follower_user_id = ?
    ORDER BY items.pub_date DESC
    LIMIT ? OFFSET ?
    `,
    )
        .bind(userId, userId, itemsPerPage, offset)
        .all();

    let list = `
    ${render_my_subsections("friendfeed")}
    <div class="main">
    `;
    if (results.length) {
        results.forEach((item: any) => {
            const title = item.favorite_id ? `★ ${item.title}` : item.title;
            list += renderItemShort(
                item.item_sqid,
                title,
                item.url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        });
        list += `<p><a href="?p=${page + 1}">More</a></p></div>`;
    } else {
        if (page == 1) {
            list += `You don't follow anyone, or you do, but they aren't subscribed to anything :-( <br> <strong><a href="/users">View all users</a></strong>.`;
        }
    }

    return c.html(
        renderHTML(
            "My friendfeed",
            html`${raw(list)}`,
            c.get("USERNAME"),
            "my",
            "",
            "",
            false,
            userId == 1 ? `${meta.duration} ms., ${meta.rows_read} rows read` : ``
        ),
    );
};

export const handle_my_favorites = async (c: any) => {
    const itemsPerPage = 30;
    const page = Number(c.req.query("p")) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const userId = c.get("USER_ID");
    const { results, meta } = await c.env.DB.prepare(
        `
    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN favorites ON items.item_id = favorites.item_id
    JOIN feeds ON items.feed_id = feeds.feed_id
    WHERE items.item_sqid IS NOT 0 AND favorites.user_id = ?
    ORDER BY items.pub_date DESC
    LIMIT ? OFFSET ?
    `,
    )
        .bind(userId, itemsPerPage, offset)
        .all();

    let list = `
    ${render_my_subsections("favorites")}
    <div class="main">
    `;
    if (results.length) {
        results.forEach((item: any) => {
            const title = item.favorite_id ? `★ ${item.title}` : item.title;
            list += renderItemShort(
                item.item_sqid,
                title,
                item.url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        });
        list += `<p><a href="?p=${page + 1}">More</a></p>`;
    } else {
        if (page == 1) {
            list += `You haven't added anything to favorites yet :-(`;
        }
    }
    list += `</div>`;

    return c.html(
        renderHTML(
            "My favorites",
            html`${raw(list)}`,
            c.get("USERNAME"),
            "my",
            "",
            "",
            false,
            userId == 1 ? `${meta.duration} ms., ${meta.rows_read} rows read` : ``
        ),
    );
};

export const handle_items_single = async (c: any) => {
    const item_sqid = c.req.param("item_sqid");
    const item_id: number = itemSqidToId(item_sqid);
    const user_id = c.get("USER_ID") || -1;
    const user_logged_in = user_id != -1;

    const batch = await c.env.DB.batch([
        // find subscription status of user to this feed
        c.env.DB.prepare(
            `
    SELECT subscriptions.subscription_id
    FROM subscriptions
    JOIN items ON subscriptions.feed_id = items.feed_id
    WHERE subscriptions.user_id = ? AND items.item_id = ?`,
        ).bind(user_id, item_id),

        // find item
        c.env.DB.prepare(
            `
    SELECT
        items.item_id,
        items.title AS item_title,
        items.description,
        items.content_html,
        items.content_html_scraped,
        items.pub_date,
        items.url AS item_url,
        feeds.title AS feed_title,
        feeds.feed_sqid,
        feeds.type,
        favorite_id
    FROM items
    JOIN feeds ON items.feed_id = feeds.feed_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    WHERE items.item_id = ?
    ORDER BY items.pub_date DESC`,
        ).bind(user_id, item_id),

        // find other items from this feed
        c.env.DB.prepare(
            `
    WITH FeedInfo AS (
        SELECT feed_id
        FROM items
        WHERE item_id = ?
        )
        SELECT
        items.item_sqid,
        items.title AS item_title,
        items.description,
        items.pub_date,
        items.url AS item_url,
        favorite_id
        FROM items
        JOIN FeedInfo fi ON items.feed_id = fi.feed_id
        LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
        WHERE items.item_id != ?
        ORDER BY items.pub_date DESC
        LIMIT 5`,
        ).bind(item_id, user_id, item_id),
    ]);

    if (!batch[1].results.length) return c.notFound();

    const user_is_subscribed = batch[0].results.length ? true : false;

    const item = batch[1].results[0];
    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
    };
    const post_date = new Date(item.pub_date).toLocaleDateString(
        "en-UK",
        date_format_opts,
    );

    let contentBlock;

    if (!item.description && !item.content_html && !item.content_html_scraped) {
        contentBlock = `<div class="flash" style="margin-top:1em;">This post cannot be viewed on Minifeed. <a href="${item.item_url}" target="_blank">↗ Open original</a></div>`;
    } else {
        if (user_logged_in) {
            // User is logged in
            if (item.content_html) {
                // We have full content from feed
                if (item.content_html_scraped) {
                    // We have scraped content
                    if (
                        item.content_html.length >
                        item.content_html_scraped.length * 0.65
                    ) {
                        // Full content is longer than 0.65 of scraped content
                        contentBlock = raw(item.content_html);
                    } else {
                        // Full content is shorted, so use scraped
                        contentBlock = raw(item.content_html_scraped);
                    }
                } else {
                    // No scraped content, use full content
                    contentBlock = raw(item.content_html);
                }
            } else if (item.content_html_scraped) {
                contentBlock = raw(item.content_html_scraped);
            }
            else {
                contentBlock = item.description;
            }

            // whatever content block was, sanitize it
            contentBlock = await sanitizeHTML(contentBlock);
            // absolutify image urls with base of item url
            contentBlock = await absolutifyImageUrls(contentBlock, getRootUrl(item.item_url));
        } else {
            // User is not logged in; description has tags scraped, no need to sanitize
            contentBlock = `${item.description} <div class="flash" style="margin-top:1em;"><a href="/login">Log in</a> and subscribe to this blog to view full content</div>`;
        }
    }

    let favoriteBlock = "";
    let subscriptionBlock = "";

    if (user_logged_in) {
        if (item.favorite_id) {
            favoriteBlock = `<span id="favorite">
            <button hx-post="/items/${item_sqid}/unfavorite"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ★ unfavorite
            </button>
            </span>`;
        } else {
            favoriteBlock = `<span id="favorite">
            <button hx-post="/items/${item_sqid}/favorite"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ☆ favorite
            </button>
            </span>`;
        }

        if (user_is_subscribed) {
            subscriptionBlock = `
            <span id="subscription-${item.feed_sqid}">
            <button hx-post="/feeds/${item.feed_sqid}/unsubscribe"
            class="subscribed"
            hx-trigger="click"
            hx-target="#subscription-${item.feed_sqid}"
            hx-swap="outerHTML">
            <span class="subscribed-text">subscribed</span>
            <span class="unsubscribe-text">unsubscribe</span>
            </button>
            </span>`;
        } else {
            subscriptionBlock = `
            <span id="subscription-${item.feed_sqid}">
            <button hx-post="/feeds/${item.feed_sqid}/subscribe"
            class="subscribe"
            hx-trigger="click"
            hx-target="#subscription-${item.feed_sqid}"
            hx-swap="outerHTML">
            subscribe
            </button>
            </span>`;
        }
    } else {
        favoriteBlock = `<span id="favorite"> <button title="Log in to favorite" disabled> ☆ favorite </button> </span>`;
        subscriptionBlock = `<span id="subscription"> <button disabled title="Login to subscribe"> <span>subscribe</span> </button> </span>`;
    }

    let otherItemsBlock = "";
    if (batch[2].results.length) {
        otherItemsBlock += `<div class="related-items"><h4>More from ${item.type} <a href="/blogs/${item.feed_sqid}"">${item.feed_title}</a>:</h4>`;
        batch[2].results.forEach((related_item: any) => {
            const itemTitle = related_item.favorite_id
                ? `★ ${related_item.item_title}`
                : related_item.item_title;
            otherItemsBlock += renderItemShort(
                related_item.item_sqid,
                itemTitle,
                related_item.item_url,
                "",
                "",
                related_item.pub_date,
                related_item.description,
            );
        });
        otherItemsBlock += `</div>`;
    }

    let list = `
    <h1 style="margin-bottom: 0.25em;">${item.item_title} </h1>
    <div style="margin-bottom:1.25em;">from ${item.type} <a href="/blogs/${item.feed_sqid}"">${item.feed_title}</a>, <time>${post_date}</time></div>
    <div class="item-actions" style="margin-bottom:3em;">
        <div>
        ${favoriteBlock}
        <a class="button" href="${item.item_url}" target="_blank">↗ original</a>
        </div>
        <div>
        ${subscriptionBlock}
        </div>
    </div>
    <article>
    ${contentBlock}
    </article>

    ${otherItemsBlock}
    `;

    let debug_info = '';
    if (c.get("USER_ID") == 1) {
        debug_info = `${batch[0].meta.duration}+${batch[1].meta.duration}+${batch[2].meta.duration} ms.;
            ${batch[0].meta.rows_read}+${batch[1].meta.rows_read}+${batch[2].meta.rows_read} rows read`
        const show_content_html_over_scraped =
            item.content_html &&
            item.content_html_scraped &&
            item.content_html.length > item.content_html_scraped.length * 0.65;
        let show_content_html_over_scraped_block = "not applicable";
        if (item.content_html_scraped && show_content_html_over_scraped)
            show_content_html_over_scraped_block = `yes`;
        else if (item.content_html_scraped && !show_content_html_over_scraped)
            show_content_html_over_scraped_block = `no`;
        list += `
        <p style="text-align:center;"><a class="no-underline" href="#hidden">🦎</a></p>
        <div class="admin-control" id="hidden">
        <table>
        <tr>
        <td>Item ID:</td>
        <td>${item.item_id}</td>
        </tr>
        <tr>
        <td>Item sqid:</td>
        <td>${item_sqid}</td>
        </tr>
        <tr>
        <td>Item url:</td>
        <td>${item.item_url}</td>
        </tr>
        <tr>
        <td>Length of description:</td>
        <td>${item.description ? item.description.length : 0}</td>
        </tr>
        <tr>
        <td>Length of content_html:</td>
        <td>${item.content_html ? item.content_html.length : 0}</td>
        </tr>
        <tr>
        <td>Show content_html over scraped:</td>
        <td>${show_content_html_over_scraped_block}</td>
        </tr>
        <tr>
        <td>Scraped:</td>
        <td>${item.content_html_scraped ? "yes" : "no"}</td>
        </tr>
        <tr>
        <td>Length of content_html_scraped:</td>
        <td>${item.content_html_scraped ? item.content_html_scraped.length : "not applicable"}</td>
        </tr>
        </table>

        <p>
        <button hx-post="/items/${item_sqid}/scrape"
            hx-trigger="click"
            hx-target="#scrape-indicator"
            hx-swap="outerHTML">
            scrape
        </button>
        <span id="scrape-indicator"></span>
        </p>

        <p>
        <button hx-post="/items/${item_sqid}/index"
            hx-trigger="click"
            hx-target="#index-indicator"
            hx-swap="outerHTML">
            re-index
        </button>
        <span id="index-indicator"></span>
        </p>

        <p>
        <button hx-post="/items/${item_sqid}/delete"
            hx-trigger="click"
            hx-target="#delete-indicator"
            hx-swap="outerHTML">
            delete
        </button>
        <span id="delete-indicator"></span>
        </p>

        </div>
        `;
    }

    return c.html(
        renderHTML(
            `${item.item_title} | ${item.feed_title} | minifeed`,
            html`${raw(list)}`,
            c.get("USERNAME"),
            "blogs",
            "",
            item.item_url,
            false,
            debug_info
        ),
    );
};

export const itemsAddToFavoritesHandler = async (c: any) => {
    const itemSqid = c.req.param("item_sqid");
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get("USER_ID");

    let result;
    try {
        result = await c.env.DB.prepare(
            `INSERT INTO favorites (user_id, item_id) VALUES (?, ?)`,
        )
            .bind(userId, itemId)
            .run();
    } catch (e) {
        c.status(400);
        return c.body(e);
    }

    if (result.success) {
        c.status(201);
        return c.html(`
        <span id="favorite">
        <button hx-post="/items/${itemSqid}/unfavorite"
        hx-trigger="click"
        hx-target="#favorite"
        hx-swap="outerHTML">
        ★ unfavorite
        </button>
        </span>
        `);
    }

    return c.html(`
    <span id="favorite">
    "Error"
    </span>
    `);
};

export const itemsRemoveFromFavoritesHandler = async (c: any) => {
    const itemSqid = c.req.param("item_sqid");
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get("USER_ID");

    let result;
    try {
        result = await c.env.DB.prepare(
            `DELETE FROM favorites WHERE user_id = ? AND item_id = ?`,
        )
            .bind(userId, itemId)
            .run();
    } catch (e) {
        c.status(400);
        return c.body(e);
    }

    if (result.success) {
        c.status(201);
        return c.html(`
        <span id="favorite">
        <button hx-post="/items/${itemSqid}/favorite"
        hx-trigger="click"
        hx-target="#favorite"
        hx-swap="outerHTML">
        ☆ favorite
        </button>
        </span>
        `);
    }

    return c.html(`
    <span id="favorite">
    "Error"
    </span>
    `);
};

export const itemsAddItembyUrlHandler = async (c: any) => {
    const feedSqid = c.req.param("feed_sqid");
    const feedId = feedSqidToId(feedSqid);

    const blog = await c.env.DB.prepare(`SELECT * FROM feeds WHERE feed_id = ?`)
        .bind(feedId)
        .all();

    const blogTitle = blog.results[0].title;

    return c.html(
        renderHTML(
            "Add new item",
            html`${renderAddItemByURLForm("", "", "", blogTitle)}`,
            c.get("USERNAME"),
            "blogs",
        ),
    );
};

export const itemDeleteHandler = async (c: any) => {
    const itemSqid = c.req.param("item_sqid");
    const itemId = itemSqidToId(itemSqid);

    const dbDeleteResults = await c.env.DB.prepare(`DELETE FROM items WHERE item_id = ?`).bind(itemId).run();
    if (dbDeleteResults.success) {
        return c.html("Item deleted. Delete it from the index yourself dude");
    } else {
        return c.html("ERROR while deleting item from DB");
    }
}

export const itemsAddItemByUrlPostHandler = async (c: any) => {
    const feedSqid = c.req.param("feed_sqid");
    const feedId = feedSqidToId(feedSqid);

    const body = await c.req.parseBody();
    const url = body["url"].toString();
    const urls = body["urls"].toString();
    if (!url && !urls) {
        return c.html("Both URL and URLs are empty")
    }
    if (url && urls) {
        return c.html("Both URL and URLs are filled in, please only fill in one")
    }

    let urls_array;
    if (url) {
        urls_array = [url];
    }
    if (urls) {
        urls_array = urls.split("\r\n");
    }

    // remove empty strings from urls_array
    urls_array = urls_array.filter((url: string) => url !== "");

    let added_items_sqids = [];

    for (const url_value of urls_array) {
        // check if item url already exists in the db
        const existingItem = await c.env.DB.prepare(
            `SELECT items.item_id FROM items WHERE url = ?`,
        ).bind(url_value).run();
        if (existingItem.results.length > 0) {
            continue;
        }
        const articleContent = await scrapeURLIntoObject(c.env, url_value);
        const item = {
            feed_id: feedId,
            title: articleContent.data.title,
            link: url_value,
            published: articleContent.data.published,
            description: articleContent.data.description,
            content_from_content: articleContent.data.content,
        };

        const insert_results = await addItemsToFeed(c.env, [item], feedId, false);  // don't scrape after adding
        const addedItemId = insert_results[0].meta.last_row_id;
        await enqueueItemIndex(c.env, addedItemId);
        const addedItemSqid = itemIdToSqid(addedItemId);
        added_items_sqids.push(addedItemSqid);
    }
    // it was a single URL, redirect to new post
    if (url) {
        return c.redirect(`/items/${added_items_sqids[0]}`);
    }
    // it was multiple URLs, redirect to blog
    return c.redirect(`/blogs/${feedSqid}`);
};

export const itemsScrapeHandler = async (c: any) => {
    const itemSqid = c.req.param("item_sqid");
    await enqueueItemScrape(c.env, itemSqidToId(itemSqid));
    return c.html("Scrape queued...");
};

export const itemsIndexHandler = async (c: any) => {
    const itemSqid = c.req.param("item_sqid");
    await enqueueItemIndex(c.env, itemSqidToId(itemSqid));
    return c.html("Indexing queued...");
};
