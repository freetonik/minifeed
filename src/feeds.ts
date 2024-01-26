import { renderAddFeedForm, renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { feedIdToSqid, feedSqidToId } from './utils'

export const feedsAll = async (c:any) => {
  const user_id = c.get('USER_ID')
  // return c.text(`User: ${user}`)
  const { results } = await c.env.DB
    .prepare(`
      SELECT feeds.feed_id, feeds.title, subscriptions.subscription_id from feeds 
      LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?`
    )
    .bind(user_id)
    .run();

  let list = `
  <div class="main">
  <p style="margin-top:0"><a class="button" href="/feeds/new">+ add new feed</a></p>
  `
  results.forEach((feed: any) => {
    const sqid = feedIdToSqid(feed.feed_id);
    const subscribed = feed.subscription_id ? '(subscribed)' : '';
    list += `
    <div>
      <a href="/feeds/${sqid}">${feed.title}</a> ${subscribed}
    </div>`
  })
  list += "</div>"
  return c.html(renderHTML("All feeds | minifeed", html`${raw(list)}`, c.get('USERNAME'), 'feeds'))
}

export const feedsSingle = async (c:any) => {
  // TODO: we're assuming that feed always has items; if feed has 0 items, this will return 404, but maybe we want to
  // show the feed still as "processing"; use https://developers.cloudflare.com/d1/platform/client-api/#batch-statements
  const feedSqid = c.req.param('feed_sqid')
  const feedId = feedSqidToId(feedSqid);
  const userId = c.get('USER_ID') || -1;
  const userLoggedIn = c.get('USER_ID') ? true : false;

  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT feeds.title, feeds.url, feeds.rss_url, subscriptions.subscription_id, feeds.verified 
      FROM feeds
      LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?
      WHERE feeds.feed_id = ?
      `).bind(userId, feedId),
    c.env.DB.prepare(`
      SELECT items.item_id, items.description, items.title AS item_title, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.url AS feed_url, feeds.feed_id
      FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id 
      WHERE feeds.feed_id = ? 
      ORDER BY items.pub_date DESC`).bind(feedId),
  ]);

  // batch[0] is feed joined with subscription status; 0 means no feed found in DB
  if (!batch[0].results.length) return c.notFound();
  const feedTitle = batch[0].results[0]['title']
  const feedUrl = batch[0].results[0]['url']
  const rssUrl = batch[0].results[0]['rss_url']
  const subscriptionButtonText = batch[0].results[0]['subscription_id'] ? "unsubscribe" : "subscribe";
  const subscriptionBlock = userLoggedIn ? `
    <span id="subscription">
      <button hx-post="/feeds/${feedSqid}/${subscriptionButtonText}"
        hx-trigger="click"
        hx-target="#subscription"
        hx-swap="outerHTML">
        ${subscriptionButtonText}
      </button>
    </span>`  : ''
  let list = `
  <h1>
    ${feedTitle}
    <small>(<a href="${feedUrl}">site</a> / <a href="${rssUrl}">rss</a>)</small>
  </h1>
  ${subscriptionBlock}
  <hr style="margin:2em 0;">
  `

  // batch[1] is items
  if (!batch[1].results.length) list += `<p>Feed is being updated, come back later...</p>`; 
  else {
    list += `<div>`
      batch[1].results.forEach((item: any) => {
      list += renderItemShort(item.item_id, item.item_title, item.item_url, '', item.feed_id, item.pub_date)
    })
    list += `</div>`
  }

  if (c.get('USER_ID') == 1) {
    list += `
    <div class="admin-control">
    <table>
      <tr>
        <td>Feed id:</td>
        <td>${feedId}</td>
      </tr>
      <tr>
        <td>Feed sqid:</td>
        <td>${feedSqid}</td>
      </tr>
      <tr>
        <td>Verified:</td>
        <td>${batch[0].results[0]['verified'] ? 'yes' : 'no'}</td>
      </tr>
    </table>
    <p>
      <button hx-post="/feeds/${feedSqid}/delete"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#delete-indicator"
        hx-swap="outerHTML">
        delete
      </button>
      <span id="delete-indicator"></span>
    </p>

    <p>
      <button hx-post="/feeds/${feedSqid}/update"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#update-indicator"
        hx-swap="outerHTML">
        update
      </button>
      <span id="update-indicator"></span>
    </p>

    <p>
      <button hx-post="/feeds/${feedSqid}/scrape"
        hx-confirm="Sure?"
        hx-trigger="click"
        hx-target="#scrape-indicator"
        hx-swap="outerHTML">
        scrape
      </button>
      <span id="scrape-indicator"></span>
    </p>
    </div>
    `
  }

  return c.html(renderHTML(
    `${feedTitle} | minifeed`, 
    html`${raw(list)}`,
    c.get('USERNAME'),
    'feeds'))
}

export const feedsSubscribe = async (c:any) => {
  if (!c.get('USER_ID')) return c.redirect('/login');
  const userId = c.get('USER_ID');
  const feedSqid = c.req.param('feed_sqid')
  const feedId = feedSqidToId(feedSqid);
  let result

  try {
    result = await c.env.DB.prepare("INSERT INTO subscriptions (user_id, feed_id) values (?, ?)").bind(userId, feedId).run()
  } catch (err) {
    c.status(400);
    return c.body('bad request');
  }
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

export const feedsUnsubscribe = async (c:any) => {
  if (!c.get('USER_ID')) return c.redirect('/login');
  const userId = c.get('USER_ID');
  const feedSqid = c.req.param('feed_sqid')
  const feedId = feedSqidToId(feedSqid);

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

export const feedsDelete = async (c:any) => {
  const feedId:number = feedSqidToId(c.req.param('feed_sqid'));

  await c.env.DB
    .prepare(`DELETE from feeds where feed_id = ?` )
    .bind(feedId)
    .run();

  return c.html(`Feed ${feedId} deleted`)
}

export const feedsUpdate = async (c:any) => {
  const feedId:number = feedSqidToId(c.req.param('feed_sqid'));
  await c.env.FEED_UPDATE_QUEUE.send(
    {
      'type': 'feed_update',
      'feed_id': feedId,
    }
  ); 
  return c.text("Feed update enqueued...")
}

export const feedsScrape = async (c:any) => {
  const feedId:number = feedSqidToId(c.req.param('feed_sqid'));
  await c.env.FEED_UPDATE_QUEUE.send(
    {
      'type': 'feed_scrape',
      'feed_id': feedId,
    }
  );
  return c.html('Feed scrape enqueued...')
}