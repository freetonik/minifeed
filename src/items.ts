import type { FeedEntry } from '@extractus/feed-extractor';
import type { Bindings } from './bindings';
import { regenerateTopItemsCacheForFeed } from './feeds';
import type { ItemRow } from './interface';
import { enqueueVectorizeStoreItem } from './queue';
import { scrapeURLIntoObject } from './scrape';
import { deleteItemFromIndex, updateItemIndex } from './search';
import {
    extractItemUrl,
    getItemPubDate,
    getText,
    itemIdToSqid,
    stripNonLinguisticElements,
    stripTags,
    truncate,
} from './utils';

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

export async function scrapeAndIndexItem(env: Bindings, itemId: number) {
    const item = await env.DB.prepare('SELECT url, description FROM items WHERE item_id = ?')
        .bind(itemId)
        .first<ItemRow>();
    if (!item) return;

    let textContent = undefined;
    try {
        const scrapedArticle = await scrapeURLIntoObject(item.url);
        let newItemDescription = item.description;
        if (!newItemDescription || newItemDescription.length < 5) newItemDescription = scrapedArticle.description;

        await env.DB.prepare('UPDATE items SET content_html_scraped = ?, description = ? WHERE item_id = ?')
            .bind(scrapedArticle.HTMLcontent, newItemDescription, itemId)
            .run();

        textContent = scrapedArticle.textContent;
    } catch (e) {
        console.log({
            message: `Scrape failed: ${e}`,
            itemId: item?.item_id,
            url: item?.url,
        });
    }

    // update search index if we have text content
    if (textContent) await updateItemIndex(env, itemId, textContent);

    // vectorize; even if scraping failed, we still want to vectorize since we were waiting for scraping
    await enqueueVectorizeStoreItem(env, itemId);
}

export async function addItem(env: Bindings, item: FeedEntry, feedId: number) {
    // STEP 1: Add item to the database
    const feed = await env.DB.prepare('SELECT rss_url FROM feeds WHERE feed_id = ?').bind(feedId).first();
    if (!feed) throw new Error(`Feed with ID ${feedId} not found`);

    const feedRSSUrl = feed.rss_url as string;
    const itemUrl = extractItemUrl(item, feedRSSUrl);

    // check if the URL is not in blacklist
    const { value: blacklisted, metadata } = await env.BLACKLIST_URLS.getWithMetadata(itemUrl);
    if (blacklisted) throw new Error(`Item URL is blacklisted. Reason: ${metadata.reason}`);

    // check if the item already exists in the database
    const httpVariant = itemUrl.startsWith('https://') ? `https://${itemUrl.slice(8)}` : itemUrl;
    const httpsVariant = itemUrl.startsWith('http://') ? `https://${itemUrl.slice(7)}` : itemUrl;
    const existingByURL = await env.DB.prepare(
        'SELECT item_id FROM items WHERE url = ? OR url = ? OR url = ? OR url = ? AND feed_id = ?',
    )
        .bind(
            itemUrl,
            itemUrl.slice(0, -1), // to account for possible trailing slash
            httpVariant, // if incoming item is https, but we already stored it as http
            httpsVariant, // if incoming item is http, but we already stored it as https
            feedId,
        )
        .first();

    if (existingByURL) throw new Error('Item already exists in the database by URL.');

    // new item, but maybe it already exists in the database by title
    if (item?.title?.length && item?.title?.length > 0) {
        const existingByTitle = await env.DB.prepare('SELECT item_id FROM items WHERE title = ? AND feed_id = ?')
            .bind(item.title, feedId)
            .first();
        if (existingByTitle) throw new Error('Item already exists in the database by title.');
    }

    // ==================================|
    // OMG FINALLY ITEM CAN BE ADDED!!!  |
    // ==================================|
    const itemDescriptionWithoutSemanticElements = await stripNonLinguisticElements(item.description || '');
    const itemDescription = truncate(itemDescriptionWithoutSemanticElements, 350);
    const potentialTitle = truncate(itemDescriptionWithoutSemanticElements, 55);

    const itemPubDate: string = getItemPubDate(item).toISOString();
    let itemTitle: string;
    if (item.title?.length) itemTitle = await stripTags(item.title);
    else if (potentialTitle?.length) itemTitle = potentialTitle;
    else itemTitle = itemPubDate.slice(0, 10);

    const itemContentHTML =
        getText(item.content_from_content) ||
        getText(item.content_from_content_encoded) ||
        getText(item.content_from_description) ||
        getText(item.content_from_content_html) ||
        '';

    const insertedItems = await env.DB.prepare(
        'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
    )
        .bind(feedId, itemTitle, itemUrl, itemPubDate, itemDescription, itemContentHTML)
        .run();

    const itemSqid = itemIdToSqid(insertedItems.meta.last_row_id);
    await env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?')
        .bind(itemSqid, insertedItems.meta.last_row_id)
        .run();

    console.log({
        message: 'New item added',
        itemId: insertedItems.meta.last_row_id,
        item_sqid: itemSqid,
        url: itemUrl,
        feedId: feedId,
    });

    return insertedItems.meta.last_row_id;
}
