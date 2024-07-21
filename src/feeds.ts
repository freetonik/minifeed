import { renderAddFeedForm, renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { extractItemUrl, feedIdToSqid, feedSqidToId, getFeedIdByRSSUrl, getRSSLinkFromUrl, getRootUrl, getText, itemIdToSqid, stripTags, truncate } from './utils'
import { deleteFeedFromIndex } from './search';
import { extractRSS } from './feed_extractor';
import { Bindings } from './bindings';
import { enqueueIndexAllItemsOfFeed, enqueueFeedUpdate, enqueueItemScrape, enqueueScrapeAllItemsOfFeed } from './queue';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ROUTE HANDLERS //////////////////////////////////////////////////////////////////////////////////////////////////////
export const blogsHandler = async (c:any) => {
    const user_id = c.get('USER_ID') || -1;
    const userLoggedIn = user_id != -1;
    const { results } = await c.env.DB
    .prepare(`
    SELECT feeds.feed_id, feeds.title, subscriptions.subscription_id, items_top_cache.content from feeds 
    LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
    LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?`
    ).bind(user_id)
    .run();
    
    let list = `<div class="main">`
    results.forEach((feed: any) => {
        const sqid = feedIdToSqid(feed.feed_id);

        const subscriptionAction = feed.subscription_id ? "unsubscribe" : "subscribe";
        const subscriptionButtonText = feed.subscription_id ? "subscribed" : "subscribe";
        
        let deleteButtonBlock = '';
        if (c.get('USER_ID') == 1) {
          deleteButtonBlock = `
            <span><button hx-post="/feeds/${sqid}/delete"
              hx-confirm="Sure?"
              hx-trigger="click"
              hx-target="#delete-indicator"
              hx-swap="outerHTML">
              delete
            </button>
            <span id="delete-indicator"></span></span>
          `
        }

        const subscriptionBlock = userLoggedIn ?
        `<div><span id="subscription-${sqid}">
            <button hx-post="/feeds/${sqid}/${subscriptionAction}"
            class="${subscriptionButtonText}"
            hx-trigger="click"
            hx-target="#subscription-${sqid}"
            hx-swap="outerHTML">
            <span class="subscribed-text">${subscriptionButtonText}</span>
            <span class="unsubscribe-text">unsubscribe</span>
            </button>
            ${deleteButtonBlock}
        </span></div>` 
        : 
        `<div><span id="subscription">
            <button disabled title="Login to subscribe">
            <span>${subscriptionButtonText}</span>
            </button>
        </span></div>`;

        const top_items = JSON.parse(feed.content);
        let top_items_list = '';

        if (top_items) {
          top_items_list += '<ul>'
          top_items.forEach((item: any) => {
            top_items_list += `<li><a href="/items/${item.item_sqid}">${item.title}</a></li>`
          });
          top_items_list += `<li><i>and <a href="/blogs/${sqid}">more...</a></i></li></ul>`
        }
        list += `
        <div class="blog-summary">
            <div class="summary-header">
                <div><h2><a class="no-color" href="/blogs/${sqid}">${feed.title}</a> </h2></div>
                ${subscriptionBlock}
                
            </div>
            ${top_items_list}
        </div>`
    })
    list += `<div style="margin-top:2em;text-align:center;"><a class="button" href="/blogs/new">+ add new blog</a></div></div>`
    return c.html(renderHTML("Blogs | minifeed", html`${raw(list)}`, c.get('USERNAME'), 'blogs'))
}

export const blogsSingleHandler = async (c:any) => {
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
          SELECT 
              items.item_id, items.description, items.title AS item_title, items.pub_date, items.url AS item_url, 
              feeds.title AS feed_title, feeds.url AS feed_url, feeds.feed_id, favorite_id
          FROM items 
          JOIN feeds ON items.feed_id = feeds.feed_id 
          LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
          WHERE feeds.feed_id = ? 
          ORDER BY items.pub_date DESC`).bind(userId, feedId),
    ]);

    // batch[0] is feed joined with subscription status; 0 means no feed found in DB
    if (!batch[0].results.length) return c.notFound();
    const feedTitle = batch[0].results[0]['title']
    const feedUrl = batch[0].results[0]['url']
    const rssUrl = batch[0].results[0]['rss_url']
    const subscriptionAction = batch[0].results[0]['subscription_id'] ? "unsubscribe" : "subscribe";
    const subscriptionButtonText = batch[0].results[0]['subscription_id'] ? "subscribed" : "subscribe";
    const subscriptionBlock = userLoggedIn ? `
      <span id="subscription">
        <button hx-post="/feeds/${feedSqid}/${subscriptionAction}"
          class="${subscriptionButtonText}"
          hx-trigger="click"
          hx-target="#subscription"
          hx-swap="outerHTML">
          <span class="subscribed-text">${subscriptionButtonText}</span>
        <span class="unsubscribe-text">unsubscribe</span>
        </button>
      </span>`  : `
      <span id="subscription">
        <button disabled title="Login to subscribe">
            <span>${subscriptionButtonText}</span>
        </button>
      </span>
      `;
    
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
        const itemTitle = item.favorite_id ? `★ ${item.item_title}` : item.item_title;
        list += renderItemShort(item.item_id, itemTitle, item.item_url, '', item.feed_id, item.pub_date, truncate(item.description, 350))
      })
      list += `</div>`
    }

    if (c.get('USER_ID') == 1) {
      list += `
      <p style="text-align:center;"><a class="no-underline" href="#hidden">🦎</a></p>
      <div class="admin-control" id="hidden">
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

      <p>
        <button hx-post="/feeds/${feedSqid}/index"
          hx-confirm="Sure?"
          hx-trigger="click"
          hx-target="#index-indicator"
          hx-swap="outerHTML">
          re-index
        </button>
        <span id="index-indicator"></span>
      </p>

      </div>
      `
    }

    return c.html(renderHTML(
      `${feedTitle} | minifeed`, 
      html`${raw(list)}`,
      c.get('USERNAME'),
      'blogs'))
}

export const feedsSubscribeHandler = async (c:any) => {
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
      <span id="subscription-${feedSqid}">
            <button hx-post="/feeds/${feedSqid}/unsubscribe"
            class="subscribed"
            hx-trigger="click"
            hx-target="#subscription-${feedSqid}"
            hx-swap="outerHTML">
            <span class="subscribed-text">subscribed</span>
            <span class="unsubscribe-text">unsubscribe</span>
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

export const feedsUnsubscribeHandler = async (c:any) => {
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
      <span id="subscription-${feedSqid}">
        <button hx-post="/feeds/${feedSqid}/subscribe"
          class="subscribe"
          hx-trigger="click"
          hx-target="#subscription-${feedSqid}"
          hx-swap="outerHTML">
          subscribe
        </button>
      </span>
    `);
}

