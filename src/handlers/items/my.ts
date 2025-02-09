import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderItemShort, renderMySubsections } from '../../htmltools';

// // MY HOME FEED: subs + favorites + friendfeed
export const handleMyAll = async (c: Context) => {
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

        WHERE items.item_sqid IS NOT 0 AND subscriptions.user_id = ?

        UNION

        SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
        FROM items
        JOIN subscriptions ON items.feed_id = subscriptions.feed_id
        JOIN feeds ON items.feed_id = feeds.feed_id
        LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
        JOIN followings ON subscriptions.user_id = followings.followed_user_id

        WHERE items.item_sqid IS NOT 0 AND followings.follower_user_id = ?

        UNION

        SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?

        WHERE items.item_sqid IS NOT 0

        ORDER BY items.pub_date DESC

        LIMIT ? OFFSET ?`,
        ).bind(user_id, user_id, user_id, user_id, user_id, items_per_page + 1, offset),

        c.env.DB.prepare(`
        SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, items_top_cache.content from feeds
        LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id

        ORDER BY feeds.feed_id DESC
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
            c.get('USER_IS_ADMIN')
                ? `${meta0.duration}+${meta1.duration} ms., ${meta0.rows_read}+${meta1.rows_read} rows read`
                : '',
        ),
    );
};
