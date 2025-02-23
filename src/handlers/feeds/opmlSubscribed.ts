import type { Context } from 'hono';
import { generateOPML } from '../../utils';

export async function handleOPMLSubscribed(c: Context) {
    const userId = c.get('USER_ID') || -1;
    const { results, meta } = await c.env.DB.prepare(`
        SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, subscriptions.subscription_id, items_top_cache.content
        FROM feeds
        LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
        LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?
        WHERE subscriptions.subscription_id IS NOT NULL
        ORDER BY subscriptions.subscription_id DESC`)
        .bind(userId)
        .run();
    const opml = generateOPML(results);
    return c.body(opml, 200, { 'Content-Type': 'text/xml' });
}
