import type { Context } from 'hono';
import { itemSqidToId } from '../../utils';

// Renders lists for item
export const handleItemsLists = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get('USER_ID');

    const lists = await c.env.DB.prepare(
        `SELECT item_lists.list_id, item_lists.title, item_lists.list_sqid, item_list_items.item_id
        FROM item_lists
        LEFT JOIN item_list_items ON item_list_items.list_id = item_lists.list_id
        WHERE user_id = ?
        `,
    )
        .bind(userId)
        .all();

    // lists.results contains instances of lists with items
    const lists_with_current_item = lists.results.filter((list) => list.item_id === itemId);
    const lists_without_current_item = lists.results
        // remove list instances that already have the item
        // .filter((list: any) => list.item_id != itemId)
        // subtract lists_with_current_item
        .filter(
            (list: any) => !lists_with_current_item.some((listWithItem: any) => listWithItem.list_id === list.list_id),
        )
        // remove duplicates
        .filter(
            (list: any, index: number, self: any) => index === self.findIndex((t: any) => t.list_id === list.list_id),
        );

    const list_objects: { [key: string]: string } = {};
    for (const list of lists_with_current_item) {
        list_objects[list.title] =
            `<strong><a class="no-underline no-color" href="/lists/${list.list_sqid}">${list.title}</a></strong> <a href="" hx-post="/items/${itemSqid}/lists/${list.list_sqid}/remove" hx-swap="outerHTML transition:true">[- remove from list]</a><br>`;
    }

    for (const list of lists_without_current_item) {
        list_objects[list.title] =
            `<a class="no-underline no-color" href="/lists/${list.list_sqid}">${list.title}</a> <a href="" hx-post="/items/${itemSqid}/lists/${list.list_sqid}/add" hx-swap="outerHTML transition:true"><strong>[+ add to list]</strong></a><br>`;
    }

    const lists_html = Object.keys(list_objects)
        .sort()
        .map((key) => list_objects[key])
        .join('');

    const content = `
    <div id="lists_section" class="lists-section" >
    <div style="padding: 1em;">
    ${lists_html}
    <strong>
    <a href="" hx-get="/items/${itemSqid}/lists/new" hx-trigger="click" hx-target="this" hx-swap="outerHTML"><br>
        [create new list and add to it]
    </a>
    </strong>
    </div>
    </div>
    `;

    return c.html(content);
};
