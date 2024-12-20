import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderItemShort } from '../../htmltools';
import { itemSqidToId } from '../../utils';

export const handleListsSingle = async (c: Context) => {
    const listSqid = c.req.param('list_sqid');
    const listId = itemSqidToId(listSqid);
    const userId = c.get('USER_ID');

    const [list, list_items] = await c.env.DB.batch([
        c.env.DB.prepare(
            `SELECT *
            FROM item_lists
            JOIN users ON users.user_id = item_lists.user_id
            WHERE list_id = ?`,
        ).bind(listId),
        c.env.DB.prepare(
            `SELECT items.item_sqid, items.title, items.url, items.pub_date, feeds.title as feed_title, feeds.feed_sqid
            FROM item_list_items
            JOIN items ON items.item_id = item_list_items.item_id
            JOIN feeds ON items.feed_id = feeds.feed_id
            WHERE list_id = ?`,
        ).bind(listId),
    ]);

    const listEntry = list.results[0];
    if (!listEntry) return c.notFound();

    let inner = `<h1 style="margin-bottom:0">${listEntry.title}</h1>
    <p style="margin: 0.75em 0 3em;">list by <a href="/users/${listEntry.username}">@${listEntry.username}</a></p>`;
    for (const item of list_items.results) {
        inner += renderItemShort(item.item_sqid, item.title, item.url, item.feed_title, item.feed_sqid, item.pub_date);
    }

    if (userId === listEntry.user_id) {
        inner += `<p>
            <button hx-confirm="Are you sure?" hx-swap="outerHTML transition:true" hx-post="/lists/${listSqid}/delete">Delete list</button>
        </p>`;
    }

    return c.html(renderHTML(`${listEntry.title} list | minifeed`, raw(inner), c.get('USER_LOGGED_IN'), 'lists'));
};
