import { renderAddFeedForm, renderHTML, renderItemShort } from "./htmltools";
import { html, raw } from "hono/html";
import {
  extractItemUrl,
  feedIdToSqid,
  feedSqidToId,
  getFeedIdByRSSUrl,
  getRSSLinkFromUrl,
  getRootUrl,
  getText,
  itemIdToSqid,
  stripTags,
  truncate,
} from "./utils";
import { deleteFeedFromIndex } from "./search";
import { extractRSS, validateFeedData } from "./feed_extractor";
import { Bindings } from "./bindings";
import {
  enqueueIndexAllItemsOfFeed,
  enqueueFeedUpdate,
  enqueueItemScrape,
  enqueueScrapeAllItemsOfFeed,
  enqueueRebuildFeedTopItemsCache,
} from "./queue";
import { FeedData } from "@extractus/feed-extractor";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ROUTE HANDLERS //////////////////////////////////////////////////////////////////////////////////////////////////////
export const blogsHandler = async (c: any) => {
  const user_id = c.get("USER_ID") || -1;
  const userLoggedIn = user_id != -1;
  const { results } = await c.env.DB.prepare(
    `
    SELECT feeds.feed_id, feeds.title, subscriptions.subscription_id, items_top_cache.content from feeds
    LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
    LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?`,
  )
    .bind(user_id)
    .run();

  let list = `<div class="main">`;
  list += `<div style="text-align:center;"><a class="button" href="/suggest">+ suggest a blog</a></div></div>`;

  if (user_id == -1) {
    list += `<div style="margin-bottom: 2em" class="flash flash-blue">
    <strong>Minifeed</strong> is a curated blog reader and blog search engine.
    Our goal is to collect all blogs written by real humans, and make them discoverable and searchable.
    After signing up, you can subscribe to blogs, follow people, and save your favorite posts.
    </div>`;
  }

  results.forEach((feed: any) => {
    const sqid = feedIdToSqid(feed.feed_id);

    const subscriptionAction = feed.subscription_id
      ? "unsubscribe"
      : "subscribe";
    const subscriptionButtonText = feed.subscription_id
      ? "subscribed"
      : "subscribe";

    const subscriptionBlock = userLoggedIn
      ? `<div><span id="subscription-${sqid}">
            <button hx-post="/feeds/${sqid}/${subscriptionAction}"
            class="${subscriptionButtonText}"
            hx-trigger="click"
            hx-target="#subscription-${sqid}"
            hx-swap="outerHTML">
            <span class="subscribed-text">${subscriptionButtonText}</span>
            <span class="unsubscribe-text">unsubscribe</span>
            </button>
        </span></div>`
      : `<div><span id="subscription">
            <button disabled title="Login to subscribe">
            <span>${subscriptionButtonText}</span>
            </button>
        </span></div>`;

    const cache_content = JSON.parse(feed.content);
    const top_items = cache_content["top_items"]
    const items_count = cache_content["items_count"] - top_items.length;
    let top_items_list = "";

    if (top_items) {
      top_items_list += "<ul>";
      top_items.forEach((item: any) => {
        top_items_list += `<li><a href="/items/${item.item_sqid}">${item.title}</a></li>`;
      });
      if (items_count > 0) {
        top_items_list += `<li><i>and <a href="/blogs/${sqid}">${items_count} more...</a></i></li></ul>`;
      }
    }
    list += `
        <div class="blog-summary">
            <div class="summary-header">
                <div><h2><a class="no-color" href="/blogs/${sqid}">${feed.title}</a> </h2></div>
                ${subscriptionBlock}

            </div>
            ${top_items_list}
        </div>`;
  });
  // list += `<div style="margin-top:2em;text-align:center;"><a class="button" href="/blogs/new">+ add new blog</a></div></div>`;
  list += `<div style="margin-top:2em;text-align:center;"><a class="button" href="/suggest">+ suggest a blog</a></div></div>`;
  return c.html(
    renderHTML(
      "Blogs | minifeed",
      html`${raw(list)}`,
      c.get("USERNAME"),
      "blogs",
    ),
  );
};

