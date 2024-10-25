import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { getCollection } from './search';

export const handleAdmin = async (c: Context) => {
    let list = '';
    const feeds = await c.env.DB.prepare(
        'SELECT * FROM feeds LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id ORDER BY feed_id ASC ',
    ).all();
    const feed_count = await c.env.DB.prepare('SELECT COUNT(feed_id) FROM feeds').all();
    const all_items_count = await c.env.DB.prepare('SELECT COUNT(item_id) FROM Items').all();
    const items_collection = await getCollection(c.env);
    const items_related_cache_count = await c.env.DB.prepare('SELECT COUNT(item_id) FROM items_related_cache').all();
    const items_vector_relation_count = await c.env.DB.prepare(
        'SELECT COUNT(item_id) FROM items_vector_relation',
    ).all();
    const items_without_sqid = await c.env.DB.prepare('SELECT count(item_id) FROM Items where item_sqid=0').all();
    const unvectorized_items_count = await c.env.DB.prepare(
        `SELECT count(items.item_id)
        FROM items 
        LEFT JOIN items_vector_relation on items.item_id = items_vector_relation.item_id 
        WHERE items_vector_relation.vectorized is null`,
    ).all();

    list += `
    <style>
        table {
            border-collapse: collapse;
            margin-bottom: 1em;
        }
        th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
        }
    </style>

    <table>
        <tr>
            <th>Metric</th>
            <th>Count</th>
        </tr>
        <tr>
            <td>Feeds</td>
            <td>${feed_count.results[0]['COUNT(feed_id)']}</td>
        </tr>
        <tr>
            <td>Items</td>
            <td>${all_items_count.results[0]['COUNT(item_id)']}</td>
        </tr>
        <tr>
            <td>Indexed items</td>
            <td>${items_collection.num_documents}</td>
        </tr>
        <tr>
            <td>Vectorized items</td>
            <td>${items_vector_relation_count.results[0]['COUNT(item_id)']}</td>
        </tr>
        <tr>
            <td>Unvectorized items</td>
            <td>
                ${unvectorized_items_count.results[0]['count(items.item_id)']}
                <a href="/admin/unvectorized_items">[list]</a>
            </td>
        </tr>
        <tr>
            <td>Related items cache</td>
            <td>${items_related_cache_count.results[0]['COUNT(item_id)']}</td>
        </tr>
        <tr>
            <td>Related missing</td>
            <td>${items_vector_relation_count.results[0]['COUNT(item_id)'] - items_related_cache_count.results[0]['COUNT(item_id)']}</td>
        </tr>
        <tr>
            <td>Items without SQID</td>
            <td>${items_without_sqid.results[0]['count(item_id)']}
            <a href="/admin/items_without_sqid">[list]</a>
            </td>
        </tr>
    </table>
    `;

    for (const feed of feeds.results) {
        let items_count = 'unknown amount of ';
        if (feed.content) {
            items_count = JSON.parse(feed.content).items_count;
        }
        list += `<div style="border:1px solid grey; margin-bottom:1em; padding: 1em;">
        <strong>${feed.title}</strong> <br>
        ${items_count} posts |
        ID: ${feed.feed_id}, SQID: <a href="/blogs/${feed.feed_sqid}">${feed.feed_sqid}</a>
        ${feed.verified ? '✅' : '❌'}

        <p>
        <button hx-post="/admin/feeds/${feed.feed_sqid}/delete"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#delete-indicator-${feed.feed_sqid}"
        hx-swap="outerHTML">
        delete
        </button>

        <button hx-post="/admin/feeds/${feed.feed_sqid}/update"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#update-indicator-${feed.feed_sqid}"
        hx-swap="outerHTML">
        update
        </button>

        <button hx-post="/admin/feeds/${feed.feed_sqid}/scrape"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#scrape-indicator-${feed.feed_sqid}"
        hx-swap="outerHTML">
        scrape
        </button>

        <button hx-post="/admin/feeds/${feed.feed_sqid}/index"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#index-indicator-${feed.feed_sqid}"
        hx-swap="outerHTML">
        re-index feed
        </button>

        <button hx-post="/admin/feeds/${feed.feed_sqid}/index_items"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#index-indicator-${feed.feed_sqid}"
        hx-swap="outerHTML">
        re-index items
        </button>

        <button hx-post="/admin/feeds/${feed.feed_sqid}/rebuild_cache"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#rebuild-cache-indicator-${feed.feed_sqid}"
        hx-swap="outerHTML">
        rebuild cache
        </button>

        <div>
            <span id="index-indicator-${feed.feed_sqid}"></span>
            <span id="update-indicator-${feed.feed_sqid}"></span>
            <span id="scrape-indicator-${feed.feed_sqid}"></span>
            <span id="delete-indicator-${feed.feed_sqid}"></span>
            <span id="rebuild-cache-indicator-${feed.feed_sqid}"></span>
        </div>
        </p>
        </div>`;

        // const robots = await getRobots(feed.url);
        // if (!robots) list += '<p>no robots.txt</p>';
        // else {
        //     list += `<p><strong>Robots.txt:</strong> ${robots.isAllowed(feed.url, 'ia_archiver')}</p>`;
        // }
    }

    list += `
    <button hx-post="/admin/feeds/index"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#index-indicator-global"
        hx-swap="outerHTML">
        re-index all feeds
    </button>
    <button hx-post="/admin/feeds/index"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#index-indicator-global"
        hx-swap="outerHTML">
        re-index all items of all feeds
    </button>
    <button hx-post="/admin/feeds/rebuild_cache"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#rebuild-cache-indicator-global"
        hx-swap="outerHTML">
        rebuild caches all feeds
    </button>

    <div>
        <span id="index-indicator-global"></span>
        <span id="rebuild-cache-indicator-global"></span>
    </div>
    `;

    return c.html(renderHTML('admin | minifeed', raw(list), c.get('USERNAME'), ''));
};

