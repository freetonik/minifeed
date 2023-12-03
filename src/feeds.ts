import { renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const feedsAll = async (c) => {
  // const user = c.get('USER_ID')
  // return c.text(`User: ${user}`)
  const { results } = await c.env.DB
    .prepare("SELECT * from feeds")
    .run();

  let list = `<h1>All feeds</h1>`
  results.forEach((feed: any) => {
    const sqid = idToSqid(feed.feed_id)
    list += `<li><a href="/feeds/${sqid}">${feed.title}</a> (<a href="${feed.url}">Site</a> / <a href="${feed.rss_url}">RSS</a>)</li>`
  })
  return c.html(renderHTML("All items", html`${raw(list)}`))
}

export const feedsSingle = async (c) => {
  // TODO: we're assuming that feed always has items; if feed has 0 items, this will return 404, but maybe we want to
  // show the feed still as "processing"; use https://developers.cloudflare.com/d1/platform/client-api/#batch-statements
  const feedSqid = c.req.param('feed_sqid')
  const feedId = sqidToId(feedSqid);
  const userId = c.get('USER_ID') || "0";

  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT feeds.title, feeds.url, feeds.rss_url, subscriptions.subscription_id from feeds 
      LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?
      WHERE feeds.feed_id = ?
      `).bind(userId, feedId),
    c.env.DB.prepare(`
      SELECT items.item_id, items.title AS item_title, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.url AS feed_url, feeds.feed_id
      FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id 
      WHERE feeds.feed_id = ? 
      ORDER BY items.pub_date DESC`).bind(feedId),
  ]);

  // batch[0] is feed with subscription status; 0 means no feed foudn in DB
  if (batch[0].results.length === 0) return c.notFound();
  const feedTitle = batch[0].results[0]['title']
  const feedUrl = batch[0].results[0]['url']
  const rssUrl = batch[0].results[0]['rss_url']
  const subscriptionButtonText = batch[0].results[0]['subscription_id'] ? "unsubscribe" : "subscribe";

  const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };
  let list = `<h1>${feedTitle}</h1><p><a href="${feedUrl}">${feedUrl}</a></p>
  <span id="subscription">
    <button hx-post="/feeds/${feedSqid}/${subscriptionButtonText}"
      hx-trigger="click"
      hx-target="#subscription"
      hx-swap="outerHTML">
      ${subscriptionButtonText}
    </button>
  </span>
  `

  // batch[1] is items
  batch[1].results.forEach((item: any) => {
    const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)
    const postSqid = idToSqid(item.item_id, 10)
    list += `<li><a href="${item.item_url}">${item.item_title}</a> / <a href="/items/${postSqid}">read</a> <time>${postDate}</time></li>`
  })
  return c.html(renderHTML("All items", html`${raw(list)}`))
}

export const feedsSubscribe = async (c) => {
  if (!c.get('USER_ID')) return c.redirect('/login');
  const userId = c.get('USER_ID');
  const feedSqid = c.req.param('feed_sqid')
  const feedId = sqidToId(feedSqid);
  let result

  try {
    result = await c.env.DB.prepare("INSERT INTO subscriptions (user_id, feed_id) values (?, ?)").bind(userId, feedId).run()
  } catch (err) {
    c.status(400);
    return c.body('bad request');
  }
  console.log(result);
  if (result.success) {
    c.status(201);
    return c.html(`
      <span id="subscription">
        <button hx-post="/feeds/${feedSqid}/unsubscribe"
          hx-trigger="click"
          hx-target="#subscription"
          hx-swap="outerHTML">
          unsubscribe
        </button>
      </span>
    `);
  }
  return c.html(`
      <span id="subscription">
        "Error"
      </span>
    `);
}

export const feedsUnsubscribe = async (c) => {
  if (!c.get('USER_ID')) return c.redirect('/login');
  const userId = c.get('USER_ID');
  const feedSqid = c.req.param('feed_sqid')
  const feedId = sqidToId(feedSqid);

  try {
    await c.env.DB.prepare("DELETE FROM subscriptions WHERE user_id = ? AND feed_id = ?").bind(userId, feedId).all()
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
      <span id="subscription">
        <button hx-post="/feeds/${feedSqid}/subscribe"
          hx-trigger="click"
          hx-target="#subscription"
          hx-swap="outerHTML">
          subscribe
        </button>
      </span>
    `);
}