export const blogsSingleHandler = async (c: any) => {
  // TODO: we're assuming that feed always has items; if feed has 0 items, this will return 404, but maybe we want to
  // show the feed still as "processing"; use https://developers.cloudflare.com/d1/platform/client-api/#batch-statements
  const feedSqid = c.req.param("feed_sqid");
  const feedId = feedSqidToId(feedSqid);
  const userId = c.get("USER_ID") || -1;
  const userLoggedIn = c.get("USER_ID") ? true : false;

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
  ]);

  // batch[0] is feed joined with subscription status; 0 means no feed found in DB
  if (!batch[0].results.length) return c.notFound();
  const feedTitle = batch[0].results[0]["title"];

  const feedUrl = batch[0].results[0]["url"];
  const rssUrl = batch[0].results[0]["rss_url"];
  const subscriptionAction = batch[0].results[0]["subscription_id"]
    ? "unsubscribe"
    : "subscribe";
  const subscriptionButtonText = batch[0].results[0]["subscription_id"]
    ? "subscribed"
    : "subscribe";
  const subscriptionBlock = userLoggedIn
    ? `
      <span id="subscription">
        <button hx-post="/feeds/${feedSqid}/${subscriptionAction}"
          class="${subscriptionButtonText}"
          hx-trigger="click"
          hx-target="#subscription"
          hx-swap="outerHTML">
          <span class="subscribed-text">${subscriptionButtonText}</span>
        <span class="unsubscribe-text">unsubscribe</span>
        </button>
      </span>`
    : `
      <span id="subscription">
        <button disabled title="Login to subscribe">
            <span>${subscriptionButtonText}</span>
        </button>
      </span>
      `;
  const feedDescriptionBlock = batch[0].results[0]["description"]
    ? `<p>${batch[0].results[0]["description"]}</p>`
    : "";

  let list = `
    <h1>
      ${feedTitle}
      <small>(<a href="${feedUrl}">site</a> / <a href="${rssUrl}">rss</a>)</small>
    </h1><p>${feedDescriptionBlock}</p>
    ${subscriptionBlock}
    <hr style="margin:2em 0;">
    `;

  // batch[1] is items
  if (!batch[1].results.length)
    list += `<p>Feed is being updated, come back later...</p>`;
  else {
    list += `<div>`;
    batch[1].results.forEach((item: any) => {
      const itemTitle = item.favorite_id
        ? `★ ${item.item_title}`
        : item.item_title;
      list += renderItemShort(
        item.item_sqid,
        itemTitle,
        item.item_url,
        "", // don't show title
        "", // don't show feed link
        item.pub_date,
        item.description,
      );
    });
    list += `</div>`;
  }

  return c.html(
    renderHTML(
      `${feedTitle} | minifeed`,
      html`${raw(list)}`,
      c.get("USERNAME"),
      "blogs",
    ),
  );
};

