import type { FeedData } from '@extractus/feed-extractor';
import type { Bindings } from './bindings';
import { extractRSS, validateFeedData } from './feed_extractor';
import type { MFFeedEntry } from './interface';
import { enqueueFeedUpdate, enqueueIndexFeed, enqueueItemScrape } from './queue';
import {
    extractItemUrl,
    feedIdToSqid,
    getRSSLinkFromUrl,
    getRootUrl,
    getText,
    itemIdToSqid,
    stripTags,
    stripTagsSynchronously,
    truncate,
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
            if (r.entries) {
                const feed_id: number = dbQueryResult.meta.last_row_id;

                // update feed_sqid
                const feed_sqid = feedIdToSqid(feed_id);
                await env.DB.prepare('UPDATE feeds SET feed_sqid = ? WHERE feed_id = ?').bind(feed_sqid, feed_id).run();

                await enqueueFeedUpdate(env, feed_id);
            }
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

        // OLD CODE
        // if (newItemsToBeAdded.length) {
        //     await addItemsToFeed(env, newItemsToBeAdded, feedId);
        //     await regenerateTopItemsCacheForFeed(env, feedId);
        // }

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

// TODO: deprecate
export async function addItemsToFeed(
    env: Bindings,
    items: Array<MFFeedEntry>,
    feedId: number,
    scrapeAfterAdding = true,
) {
    if (!items.length) return;

    const { results: feeds } = await env.DB.prepare('SELECT title, rss_url FROM feeds WHERE feed_id = ?')
        .bind(feedId)
        .all();
    const feedRSSUrl = String(feeds[0].rss_url);

    const stmt = env.DB.prepare(
        'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
    );
    const binds: D1PreparedStatement[] = [];

    for (const item of items) {
        let link: string;
        try {
            link = extractItemUrl(item, feedRSSUrl);
        } catch (e) {
            console.log({
                message: `Error extracting item URL ${e}`,
                feedId,
                feedRSSUrl,
            });
            continue;
        }

        if (item.published) {
            // if item.published is in future, set it to current date
            if (new Date(item.published) > new Date()) item.published = new Date().toISOString();
        } else {
            // if date was not properly parsed, try to parse it (expects 'pubdate' to be retrieved by feed_extractor's extractRSS function)
            if (item.pubdate) {
                const dateFromPubdate = new Date(item.pubdate);
                // if date is in future, set it to current date
                if (dateFromPubdate > new Date()) {
                    item.published = new Date().toISOString();
                }
                // if date is older than unix epoch start date, set it to current date
                else if (dateFromPubdate < new Date('1970-01-01')) {
                    item.published = new Date().toISOString();
                } else {
                    item.published = dateFromPubdate.toISOString();
                }
            } else {
                item.published = new Date().toISOString(); // if date is still not available, use current date
            }
        }

        let content_html =
            item.content_from_content ||
            item.content_from_content_encoded ||
            item.content_from_description ||
            item.content_from_content_html ||
            '';

        content_html = getText(content_html);

        let itemTitle = item.title?.length ? item.title : item.published.slice(0, 10);
        itemTitle = await stripTags(itemTitle);

        binds.push(
            stmt.bind(
                feedId,
                itemTitle,
                link,
                item.published,
                truncate(stripTagsSynchronously(item.description), 350),
                content_html,
            ),
        );
    }

    const results_of_insert = await env.DB.batch(binds);
    for (const result of results_of_insert) {
        if (result.success) {
            const item_id = result.meta.last_row_id;
            const item_sqid = itemIdToSqid(item_id);

            console.log({
                message: 'Item added to feed',
                itemId: item_id,
                feedId: feedId,
            });

            await env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?').bind(item_sqid, item_id).run();
            console.log(`Item: ${item_id} set sqid ${item_sqid}`);

            if (scrapeAfterAdding) {
                console.log(`Item: ${item_id} queued for scraping`);
                await enqueueItemScrape(env, item_id);
            }
        }
    }

    return results_of_insert;
}

export async function regenerateTopItemsCacheForFeed(env: Bindings, feedId: number) {
    const { results: top_items } = await env.DB.prepare(
        'SELECT item_id, title FROM items WHERE feed_id = ? ORDER BY items.pub_date DESC LIMIT 5',
    )
        .bind(feedId)
        .all();

    top_items.forEach((item: any) => {
        item.item_sqid = itemIdToSqid(item.item_id);
        delete item.item_id;
    });

    const items_count = await env.DB.prepare('SELECT COUNT(item_id) FROM Items where feed_id = ?').bind(feedId).all();

    const cache_content = {
        top_items: top_items,
        items_count: items_count.results[0]['COUNT(item_id)'],
    };

    await env.DB.prepare('REPLACE INTO items_top_cache (feed_id, content) values (?, ?)')
        .bind(feedId, JSON.stringify(cache_content))
        .run();

    return true;
}
