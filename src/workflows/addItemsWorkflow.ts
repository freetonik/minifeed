import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { vectorizeAndStoreItem } from '../ai';
import type { Bindings } from '../bindings';
import { regenerateTopItemsCacheForFeed } from '../feeds';
import { regenerateRelatedForItem } from '../handlers/items/itemAdmin';
import type { MFFeedEntry } from '../interface';
import { scrapeURLIntoObject } from '../scrape';
import { updateItemIndex } from '../search';
import {
    extractItemUrl,
    getItemPubDate,
    getText,
    itemIdToSqid,
    stripNonLinguisticElements,
    stripTags,
    truncate,
} from '../utils';

type AddItemsWorkflowParams = {
    items: Array<MFFeedEntry>;
    feedId: number;
};

type ItemInfo = {
    itemId: number;
    itemUrl: string;
    itemDescription: string;
    itemSqid?: string;
    textContent?: string;
};

export class AddItemsWorkflow extends WorkflowEntrypoint<Bindings, AddItemsWorkflowParams> {
    async run(event: WorkflowEvent<AddItemsWorkflowParams>, step: WorkflowStep) {
        // STEP 1: Add items to the database
        let itemsInfo: Array<ItemInfo> = [];
        itemsInfo = await step.do('add items to db', async () => {
            const { items, feedId } = event.payload;

            const feed = await this.env.DB.prepare('SELECT rss_url FROM feeds WHERE feed_id = ?').bind(feedId).first();
            if (!feed) throw new NonRetryableError(`Feed with ID ${feedId} not found`);
            const feedRSSUrl = feed.rss_url as string;

            for (const item of items) {
                let itemUrl = '';
                try {
                    itemUrl = extractItemUrl(item, feedRSSUrl);
                } catch (e) {
                    console.log({
                        message: 'Failed to extract item URL',
                        itemUrl,
                        feedRSSUrl,
                    });
                    break;
                }

                // check if the URL is not in blacklist
                const { value: blacklisted, metadata } = await this.env.BLACKLIST_URLS.getWithMetadata(itemUrl);
                if (blacklisted) {
                    console.log({
                        message: `Item URL is blacklisted. Reason: ${metadata.reason}`,
                        itemUrl,
                        feedRSSUrl,
                    });
                    break;
                }

                // check if item URL is already in the database for this feed
                const httpVariant = itemUrl.startsWith('https://') ? `https://${itemUrl.slice(8)}` : itemUrl;
                const httpsVariant = itemUrl.startsWith('http://') ? `https://${itemUrl.slice(7)}` : itemUrl;
                const existingByURL = await this.env.DB.prepare(`
                            SELECT item_id
                            FROM items
                            WHERE url = ? OR url = ? OR url = ? OR url = ? AND feed_id = ?
                            `)
                    .bind(
                        itemUrl,
                        itemUrl.slice(0, -1), // to account for possible trailing slash
                        httpVariant, // if incoming item is https, but we already stored it as http
                        httpsVariant, // if incoming item is http, but we already stored it as https
                        feedId,
                    )
                    .first();

                if (existingByURL) {
                    await this.env.BLACKLIST_URLS.put(itemUrl, '1', { metadata: { reason: 'duplicate url' } });
                    console.log({
                        message: 'Item already exists in the database by URL. Blacklisted.',
                        itemUrl,
                        feedRSSUrl,
                    });
                    break;
                }

                // check if item title is already in the database by title for this feed
                if (item?.title?.length && item?.title?.length > 0) {
                    const existingByTitle = await this.env.DB.prepare(`
                        SELECT item_id
                        FROM items
                        WHERE title = ? AND feed_id = ?
                        `)
                        .bind(item.title, feedId)
                        .first();
                    if (existingByTitle) {
                        await this.env.BLACKLIST_URLS.put(itemUrl, '1', { metadata: { reason: 'duplicate title' } });
                        console.log({
                            message: 'Item already exists in the database by title. Blacklisted.',
                            itemUrl,
                            feedRSSUrl,
                        });
                        break;
                    }
                }

                // ==================================|
                // OMG FINALLY ITEM CAN BE ADDED!!!  |
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

                const insertedItem = await this.env.DB.prepare(
                    'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?) RETURNING item_id',
                )
                    .bind(feedId, itemTitle, itemUrl, itemPubDate, itemDescription, itemContentHTML)
                    .run();

                const itemSqid = itemIdToSqid(insertedItem.item_id);
                await this.env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?')
                    .bind(itemSqid, insertedItem.item_id)
                    .run();

                console.log({
                    message: 'New item added',
                    itemId: insertedItem.item_id,
                    item_sqid: itemSqid,
                    url: itemUrl,
                    feedId: feedId,
                });

                itemsInfo.push({
                    itemId: insertedItem.item_id,
                    itemUrl,
                    itemDescription,
                });
            }

            return itemsInfo;
        });

        // STEP 2: Update feed top items cache
        if (itemsInfo.length > 0) {
            await step.do('regenerate top items cache for feed', async () => {
                return await regenerateTopItemsCacheForFeed(this.env, event.payload.feedId);
            });
        }

        // STEP 3: Scrape (may fail)

        await step.do('scrape item', async () => {
            for (const item of itemsInfo) {
                try {
                    const scrapedArticle = await scrapeURLIntoObject(item.itemUrl);
                    let newItemDescription = item.itemDescription;
                    if (!newItemDescription || newItemDescription.length < 5)
                        newItemDescription = scrapedArticle.description;

                    await this.env.DB.prepare(
                        'UPDATE items SET content_html_scraped = ?, description = ? WHERE item_id = ?',
                    )
                        .bind(scrapedArticle.HTMLcontent, newItemDescription, item.itemId)
                        .run();

                    item.textContent = scrapedArticle.textContent;
                } catch (e) {
                    console.log({
                        message: `Scrape failed: ${e}`,
                        itemId: item?.itemId,
                        url: item?.itemUrl,
                    });
                    break;
                }
            }
        });

        // STEP 5: Update search index
        await step.do('index item', async () => {
            for (const item of itemsInfo) {
                await updateItemIndex(this.env, item.itemId, item.textContent); // use the scraped content if possible
            }
        });

        // STEP 6: Vectorize items
        await step.do('vectorize item', async () => {
            for (const item of itemsInfo) {
                await vectorizeAndStoreItem(this.env, item.itemId);
            }
        });

        // STEP 7: Wait for vectorize to persist
        await step.sleep('wait on something', '1 minute');

        // STEP 8: Regenerate related cache
        await step.do('regenerate related cache for items', async () => {
            for (const item of itemsInfo) await regenerateRelatedForItem(this.env, item.itemId);
        });
    }
}
