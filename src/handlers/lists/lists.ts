import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderGuestFlash, renderHTML } from '../../htmltools';

export const handleLists = async (c: Context) => {
    const lists = await c.env.DB.prepare(
        `SELECT DISTINCT item_lists.*, users.username, COUNT(item_list_items.item_id) as item_count
        FROM item_lists
        JOIN users ON users.user_id = item_lists.user_id
        JOIN item_list_items ON item_list_items.list_id = item_lists.list_id
        GROUP BY item_lists.list_id, item_lists.title, item_lists.user_id, item_lists.list_sqid, users.username`,
    ).all();

    let inner = '';
    if (!c.get('USER_LOGGED_IN')) {
        inner += renderGuestFlash;
    }
    for (const list of lists.results) {
        inner += `<div class="borderbox fancy-gradient-bg" style="margin-bottom: 1em;">
        <h3 class="util-mt-0"><a href="/lists/${list.list_sqid}">${list.title}</a></h3>
        list by <a href="/users/${list.username}">@${list.username}</a> | ${list.item_count} ${list.item_count === 1 ? 'item' : 'items'}
        </div>

        `;
    }

    return c.html(renderHTML('Lists | minifeed', raw(inner), c.get('USERNAME'), 'lists'));
};
