import type { Context } from 'hono';
import { itemSqidToId } from '../../utils';

export const handleItemsAddToFavorites = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get('USER_ID');

    try {
        const result = await c.env.DB.prepare('INSERT INTO favorites (user_id, item_id) VALUES (?, ?)')
            .bind(userId, itemId)
            .run();
        if (result.success) {
            c.status(201);
            return c.html(`
        <span id="favorite">
        <button hx-post="/items/${itemSqid}/unfavorite"
        class="button"
        hx-trigger="click"
        hx-target="#favorite"
        hx-swap="outerHTML">
        ★ unfavorite
        </button>
        </span>
        `);
        }
    } catch (e) {
        c.status(400);
        return c.json({ error: 'An error occurred' });
    }

    return c.html(`
    <span id="favorite">
    "Error"
    </span>
    `);
};

export const handleItemsRemoveFromFavorites = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const userId = c.get('USER_ID');

    try {
        const result = await c.env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND item_id = ?')
            .bind(userId, itemId)
            .run();
        if (result.success) {
            c.status(201);
            return c.html(`
                <span id="favorite">
                <button hx-post="/items/${itemSqid}/favorite"
                class="button"
                hx-trigger="click"
                hx-target="#favorite"
                hx-swap="outerHTML">
                ☆ favorite
                </button>
                </span>
                `);
        }
    } catch (e) {
        c.status(400);
        return c.json({ error: 'An error occurred' });
    }

    return c.html(` <span id="favorite"> "Error" </span> `);
};
