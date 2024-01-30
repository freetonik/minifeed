import { Bindings } from "./bindings";

export async function enqueueUpdateAllFeeds(env: Bindings) {
    const { results: feeds } = await env.DB.prepare("SELECT feed_id, rss_url FROM feeds").all();
    for (const feed of feeds) {
        console.log(`Initiating feed update job for feed: ${feed['feed_id']} (${feed['rss_url']})`)
        await env.FEED_UPDATE_QUEUE.send(
            {
                'type': 'feed_update',
                'feed_id': feed['feed_id']
            }
        );
    }
}

export async function enqueueScrapeAllItemsOfFeed(env: Bindings, feedId: Number) {
    const { results: items } = await env.DB.prepare("SELECT item_id, url FROM items WHERE feed_id = ?").bind(feedId).all();
    for (const item of items) {
        await env.FEED_UPDATE_QUEUE.send(
            {
                'type': 'item_scrape',
                'item_id': item['item_id']
            }
        );
    }
}
