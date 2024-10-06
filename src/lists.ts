import { html, raw } from "hono/html";
import { itemSqidToId } from "./utils";
import { renderHTML } from "./htmltools";

export const handle_lists = async (c: any) => {
    const lists = await c.env.DB.prepare(
        `SELECT DISTINCT item_lists.*, users.username
        FROM item_lists 
        JOIN users ON users.user_id = item_lists.user_id
        JOIN item_list_items ON item_list_items.list_id = item_lists.list_id`
    ).all();

    let inner = `
    <h1>Lists</h1>
    `
    for (const list of lists.results) {
        inner += html`<li><a href="/lists/${list.list_sqid}">${list.title}</a> (by @${list.username})</li>`
    }

    return c.html(
        renderHTML(
            "Lists | minifeed",
            html`${raw(inner)}`,
            c.get("USERNAME"),
            "lists",
            "",
            "",
            false,
        ),
    );
    
}

export const handle_lists_single = async (c: any) => {
    const list_sqid = c.req.param("list_sqid");
    const list_id = itemSqidToId(list_sqid);

    const list = await c.env.DB.prepare(
        `SELECT * 
        FROM item_lists 
        JOIN users ON users.user_id = item_lists.user_id
        WHERE list_id = ?`
    ).bind(list_id).first();

    const list_items = await c.env.DB.prepare(
        `SELECT * 
        FROM item_list_items 
        JOIN items ON items.item_id = item_list_items.item_id
        WHERE list_id = ?`
    ).bind(list_id).all();

    let inner = `<h1>List "${list.title}"</h1>
    <p>by @${list.username}</p>`
    for (const item of list_items.results) {
        inner += `<li><a href="/items/${item.item_sqid}">${item.title}</a></li>`
    }

    return c.html(
        renderHTML(
            "List ${list.title} | minifeed",
            html`${raw(inner)}`,
            c.get("USERNAME"),
            "lists",
            "",
            "",
            false,
        ),
    );

}