export const feedsDeleteHandler = async (c:any) => {
  const feedId:number = feedSqidToId(c.req.param('feed_sqid'));

  await c.env.DB
    .prepare(`DELETE from feeds where feed_id = ?` )
    .bind(feedId)
    .run();

  await deleteFeedFromIndex(c.env, feedId);

  return c.html(`Feed ${feedId} deleted`);
}

export const blogsNewHandler = async (c:any) => {
  if (!c.get('USER_ID')) return c.redirect('/login')
  return c.html(renderHTML("Add new blog", html`${renderAddFeedForm()}`, c.get('USERNAME'), 'blogs'))
}

export const blogsNewPostHandler = async (c:any) => {
  const body = await c.req.parseBody();
  const url = body['url'].toString();
  let rssUrl;
  try {
      const verified = c.get('USER_ID') === 1 ? true : false;
      rssUrl = await addFeed(c.env, url, verified); // MAIN MEAT!
  } catch (e: any) {
      return c.html(renderHTML("Add new blog", html`${renderAddFeedForm(url, e.toString())}`, c.get('USERNAME'), 'blogs'))
  }

  // Redirect
  if (rssUrl) {
      const feedId = await getFeedIdByRSSUrl(c, rssUrl)
      const sqid = feedIdToSqid(feedId)
      return c.redirect(`/blogs/${sqid}`, 301)
  }
  return c.text("Something went wrong")

}



export async function feedsUpdateHandler(c:any) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueFeedUpdate(c.env, feed_id);
    return c.text("Feed update enqueued...");
}

export async function feedsScrapeHandler(c:any) {
    const feed_id:number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueScrapeAllItemsOfFeed(c.env, feed_id)
    return c.html('Feed scrape enqueued...')
}

