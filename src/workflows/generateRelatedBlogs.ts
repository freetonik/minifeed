import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Bindings } from '../bindings';
import { sortByFrequency } from '../utils';

type GenerateRelatedFeedsParams = {
    feedId: number;
};

export class GenerateRelatedFeedsWorkflow extends WorkflowEntrypoint<Bindings, GenerateRelatedFeedsParams> {
    async run(event: WorkflowEvent<GenerateRelatedFeedsParams>, step: WorkflowStep) {
        const relatedItemIds: Array<number> = await step.do('get ids of related items of given feed', async () => {
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

            const relatedItemIds = relatedItems.results.map((item) => item.related_item_id as number);

            // Return array of unique related item IDs, sorted by frequency of occurrence among all items of this feed
            return sortByFrequency(relatedItemIds);
        });

        const relatedFeedsIds = await step.do('get feed ids of related items', async () => {
            const feedIds = await this.env.DB.prepare(
                `SELECT DISTINCT feeds.feed_id
                FROM items
                JOIN feeds ON items.feed_id = feeds.feed_id
                WHERE items.item_id IN  (${relatedItemIds.join(',')})
                LIMIT 10
                `,
            ).all();

            return feedIds.results.map((item) => item.feed_id as number);
        });

        await step.do('delete existing related feed ids', async () => {
            await this.env.DB.prepare('DELETE FROM related_feeds WHERE feed_id = ?').bind(event.payload.feedId).run();
        });

        await step.do('insert feed ids', async () => {
            for (const rfId of relatedFeedsIds) {
                await this.env.DB.prepare('INSERT INTO related_feeds (feed_id, related_feed_id) VALUES (?, ?)')
                    .bind(event.payload.feedId, rfId)
                    .run();
            }
        });
    }
}
