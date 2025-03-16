import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderItemShort } from '../../htmltools';
import { feedSqidToId } from '../../utils';

export async function handleBlog(c: Context) {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);
    const userId = c.get('USER_ID') || -1;
    const userLoggedIn = !!c.get('USER_ID');

    const batch = await c.env.DB.batch([
        c.env.DB.prepare(
            `
          SELECT feeds.title, feeds.url, feeds.rss_url, subscriptions.subscription_id, feeds.verified, feeds.description
          FROM feeds
          LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?
          WHERE feeds.feed_id = ?
          `,
        ).bind(userId, feedId),

        c.env.DB.prepare(
            `
          SELECT
              items.item_id, items.item_sqid, items.description, items.title AS item_title, items.pub_date, items.url AS item_url,
              feeds.title AS feed_title, feeds.url AS feed_url, feeds.feed_id, favorite_id
          FROM items
          JOIN feeds ON items.feed_id = feeds.feed_id
          LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
          WHERE items.item_sqid IS NOT 0 AND feeds.feed_id = ?
          ORDER BY items.pub_date DESC`,
        ).bind(userId, feedId),

        c.env.DB.prepare(`
          SELECT related_feeds.related_feed_id, title, url, rss_url, feed_sqid
          FROM feeds
          JOIN related_feeds ON feeds.feed_id = related_feeds.related_feed_id
          WHERE related_feeds.feed_id = ?
        `).bind(feedId),
    ]);

    // batch[0] is feed joined with subscription status; 0 means no feed found in DB
    if (!batch[0].results.length) return c.notFound();
    const feedTitle = batch[0].results[0].title;

    const feedUrl = batch[0].results[0].url;
    const rssUrl = batch[0].results[0].rss_url;
    const subscriptionAction = batch[0].results[0].subscription_id ? 'unsubscribe' : 'subscribe';
    const subscriptionButtonText = batch[0].results[0].subscription_id ? 'subscribed' : 'subscribe';
    const subscriptionBlock = userLoggedIn
        ? `
      <span id="subscription">
        <button hx-post="/feeds/${feedSqid}/${subscriptionAction}"
          class="button ${subscriptionButtonText}"
          hx-trigger="click"
          hx-target="#subscription"
          hx-swap="outerHTML">
          <span class="subscribed-text">${subscriptionButtonText}</span>
        <span class="unsubscribe-text">unsubscribe</span>
        </button>
      </span>`
        : `
      <span id="subscription">
        <button class="button" disabled title="Login to subscribe">
            <span>${subscriptionButtonText}</span>
        </button>
      </span>
      `;
    const feedDescription = batch[0].results[0].description ? `${batch[0].results[0].description}<br>` : '';

    const feedDescriptionBlock = `
    <div style="margin-bottom:1em;">
    ${feedDescription}
    <a href="${feedUrl}">${feedUrl}</a> (<a href="${rssUrl}">RSS</a>)
    </div>
    `;

    let inner = `
    <div style="margin-bottom:3em;">
    <h1 style="margin-bottom:0.25em;">
      ${feedTitle}
    </h1>

    ${feedDescriptionBlock}
    ${subscriptionBlock}
    <span id="subscription">
        <a class="button" href="${feedUrl}">
        visit blog <strong>↗</strong>
        </a>
      </span>


    </div>
    `;

    // batch[1] is items
    if (!batch[1].results.length) inner += '<p>Feed is being updated, come back later...</p>';
    else {
        for (const item of batch[1].results) {
            const itemTitle = item.favorite_id ? `★ ${item.item_title}` : item.item_title;
            inner += renderItemShort(
                item.item_sqid,
                itemTitle,
                item.item_url,
                '', // don't show feed title
                '', // don't show feed link
                item.pub_date,
                item.description,
            );
        }
        inner += `<div class="flash">↑ These items are from RSS. Visit the blog itself at <strong><a href="${feedUrl}">${feedUrl}</a></strong> to find everything else and to appreciate author's digital home.</div>`;
    }

    let related_block = '';
    if (batch[2].results?.length) {
        related_block += '<div class="related-items"><h4>Related blogs</h4><div class="items fancy-gradient-bg">';
        for (const i of batch[2].results) {
            related_block += `
            <div class="item-tiny">
              <a href="/blogs/${i.feed_sqid}" class="bold no-color no-underline">${i.title}</a> <br>

              <div class="muted">
                  <small>
                  <a class="no-underline no-color" href="${i.url}">${i.url}</a> |
                      <a class="no-underline no-color" href="${i.rss_url}">RSS</a>
                  </small>
              </div>
          </div>
          `;
        }
        related_block += '</div></div>';
        inner += related_block;
    }

    let debug_info = '';
    if (c.get('USER_IS_ADMIN')) {
        debug_info = `${batch[0].meta.duration}+${batch[1].meta.duration} ms;,
            ${batch[0].meta.rows_read}+${batch[1].meta.rows_read} rows read`;
    }
    return c.html(renderHTML(`${feedTitle} | minifeed`, raw(inner), userLoggedIn, 'blogs', '', '', debug_info));
}