export async function feedsIndexHandler(c:any) {
    const feed_id:number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueIndexAllItemsOfFeed(c.env, feed_id)
    return c.html('Feed index enqueued...')
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FEED FUNCTIONS (NOT ROUTE HANDLERS)

async function addFeed(env: Bindings, url: string, verified: boolean = false) {
    let RSSUrl: string = await getRSSLinkFromUrl(url);
    const r = await extractRSS(RSSUrl);
    
    // if url === rssUrl that means the submitted URL was RSS URL, so retrieve site URL from RSS; otherwise use submitted URL as site URL
    const attemptedSiteUrl = (r.link && r.link.length > 0) ? r.link : getRootUrl(url)
    const siteUrl = (url === RSSUrl) ? attemptedSiteUrl : url
    const verified_as_int = verified ? 1 : 0;

    try {
        const dbQueryResult = await env.DB.prepare("INSERT INTO feeds (title, type, url, rss_url, verified) values (?, ?, ?, ?, ?)").bind(r.title, "blog", siteUrl, RSSUrl, verified_as_int).all()
        if (dbQueryResult['success'] === true) {
            if (r.entries) {
                const feed_id: number = dbQueryResult['meta']['last_row_id'];
                await enqueueFeedUpdate(env, feed_id)
            }
            return RSSUrl
        }
    } catch (e: any) {
        if (e.toString().includes('UNIQUE constraint failed: feeds.rss_url')) {
            return RSSUrl
        } else {
            throw e
        }
    }
}


/**
 * Updates the feed with the specified feedId by fetching the RSS content and adding new items to the database.
 * 
 * @param env - The environment bindings.
 * @param feedId - The ID of the feed to update.
 * @returns A Promise that resolves once the feed is updated.
 */
export async function updateFeed(env: Bindings, feedId: number) {
  // get RSS url of feed
  const { results: feeds } = await env.DB.prepare("SELECT * FROM feeds WHERE feed_id = ?").bind(feedId).all();
  const RSSUrl = String(feeds[0]['rss_url']);
  const feedUrl = String(feeds[0]['url']);

  const r = await extractRSS(RSSUrl); // fetch RSS content

  // get URLs of existing items from DB
  const { results: existingItems } = await env.DB.prepare("SELECT url FROM items WHERE feed_id = ?").bind(feedId).all();
  const existingUrls = existingItems.map(obj => obj.url);

  // if remote RSS entries exist
  if (r.entries) {
      const newItemsToBeAdded = r.entries.filter(entry => !existingUrls.includes(extractItemUrl(entry, feedUrl))); // filter out existing ones and add them to Db
      if (newItemsToBeAdded.length) {
        await addItemsToFeed(env, newItemsToBeAdded, feedId);
        await regenerateTopItemsCacheForFeed(env, feedId);
      }
      console.log(`Updated feed ${feedId} (${RSSUrl}), fetched items: ${r.entries.length}, of which new items added: ${newItemsToBeAdded.length}`)
      return
  }
  console.log(`Updated feed ${feedId} (${RSSUrl}), no items fetched`)
}

async function addItemsToFeed(env: Bindings, items: Array<any>, feedId: number) {
    if (!items.length) return;

    // get feed title
    const { results: feeds } = await env.DB.prepare("SELECT title, url FROM feeds WHERE feed_id = ?").bind(feedId).all();
    const feedUrl = String(feeds[0]['url']);

    const stmt = env.DB.prepare("INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)");
    let binds: any[] = [];
  
    items.forEach((item: any) => {
        let link = extractItemUrl(item, feedUrl);
        // if date was not properly parsed, try to parse it (expects 'pubdate' to be retrieved by feed_extractor's extractRSS function)
        if (!item.published) item.published = new Date(item.pubdate).toISOString();

        let content_html = 
            item['content_from_content'] || 
            item['content_from_content_encoded'] || 
            item['content_from_description'] || 
            item['content_from_content_html'] || '';
        
        content_html = getText(content_html);

        binds.push(stmt.bind(feedId, item.title, link, item.published, stripTags(item.description), content_html));
    });

  const insert_results = await env.DB.batch(binds);
  for (const result of insert_results) {
      if (result.success) {
          console.log(`Added item ${result.meta.last_row_id} to feed ${feedId}`)
          console.log(`Item: ${result.meta.last_row_id} sent to queue for scraping`)
          await enqueueItemScrape(env, result.meta.last_row_id);
      }
  }
}

async function regenerateTopItemsCacheForFeed(env: Bindings, feedId: number) {
  const { results: items } = await env.DB.prepare("SELECT item_id, title FROM items WHERE feed_id = ? ORDER BY items.pub_date DESC LIMIT 5").bind(feedId).all();
  items.forEach((item:any) => {
      item.item_sqid = itemIdToSqid(item.item_id)
      delete item.item_id
  })
  await env.DB.prepare("REPLACE INTO items_top_cache (feed_id, content) values (?, ?)").bind(feedId, JSON.stringify(items)).run();
  console.log(items)
}