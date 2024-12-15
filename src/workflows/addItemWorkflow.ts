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

type AddItemWorkflowParams = {
    item: MFFeedEntry;
    feedId: number;
};

type ItemInfo = {
    itemId: number;
    itemUrl: string;
    itemDescription: string;
    itemSqid?: string;
};

export class AddItemWorkflow extends WorkflowEntrypoint<Bindings, AddItemWorkflowParams> {
    async run(event: WorkflowEvent<AddItemWorkflowParams>, step: WorkflowStep) {
        // STEP 1: Add item to the database
        const itemInfo: ItemInfo = await step.do('add item to db', async () => {
            const { item, feedId } = event.payload;

            const feed = await this.env.DB.prepare('SELECT rss_url FROM feeds WHERE feed_id = ?').bind(feedId).first();
            if (!feed) throw new NonRetryableError(`Feed with ID ${feedId} not found`);

            const feedRSSUrl = feed.rss_url as string;
            let itemUrl = '';
            try {
                itemUrl = extractItemUrl(item, feedRSSUrl);
            } catch (e) {
                throw new NonRetryableError('Failed to extract item URL');
            }

            const itemDescription = truncate(await stripTags(item.description || ''), 350);

            // new item, but maybe it already exists in the database by URL
            const existingByURL = await this.env.DB.prepare(`
                            SELECT item_id
                            FROM items
                            WHERE url = ? OR url = ? AND feed_id = ?
                            `)
                .bind(
                    itemUrl,
                    itemUrl.slice(0, -1), // to account for possible trailing slash
                    feedId,
                )
                .first();
            if (existingByURL) throw new NonRetryableError('Item already exists in the database by URL');

            // new item, but maybe it already exists in the database by title
            if (item?.title?.length && item?.title?.length > 0) {
                const existingByTitle = await this.env.DB.prepare(`
                            SELECT item_id
                            FROM items
                            WHERE title = ? AND feed_id = ?
                            `)
                    .bind(item.title, feedId)
                    .first();
                if (existingByTitle) throw new NonRetryableError('Item already exists in the database by title');
            }

            // ok, it's really a new item, add it to db
            const itemPubDate: string = getItemPubDate(item).toISOString();
            const itemTitle = item.title?.length ? await stripTags(item.title) : itemPubDate.slice(0, 10);
            const itemContentHTML =
                getText(item.content_from_content) ||
                getText(item.content_from_content_encoded) ||
                getText(item.content_from_description) ||
                getText(item.content_from_content_html) ||
                '';

            const insertedItems = await this.env.DB.prepare(
                'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
            )
                .bind(feedId, itemTitle, itemUrl, itemPubDate, itemDescription, itemContentHTML)
                .run();

            console.log({
                message: 'New item added',
                itemId: insertedItems.meta.last_row_id,
                url: itemUrl,
                feedId: feedId,
            });

            return {
                itemId: insertedItems.meta.last_row_id,
                itemUrl,
                itemDescription,
            };
        });

        // STEP 2: Assign item SQID
        await step.do('assign item sqid', async () => {
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
            return await regenerateTopItemsCacheForFeed(this.env, event.payload.feedId);
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
