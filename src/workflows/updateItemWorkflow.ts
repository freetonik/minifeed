import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { vectorizeAndStoreItem } from '../ai';
import type { Bindings } from '../bindings';
import { regenerateTopItemsCacheForFeed } from '../feeds';
import { regenerateRelatedCacheForItemNEW } from '../handlers/items/itemAdmin';
import { scrapeURLIntoObject } from '../scrape';
import { updateItemIndex } from '../search';

type Params = {
    itemId: number;
};

type ItemInfo = {
    itemId: number;
    itemUrl: string;
    itemDescription: string;
    itemSqid: string;
    feedId: number;
};

export class UpdateItemWorkflow extends WorkflowEntrypoint<Bindings, Params> {
    async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
        // STEP 1: Fetch item from DB
        const itemInfo: ItemInfo = await step.do('add item to db', async () => {
            const existingItem = await this.env.DB.prepare(
                'SELECT item_id, url, description, item_sqid, feed_id FROM items WHERE item_id = ?',
            )
                .bind(event.payload.itemId)
                .first();
            if (!existingItem) throw new NonRetryableError(`itemID ${event.payload.itemId} not found in DB`);

            return {
                itemId: event.payload.itemId as number,
                itemUrl: existingItem.url as string,
                itemDescription: existingItem.description as string,
                itemSqid: existingItem.item_sqid as string,
                feedId: existingItem.feed_id as number,
            };
        });

        // STEP 2: Update feed top items cache
        await step.do('regenerate top items cache for item', async () => {
            await regenerateTopItemsCacheForFeed(this.env, itemInfo.feedId);
            return true;
        });

        // STEP 3: Scrape (may fail)
        let textContent = undefined;
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

        // STEP 4: Update search index
        await step.do('index item', async () => {
            return await updateItemIndex(this.env, itemInfo.itemId, textContent); // if scraping succeeded, use the scraped content
        });

        // STEP 5: Vectorize item
        await step.do('vectorize item', async () => {
            return await vectorizeAndStoreItem(this.env, itemInfo.itemId);
        });

        // STEP 6: Wait for vectorize to persist
        await step.sleep('wait on something', '1 minute');

        // STEP 7: Regenerate related cache
        await step.do('regenerate related cache for item', async () => {
            return await regenerateRelatedCacheForItemNEW(this.env, itemInfo.itemId);
        });
    }
}
