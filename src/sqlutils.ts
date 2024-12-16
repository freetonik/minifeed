import type { Bindings } from './bindings';

export async function dbGetItem(env: Bindings, itemId: number, columns = ['title', 'item_sqid', 'feed_id']) {
    return await env.DB.prepare(`
        SELECT ${columns.join(', ')}
        FROM items
        WHERE item_id = ?
    `)
        .bind(itemId)
        .first();
}