export const handleAdminUnvectorizedItems = async (c: Context) => {
    let list = '<ol>';

    const unvectorized_items = await c.env.DB.prepare(
        `SELECT items.item_id, items.feed_id, items.title, items.item_sqid, feeds.title as feed_title, feeds.feed_sqid
        FROM items 
        LEFT JOIN feeds on items.feed_id = feeds.feed_id
        LEFT JOIN items_vector_relation on items.item_id = items_vector_relation.item_id 
        WHERE items_vector_relation.vectorized is null
        `,
    ).all();

    for (const item of unvectorized_items.results) {
        list += `<li>
            <a class="no-color no-underline" href="/items/${item.item_sqid}">${item.title}</a> 
            <a href="/admin/vectorize?start=${item.item_id}&stop=${item.item_id}">[vectorize]</a>
            <br> 
            <code>${item.item_id}</code> | <code>${item.item_sqid}</code>
            <br>
            <a href="/blogs/${item.feed_sqid}">${item.feed_title}</a>
            <br><br>
            </li>`;
    }
    list += '</ol>';

    return c.html(renderHTML('admin | minifeed', raw(list), c.get('USERNAME'), ''));
};

export const handleAdminItemsWithoutSqid = async (c: Context) => {
    let list = '<ol>';

    const items_without_sqid = await c.env.DB.prepare(`
        SELECT item_id, item_sqid, items.title, feed_sqid, feeds.title as feed_title
        FROM Items 
        JOIN feeds on items.feed_id = feeds.feed_id
        WHERE item_sqid=0`).all();

    for (const item of items_without_sqid.results) {
        list += `<li><a class="no-color no-underline" href="/items/${item.item_sqid}">${item.title}</a> 
            <br> 
            <code>${item.item_id}</code> | <code>${item.item_sqid}</code>
            <br>
            <a href="/feeds/${item.feed_sqid}">${item.feed_title}</a>
            <br><br>
            </li>`;
    }
    list += '</ol>';

    return c.html(renderHTML('admin | minifeed', raw(list), c.get('USERNAME'), ''));
};
