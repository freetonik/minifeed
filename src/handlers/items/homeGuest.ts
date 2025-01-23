import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderGuestFlash, renderHTML, renderItemShort } from '../../htmltools';

export const handleHomeForGuest = async (c: Context) => {
    const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
            SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, items_top_cache.content from feeds
            LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
            ORDER BY RANDOM()
            LIMIT 6`),

        c.env.DB.prepare(`
            SELECT items.item_id, items.item_sqid, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, feeds.feed_sqid, items.description
            FROM items
            JOIN feeds ON items.feed_id = feeds.feed_id
            WHERE items.item_sqid IS NOT 0
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
        ${renderGuestFlash}
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

    return c.html(renderHTML('Minifeed', raw(guestInner), c.get('USER_LOGGED_IN'), 'my'));
};
