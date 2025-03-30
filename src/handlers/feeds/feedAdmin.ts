import type { Context } from 'hono';
import { addFeed } from '../../feeds';
import { renderAddFeedForm, renderHTML } from '../../htmltools';
import type { ItemRow } from '../../interface';
import {
    enqueueIndexAllItemsOfFeed,
    enqueueIndexFeed,
    enqueueRebuildFeedTopItemsCache,
    enqueueRegenerateRelatedFeedsCache,
    enqueueUpdateFeed,
} from '../../queue';
import { deleteFeedFromIndex } from '../../search';
import { feedIdToSqid, feedSqidToId, getFeedIdByRSSUrl } from '../../utils';

export async function handleFeedsDelete(c: Context) {
    const feedId: number = feedSqidToId(c.req.param('feed_sqid'));

    const ids_of_feed_items = await c.env.DB.prepare('SELECT item_id FROM items WHERE feed_id = ?').bind(feedId).all();

    if (ids_of_feed_items.results.length > 0) {
        const item_ids_to_delete_from_vectorize = ids_of_feed_items.results.map((item: ItemRow) =>
            item.item_id.toString(),
        );
        // split array into chunks of 100
        const chunks = [];
        for (let i = 0; i < item_ids_to_delete_from_vectorize.length; i += 100) {
            chunks.push(item_ids_to_delete_from_vectorize.slice(i, i + 100));
        }
        for (const chunk of chunks) {
            try {
                await c.env.VECTORIZE.deleteByIds(chunk);
            } catch (e) {
                console.log({
                    message: `Error deleting items from vectorize: ${e}`,
                    itemId: chunk,
                    feedId: feedId,
                });
            }
        }
    }

    await c.env.DB.prepare('DELETE from feeds where feed_id = ?').bind(feedId).run();
    await deleteFeedFromIndex(c.env, feedId);

    return c.html(`Feed ${feedId} deleted`);
}

export async function handleBlogsNew(c: Context) {
    if (!c.get('USER_ID')) return c.redirect('/login');
    return c.html(renderHTML(c, 'Add new blog', renderAddFeedForm()));
}

export async function handleBlogsNewPOST(c: Context) {
    const body = await c.req.parseBody();
    const url = body.url.toString();
    let rssUrl: string | undefined;
    try {
        const verified = !!c.get('USER_IS_ADMIN');
        rssUrl = await addFeed(c.env, url, verified); // MAIN MEAT!
    } catch (e: unknown) {
        const errorMessage = (e as Error).toString();
        return c.html(renderHTML(c, 'Add new blog', renderAddFeedForm(url, errorMessage)));
    }

    // Redirect
    if (rssUrl) {
        const feedId = await getFeedIdByRSSUrl(c, rssUrl);
        const sqid = feedIdToSqid(feedId);
        return c.redirect(`/blogs/${sqid}`, 301);
    }
    return c.text('Something went wrong');
}

export async function handleFeedsUpdate(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueUpdateFeed(c.env, feed_id);
    return c.text('Feed update enqueued...');
}

export async function handleFeedsItemsIndexing(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueIndexAllItemsOfFeed(c.env, feed_id);
    return c.html('Feed index enqueued...');
}

export async function handleFeedsIndexing(c: Context) {
    const feedId: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueIndexFeed(c.env, feedId);
    return c.html('Feed index enqueued...');
}

export async function handleFeedsItemsGlobalIndex(c: Context) {
    const feeds = await c.env.DB.prepare('SELECT feed_id FROM feeds').all();
    for (const feed of feeds.results) {
        await enqueueIndexAllItemsOfFeed(c.env, feed.feed_id);
    }
    return c.html('Feed index enqueued FOR ALL FEEDS...');
}

export async function handleFeedsGlobalIndex(c: Context) {
    const feeds = await c.env.DB.prepare('SELECT feed_id FROM feeds').all();
    for (const feed of feeds.results) {
        await enqueueIndexFeed(c.env, feed.feed_id);
    }
    return c.html('Feed indexing enqueued FOR ALL FEEDS...');
}

export async function handleFeedsCacheRebuild(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueRebuildFeedTopItemsCache(c.env, feed_id);
    return c.html('Feed cache rebuild enqueued...');
}

export async function handleFeedsGlobalCacheRebuild(c: Context) {
    const feeds = await c.env.DB.prepare('SELECT feed_id FROM feeds').all();
    for (const feed of feeds.results) {
        await enqueueRebuildFeedTopItemsCache(c.env, feed.feed_id);
    }
    return c.html('Feed cache rebuild enqueued FOR ALL FEEDS...');
}

export async function handleFeedsRebuildRelatedFeeds(c: Context) {
    const feedId: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueRegenerateRelatedFeedsCache(c.env, feedId);
    return c.html('Feed related feeds rebuild enqueued...');
}