export const feedsSubscribeHandler = async (c: any) => {
  if (!c.get("USER_ID")) return c.redirect("/login");
  const userId = c.get("USER_ID");
  const feedSqid = c.req.param("feed_sqid");
  const feedId = feedSqidToId(feedSqid);
  let result;

  try {
    result = await c.env.DB.prepare(
      "INSERT INTO subscriptions (user_id, feed_id) values (?, ?)",
    )
      .bind(userId, feedId)
      .run();
  } catch (err) {
    c.status(400);
    return c.body("bad request");
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
};

export const feedsUnsubscribeHandler = async (c: any) => {
  if (!c.get("USER_ID")) return c.redirect("/login");
  const userId = c.get("USER_ID");
  const feedSqid = c.req.param("feed_sqid");
  const feedId = feedSqidToId(feedSqid);

  try {
    await c.env.DB.prepare(
      "DELETE FROM subscriptions WHERE user_id = ? AND feed_id = ?",
    )
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
          class="subscribe"
          hx-trigger="click"
          hx-target="#subscription-${feedSqid}"
          hx-swap="outerHTML">
          subscribe
        </button>
      </span>
    `);
};

export const feedsDeleteHandler = async (c: any) => {
  const feedId: number = feedSqidToId(c.req.param("feed_sqid"));

  await c.env.DB.prepare(`DELETE from feeds where feed_id = ?`)
    .bind(feedId)
    .run();

  await deleteFeedFromIndex(c.env, feedId);

  return c.html(`Feed ${feedId} deleted`);
};

export const blogsNewHandler = async (c: any) => {
  if (!c.get("USER_ID")) return c.redirect("/login");
  return c.html(
    renderHTML(
      "Add new blog",
      html`${renderAddFeedForm()}`,
      c.get("USERNAME"),
      "blogs",
    ),
  );
};

export const blogsNewPostHandler = async (c: any) => {
  const body = await c.req.parseBody();
  const url = body["url"].toString();
  let rssUrl;
  try {
    const verified = c.get("USER_ID") === 1 ? true : false;
    rssUrl = await addFeed(c.env, url, verified); // MAIN MEAT!
  } catch (e: any) {
    return c.html(
      renderHTML(
        "Add new blog",
        html`${renderAddFeedForm(url, e.toString())}`,
        c.get("USERNAME"),
        "blogs",
      ),
    );
  }

  // Redirect
  if (rssUrl) {
    const feedId = await getFeedIdByRSSUrl(c, rssUrl);
    const sqid = feedIdToSqid(feedId);
    return c.redirect(`/blogs/${sqid}`, 301);
  }
  return c.text("Something went wrong");
};

export async function feedsUpdateHandler(c: any) {
  const feed_id: number = feedSqidToId(c.req.param("feed_sqid"));
  await enqueueFeedUpdate(c.env, feed_id);
  return c.text("Feed update enqueued...");
}

export async function feedsScrapeHandler(c: any) {
  const feed_id: number = feedSqidToId(c.req.param("feed_sqid"));
  await enqueueScrapeAllItemsOfFeed(c.env, feed_id);
  return c.html("Feed scrape enqueued...");
}

export async function feedsIndexHandler(c: any) {
  const feed_id: number = feedSqidToId(c.req.param("feed_sqid"));
  await enqueueIndexAllItemsOfFeed(c.env, feed_id);
  return c.html("Feed index enqueued...");
}

export async function feedsGlobalIndexHandler(c: any) {
  const feeds = await c.env.DB.prepare("SELECT feed_id FROM feeds").all();
  for (const feed of feeds.results) {
    await enqueueIndexAllItemsOfFeed(c.env, feed.feed_id);
  }
  return c.html("Feed index enqueued FOR ALL FEEDS...");
}

export async function feedsCacheRebuildHandler(c: any) {
  const feed_id: number = feedSqidToId(c.req.param("feed_sqid"));
  await enqueueRebuildFeedTopItemsCache(c.env, feed_id);
  return c.html("Feed cache rebuild enqueued...");
}

export async function feedsGlobalCacheRebuildHandler(c: any) {
  const feeds = await c.env.DB.prepare("SELECT feed_id FROM feeds").all();
  for (const feed of feeds.results) {
    await enqueueRebuildFeedTopItemsCache(c.env, feed.feed_id);
  }
  return c.html("Feed cache rebuild enqueued FOR ALL FEEDS...");
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FEED FUNCTIONS (NOT ROUTE HANDLERS)

async function addFeed(env: Bindings, url: string, verified: boolean = false) {
  const RSSUrl: string = await getRSSLinkFromUrl(url);
  const r: FeedData = await extractRSS(RSSUrl);

  const feedValidationResult = validateFeedData(r);
  if (!feedValidationResult.validated) {
    throw new Error(
      "Feed data verification failed: " +
      feedValidationResult.messages.join("; "),
    );
  }

  // if url === rssUrl that means the submitted URL was RSS URL, so retrieve site URL from RSS; otherwise use submitted URL as site URL
  const attemptedSiteUrl =
    r.link && r.link.length > 0 ? r.link : getRootUrl(url);
  const siteUrl = url === RSSUrl ? attemptedSiteUrl : url;
  const verified_as_int = verified ? 1 : 0;

  try {
    const dbQueryResult = await env.DB.prepare(
      "INSERT INTO feeds (title, type, url, rss_url, verified) values (?, ?, ?, ?, ?)",
    )
      .bind(r.title, "blog", siteUrl, RSSUrl, verified_as_int)
      .all();
    if (dbQueryResult["success"] === true) {
      if (r.entries) {
        const feed_id: number = dbQueryResult["meta"]["last_row_id"];

        // update feed_sqid
        const feed_sqid = feedIdToSqid(feed_id);
        await env.DB.prepare("UPDATE feeds SET feed_sqid = ? WHERE feed_id = ?")
          .bind(feed_sqid, feed_id)
          .run();

        await enqueueFeedUpdate(env, feed_id);
      }
      return RSSUrl;
    }
  } catch (e: any) {
    if (e.toString().includes("UNIQUE constraint failed")) {
      return RSSUrl;
    } else {
      throw e;
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
  const { results: feeds } = await env.DB.prepare(
    "SELECT rss_url, description FROM feeds WHERE feed_id = ?",
  )
    .bind(feedId)
    .all();
  const RSSUrl = String(feeds[0]["rss_url"]);
  const description = String(feeds[0]["description"]);
  console.log(`Updating feed ${feedId} (${RSSUrl})`);

  const r: FeedData = await extractRSS(RSSUrl); // fetch RSS content

  if (
    r.description &&
    r.description.length > 7 &&
    description != r.description
  ) {
    await env.DB.prepare("UPDATE feeds SET description = ? WHERE feed_id = ?")
      .bind(r.description, feedId)
      .run();
  }

  // get URLs of existing items from DB
  const { results: existingItems } = await env.DB.prepare(
    "SELECT url FROM items WHERE feed_id = ?",
  )
    .bind(feedId)
    .all();
  const existingUrls = existingItems.map((obj) => obj.url);

  // if remote RSS entries exist
  if (r.entries) {
    const newItemsToBeAdded = r.entries.filter(
      (entry) => !existingUrls.includes(extractItemUrl(entry, RSSUrl)),
    ); // filter out existing ones and add them to Db
    if (newItemsToBeAdded.length) {
      await addItemsToFeed(env, newItemsToBeAdded, feedId);
      await regenerateTopItemsCacheForFeed(env, feedId);
    }
    console.log(
      `Updated feed ${feedId} (${RSSUrl}), fetched items: ${r.entries.length}, of which new items added: ${newItemsToBeAdded.length}`,
    );
    return;
  }
  console.log(`Updated feed ${feedId} (${RSSUrl}), no items fetched`);
}

export async function addItemsToFeed(
  env: Bindings,
  items: Array<any>,
  feedId: number,
  scrapeAfterAdding: boolean = true,
) {
  if (!items.length) return;

  // get feed title
  const { results: feeds } = await env.DB.prepare(
    "SELECT title, rss_url FROM feeds WHERE feed_id = ?",
  )
    .bind(feedId)
    .all();
  const feedRSSUrl = String(feeds[0]["rss_url"]);

  const stmt = env.DB.prepare(
    "INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)",
  );
  let binds: any[] = [];

  items.forEach((item: any) => {
    let link = extractItemUrl(item, feedRSSUrl);
    if (!item.published) {
      // if date was not properly parsed, try to parse it (expects 'pubdate' to be retrieved by feed_extractor's extractRSS function)
      if (item.pubdate) {
        item.published = new Date(item.pubdate).toISOString();
      } else {
        // if date is still not available, use current date
        item.published = new Date().toISOString();
      }
    }

    let content_html =
      item["content_from_content"] ||
      item["content_from_content_encoded"] ||
      item["content_from_description"] ||
      item["content_from_content_html"] ||
      "";

    content_html = getText(content_html);

    binds.push(
      stmt.bind(
        feedId,
        item.title,
        link,
        item.published,
        truncate(stripTags(item.description), 350),
        content_html,
      ),
    );
  });

  const insert_results = await env.DB.batch(binds);
  for (const result of insert_results) {
    if (result.success) {
      const item_id = result.meta.last_row_id;
      console.log(`Item: ${item_id} added to feed ${feedId}`);

      const item_sqid = itemIdToSqid(item_id);
      await env.DB.prepare("UPDATE items SET item_sqid = ? WHERE item_id = ?")
        .bind(item_sqid, item_id)
        .run();
      console.log(`Item: ${item_id} set sqid ${item_sqid}`);

      if (scrapeAfterAdding) {
        console.log(`Item: ${item_id} sent to queue for scraping`);
        await enqueueItemScrape(env, item_id);
      }
    }
  }

  return insert_results;
}

export async function regenerateTopItemsCacheForFeed(
  env: Bindings,
  feedId: number,
) {
  const { results: top_items } = await env.DB.prepare(
    "SELECT item_id, title FROM items WHERE feed_id = ? ORDER BY items.pub_date DESC LIMIT 5",
  )
    .bind(feedId)
    .all();
  top_items.forEach((item: any) => {
    item.item_sqid = itemIdToSqid(item.item_id);
    delete item.item_id;
  });

  const items_count = await env.DB.prepare(
    "SELECT COUNT(item_id) FROM Items where feed_id = ?",
  )
    .bind(feedId)
    .all();

  const cache_content = {
    top_items: top_items,
    items_count: items_count.results[0]["COUNT(item_id)"],
  }


  await env.DB.prepare(
    "REPLACE INTO items_top_cache (feed_id, content) values (?, ?)",
  )
    .bind(feedId, JSON.stringify(cache_content))
    .run();
}
