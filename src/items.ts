import type { Bindings } from './bindings';
import { regenerateTopItemsCacheForFeed } from './feeds';
import { deleteItemFromIndex } from './search';

export async function deleteItem(env: Bindings, itemId: number) {
    const itemToBeDeleted = await env.DB.prepare('SELECT feed_id FROM items WHERE item_id = ?').bind(itemId).first();
    if (itemToBeDeleted) {
        const feedId = itemToBeDeleted.feed_id as number;

        const dbDeleteResults = await env.DB.prepare('DELETE FROM items WHERE item_id = ?').bind(itemId).run();

        if (dbDeleteResults.success) {
            if (env.ENVIRONMENT !== 'dev') await env.VECTORIZE.deleteByIds([`${itemId}`]);
            await deleteItemFromIndex(env, itemId);
            await regenerateTopItemsCacheForFeed(env, feedId);
            console.log({
                message: 'Deleted item from db, vectorize, and search index. Regenerated cache for feed.',
                itemId,
                feedId,
            });
            return true;
        }
    }
    return false;
}
