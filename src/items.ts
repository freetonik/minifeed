import type { Context } from 'hono';
import { raw } from 'hono/html';
import type { Bindings } from './bindings';
import { addItemsToFeed } from './feeds';
import {
    renderAddItemByURLForm,
    renderGlobalSubsections,
    renderHTML,
    renderItemShort,
    renderMySubsections,
} from './htmltools';
import type { RelatedItemCached } from './interface';
import { enqueueItemIndex, enqueueItemScrape, enqueueVectorizeStoreItem } from './queue';
import { scrapeURLIntoObject } from './scrape';
import { updateItemIndex } from './search';
import { absolutifyImageUrls, feedSqidToId, getRootUrl, itemIdToSqid, itemSqidToId, sanitizeHTML } from './utils';

export const guestFlash = `<div class="flash">
    <strong>Minifeed</strong> is a curated blog reader and search engine.
    We collect humans-written blogs to make them discoverable and searchable.
    Sign up to subscribe to blogs, follow people, save favorites, and create lists.
    </div>`;

export const handleGlobal = async (c: Context) => {
    const userId = c.get('USER_ID') || -1;
    const items_per_page = 60;
    const listingType = c.req.param('listingType') || 'newest';

    let ordering = 'items.pub_date DESC';
    if (listingType === 'random') ordering = 'RANDOM()';
    else if (listingType === 'oldest') ordering = 'items.pub_date ASC';

    const page = Number(c.req.query('p')) || 1;
    const offset = page * items_per_page - items_per_page;
    const { results, meta } = await c.env.DB.prepare(
        `
        SELECT items.item_id, items.item_sqid, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
        WHERE items.item_sqid IS NOT 0 AND feeds.type = 'blog'
        ORDER BY ${ordering}
        LIMIT ? OFFSET ?`,
    )
        .bind(userId, items_per_page + 1, offset)
        .run();

    let list = '';
    if (!c.get('USER_LOGGED_IN')) {
        list += guestFlash;
    }

    if (!results.length) list += '<p><i>Nothing exists on minifeed yet...</i></p>';

    list += renderGlobalSubsections(listingType);

    if (listingType === 'newest' || listingType === 'random') {
        for (let i = 0; i < results.length - 1; i++) {
            const item = results[i];
            const itemTitle = item.favorite_id ? `★ ${item.item_title}` : item.item_title;

            list += renderItemShort(
                item.item_sqid,
                itemTitle,
                item.item_url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        }
    }

    if (listingType === 'oldest') {
        for (let i = results.length - 1; i > 0; i--) {
            const item = results[i];
            const itemTitle = item.favorite_id ? `★ ${item.item_title}` : item.item_title;

            list += renderItemShort(
                item.item_sqid,
                itemTitle,
                item.item_url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        }
    }

    if (listingType !== 'random' && results.length > items_per_page) list += `<a href="?p=${page + 1}">More...</a></p>`;
    return c.html(
        renderHTML(
            'Global feed | minifeed',
            raw(list),
            c.get('USER_LOGGED_IN'),
            'global',
            '',
            '',
            false,
            c.get('USER_IS_ADMIN') ? `${meta.duration} ms., ${meta.rows_read} rows read` : '',
        ),
    );
};

export const handleHomeForGuest = async (c: Context) => {
    const user_id = c.get('USER_ID');

    const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
            SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, items_top_cache.content from feeds
            LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
            WHERE feeds.type = 'blog'
            ORDER BY RANDOM()
            LIMIT 6`),

        c.env.DB.prepare(`
            SELECT items.item_id, items.item_sqid, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, feeds.feed_sqid, items.description
            FROM items
            JOIN feeds ON items.feed_id = feeds.feed_id
            WHERE items.item_sqid IS NOT 0 AND feeds.type = 'blog'
            ORDER BY items.pub_date DESC
            LIMIT 10`),
    ]);

    const latestBlogs = batch[0].results;
    const latestItems = batch[1].results;

    let latestBlogsBlock = '';
    for (const feed of latestBlogs) {
        const cache_content = JSON.parse(feed.content);
        let top_items_list = '';
        if (cache_content?.top_items) {
            const top_items = cache_content.top_items;
            let items_count = 0;
            items_count = cache_content.items_count - top_items.length;
            top_items_list += '';
            for (const item of top_items) {
                top_items_list += `<li><a class="no-underline hover-underline" href="/items/${item.item_sqid}">${item.title}</a></li>`;
            }
            if (items_count > 0) {
                top_items_list += `<li><i>and <a href="/blogs/${feed.feed_sqid}">more...</a></i></li>`;
            }
        }
        latestBlogsBlock += `
                <div class="blog-summary fancy-gradient-bg box-grid">
                    <h3>
                    <a class="no-color no-underline util-mr-05" href="/blogs/${feed.feed_sqid}">${feed.title}</a>
                    <small>
                        <a class="tag-label no-color" href="${feed.url}">WEB↗</a>
                        <a class="tag-label no-color" href="${feed.rss_url}">RSS↗</a>
                    </small>
                    </h3>
                    <ul>
                        ${top_items_list}
                    </ul>
                </div>`;
    }

    let latestItemsBlock = '';
    for (const item of latestItems) {
        latestItemsBlock += renderItemShort(
            item.item_sqid,
            item.item_title,
            item.item_url,
            item.feed_title,
            item.feed_sqid,
            item.pub_date,
            item.description,
        );
    }

    const guestInner = `
            ${guestFlash}
            <h2>Few random blogs</h2>
            <div class="container-grid">
            ${latestBlogsBlock}
            </div>

            <a class="box-grid box-aftergrid-element no-underline no-color" href="/blogs">
                BROWSE ALL BLOGS →
            </a>

            <h2 style="margin-top: 2em;">Latest posts from all blogs</h2>
            ${latestItemsBlock}

            <a class="box-grid box-aftergrid-element no-underline no-color" href="/global">
                BROWSE ALL POSTS →
            </a>
            `;

    return c.html(renderHTML('My feed | minifeed', raw(guestInner), c.get('USER_LOGGED_IN'), 'my', '', '', false));
};

// // MY HOME FEED: subs + favorites + friendfeed
export const handleMy = async (c: Context) => {
    const user_id = c.get('USER_ID');
    if (!user_id) return c.redirect('/welcome');

    const items_per_page = 30;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * items_per_page - items_per_page;

    const batch = await c.env.DB.batch([
        c.env.DB.prepare(
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

        LIMIT ? OFFSET ?`,
        ).bind(user_id, user_id, user_id, user_id, user_id, items_per_page + 1, offset),

        c.env.DB.prepare(`
        SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, items_top_cache.content from feeds
        LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
        WHERE feeds.type = 'blog'
        ORDER BY feeds.created DESC
        LIMIT 2`),
    ]);

    const results = batch[0].results;
    const latestBlogs = batch[1].results;

    const meta0 = batch[0].meta;
    const meta1 = batch[1].meta;

    let latestBlogsBlock = '';
    for (const feed of latestBlogs) {
        const cache_content = JSON.parse(feed.content);
        let top_items_list = '';
        if (cache_content?.top_items) {
            top_items_list += '';
            for (const item of cache_content.top_items.slice(0, 3)) {
                top_items_list += `<li><a class="no-underline hover-underline" href="/items/${item.item_sqid}">${item.title}</a></li>`;
            }
        }
        latestBlogsBlock += `
                <div class="blog-summary fancy-gradient-bg box-grid">
                    <h3>
                    <a class="no-color no-underline util-mr-05" href="/blogs/${feed.feed_sqid}">${feed.title}</a>
                    <small>
                        <a class="tag-label no-color" href="${feed.url}">WEB↗</a>
                        <a class="tag-label no-color" href="${feed.rss_url}">RSS↗</a>
                    </small>
                    </h3>
                    <ul>
                        ${top_items_list}
                    </ul>
                </div>`;
    }

    const newBlogsBlock = `
    <h3>Newly added blogs (<a href="/blogs">view all</a>) </h3>
    <div class="container-grid util-mb-3">
    ${latestBlogsBlock}
    </div>`;

    let inner = `${renderMySubsections('my')}`;
    if (results.length) {
        for (const [index, item] of results.entries()) {
            const title = item.favorite_id ? `★ ${item.title}` : item.title;
            inner += renderItemShort(
                item.item_sqid,
                title,
                item.url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
            if (index === 9 && page === 1) inner += newBlogsBlock;
        }
        if (results.length < 10) inner += newBlogsBlock;
        if (results.length > items_per_page) inner += `<p><a href="?p=${page + 1}">More</a></p>`;
    } else {
        const randomBlogs = await c.env.DB.prepare(`
            SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, items_top_cache.content from feeds
            LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
            WHERE feeds.type = 'blog'
            ORDER BY RANDOM()
            LIMIT 8`).all();

        let randomBlogsBlock = '';
        for (const feed of randomBlogs.results) {
            const cache_content = JSON.parse(feed.content);
            let top_items_list = '';
            if (cache_content?.top_items) {
                top_items_list += '';
                for (const item of cache_content.top_items) {
                    top_items_list += `<li><a class="no-underline hover-underline" href="/items/${item.item_sqid}">${item.title}</a></li>`;
                }
            }
            randomBlogsBlock += `
                <div class="blog-summary fancy-gradient-bg box-grid">
                    <h3>
                        <a class="no-color no-underline util-mr-05" href="/blogs/${feed.feed_sqid}">${feed.title}</a>
                        <small>
                            <a class="tag-label no-color" href="${feed.url}">WEB↗</a>
                            <a class="tag-label no-color" href="${feed.rss_url}">RSS↗</a>
                        </small>
                    </h3>

                    <div class="util-mt-1">
                        <span id="subscription-${feed.feed_sqid}">
                            <button hx-post="/feeds/${feed.feed_sqid}/subscribe"
                                class="button subscribe"
                                hx-trigger="click"
                                hx-target="#subscription-${feed.feed_sqid}"
                                hx-swap="outerHTML">
                            <span class="subscribed-text">subscribe</span>
                            <span class="unsubscribe-text">unsubscribe</span>
                            </button>
                        </span>
                    </div>
                    <ul>
                        ${top_items_list}
                    </ul>
                </div>`;
        }

        inner += `
        <p class="util-mb-2">
        Your home is empty ☹️ <br>Subscribe to some <strong><a href="/blogs">blogs</a></strong> or follow some <strong><a href="/users">users</a></strong>. Here are some cool blogs to get you started:
        </p>

        <div class="container-grid util-mb-1">
        ${randomBlogsBlock}
        </div>
        <a class="box-grid box-aftergrid-element no-underline no-color" href="/blogs">
            BROWSE ALL BLOGS →
        </a>
        `;
    }

    return c.html(
        renderHTML(
            'My feed | minifeed',
            raw(inner),
            c.get('USER_LOGGED_IN'),
            'my',
            '',
            '',
            false,
            c.get('USER_IS_ADMIN')
                ? `${meta0.duration}+${meta1.duration} ms., ${meta0.rows_read}+${meta1.rows_read} rows read`
                : '',
        ),
    );
};

