import type { FeedData } from '@extractus/feed-extractor';
import type { Bindings } from './bindings';
import { extractRSS, validateFeedData } from './feed_extractor';
import type { MFFeedEntry } from './interface';
import { enqueueIndexFeed, enqueueUpdateFeed } from './queue';
import { extractItemUrl, feedIdToSqid, getRSSLinkFromUrl, getRootUrl, itemIdToSqid, stripTags } from './utils';

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
            // update feed_sqid
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
    console.log({
        message: 'Updating feed',
        feedId,
        feedRSSUrl,
    });

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

        // TODO: replace with queue temporarily
        for (const item of newItemsToBeAdded) {
            await env.ADD_ITEM_WORKFLOW.create({
                params: { item, feedId },
            });
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
        await env.GENERATE_RELATED_FEEDS_WORKFLOW.create({ params: { feedId: feed.feed_id } });
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
        await env.GENERATE_RELATED_FEEDS_WORKFLOW.create({ params: { feedId: feed.feed_id } });
    }
}

// async function addItem(env: Bindings, item, feedId) {
//     // STEP 1: Add item to the database
//     const feed = await env.DB.prepare('SELECT rss_url FROM feeds WHERE feed_id = ?').bind(feedId).first();
//     if (!feed) return false;

//     const feedRSSUrl = feed.rss_url as string;
//     let itemUrl = '';
//     try {
//         itemUrl = extractItemUrl(item, feedRSSUrl);
//     } catch (e) {
//         console.log({
//             message: 'Failed to extract item URL',
//             itemUrl,
//             feedRSSUrl,
//         });
//         return false;
//     }

//     // check if the URL is not in blacklist
//     const { value: blacklisted, metadata } = await env.BLACKLIST_URLS.getWithMetadata(itemUrl);
//     if (blacklisted) {
//         console.log({
//             message: `Item URL is blacklisted. Reason: ${metadata.reason}`,
//             itemUrl,
//             feedRSSUrl,
//         });
//         return false;
//     }

//     // new item, but maybe it already exists in the database by URL
//     const httpVariant = itemUrl.startsWith('https://') ? `https://${itemUrl.slice(8)}` : itemUrl;
//     const httpsVariant = itemUrl.startsWith('http://') ? `https://${itemUrl.slice(7)}` : itemUrl;
//     const existingByURL = await env.DB.prepare(
//         'SELECT item_id FROM items WHERE url = ? OR url = ? OR url = ? OR url = ? AND feed_id = ?',
//     )
//         .bind(
//             itemUrl,
//             itemUrl.slice(0, -1), // to account for possible trailing slash
//             httpVariant, // if incoming item is https, but we already stored it as http
//             httpsVariant, // if incoming item is http, but we already stored it as https
//             feedId,
//         )
//         .first();

//     if (existingByURL) {
//         await env.BLACKLIST_URLS.put(itemUrl, '1', { metadata: { reason: 'duplicate url' } });
//         console.log({
//             message: 'Item already exists in the database by URL. Blacklisted.',
//             itemUrl,
//             feedRSSUrl,
//         });
//         return false;
//     }

//     // new item, but maybe it already exists in the database by title
//     if (item?.title?.length && item?.title?.length > 0) {
//         const existingByTitle = await env.DB.prepare(`
//                             SELECT item_id
//                             FROM items
//                             WHERE title = ? AND feed_id = ?
//                             `)
//             .bind(item.title, feedId)
//             .first();
//         if (existingByTitle) {
//             await this.env.BLACKLIST_URLS.put(itemUrl, '1', { metadata: { reason: 'duplicate title' } });
//             console.log({
//                 message: 'Item already exists in the database by title. Blacklisted.',
//                 itemUrl,
//                 feedRSSUrl,
//             });
//             return false;
//         }
//     }

//     // ==================================|
//     // OMG FINALLY ITEM CAN BE ADDED!!!  |
//     // ==================================|
//     const itemDescriptionWithoutSemanticElements = await stripNonLinguisticElements(item.description || '');
//     const itemDescription = truncate(itemDescriptionWithoutSemanticElements, 350);
//     const potentialTitle = truncate(itemDescriptionWithoutSemanticElements, 55);

//     const itemPubDate: string = getItemPubDate(item).toISOString();
//     let itemTitle: string;
//     if (item.title?.length) itemTitle = await stripTags(item.title);
//     else if (potentialTitle?.length) itemTitle = potentialTitle;
//     else itemTitle = itemPubDate.slice(0, 10);

//     const itemContentHTML =
//         getText(item.content_from_content) ||
//         getText(item.content_from_content_encoded) ||
//         getText(item.content_from_description) ||
//         getText(item.content_from_content_html) ||
//         '';

//     const insertedItems = await env.DB.prepare(
//         'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
//     )
//         .bind(feedId, itemTitle, itemUrl, itemPubDate, itemDescription, itemContentHTML)
//         .run();

//     console.log({
//         message: 'New item added',
//         itemId: insertedItems.meta.last_row_id,
//         url: itemUrl,
//         feedId: feedId,
//     });

//     const itemInfo = {
//         itemId: insertedItems.meta.last_row_id,
//         itemUrl,
//         itemDescription,
//     };

//     // NEXT STEPS ONLY IF ITEM WAS ADDED SUCCESSFULLY
//     if (itemInfo.itemId) {
//         // STEP 2: Assign item SQID
//         const itemSqid = itemIdToSqid(itemInfo.itemId);
//         await env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?').bind(itemSqid, itemInfo.itemId).run();
//         console.log({
//             message: 'Item SQID assigned',
//             item_id: itemInfo.itemId,
//             item_sqid: itemSqid,
//         });

//         // STEP 3: Update feed top items cache
//         await regenerateTopItemsCacheForFeed(env, feedId);

//         // STEP 4: Scrape (may fail)
//         let textContent = null;
//         try {
//             const scrapedArticle = await scrapeURLIntoObject(itemInfo.itemUrl);
//             let newItemDescription = itemInfo.itemDescription;
//             if (!newItemDescription || newItemDescription.length < 5) newItemDescription = scrapedArticle.description;

//             await env.DB.prepare('UPDATE items SET content_html_scraped = ?, description = ? WHERE item_id = ?')
//                 .bind(scrapedArticle.HTMLcontent, newItemDescription, itemInfo.itemId)
//                 .run();

//             textContent = scrapedArticle.textContent;
//         } catch (e) {
//             console.log({
//                 message: `Scrape failed: ${e}`,
//                 itemId: itemInfo?.itemId,
//                 url: itemInfo?.itemUrl,
//             });
//         }

//         // STEP 5: Update search index
//         // if scraping succeeded, use the scraped content
//         if (textContent) {
//             await updateItemIndex(env, itemInfo.itemId, textContent);
//         } else {
//             await updateItemIndex(env, itemInfo.itemId);
//         }

//         // STEP 6: Vectorize item
//         await vectorizeAndStoreItem(env, itemInfo.itemId);

//         // STEP 8: Regenerate related cache
//         await step.do('regenerate related cache for item', async () => {
//             return await regenerateRelatedForItem(this.env, itemInfo.itemId);
//         });
//     }
// }
