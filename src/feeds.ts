import type { FeedData } from '@extractus/feed-extractor';
import type { Bindings } from './bindings';
import { extractRSS, validateFeedData } from './feed_extractor';
import type { MFFeedEntry } from './interface';
import { addItem } from './items';
import {
    enqueueIndexFeed,
    enqueueItemIndex,
    enqueueItemScrape,
    enqueueRegenerateRelatedFeedsCache,
    enqueueUpdateFeed,
} from './queue';
import {
    extractItemUrl,
    feedIdToSqid,
    getRSSLinkFromUrl,
    getRootUrl,
    itemIdToSqid,
    sortByFrequency,
    stripTags,
} from './utils';

export async function addFeed(env: Bindings, url: string, verified = false) {
    let r: FeedData;
    let RSSUrl: string = url;
    try {
        r = await extractRSS(url); // first, try to use RSS extractor right away
    } catch (err) {
        // if RSS extractor failed, try to get RSS link from URL and then try to use RSS extractor again
        RSSUrl = await getRSSLinkFromUrl(url);
        r = await extractRSS(RSSUrl);
    }

    const feedValidationResult = validateFeedData(r);
    if (!feedValidationResult.validated)
        throw new Error(`Feed data verification failed: ${feedValidationResult.messages.join('; ')}`);

    // if url === rssUrl that means the submitted URL was RSS URL, so retrieve site URL from RSS; otherwise use submitted URL as site URL
    const attemptedSiteUrl = r.link && r.link.length > 0 ? r.link : getRootUrl(url);
    const siteUrl = url === RSSUrl ? attemptedSiteUrl : url;
    const verified_as_int = verified ? 1 : 0;
    let feedTitle = r.title;
    if (!feedTitle || feedTitle.trim().length === 0) {
        const siteUrlHost = new URL(siteUrl).host;
        feedTitle = `${siteUrlHost}`;
    }

    try {
        const dbQueryResult = await env.DB.prepare(
            'INSERT INTO feeds (title, type, url, rss_url, verified) values (?, ?, ?, ?, ?)',
        )
            .bind(feedTitle, 'blog', siteUrl, RSSUrl, verified_as_int)
            .all();
        if (dbQueryResult.success === true) {
            // set feed_sqid
            const feed_id: number = dbQueryResult.meta.last_row_id; // TODO: get ID via 'returning' clause
            const feed_sqid = feedIdToSqid(feed_id);
            await env.DB.prepare('UPDATE feeds SET feed_sqid = ? WHERE feed_id = ?').bind(feed_sqid, feed_id).run();

            // enqueue feed indexing; the feed does not have a description yet
            await enqueueIndexFeed(env, feed_id);

            if (r.entries) await enqueueUpdateFeed(env, feed_id);

            return RSSUrl;
        }
    } catch (e: any) {
        if (e.toString().includes('UNIQUE constraint failed')) {
            return RSSUrl;
        }
    }
}

export async function updateFeed(env: Bindings, feedId: number) {
    // get RSS url of feed
    const feed = await env.DB.prepare('SELECT rss_url, description FROM feeds WHERE feed_id = ?').bind(feedId).first();
    if (!feed) return;

    const feedRSSUrl = String(feed.rss_url);
    const currentDescription = String(feed.description);
    const r: FeedData = await extractRSS(feedRSSUrl); // fetch RSS content

    if (r.description && r.description.length > 7) {
        const desc = await stripTags(r.description);
        if (!desc.includes('<img') && desc !== currentDescription) {
            await env.DB.prepare('UPDATE feeds SET description = ? WHERE feed_id = ?').bind(desc, feedId).run();
            console.log({
                message: 'Updated feed description',
                feedId,
                feedRSSUrl,
            });
        }
        // this may be the first time we are setting the description, so we need to update the index
        await enqueueIndexFeed(env, feedId);
    }

    // get URLs of existing items from DB
    const existingItems = await env.DB.prepare('SELECT url FROM items WHERE feed_id = ?').bind(feedId).all();
    const existingUrls = existingItems.results.map((obj) => obj.url);

    // if remote RSS entries exist
    if (r.entries) {
        const newItemsToBeAdded = r.entries.filter(
            (entry) => !existingUrls.includes(extractItemUrl(entry as MFFeedEntry, feedRSSUrl)),
        );
        console.log({
            message: `Updating feed, fetched ${r.entries.length} items, of which new items added: ${newItemsToBeAdded.length}`,
            feedId,
            feedRSSUrl,
        });

        const addedItemsIds: Array<number> = [];
        for (const item of newItemsToBeAdded) {
            let newItemId = undefined;
            try {
                newItemId = await addItem(env, item, feedId);
            } catch (e) {
                console.log({
                    message: `Failed to add item: ${e}`,
                    feedId,
                    feedRSSUrl,
                });
            }
            if (newItemId) {
                addedItemsIds.push(newItemId);
                await regenerateTopItemsCacheForFeed(env, feedId);
                await enqueueItemIndex(env, newItemId); // index right away (may re-index after scraping)
            }
        }

        for (const itemId of addedItemsIds) {
            // scrape will trigger re-indexing and vectorization
            // vectorization will trigger related cache regeneration
            await enqueueItemScrape(env, itemId);
        }

        return;
    }

    console.log({
        message: 'Updating feed, no items fetched',
        feedId,
        feedRSSUrl,
    });
}

