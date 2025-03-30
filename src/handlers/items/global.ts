import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderGlobalSubsections, renderGuestFlash, renderHTML, renderItemShort } from '../../htmltools';
import { regenerateListOfItemIds } from '../../items';

export async function handleGlobal(c: Context) {
    const userId = c.get('USER_ID') || -1;
    const itemsPerPage = 60;
    const listingType = c.req.param('listingType') || 'newest';
    const page = Number(c.req.query('p')) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    let ordering = 'items.pub_date DESC';
    if (listingType === 'oldest') ordering = 'items.pub_date ASC';
    else if (listingType === 'random') ordering = 'RANDOM()';

    let items = [];
    let metaInfo = {};
    if (listingType === 'oldest' || listingType === 'newest') {
        const { results, meta } = await c.env.DB.prepare(
            `
            SELECT items.item_id, items.item_sqid, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
            FROM items
            JOIN feeds ON items.feed_id = feeds.feed_id
            LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
            WHERE items.item_sqid IS NOT 0
            ORDER BY ${ordering}
            LIMIT ? OFFSET ?`,
        )
            .bind(userId, itemsPerPage + 1, offset)
            .run();
        items = results;
        metaInfo = meta;
    } else if (listingType === 'random') {
        // get ids from UTILITY_LISTS_KV
        let itemIds = await c.env.UTILITY_LISTS_KV.get('all_item_ids', 'json');
        if (!itemIds) itemIds = await regenerateListOfItemIds(c.env);

        // get 60 random elements from itemIds
        // const randomItemIds = itemIds ? JSON.parse(itemIds) : [];
        const shuffledItemIds = itemIds.sort(() => 0.5 - Math.random());
        const selectedItemIds = shuffledItemIds.slice(0, itemsPerPage + 1);
        const { results, meta } = await c.env.DB.prepare(
            `
            SELECT items.item_id, items.item_sqid, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
            FROM items
            JOIN feeds ON items.feed_id = feeds.feed_id
            LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
            WHERE items.item_id IN (${selectedItemIds.map(() => '?').join(',')})`,
        )
            .bind(userId, ...selectedItemIds)
            .run();

        items = results;
        metaInfo = meta;
    }

    if (!items.length) return c.notFound();

    let list = '';
    if (!c.get('USER_LOGGED_IN')) list += renderGuestFlash();
    list += renderGlobalSubsections(listingType);

    for (let i = 0; i < items.length - 1; i++) {
        const item = items[i];
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

    if (listingType !== 'random' && items.length > itemsPerPage) list += `<a href="?p=${page + 1}">More...</a></p>`;

    return c.html(
        renderHTML(c, 'Global feed | minifeed', raw(list), `${metaInfo.duration} ms., ${metaInfo.rows_read} rows read`),
    );
}
