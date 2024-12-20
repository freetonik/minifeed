import type { Bindings } from './bindings';
import { regenerateTopItemsCacheForFeed } from './feeds';
import { deleteItemFromIndex } from './search';

export async function deleteItem(env: Bindings, itemId: number, blacklist = false) {
    const itemToBeDeleted = await env.DB.prepare('SELECT feed_id FROM items WHERE item_id = ?').bind(itemId).first();
    if (itemToBeDeleted) {
        const feedId = itemToBeDeleted.feed_id as number;

        const itemUrl = await env.DB.prepare('SELECT url FROM items WHERE item_id = ?').bind(itemId).first();
        const dbDeleteResults = await env.DB.prepare('DELETE FROM items WHERE item_id = ?').bind(itemId).run();

        if (dbDeleteResults.success) {
            if (env.ENVIRONMENT !== 'dev') await env.VECTORIZE.deleteByIds([`${itemId}`]);
            await deleteItemFromIndex(env, itemId);
            await regenerateTopItemsCacheForFeed(env, feedId);
            if (itemUrl && blacklist) {
                console.log({
                    message: 'Blacklisted item URL by manual request',
                    itemUrl: itemUrl.url,
                });
                await env.BLACKLIST_URLS.put(itemUrl.url as string, '1', { metadata: { reason: 'manual' } });
            }

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
