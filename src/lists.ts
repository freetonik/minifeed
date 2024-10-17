import type { Context } from 'hono';
import { html, raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { itemSqidToId } from './utils';

export const handle_lists = async (c: Context) => {
    const lists = await c.env.DB.prepare(
        `SELECT DISTINCT item_lists.*, users.username
        FROM item_lists 
        JOIN users ON users.user_id = item_lists.user_id
        JOIN item_list_items ON item_list_items.list_id = item_lists.list_id`,
    ).all();

    let inner = `
    <h1>Lists</h1>
    `;
    for (const list of lists.results) {
        inner += html`<li><a href="/lists/${list.list_sqid}">${list.title}</a> (by @${list.username})</li>`;
    }

    return c.html(renderHTML('Lists | minifeed', raw(inner), c.get('USERNAME'), 'lists', '', '', false));
};

export const handle_lists_single = async (c: Context) => {
    const list_sqid = c.req.param('list_sqid');
    const list_id = itemSqidToId(list_sqid);
    const user_id = c.get('USER_ID');

    const [list, list_items] = await c.env.DB.batch([
        c.env.DB.prepare(
            `SELECT * 
            FROM item_lists 
            JOIN users ON users.user_id = item_lists.user_id
            WHERE list_id = ?`,
        ).bind(list_id),
        c.env.DB.prepare(
            `SELECT * 
            FROM item_list_items 
            JOIN items ON items.item_id = item_list_items.item_id
            WHERE list_id = ?`,
        ).bind(list_id),
    ]);

    const list_entry = list.results[0];
    if (!list_entry) return c.notFound();

    let inner = `<h1>List "${list_entry.title}"</h1>
    <p>by <a href="/users/${list_entry.username}">@${list_entry.username}</a></p>`;
    for (const item of list_items.results) {
        inner += `<li><a href="/items/${item.item_sqid}">${item.title}</a></li>`;
    }

    if (user_id === list_entry.user_id) {
        inner += `<p><button hx-confirm="Are you sure?" hx-swap="outerHTML transition:true" hx-post="/lists/${list_sqid}/delete">Delete list</button></p>`;
    }

    return c.html(renderHTML(`List ${list.title} | minifeed`, raw(inner), c.get('USERNAME'), 'lists', '', '', false));
};

export const handle_lists_single_delete_POST = async (c: Context) => {
    const list_id = itemSqidToId(c.req.param('list_sqid'));
    const user_id = c.get('USER_ID');

    const list = await c.env.DB.prepare('SELECT * FROM item_lists WHERE list_id = ?').bind(list_id).first();
    if (!list || list.user_id !== user_id) return c.text('Unauthorized', 401);

    await c.env.DB.prepare('DELETE FROM item_lists WHERE list_id = ?').bind(list_id).run();

    return c.html(
        `<div class="flash">List deleted. This page is now a ghost. Refresh to let it ascent into ether.</div>`,
    );
};