export const handleMySubscriptions = async (c: Context) => {
    const user_id = c.get('USER_ID');
    const items_per_page = 30;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * items_per_page - items_per_page;

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
        .bind(user_id, user_id, items_per_page + 1, offset)
        .all();

    let inner = ` ${renderMySubsections('subscriptions')}

    `;
    if (results.length) {
        for (const item of results) {
            const title = item.favorite_id ? `★ ${item.title}` : item.title;
            inner += renderItemShort(
                item.item_sqid,
                title,
                item.url,
                item.feed_title,
                item.feed_sqid,
                item.pub_date,
                item.description,
            );
        }
        if (results.length > items_per_page) inner += `<p><a href="?p=${page + 1}">More</a></p></div>`;
    } else {
        const randomBlogs = await c.env.DB.prepare(`
            SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, items_top_cache.content from feeds
            LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
            WHERE feeds.type = 'blog'
            ORDER BY RANDOM()
            LIMIT 8`).all();

        let randomBlogsBlock = '';
        for (const feed of randomBlogs.results) {
            const cache_content = JSON.parse(feed.content);
            let top_items_list = '';
            if (cache_content?.top_items) {
                top_items_list += '';
                for (const item of cache_content.top_items) {
                    top_items_list += `<li><a class="no-underline hover-underline" href="/items/${item.item_sqid}">${item.title}</a></li>`;
                }
            }
            randomBlogsBlock += `
                <div class="blog-summary fancy-gradient-bg box-grid">
                    <h3>
                        <a class="no-color no-underline util-mr-05" href="/blogs/${feed.feed_sqid}">${feed.title}</a>
                        <small>
                            <a class="tag-label no-color" href="${feed.url}">WEB↗</a>
                            <a class="tag-label no-color" href="${feed.rss_url}">RSS↗</a>
                        </small>
                    </h3>

                    <div class="util-mt-1">
                        <span id="subscription-${feed.feed_sqid}">
                            <button hx-post="/feeds/${feed.feed_sqid}/subscribe"
                                class="button subscribe"
                                hx-trigger="click"
                                hx-target="#subscription-${feed.feed_sqid}"
                                hx-swap="outerHTML">
                            <span class="subscribed-text">subscribe</span>
                            <span class="unsubscribe-text">unsubscribe</span>
                            </button>
                        </span>
                    </div>
                    <ul>
                        ${top_items_list}
                    </ul>
                </div>`;
        }

        inner += `
        <p class="util-mb-2">
        Your have no subscriptions ☹️ <br>Subscribe to some <strong><a href="/blogs">blogs</a></strong>. Here are some cool blogs to get you started:
        </p>

        <div class="container-grid util-mb-1">
        ${randomBlogsBlock}
        </div>
        <a class="box-grid box-aftergrid-element no-underline no-color" href="/blogs">
            BROWSE ALL BLOGS →
        </a>
        `;
    }
    return c.html(
        renderHTML(
            'Subscriptions | minifeed',
            raw(inner),
            c.get('USER_LOGGED_IN'),
            'my',
            '',
            '',
            false,
            c.get('USER_IS_ADMIN') ? `${meta.duration} ms., ${meta.rows_read} rows read` : '',
        ),
    );
};

