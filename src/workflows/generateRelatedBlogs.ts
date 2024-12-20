import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Bindings } from '../bindings';

type GenerateRelatedBlogsParams = {
    feedId: number;
};

type ItemInfo = {
    itemId: number;
    itemUrl: string;
    itemDescription: string;
    itemSqid?: string;
};

export class AddItemWorkflow extends WorkflowEntrypoint<Bindings, GenerateRelatedBlogsParams> {
    async run(event: WorkflowEvent<GenerateRelatedBlogsParams>, step: WorkflowStep) {
        await step.do('get ids of related items of blog', async () => {
            const { feedId } = event.payload;
            const relatedItems = await this.env.DB.prepare(
                `SELECT items.item_id, related_item_id, feeds.feed_id
                FROM related_items
                JOIN items ON items.item_id = related_items.item_id
                JOIN feeds ON feeds.feed_id = items.feed_id
                WHERE items.feed_id = ?`,
            )
                .bind(feedId)
                .all();
        });
    }
}
