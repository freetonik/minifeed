import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep, type WorkflowStepConfig } from 'cloudflare:workers';
import { vectorizeAndStoreItem } from '../ai';
import type { Bindings } from '../bindings';
import { regenerateTopItemsCacheForFeed } from '../feeds';
import { regenerateRelatedCacheForItem } from '../handlers/items/itemAdmin';
import type { MFFeedEntry } from '../interface';
import { scrapeURLIntoObject } from '../scrape';
import { updateItemIndex } from '../search';
import { extractItemUrl, getItemPubDate, getText, itemIdToSqid, stripTags, truncate } from '../utils';

const standardRetryPolicy: WorkflowStepConfig = {
    retries: {
        limit: 5,
        delay: '5 second',
        backoff: 'exponential',
    },
    timeout: '15 minutes',
};

type Params = {
    item: MFFeedEntry;
    feedId: number;
    feedRSSUrl: string;
    itemId?: number;
};

export class AddOrUpdateItemWorkflow extends WorkflowEntrypoint<Bindings, Params> {
    async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
        // STEP 1: Add item to the database
        const itemInfo = await step.do('add item to db', async () => {
            // if itemId is provided, we are updating an existing item
            if (event.payload.itemId) {
                const existingItem = await this.env.DB.prepare(`
                    SELECT item_id, url, description, item_sqid
                    FROM items
                    WHERE item_id = ?
                    `)
                    .bind(event.payload.itemId)
                    .first();
                if (existingItem) {
                    return {
                        itemId: event.payload.itemId as number,
                        itemUrl: existingItem.url as string,
                        itemDescription: existingItem.description as string,
                        itemSqid: existingItem.item_sqid as string,
                    };
                }
            }

            const item = event.payload.item;
            const feedRSSUrl = event.payload.feedRSSUrl;
            const itemUrl = extractItemUrl(item, feedRSSUrl);
            const feedId = event.payload.feedId;
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
                    message: 'Item already exists in the database',
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
            const insertionResults = await this.env.DB.prepare(
                'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
            )
                .bind(feedId, itemTitle, itemUrl, itemPubDate, itemDescription, itemContentHTML)
                .run();

            const itemId = insertionResults.meta.last_row_id;
            console.log(`Item: ${itemId} added to feed ${feedId}`);
            return {
                itemId,
                itemUrl,
                itemDescription,
            };
        });

        // STEP 2: Assign item SQID
        const itemSqid = await step.do('assign item sqid', async () => {
            // if workflow starter with existing known item id, we don't need to re-assign a new sqid
            if (itemInfo.itemSqid) return itemInfo.itemSqid;

            const itemSqid = itemIdToSqid(itemInfo.itemId);
            await this.env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?')
                .bind(itemSqid, itemInfo.itemId)
                .run();
            console.log(`Item: ${itemInfo.itemId} set sqid ${itemSqid}`);
            return itemSqid;
        });

        // STEP 3: Update feed top items cache
        const topCacheRegenerated = await step.do('regenerate top items cache for item', async () => {
            await regenerateTopItemsCacheForFeed(this.env, event.payload.feedId);
            return true;
        });

        // STEP 4: Scrape (may fail)
        let textContent = null;
        try {
            textContent = await step.do('scrape item', standardRetryPolicy, async () => {
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
            console.log(`Scraping failed: ${e.message}`);
        }

        // STEP 5: Update search index
        await step.do('index item', standardRetryPolicy, async () => {
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

        await step.sleep('wait on something', '1 minute');

        // STEP 7: Regenerate related cache
        await step.do('regenerate related cache for item', async () => {
            await regenerateRelatedCacheForItem(this.env, itemInfo.itemId);
        });
    }
}
