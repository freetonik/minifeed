import type { Context } from 'hono';
import { raw } from 'hono/html';
import { guestFlash, renderGlobalSubsections, renderHTML, renderItemShort } from '../../htmltools';

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
