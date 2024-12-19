import type { Bindings } from './bindings';

///////////////////////////////
// FEED UPDATES ///////////////
export async function enqueueUpdateFeed(env: Bindings, feed_id: number) {
    await env.FEED_UPDATE_QUEUE.send({ type: 'feed_update', feed_id });
}

// usually triggered by CRON
export async function enqueueUpdateAllFeeds(env: Bindings) {
    const { results: feeds } = await env.DB.prepare("SELECT feed_id FROM feeds WHERE type = 'blog'").all();
    for (const feed of feeds) await enqueueUpdateFeed(env, feed.feed_id as number);
}

export async function enqueueRebuildFeedTopItemsCache(env: Bindings, feed_id: number) {
    await env.FEED_UPDATE_QUEUE.send({ type: 'feed_update_top_items_cache', feed_id });
}

///////////////////////////////
// INDEXING ///////////////////
export async function enqueueItemIndex(env: Bindings, item_id: number) {
    await env.FEED_UPDATE_QUEUE.send({ type: 'item_index', item_id });
}

export async function enqueueIndexAllItemsOfFeed(env: Bindings, feed_id: number) {
    await env.FEED_UPDATE_QUEUE.send({ type: 'feed_items_index', feed_id });
}

export async function enqueueIndexFeed(env: Bindings, feed_id: number) {
    await env.FEED_UPDATE_QUEUE.send({ type: 'feed_index', feed_id });
}

///////////////////////////////
// VECTORIZING/////////////////
export async function enqueueVectorizeStoreItem(env: Bindings, item_id: number) {
    await env.FEED_UPDATE_QUEUE.send({ type: 'item_vectorize_store', item_id });
}

//////////////////////
// RELATED ITEMS CACHE
export async function enqueueRegenerateRelatedCacheForAllItems(env: Bindings) {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const { results: items } = await env.DB.prepare(
        'SELECT related_items.item_id FROM related_items WHERE created < ? LIMIT 1000',
    )
        .bind(twoWeeksAgo.toISOString())
        .all();

    console.log({
        message: 'Starting enqueuing regenerate related cache for up to 1000 items',
    });

    for (const item of items) {
        console.log({
            message: 'Enqueuing regeneration of related cache for item',
            itemId: item.item_id,
        });
        await env.FEED_UPDATE_QUEUE.send({
            type: 'item_update_related_cache_new',
            item_id: item.item_id,
        });
    }

    console.log({
        message: 'Done enqueuing regenerate related cache for up to 1000 items',
    });
}
