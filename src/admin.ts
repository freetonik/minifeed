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

    const duplicatesByURL = await c.env.DB.prepare(`
        SELECT COUNT(item_id)
        FROM Items
        WHERE item_sqid IN (
            SELECT url
            FROM Items
            GROUP BY url
            HAVING COUNT(*) > 1
        )`).all();

    const duplicatesByTitle = await c.env.DB.prepare(`
            SELECT COUNT(item_id)
            FROM Items
            WHERE item_sqid IN (
                SELECT title
                FROM Items
                GROUP BY title
                HAVING COUNT(*) > 1
            )`).all();

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

        <tr> <td></td> <td></td> </tr>

        <tr>
            <td>Indexed items</td>
            <td>${items_collection.num_documents}</td>
        </tr>
        <tr>
            <td>Unindexed items</td>
            <td>
                ${all_items_count.results[0]['COUNT(item_id)'] - items_collection.num_documents}
                <a href="/admin/unindexed_items">[list]</a>
            </td>
        </tr>

        <tr> <td></td> <td></td> </tr>

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
            <td>${items_vector_relation_count.results[0]['COUNT(item_id)'] - items_related_cache_count.results[0]['COUNT(item_id)']}
            <a href="/admin/items_without_related_cache">[list]</a>
            </td>

        </tr>

        <tr> <td></td> <td></td> </tr>

        <tr>
            <td>Items without SQID</td>
            <td>${items_without_sqid.results[0]['count(item_id)']}
            <a href="/admin/items_without_sqid">[list]</a>
            </td>
        </tr>

        <tr> <td></td> <td></td> </tr>

        <tr>
            <td>Duplicates by URL</td>
            <td>${duplicatesByURL.results[0]['COUNT(item_id)']}
            <a href="/admin/duplicates">[duplicates]</a>
            </td>
        </tr>

        <tr>
            <td>Duplicates by URL</td>
            <td>${duplicatesByTitle.results[0]['COUNT(item_id)']}
            <a href="/admin/duplicates">[duplicates]</a>
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
            update (fetch new from RSS)
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

export const handleDuplicateItems = async (c: Context) => {
    const duplicatesByURL = await c.env.DB.prepare(`
        SELECT item_id, item_sqid, items.title, feed_sqid, feeds.title as feed_title
        FROM Items
        JOIN feeds on items.feed_id = feeds.feed_id
        WHERE item_sqid IN (
            SELECT url
            FROM Items
            GROUP BY url
            HAVING COUNT(*) > 1
        )`).all();

    const duplicatesByTitle = await c.env.DB.prepare(`
            SELECT item_id, item_sqid, items.title, feed_sqid, feeds.title as feed_title
            FROM Items
            JOIN feeds on items.feed_id = feeds.feed_id
            WHERE item_sqid IN (
                SELECT title
                FROM Items
                GROUP BY title
                HAVING COUNT(*) > 1
            )`).all();

    let list = `<h2>Duplicates by URL: ${duplicatesByURL.results.length}</h2><ol>`;
    for (const item of duplicatesByURL.results) {
        list += `<li><a class="no-color no-underline" href="/items/${item.item_sqid}">${item.title}</a>
            <br>
            <code>${item.item_id}</code> | <code>${item.item_sqid}</code>
            <br>
            <a href="/blogs/${item.feed_sqid}">${item.feed_title}</a>
            <br><br>
            </li>`;
    }
    list += '</ol>';

    list += `<h2>Duplicates by title: ${duplicatesByTitle.results.length}</h2><ol>`;
    for (const item of duplicatesByTitle.results) {
        list += `<li><a class="no-color no-underline" href="/items/${item.item_sqid}">${item.title}</a>
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

export const handleAdminUnindexedItems = async (c: Context) => {
    const allItemIdsEntries = await c.env.DB.prepare(
        'SELECT item_id, item_sqid, items.feed_id, feeds.feed_sqid FROM Items JOIN feeds on items.feed_id = feeds.feed_id ',
    ).all();
    const allDBItems = [];
    for (const item of allItemIdsEntries.results) {
        allDBItems.push({
            feed_id: item.feed_id,
            feed_sqid: item.feed_sqid,
            id: String(item.item_id),
            item_sqid: item.item_sqid,
        });
    }

    const response = await fetch(
        `https://${c.env.TYPESENSE_CLUSTER}:443/collections/${c.env.TYPESENSE_ITEMS_COLLECTION}/documents/export?exclude_fields=content,feed_title,pub_date,url,type,title`,
        {
            method: 'GET',
            headers: { 'X-TYPESENSE-API-KEY': c.env.TYPESENSE_API_KEY },
        },
    );

    const allIndexedItems = await processJsonlStream(response);
    const orphanIndexedItems = findObjsUniqueToListOne(allIndexedItems, allDBItems);
    const unIndexedItems = findObjsUniqueToListOne(allDBItems, allIndexedItems);

    const inner = `
        <h2>All items: ${allDBItems.length}</h2>

        <h2>Indexed items: ${allIndexedItems?.length} / Missing from index: ${allDBItems.length - allIndexedItems.length}</h2>

        <h2>Orphan indexed items (in index, but not in DB): ${orphanIndexedItems.length}</h2>
        ${JSON.stringify(orphanIndexedItems)}

        <h2>Unindexed items (in DB, but not in index): ${unIndexedItems.length}</h2>
        ${JSON.stringify(unIndexedItems)}
    `;

    return c.html(renderHTML('admin | minifeed', raw(inner), c.get('USERNAME'), ''));
};

export const handleAdminItemsWithoutSqid = async (c: Context) => {
    const items_without_sqid = await c.env.DB.prepare(`
        SELECT item_id, item_sqid, items.title, feed_sqid, feeds.title as feed_title
        FROM Items
        JOIN feeds on items.feed_id = feeds.feed_id
        WHERE item_sqid=0`).all();

    let list = '<ol>';
    for (const item of items_without_sqid.results) {
        list += `<li><a class="no-color no-underline" href="/items/${item.item_sqid}">${item.title}</a>
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

export const handleAdminItemsWithoutRelatedCache = async (c: Context) => {
    const items = await c.env.DB.prepare(`
        SELECT items.item_sqid, items_vector_relation.item_id from items_vector_relation
        LEFT JOIN items_related_cache on items_vector_relation.item_id = items_related_cache.item_id
        JOIN items on items.item_id = items_vector_relation.item_id
        WHERE items_related_cache.item_id IS NULL `).all();

    let list = '<ol>';
    for (const item of items.results) {
        list += `<li><a class="no-color no-underline" href="/items/${item.item_sqid}">${item.title}</a>
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

async function processJsonlStream(response: Response) {
    if (!response.body) return;
    const decoder = new TextDecoderStream();
    const reader = response.body.pipeThrough(decoder).getReader();

    const items = [];
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            // Process any remaining data in buffer
            if (buffer.trim()) {
                items.push(JSON.parse(buffer.trim()));
            }
            break;
        }

        // Append new chunk to buffer
        buffer += value;

        // Split by newlines and process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
            if (line.trim()) {
                items.push(JSON.parse(line));
            }
        }
    }

    return items;
}

function findObjsUniqueToListOne(list1: any, list2: any) {
    const list2Ids = new Set(list2.map((obj) => obj.id));

    return list1.filter((obj) => !list2Ids.has(obj.id));
}