export const handleMyFriendfeed = async (c: Context) => {
    const userId = c.get('USER_ID');
    const itemsPerPage = 30;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

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
        .bind(userId, userId, itemsPerPage + 1, offset)
        .all();

    let list = `
    ${renderMySubsections('friendfeed')}
    <div class="main">
    `;
    if (results.length) {
        for (const item of results) {
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
        }
        if (results.length > itemsPerPage) list += `<p><a href="?p=${page + 1}">More</a></p></div>`;
    } else {
        if (page === 1) {
            list += `You don't follow anyone, or you do, but they aren't subscribed to anything :-( <br> <strong><a href="/users">View all users</a></strong>.`;
        }
    }

    return c.html(
        renderHTML(
            'Friendfeed | minifeed',
            raw(list),
            c.get('USERNAME'),
            'my',
            '',
            '',
            false,
            c.get('USER_IS_ADMIN') ? `${meta.duration} ms., ${meta.rows_read} rows read` : '',
        ),
    );
};
export const handleMyFavorites = async (c: Context) => {
    const itemsPerPage = 30;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const userId = c.get('USER_ID');
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
        .bind(userId, itemsPerPage + 1, offset)
        .all();

    let list = `
    ${renderMySubsections('favorites')}
    <div class="main">
    `;
    if (results.length) {
        for (const item of results) {
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
        }
        if (results.length > itemsPerPage) list += `<p><a href="?p=${page + 1}">More</a></p>`;
    } else {
        list += `You haven't added anything to favorites yet.`;
    }
    list += '</div>';

    return c.html(
        renderHTML(
            'Favorites | minifeed',
            raw(list),
            c.get('USERNAME'),
            'my',
            '',
            '',
            false,
            c.get('USER_IS_ADMIN') ? `${meta.duration} ms., ${meta.rows_read} rows read` : '',
        ),
    );
};
export const handleItemsSingle = async (c: Context) => {
    const item_sqid = c.req.param('item_sqid');
    const item_id: number = itemSqidToId(item_sqid);
    const user_id = c.get('USER_ID') || -1;
    const user_logged_in = c.get('USER_LOGGED_IN');

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
        items.feed_id,
        items.title AS item_title,
        items.description,
        items.content_html,
        items.pub_date,
        items.url AS item_url,
        feeds.title AS feed_title,
        feeds.feed_sqid,
        feeds.type,
        favorite_id,
        items_related_cache.content AS related_content
    FROM items
    JOIN feeds ON items.feed_id = feeds.feed_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    LEFT JOIN items_related_cache on items.item_id = items_related_cache.item_id
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

    const user_is_subscribed = batch[0].results.length;

    const item = batch[1].results[0];
    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    const post_date = new Date(item.pub_date).toLocaleDateString('en-UK', date_format_opts);

    let contentBlock = '';

    if (!item.description && !item.content_html) {
        contentBlock = `<div class="flash" style="margin-top:1em;">This post cannot be viewed on Minifeed. <a href="${item.item_url}" target="_blank">↗ Open original</a></div>`;
    } else {
        if (user_logged_in) {
            contentBlock = item.content_html || item.description;
            try {
                contentBlock = await sanitizeHTML(contentBlock);
                contentBlock = await absolutifyImageUrls(contentBlock, getRootUrl(item.item_url));
            } catch {
                contentBlock = item.description;
            }
            contentBlock += `<div class="flash" style="margin-top:1em;">This page shows contents from RSS. <a href="${item.item_url}" target="_blank">↗ Open original to view full content</a></div>`;
        } else {
            // User is not logged in; description has tags stripped, no need to sanitize
            contentBlock = `${item.description} <div class="flash" style="margin-top:1em;">This is a short summary. <a href="${item.item_url}" target="_blank">↗ Open original to view full content</a></div>`;
        }
    }

    let favoriteBlock = '';
    let subscriptionBlock = '';
    let lists_block = '';
    if (user_logged_in) {
        lists_block = `
        <span id="lists">
            <button class="button" hx-get="/items/${item_sqid}/lists"
            class="button"
            hx-target="#lists_section"
            hx-swap="outerHTML">
            ⛬ list
            </button>
        </span>
        `;

        if (item.favorite_id) {
            favoriteBlock = `<span id="favorite">
            <button hx-post="/items/${item_sqid}/unfavorite"
            class="button"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ★ unfavorite
            </button>
            </span>`;
        } else {
            favoriteBlock = `<span id="favorite">
            <button hx-post="/items/${item_sqid}/favorite"
            class="button"
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
            class="button subscribed"
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
            class="button subscribe"
            hx-trigger="click"
            hx-target="#subscription-${item.feed_sqid}"
            hx-swap="outerHTML">
            subscribe
            </button>
            </span>`;
        }
    } else {
        lists_block = `<span id="favorite"> <button class="button" title="Log in to add to list" disabled>⛬ list</button> </span>`;
        favoriteBlock = `<span id="favorite"> <button class="button" title="Log in to favorite" disabled> ☆ favorite </button> </span>`;
        subscriptionBlock = `<span id="subscription"> <button class="button" disabled title="Login to subscribe"> <span>subscribe</span> </button> </span>`;
    }

    let otherItemsBlock = '';
    if (batch[2].results.length) {
        otherItemsBlock += `<div class="related-items fancy-gradient-bg"><h4>More from <a href="/blogs/${item.feed_sqid}"">${item.feed_title}</a></h4><div class="items">`;
        for (const related_item of batch[2].results) {
            const itemTitle = related_item.favorite_id ? `★ ${related_item.item_title}` : related_item.item_title;
            otherItemsBlock += renderItemShort(
                related_item.item_sqid,
                itemTitle,
                related_item.item_url,
                '',
                '',
                related_item.pub_date,
                related_item.description,
            );
        }
        otherItemsBlock += '</div></div>';
    }

    let related_block = '';
    if (item.related_content) {
        const related_content = JSON.parse(item.related_content);
        const related_from_other_blogs = related_content.relatedFromOtherBlogs;

        related_block += `<div class="related-items">`;
        if (related_from_other_blogs?.length) related_block += '<h4>Related</h4><div class="items fancy-gradient-bg">';
        for (const i of related_from_other_blogs) {
            related_block += renderItemShort(i.item_sqid, i.title, i.url, i.feed_title, i.feed_sqid);
        }
        related_block += '</div></div>';
    }

    let list = `
    <h1 style="margin-bottom: 0.25em;">${item.item_title} </h1>

    <div class="item-metadata">
        from ${item.type} <a href="/blogs/${item.feed_sqid}"">${item.feed_title}</a>, <time>${post_date}</time> | <a href="${item.item_url}" target="_blank">↗&nbsp;original</a>
    </div>
    <div class="item-actions">
        <div style="display: flex; gap: 0.25em;">
        ${favoriteBlock}
        ${lists_block}
        <a class="button" href="${item.item_url}" target="_blank">↗ original</a>
        </div>
        <div>
        ${subscriptionBlock}
        </div>
    </div>
    <div id="lists_section" class="lists-section"></div>
    <article style="margin-top:3em;">
    ${contentBlock}
    </article>
    ${related_block}
    ${otherItemsBlock}
    `;

    let debug_info = '';
    if (c.get('USER_IS_ADMIN')) {
        debug_info = `${batch[0].meta.duration}+${batch[1].meta.duration}+${batch[2].meta.duration} ms.;
            ${batch[0].meta.rows_read}+${batch[1].meta.rows_read}+${batch[2].meta.rows_read} rows read`;

        list += `
        <p style="text-align:center;"><a class="no-underline" href="#hidden">🦎</a></p>
        <div class="borderbox admin-control" id="hidden">
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
        </table>

        <p>
        <button hx-post="/admin/items/${item_sqid}/scrape"
            hx-trigger="click"
            hx-target="#scrape-indicator"
            hx-swap="outerHTML">
            scrape
        </button>
        <span id="scrape-indicator"></span>

        <button hx-post="/admin/items/${item_sqid}/index"
            hx-trigger="click"
            hx-target="#index-indicator"
            hx-swap="outerHTML">
            re-index
        </button>
        <span id="index-indicator"></span>

        <button hx-post="/admin/items/${item_sqid}/delete"
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
            raw(list),
            c.get('USERNAME'),
            'blogs',
            '',
            item.item_url,
            false,
            debug_info,
        ),
    );
};

// Renders lists for item
export const handleItemsLists = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get('USER_ID');

    const lists = await c.env.DB.prepare(
        `SELECT item_lists.list_id, item_lists.title, item_lists.list_sqid, item_list_items.item_id
        FROM item_lists
        LEFT JOIN item_list_items ON item_list_items.list_id = item_lists.list_id
        WHERE user_id = ?
        `,
    )
        .bind(userId)
        .all();

    // lists.results contains instances of lists with items
    const lists_with_current_item = lists.results.filter((list) => list.item_id === itemId);
    const lists_without_current_item = lists.results
        // remove list instances that already have the item
        // .filter((list: any) => list.item_id != itemId)
        // subtract lists_with_current_item
        .filter(
            (list: any) => !lists_with_current_item.some((listWithItem: any) => listWithItem.list_id === list.list_id),
        )
        // remove duplicates
        .filter(
            (list: any, index: number, self: any) => index === self.findIndex((t: any) => t.list_id === list.list_id),
        );

    const list_objects: { [key: string]: string } = {};
    for (const list of lists_with_current_item) {
        list_objects[list.title] =
            `<strong><a class="no-underline no-color" href="/lists/${list.list_sqid}">${list.title}</a></strong> <a href="" hx-post="/items/${itemSqid}/lists/${list.list_sqid}/remove" hx-swap="outerHTML transition:true">[- remove from list]</a><br>`;
    }

    for (const list of lists_without_current_item) {
        list_objects[list.title] =
            `<a class="no-underline no-color" href="/lists/${list.list_sqid}">${list.title}</a> <a href="" hx-post="/items/${itemSqid}/lists/${list.list_sqid}/add" hx-swap="outerHTML transition:true"><strong>[+ add to list]</strong></a><br>`;
    }

    const lists_html = Object.keys(list_objects)
        .sort()
        .map((key) => list_objects[key])
        .join('');

    const content = `
    <div id="lists_section" class="lists-section" >
    <div style="padding: 1em;">
    ${lists_html}
    <strong>
    <a href="" hx-get="/items/${itemSqid}/lists/new" hx-trigger="click" hx-target="this" hx-swap="outerHTML"><br>
        [create new list and add to it]
    </a>
    </strong>
    </div>
    </div>
    `;

    return c.html(content);
};

export const handleItemsListsNewForm = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    return c.html(`<form hx-post="/items/${itemSqid}/lists" hx-target="this" hx-swap="outerHTML" style="margin-top:0.5em;">
    <input type="text" name="list_title" placeholder="Type list title and press Enter" style="font-size: inherit !important;padding: 0.25em 0.5em !important;">
    </form>`);
};

function checkListTitle(listTitle: string) {
    // allow only latin chars, numbers, -, +, =, ?, _, and space
    const goodChars = /^[a-zA-Z0-9\-=+?_ ]{3,32}$/.test(listTitle);
    // disallow first or last char to be space; disallow consecutive spaces
    const goodStructure = /^\S(?!.*\s{3,}).*\S$/.test(listTitle);
    return goodChars && goodStructure;
}

export const handleItemsListsNewPOST = async (c: Context) => {
    const body = await c.req.parseBody();
    const itemSqid = c.req.param('item_sqid');
    const listTitle = body.list_title.toString();

    if (!checkListTitle(listTitle))
        return c.html(`
        <form hx-post="/items/${itemSqid}/lists" hx-target="this" hx-swap="outerHTML" style="margin-top:0.5em;">
            <input type="text" name="list_title" placeholder="Type list title and press Enter" value="${listTitle}" style="font-size: inherit !important;padding: 0.25em 0.5em !important;">
            <i style="margin-top: 0.5em; display: block; color: var(--color-red);">
            Such bad title! Rules: 3 char minimum, latin letters, numbers, -, +, =, ?, _, and one space space at a time. This is good for everybody.
            </i>
        </form>
        `);

    const result = await c.env.DB.prepare('INSERT INTO item_lists (user_id, title) VALUES (?, ?)')
        .bind(c.get('USER_ID'), listTitle)
        .run();

    const list_id = result.meta.last_row_id;
    const list_sqid = itemIdToSqid(list_id);

    // set sqid of list
    await c.env.DB.prepare('UPDATE item_lists SET list_sqid = ? WHERE list_id = ?').bind(list_sqid, list_id).run();

    const itemId: number = itemSqidToId(itemSqid);
    // add item to list
    await c.env.DB.prepare('INSERT INTO item_list_items (list_id, item_id) VALUES (?, ?)').bind(list_id, itemId).run();

    return c.html(
        `<a class="no-underline no-color" href="/lists/${list_sqid}">${listTitle}</a> <a hx-post="/items/${itemSqid}/lists/${list_sqid}/remove" hx-swap="outerHTML transition:true">[- remove from list]</a><br>`,
    );
};

// add item to list
export const handleItemsListsAddPOST = async (c: Context) => {
    const item_sqid = c.req.param('item_sqid');
    const list_sqid = c.req.param('list_sqid');
    const item_id = itemSqidToId(item_sqid);
    const list_id = itemSqidToId(list_sqid);

    const result = await c.env.DB.prepare('INSERT INTO item_list_items (list_id, item_id) VALUES (?, ?)')
        .bind(list_id, item_id)
        .run();

    if (result.success) return c.html('[added]');
    return c.html('Error while adding item to list');
};

export const handleItemsListsRemovePOST = async (c: Context) => {
    const item_sqid = c.req.param('item_sqid');
    const list_sqid = c.req.param('list_sqid');
    const item_id = itemSqidToId(item_sqid);
    const list_id = itemSqidToId(list_sqid);

    const result = await c.env.DB.prepare('DELETE FROM item_list_items WHERE list_id = ? AND item_id = ?')
        .bind(list_id, item_id)
        .run();

    if (result.success) return c.html('[removed]');
    return c.html('Error while removing item from list');
};

export const handleItemsAddToFavorites = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get('USER_ID');

    try {
        const result = await c.env.DB.prepare('INSERT INTO favorites (user_id, item_id) VALUES (?, ?)')
            .bind(userId, itemId)
            .run();
        if (result.success) {
            c.status(201);
            return c.html(`
        <span id="favorite">
        <button hx-post="/items/${itemSqid}/unfavorite"
        class="button"
        hx-trigger="click"
        hx-target="#favorite"
        hx-swap="outerHTML">
        ★ unfavorite
        </button>
        </span>
        `);
        }
    } catch (e) {
        c.status(400);
        return c.json({ error: 'An error occurred' });
    }

    return c.html(`
    <span id="favorite">
    "Error"
    </span>
    `);
};
export const handleItemsRemoveFromFavorites = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get('USER_ID');

    try {
        const result = await c.env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND item_id = ?')
            .bind(userId, itemId)
            .run();
        if (result.success) {
            c.status(201);
            return c.html(`
                <span id="favorite">
                <button hx-post="/items/${itemSqid}/favorite"
                class="button"
                hx-trigger="click"
                hx-target="#favorite"
                hx-swap="outerHTML">
                ☆ favorite
                </button>
                </span>
                `);
        }
    } catch (e) {
        c.status(400);
        return c.json({ error: 'An error occurred' });
    }

    return c.html(` <span id="favorite"> "Error" </span> `);
};

export const handleItemsAddItembyUrl = async (c: Context) => {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    const blog = await c.env.DB.prepare('SELECT * FROM feeds WHERE feed_id = ?').bind(feedId).all();

    const blogTitle = blog.results[0].title;

    return c.html(
        renderHTML('Add new item', renderAddItemByURLForm('', '', '', blogTitle), c.get('USERNAME'), 'blogs'),
    );
};

export const handleItemsDelete = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId = itemSqidToId(itemSqid);

    const dbDeleteResults = await c.env.DB.prepare('DELETE FROM items WHERE item_id = ?').bind(itemId).run();
    if (c.env.ENVIRONMENT !== 'dev') await c.env.VECTORIZE.deleteByIds([`${itemId}`]);
    if (dbDeleteResults.success) {
        return c.html('Item deleted. Delete it from the index yourself dude');
    }
    return c.html('ERROR while deleting item from DB');
};

export const handleItemsAddItemByUrlPOST = async (c: Context) => {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    const body = await c.req.parseBody();
    const url = body.url.toString();
    const urls = body.urls.toString();
    if (!url && !urls) {
        return c.html('Both URL and URLs are empty');
    }
    if (url && urls) {
        return c.html('Both URL and URLs are filled in, please only fill in one');
    }

    let urls_array: Array<string>;
    if (url) {
        urls_array = [url];
    } else if (urls) {
        urls_array = urls.split('\r\n');
    } else urls_array = [];

    if (!urls_array.length) return c.html('No URLs provided');

    // remove empty strings from urls_array
    urls_array = urls_array.filter((url: string) => url !== '');

    const added_items_sqids = [];

    for (const url_value of urls_array) {
        // check if item url already exists in the db
        const existingItem = await c.env.DB.prepare('SELECT items.item_id FROM items WHERE url = ?')
            .bind(url_value)
            .run();
        if (existingItem.results.length > 0) {
            continue;
        }
        const articleContent = await scrapeURLIntoObject(url_value);
        const item = {
            feed_id: feedId,
            title: articleContent.title,
            link: url_value,
            published: articleContent.published,
            description: articleContent.description,
            content_from_content: articleContent.HTMLcontent,
        };

        const insert_results = await addItemsToFeed(c.env, [item], feedId, false); // don't scrape after adding
        const addedItemId = insert_results[0].meta.last_row_id;

        // await enqueueItemIndex(c.env, addedItemId); // addItemsToFeed(..scrapeAfterAdding=false), so scrape it...
        await updateItemIndex(c.env, addedItemId, articleContent.textContent);
        await enqueueVectorizeStoreItem(c.env, addedItemId); // ... and vectorize it...

        const addedItemSqid = itemIdToSqid(addedItemId);
        added_items_sqids.push(addedItemSqid);
    }
    // it was a single URL, redirect to new post
    if (url) {
        if (added_items_sqids.length > 1) {
            return c.redirect(`/items/${added_items_sqids[0]}`);
        }
        throw new Error('No items added. Probably all of them already exist in the database by unique URL');
    }
    // it was multiple URLs, redirect to blog
    return c.redirect(`/blogs/${feedSqid}`);
};

export const handleItemsScraping = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    await enqueueItemScrape(c.env, itemSqidToId(itemSqid));
    return c.html('Scrape queued...');
};

export const handleItemsIndexing = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    await enqueueItemIndex(c.env, itemSqidToId(itemSqid));
    return c.html('Indexing queued...');
};

export const regenerateRelatedCacheForItem = async (env: Bindings, itemId: number) => {
    const vectors = await env.VECTORIZE.getByIds([`${itemId}`]);
    if (!vectors.length) return;

    const item = await env.DB.prepare(
        `SELECT items.item_id, feeds.title as feed_title
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        WHERE item_id = ?`,
    )
        .bind(itemId)
        .first();

    if (!item) throw new Error(`Item with id ${itemId} not found`);

    const cache_content: { relatedFromOtherBlogs: RelatedItemCached[]; relatedFromThisBlog: RelatedItemCached[] } = {
        relatedFromOtherBlogs: [],
        relatedFromThisBlog: [],
    };

    // Processing items from other blogs
    const matchesOtherBlogs = await env.VECTORIZE.query(vectors[0].values, {
        topK: 11,
        filter: { feed_id: { $ne: `${item.feed_id}` } },
    });

    const relatedIDsOtherBlog: Array<string> = [];
    for (const match of matchesOtherBlogs.matches) {
        if (match.id === `${itemId}`) continue; // skip current item itself
        relatedIDsOtherBlog.push(match.id);
    }
    const queryBindPlaceholders = relatedIDsOtherBlog.map(() => '?').join(','); // Generate '?,?,...,?'
    const relatedItemsOtherBlog = await env.DB.prepare(
        `SELECT item_id, item_sqid, items.title, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, items.url
        FROM items
        JOIN  feeds ON items.feed_id = feeds.feed_id
        WHERE item_id IN (${queryBindPlaceholders})`,
    )
        .bind(...relatedIDsOtherBlog)
        .all();

    for (const i of relatedItemsOtherBlog.results) {
        cache_content.relatedFromOtherBlogs.push({
            title: i.title as string,
            item_id: i.item_id as number,
            item_sqid: i.item_sqid as string,
            feed_title: i.feed_title as string,
            feed_id: i.feed_id as number,
            feed_sqid: i.feed_sqid as string,
            url: i.url as string,
        });
    }
    console.log(`Regenerated cache for item ${itemId}`);
    await env.DB.prepare(
        'REPLACE INTO items_related_cache (item_id, content, created) values (?, ?, CURRENT_TIMESTAMP)',
    )
        .bind(itemId, JSON.stringify(cache_content))
        .run();
};

export const regenerateRelatedCacheForItemMOCK = async (env: Bindings, itemId: number) => {
    if (env.ENVIRONMENT !== 'dev') return;

    const item = await env.DB.prepare(
        `SELECT items.item_id, feeds.title as feed_title
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        WHERE item_id = ?`,
    )
        .bind(itemId)
        .first();

    if (!item) throw new Error(`Item with id ${itemId} not found`);

    const cache_content: { relatedFromOtherBlogs: RelatedItemCached[]; relatedFromThisBlog: RelatedItemCached[] } = {
        relatedFromOtherBlogs: [],
        relatedFromThisBlog: [],
    };

    const relatedIDsOtherBlog: Array<string> = [];

    const randomItems = await env.DB.prepare(
        `SELECT item_id, item_sqid, items.title, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, items.url
        FROM items
        JOIN  feeds ON items.feed_id = feeds.feed_id
        ORDER BY RANDOM()
        LIMIT 10`,
    ).all();

    relatedIDsOtherBlog.push(...randomItems.results.map((i: any) => i.item_id));

    const queryBindPlaceholders = relatedIDsOtherBlog.map(() => '?').join(','); // Generate '?,?,...,?'
    const relatedItemsOtherBlog = await env.DB.prepare(
        `SELECT item_id, item_sqid, items.title, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, items.url
        FROM items
        JOIN  feeds ON items.feed_id = feeds.feed_id
        WHERE item_id IN (${queryBindPlaceholders})`,
    )
        .bind(...relatedIDsOtherBlog)
        .all();

    for (const i of relatedItemsOtherBlog.results) {
        cache_content.relatedFromOtherBlogs.push({
            title: i.title as string,
            item_id: i.item_id as number,
            item_sqid: i.item_sqid as string,
            feed_title: i.feed_title as string,
            feed_id: i.feed_id as number,
            feed_sqid: i.feed_sqid as string,
            url: i.url as string,
        });
    }
    console.log(`Regenerated cache for item ${itemId}`);
    await env.DB.prepare(
        'REPLACE INTO items_related_cache (item_id, content, created) values (?, ?, CURRENT_TIMESTAMP)',
    )
        .bind(itemId, JSON.stringify(cache_content))
        .run();
};
