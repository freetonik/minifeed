import type { Context } from 'hono';
import { regenerateTopItemsCacheForFeed } from './feeds';
import { deleteItemFromIndex } from './search';

export async function deleteItem(c: Context, itemId: number) {
    const itemToBeDeleted = await c.env.DB.prepare('SELECT feed_id FROM items WHERE item_id = ?').bind(itemId).first();
    const feedId = itemToBeDeleted.feed_id;

    const dbDeleteResults = await c.env.DB.prepare('DELETE FROM items WHERE item_id = ?').bind(itemId).run();
    if (dbDeleteResults.success) {
        if (c.env.ENVIRONMENT !== 'dev') await c.env.VECTORIZE.deleteByIds([`${itemId}`]);
        await deleteItemFromIndex(c.env, itemId);
        await regenerateTopItemsCacheForFeed(c.env, feedId);
        console.log({
            message: 'Deleted item from db, vectorize, and search index. Regenerated cache for feed.',
            itemId,
            feedId,
        });
        return true;
    }
    return false;
}
