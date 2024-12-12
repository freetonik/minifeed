import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderItemShort, renderMySubsections } from '../../htmltools';

export const handleMyFavorites = async (c: Context) => {
    const itemsPerPage = 30;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const userId = c.get('USER_ID');
    const { results, meta } = await c.env.DB.prepare(`
    SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_sqid, favorite_id, items.description
    FROM items
    JOIN favorites ON items.item_id = favorites.item_id
    JOIN feeds ON items.feed_id = feeds.feed_id
    WHERE items.item_sqid IS NOT 0 AND favorites.user_id = ?
    ORDER BY items.pub_date DESC
    LIMIT ? OFFSET ?
    `)
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
