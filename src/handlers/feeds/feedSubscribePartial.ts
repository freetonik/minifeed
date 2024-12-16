import type { Context } from 'hono';
import { feedSqidToId } from '../../utils';

export const handleFeedsSubscribe = async (c: Context) => {
    if (!c.get('USER_ID')) return c.redirect('/login');
    const userId = c.get('USER_ID');
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    try {
        const result = await c.env.DB.prepare('INSERT INTO subscriptions (user_id, feed_id) values (?, ?)')
            .bind(userId, feedId)
            .run();
        if (result.success) {
            c.status(201);
            return c.html(`
              <span id="subscription-${feedSqid}">
                    <button hx-post="/feeds/${feedSqid}/unsubscribe"
                    class="button subscribed"
                    hx-trigger="click"
                    hx-target="#subscription-${feedSqid}"
                    hx-swap="outerHTML">
                    <span class="subscribed-text">subscribed</span>
                    <span class="unsubscribe-text">unsubscribe</span>
                    </button>
                </span>
            `);
        }
        return c.html(`<span id="subscription"> "Error" </span>`);
    } catch (err) {
        c.status(400);
        return c.body('bad request');
    }
};

export const handleFeedsUnsubscribe = async (c: Context) => {
    if (!c.get('USER_ID')) return c.redirect('/login');
    const userId = c.get('USER_ID');
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    try {
        await c.env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ? AND feed_id = ?')
            .bind(userId, feedId)
            .all();
    } catch (err) {
        c.status(400);
        return c.html(`
      <span id="subscription">
        "Error"
      </span>
    `);
    }
    c.status(201);
    return c.html(`
      <span id="subscription-${feedSqid}">
        <button hx-post="/feeds/${feedSqid}/subscribe"
          class="button subscribe"
          hx-trigger="click"
          hx-target="#subscription-${feedSqid}"
          hx-swap="outerHTML">
          subscribe
        </button>
      </span>
    `);
};