export async function regenerateTopItemsCacheForFeed(env: Bindings, feedId: number) {
    const { results: top_items } = await env.DB.prepare(
        'SELECT item_id, title FROM items WHERE feed_id = ? ORDER BY items.pub_date DESC LIMIT 5',
    )
        .bind(feedId)
        .all();

    const updatedTopItems = top_items.map((item) => ({
        item_sqid: itemIdToSqid(item.item_id as number),
        title: item.title,
    }));

    const items_count = await env.DB.prepare('SELECT COUNT(item_id) FROM Items where feed_id = ?').bind(feedId).all();

    const cache_content = {
        top_items: updatedTopItems,
        items_count: items_count.results[0]['COUNT(item_id)'],
    };

    await env.DB.prepare('REPLACE INTO items_top_cache (feed_id, content) values (?, ?)')
        .bind(feedId, JSON.stringify(cache_content))
        .run();

    return true;
}

export async function generateInitialRelatedFeeds(env: Bindings) {
    // select feeds that have no related entries
    const feeds = await env.DB.prepare(`
        SELECT f.feed_id
        FROM feeds f
        LEFT JOIN related_feeds rf ON f.feed_id = rf.feed_id
        WHERE rf.id IS NULL;
        `).all();
    for (const feed of feeds.results) {
        await enqueueRegenerateRelatedFeedsCache(env, feed.feed_id as number);
    }
}

export async function regenerateRelatedFeeds(env: Bindings) {
    // select items whose related feeds were generated more than 1 week ago
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const feeds = await env.DB.prepare(`
        SELECT f.feed_id
        FROM feeds f
        JOIN related_feeds rf ON f.feed_id = rf.feed_id
        WHERE rf.created < ?
        LIMIT 100;
        `)
        .bind(weekAgo.toISOString())
        .all();

    for (const feed of feeds.results) {
        await enqueueRegenerateRelatedFeedsCache(env, feed.feed_id as number);
    }
}

export async function generateRelatedFeedsFromRelatedItems(env: Bindings, feedId: number) {
    const relatedItems = await env.DB.prepare(
        `SELECT items.item_id, related_item_id, feeds.feed_id
                    FROM related_items
                    JOIN items ON items.item_id = related_items.item_id
                    JOIN feeds ON feeds.feed_id = items.feed_id
                    WHERE items.feed_id = ?`,
    )
        .bind(feedId)
        .all();

    let relatedItemIds: Array<number> = relatedItems.results.map((item) => item.related_item_id as number);
    // array of unique related item IDs, sorted by frequency of occurrence among all items of this feed
    relatedItemIds = sortByFrequency(relatedItemIds);

    const feedIds = await env.DB.prepare(
        `SELECT DISTINCT feeds.feed_id
            FROM items
            JOIN feeds ON items.feed_id = feeds.feed_id
            WHERE items.item_id IN (${relatedItemIds.join(',')})
            LIMIT 10
            `,
    ).all();

    const relatedFeedsIds = feedIds.results.map((item) => item.feed_id as number);

    // delete existing related feed ids
    await env.DB.prepare('DELETE FROM related_feeds WHERE feed_id = ?').bind(feedId).run();
    // insert feed ids to related_feeds
    for (const rfId of relatedFeedsIds) {
        await env.DB.prepare('INSERT INTO related_feeds (feed_id, related_feed_id) VALUES (?, ?)')
            .bind(feedId, rfId)
            .run();
    }
    console.log(relatedFeedsIds);
}
