import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { vectorizeAndStoreItem } from '../ai';
import type { Bindings } from '../bindings';
import { regenerateTopItemsCacheForFeed } from '../feeds';
import { regenerateRelatedCacheForItem } from '../handlers/items/itemAdmin';
import type { MFFeedEntry } from '../interface';
import { scrapeURLIntoObject } from '../scrape';
import { updateItemIndex } from '../search';
import { extractItemUrl, getItemPubDate, getText, itemIdToSqid, stripTags, truncate } from '../utils';

type Params = {
    item?: MFFeedEntry;
    feedId?: number;
    itemId?: number;
};

type ItemInfo = {
    itemId: number;
    itemUrl: string;
    itemDescription: string;
    itemSqid?: string;
    feedId?: number;
};

export class AddOrUpdateItemWorkflow extends WorkflowEntrypoint<Bindings, Params> {
    async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
        // STEP 1: Add item to the database

        const itemInfo: ItemInfo = await step.do('add item to db', async () => {
            const { item, feedId, itemId } = event.payload;

            if (item && itemId) throw new NonRetryableError('Both item and itemId provided, only one allowed');

            // if itemId is provided, we are updating an existing item
            if (itemId) {
                const existingItem = await this.env.DB.prepare(
                    'SELECT item_id, url, description, item_sqid, feed_id FROM items WHERE item_id = ?',
                )
                    .bind(event.payload.itemId)
                    .first();
                if (existingItem) {
                    return {
                        itemId: event.payload.itemId as number,
                        itemUrl: existingItem.url as string,
                        itemDescription: existingItem.description as string,
                        itemSqid: existingItem.item_sqid as string,
                        feedId: existingItem.feed_id as number,
                    };
                }
                throw new NonRetryableError(`itemID ${event.payload.itemId} was provided, but not found in DB`);
            }

            if (item && feedId) {
                const feed = await this.env.DB.prepare('SELECT rss_url FROM feeds WHERE feed_id = ?')
                    .bind(feedId)
                    .first();

                if (!feed) throw new NonRetryableError(`Feed with ID ${feedId} not found`);

                const feedRSSUrl = feed.rss_url as string;
                const itemUrl = extractItemUrl(item, feedRSSUrl);
                const itemDescription = truncate(await stripTags(item.description || ''), 350);

                // new item, but maybe it already exists in the database
                const possiblyExistingItem = await this.env.DB.prepare(`
                            SELECT item_id
                            FROM items
                            WHERE url = ? AND feed_id = ?
                            `)
                    .bind(itemUrl, feedId)
                    .first();
                if (possiblyExistingItem) {
                    console.log({
                        message: 'New item being added, but it already exists in the database by url and feed_id',
                        item_id: possiblyExistingItem.item_id,
                        url: itemUrl,
                        feed_id: feedId,
                    });
                    return {
                        itemId: possiblyExistingItem.item_id as number,
                        itemUrl,
                        itemDescription,
                    };
                }

                const itemPubDate: string = getItemPubDate(item).toISOString();
                const itemTitle = item.title?.length ? await stripTags(item.title) : itemPubDate.slice(0, 10);
                const itemContentHTML =
                    getText(item.content_from_content) ||
                    getText(item.content_from_content_encoded) ||
                    getText(item.content_from_description) ||
                    getText(item.content_from_content_html) ||
                    '';

                // ok, it's really a new item, add it to db
                const insertedItems = await this.env.DB.prepare(
                    'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
                )
                    .bind(feedId, itemTitle, itemUrl, itemPubDate, itemDescription, itemContentHTML)
                    .run();

                const itemId = insertedItems.meta.last_row_id;
                console.log({
                    message: 'New item added',
                    item_id: itemId,
                    url: itemUrl,
                    feed_id: feedId,
                });
                return {
                    itemId,
                    itemUrl,
                    itemDescription,
                };
            }

            throw new NonRetryableError('Either item or itemId must be provided');
        });

        // STEP 2: Assign item SQID
        await step.do('assign item sqid', async () => {
            // if workflow starter with existing known item id, we don't need to re-assign a new sqid
            if (itemInfo.itemSqid) return itemInfo.itemSqid;

            const itemSqid = itemIdToSqid(itemInfo.itemId);
            await this.env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?')
                .bind(itemSqid, itemInfo.itemId)
                .run();
            console.log({
                message: 'Item SQID assigned',
                item_id: itemInfo.itemId,
                item_sqid: itemSqid,
            });
            return itemSqid;
        });

        // STEP 3: Update feed top items cache
        await step.do('regenerate top items cache for item', async () => {
            const feedId = event.payload.feedId || itemInfo.feedId;
            if (feedId) {
                await regenerateTopItemsCacheForFeed(this.env, feedId);
                return true;
            }
            return false; // for some reason we don't have a feedId
        });

        // STEP 4: Scrape (may fail)
        let textContent = null;
        try {
            textContent = await step.do('scrape item', async () => {
                const scrapedArticle = await scrapeURLIntoObject(itemInfo.itemUrl);
                let newItemDescription = itemInfo.itemDescription;
                if (!newItemDescription || newItemDescription.length < 5)
                    newItemDescription = scrapedArticle.description;

                await this.env.DB.prepare(
                    'UPDATE items SET content_html_scraped = ?, description = ? WHERE item_id = ?',
                )
                    .bind(scrapedArticle.HTMLcontent, newItemDescription, itemInfo.itemId)
                    .run();

                return scrapedArticle.textContent;
            });
        } catch (e) {
            console.log({
                message: `Scrape failed: ${e}`,
                itemId: itemInfo.itemId,
                url: itemInfo.itemUrl,
            });
        }

        // STEP 5: Update search index
        await step.do('index item', async () => {
            // if scraping succeeded, use the scraped content
            if (textContent) {
                return await updateItemIndex(this.env, itemInfo.itemId, textContent);
            }
            return await updateItemIndex(this.env, itemInfo.itemId);
        });

        // STEP 6: Vectorize item
        await step.do('vectorize item', async () => {
            return await vectorizeAndStoreItem(this.env, itemInfo.itemId);
        });

        // STEP 7: Wait for vectorize to persist
        await step.sleep('wait on something', '1 minute');

        // STEP 8: Regenerate related cache
        await step.do('regenerate related cache for item', async () => {
            return await regenerateRelatedCacheForItem(this.env, itemInfo.itemId);
        });
    }
}
