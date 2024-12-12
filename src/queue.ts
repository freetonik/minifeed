import type { Bindings } from './bindings';

///////////////////////////////
// FEED UPDATES ///////////////
export async function enqueueFeedUpdate(env: Bindings, feed_id: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'feed_update',
        feed_id: feed_id,
    });
}

export async function enqueueUpdateAllFeeds(env: Bindings) {
    // usually triggered by CRON
    type FeedsRowPartial = {
        feed_id: number;
        rss_url: string;
    };
    const { results: feeds } = await env.DB.prepare(
        "SELECT feed_id, rss_url FROM feeds WHERE type = 'blog'",
    ).all<FeedsRowPartial>();
    for (const feed of feeds) {
        await enqueueFeedUpdate(env, feed.feed_id);
    }
}

export async function enqueueRebuildFeedTopItemsCache(env: Bindings, feed_id: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'feed_update_top_items_cache',
        feed_id: feed_id,
    });
}

///////////////////////////////
// SCRAPES ////////////////////
export async function enqueueScrapeAllItemsOfFeed(env: Bindings, feed_id: number) {
    type ItemsRowPartial = {
        item_id: number;
        url: string;
    };
    const { results: items } = await env.DB.prepare('SELECT item_id, url FROM items WHERE feed_id = ?')
        .bind(feed_id)
        .all<ItemsRowPartial>();
    for (const item of items) {
        await enqueueItemScrape(env, item.item_id);
    }
}

export async function enqueueItemScrape(env: Bindings, item_id: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'item_scrape',
        item_id: item_id,
    });
}

///////////////////////////////
// INDEXING ///////////////////
export async function enqueueItemIndex(env: Bindings, itemId: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'item_index',
        item_id: itemId,
    });
}

export async function enqueueIndexAllItemsOfFeed(env: Bindings, feedId: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'feed_items_index',
        feed_id: feedId,
    });
}

export async function enqueueIndexFeed(env: Bindings, feedId: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'feed_index',
        feed_id: feedId,
    });
}

///////////////////////////////
// VECTORIZING/////////////////
export async function enqueueVectorizeStoreItem(env: Bindings, itemId: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'item_vectorize_store',
        item_id: itemId,
    });
}

export async function enqueueVectorizeStoreAllItems(env: Bindings) {
    const { results: items } = await env.DB.prepare(
        `SELECT items.item_id FROM items
        LEFT JOIN items_vector_relation on items.item_id = items_vector_relation.item_id
        WHERE items_vector_relation.vectorized is null LIMIT 250`,
    ).all();

    for (const item of items) {
        await env.FEED_UPDATE_QUEUE.send({
            type: 'item_vectorize_store',
            item_id: item.item_id,
        });
    }
}

//////////////////////
// RELATED ITEMS CACHE
export async function enqueueRegenerateItemRelatedCache(env: Bindings, itemId: number) {
    await env.FEED_UPDATE_QUEUE.send({
        type: 'item_update_related_cache',
        item_id: itemId,
    });
}

export async function enqueueGenerateInitialRelatedCacheForItems(env: Bindings) {
    const { results: items } = await env.DB.prepare(
        'SELECT items.item_id FROM items LEFT JOIN items_related_cache on items.item_id=items_related_cache.item_id WHERE items_related_cache.content is null',
    ).all();

    for (const item of items) {
        await env.FEED_UPDATE_QUEUE.send({
            type: 'item_update_related_cache',
            item_id: item.item_id,
        });
    }
}

export async function enqueueRegenerateRelatedCacheForAllItems(env: Bindings) {
    // const { results: items } = await env.DB.prepare('SELECT items.item_id FROM items').all();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { results: items } = await env.DB.prepare('SELECT items.item_id FROM items WHERE created < ? LIMIT 1000')
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
            type: 'item_update_related_cache',
            item_id: item.item_id,
        });
    }

    console.log({
        message: 'Done enqueuing regenerate related cache for up to 1000 items',
    });
}
