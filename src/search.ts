import type { Bindings } from './bindings';
import type { FeedRow, FeedSearchDocument, ItemSearchDocument } from './interface';
import { collapseWhitespace, gatherResponse, stripASCIIFormatting, stripTags } from './utils';

////////////////////////////////
// SEARCH INDEX MANAGEMENT /////

export async function upsertSingleDocument(env: Bindings, document: ItemSearchDocument) {
    const reqUrl = `https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/import?action=upsert`;
    const init = {
        body: JSON.stringify(document),
        method: 'POST',
        headers: {
            'X-TYPESENSE-API-KEY': env.TYPESENSE_API_KEY,
            'Content-Type': 'application/json',
        },
    };

    try {
        console.log({
            message: `Upserting document index (${document.title})`,
            itemId: document.id,
        });
        const response = await fetch(reqUrl, init);
        return await gatherResponse(response);
    } catch (e) {
        console.log({
            message: `Error while upserting document: ${e}`,
            itemId: document.id,
        });
    }
}

export async function upsertSingleFeed(env: Bindings, document: FeedSearchDocument) {
    const reqUrl = `https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_FEEDS_COLLECTION}/documents/import?action=upsert`;
    const init = {
        body: JSON.stringify(document),
        method: 'POST',
        headers: {
            'X-TYPESENSE-API-KEY': env.TYPESENSE_API_KEY,
            'Content-Type': 'application/json',
        },
    };
    try {
        const response = await fetch(reqUrl, init);
        await gatherResponse(response);
    } catch (e) {
        console.log({
            message: `Error upserting feed: ${e}`,
            feedId: document.id,
        });
    }
}

export async function deleteFeedFromIndex(env: Bindings, feedId: number) {
    const init = {
        method: 'DELETE',
        headers: {
            'X-TYPESENSE-API-KEY': env.TYPESENSE_API_KEY,
        },
    };

    try {
        const response = await fetch(
            `https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/?filter_by=feed_id:=${feedId}`,
            init,
        );
        return await gatherResponse(response);
    } catch (e) {
        console.log({
            message: `Error deleting feed from index: ${e}`,
            feedId,
        });
    }
}

export async function deleteItemFromIndex(env: Bindings, itemId: number) {
    const init = {
        method: 'DELETE',
        headers: {
            'X-TYPESENSE-API-KEY': env.TYPESENSE_API_KEY,
        },
    };
    try {
        const response = await fetch(
            `https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/${itemId}`,
            init,
        );
        return await gatherResponse(response);
    } catch (e) {
        console.log({
            message: `Error deleting item from index: ${e}`,
            itemId,
        });
    }
}

// Upserts the search index for a single item
export async function updateItemIndex(env: Bindings, itemId: number, textContent?: string) {
    type ItemsFeedsRowPartial = {
        item_sqid: string;
        title: string;
        type: string;
        content_html: string;
        description: string;
        content_html_scraped: string;
        url: string;
        pub_date: string;
        feed_title: string;
        feed_id: number;
        feed_sqid: string;
        verified: boolean;
    };
    const { results: items } = await env.DB.prepare(
        `SELECT items.title, items.item_sqid, feeds.type, items.content_html, items.description, items.content_html_scraped, items.url, items.pub_date, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, feeds.verified
        FROM items
        JOIN feeds ON feeds.feed_id = items.feed_id
        WHERE item_id = ?`,
    )
        .bind(itemId)
        .all<ItemsFeedsRowPartial>();

    const item = items[0];
    let content: string;
    // preference: given text content → scraped content → content_html → description
    if (textContent) content = textContent;
    else if (item.content_html_scraped && item.content_html_scraped.length > 0)
        content = await stripTags(item.content_html_scraped);
    else if (item.content_html && item.content_html.length > 0) content = await stripTags(item.content_html);
    else content = item.description;

    const searchDocument: ItemSearchDocument = {
        // we provide explicit id so it will be used as id in the typesense index
        id: itemId.toString(),
        // searchable fields
        title: item.title,
        content: collapseWhitespace(stripASCIIFormatting(content)),
        type: item.type,
        verified: Number(item.verified) === 1,
        // non-searchable fields
        item_sqid: item.item_sqid,
        url: item.url,
        pub_date: item.pub_date,
        feed_id: item.feed_id,
        feed_sqid: item.feed_sqid,
        feed_title: item.feed_title,
    };

    return await upsertSingleDocument(env, searchDocument);
}

export async function updateFeedIndex(env: Bindings, feedId: number) {
    const feed = await env.DB.prepare(
        `SELECT title, type, url, description, rss_url, feed_id, feed_sqid, verified
        FROM feeds
        WHERE feed_id = ?`,
    )
        .bind(feedId)
        .first<FeedRow>();

    if (!feed) return;

    const feedDescription = feed.description ? `${feed.description}. ` : '';
    let feedUrlHost = '';
    try {
        feedUrlHost = new URL(feed.url).host;
    } catch (e) {
        console.log({
            message: `Error parsing URL: ${e}`,
            feedId: feed.feed_id,
        });
        return;
    }
    const feedContent = `${feed.title}. ${feedDescription}${feed.url} ${feedUrlHost} ${feed.rss_url}`;

    const searchDocument: FeedSearchDocument = {
        // we provide explicit id so it will be used as id in the typesense index
        id: feed.feed_id.toString(),
        // searchable fields
        title: feed.title,
        type: feed.type,
        content: feedContent,
        feed_id: feed.feed_id,
        verified: Number(feed.verified) === 1,
        // non-searchable fields
        feed_sqid: feed.feed_sqid,
        url: feed.url,
        rss_url: feed.rss_url,
    };
    console.log({
        message: `Upserting feed: ${feed.title}`,
        feedId: feed.feed_id,
    });
    await upsertSingleFeed(env, searchDocument);
}

// at some point we need to use bulk indexing, but it needs to be controllable with up to 40 documents per request
export async function updateFeedItemsIndex(env: Bindings, feed_id: number) {
    const { results: items } = await env.DB.prepare('SELECT item_id FROM items WHERE feed_id = ?').bind(feed_id).all();
    for (const item of items) await updateItemIndex(env, item.item_id as number);
}

export async function getCollection(env: Bindings, collection?: string) {
    let collectionName = env.TYPESENSE_ITEMS_COLLECTION;
    if (collection) collectionName = collection;
    const init = {
        method: 'GET',
        headers: {
            'X-TYPESENSE-API-KEY': env.TYPESENSE_API_KEY,
        },
    };

    const response = await fetch(`https://${env.TYPESENSE_CLUSTER}:443/collections/${collectionName}`, init);
    const results = await gatherResponse(response);
    return JSON.parse(results);
}
