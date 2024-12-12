import type { Context } from 'hono';
import { itemIdToSqid, itemSqidToId } from '../../utils';

export const handleItemsListsNewForm = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    return c.html(`<form hx-post="/items/${itemSqid}/lists" hx-target="this" hx-swap="outerHTML" style="margin-top:0.5em;">
        <input type="text" name="list_title" placeholder="Type list title and press Enter" style="font-size: inherit !important;padding: 0.25em 0.5em !important;">
    </form>`);
};

export const handleItemsListsNewPOST = async (c: Context) => {
    const body = await c.req.parseBody();
    const itemSqid = c.req.param('item_sqid');
    const listTitle = body.list_title.toString();

    if (!checkListTitle(listTitle))
        return c.html(`
        <form hx-post="/items/${itemSqid}/lists" hx-target="this" hx-swap="outerHTML" style="margin-top:0.5em;">
            <input type="text" name="list_title" placeholder="Type list title and press Enter" value="${listTitle}" style="font-size: inherit !important;padding: 0.25em 0.5em !important;">
            <i style="margin-top: 0.5em; display: block; color: var(--color-red);">
            Such bad title! Rules: 3 char minimum, latin letters, numbers, -, +, =, ?, _, and one space space at a time. This is good for everybody.
            </i>
        </form>
        `);

    const result = await c.env.DB.prepare('INSERT INTO item_lists (user_id, title) VALUES (?, ?)')
        .bind(c.get('USER_ID'), listTitle)
        .run();

    const list_id = result.meta.last_row_id;
    const list_sqid = itemIdToSqid(list_id);

    // set sqid of list
    await c.env.DB.prepare('UPDATE item_lists SET list_sqid = ? WHERE list_id = ?').bind(list_sqid, list_id).run();

    const itemId: number = itemSqidToId(itemSqid);
    // add item to list
    await c.env.DB.prepare('INSERT INTO item_list_items (list_id, item_id) VALUES (?, ?)').bind(list_id, itemId).run();

    return c.html(
        `<a class="no-underline no-color" href="/lists/${list_sqid}">${listTitle}</a> <a hx-post="/items/${itemSqid}/lists/${list_sqid}/remove" hx-swap="outerHTML transition:true">[- remove from list]</a><br>`,
    );
};

// add item to list
export const handleItemsListsAddPOST = async (c: Context) => {
    const item_sqid = c.req.param('item_sqid');
    const list_sqid = c.req.param('list_sqid');
    const item_id = itemSqidToId(item_sqid);
    const list_id = itemSqidToId(list_sqid);

    const result = await c.env.DB.prepare('INSERT INTO item_list_items (list_id, item_id) VALUES (?, ?)')
        .bind(list_id, item_id)
        .run();

    if (result.success) return c.html('[added]');
    return c.html('Error while adding item to list');
};

export const handleItemsListsRemovePOST = async (c: Context) => {
    const item_sqid = c.req.param('item_sqid');
    const list_sqid = c.req.param('list_sqid');
    const item_id = itemSqidToId(item_sqid);
    const list_id = itemSqidToId(list_sqid);

    const result = await c.env.DB.prepare('DELETE FROM item_list_items WHERE list_id = ? AND item_id = ?')
        .bind(list_id, item_id)
        .run();

    if (result.success) return c.html('[removed]');
    return c.html('Error while removing item from list');
};

function checkListTitle(listTitle: string) {
    // allow only latin chars, numbers, -, +, =, ?, _, and space
    const goodChars = /^[a-zA-Z0-9\-=+?_ ]{3,32}$/.test(listTitle);
    // disallow first or last char to be space; disallow consecutive spaces
    const goodStructure = /^\S(?!.*\s{3,}).*\S$/.test(listTitle);
    return goodChars && goodStructure;
}
