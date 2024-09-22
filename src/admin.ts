import { html, raw } from "hono/html";
import { renderHTML } from "./htmltools";
import { getCollection } from "./search";

export const adminHandler = async (c: any) => {
  // TODO: we're assuming that feed always has items; if feed has 0 items, this will return 404, but maybe we want to
  // show the feed still as "processing"; use https://developers.cloudflare.com/d1/platform/client-api/#batch-statements
  let list = "";
  const feeds = await c.env.DB.prepare(
    "SELECT * FROM feeds LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id ORDER BY feed_id ASC ",
  ).all();

  const feed_count = await c.env.DB.prepare(
    "SELECT COUNT(feed_id) FROM feeds",
  ).all();

  list += `<h3>${feed_count.results[0]["COUNT(feed_id)"]} Feeds</h3>`;

  const all_items_count = await c.env.DB.prepare(
    "SELECT COUNT(item_id) FROM Items",
  ).all();

  list += `<h3>${all_items_count.results[0]["COUNT(item_id)"]} Items</h3>`;

  const items_collection = await getCollection(c.env);
  list += `<h3>${items_collection["num_documents"]} Indexed items</h3>`;


  for (const feed of feeds.results) {
    list += `<div style="border:1px solid grey; margin-bottom:1em; padding: 1em;">
    <strong>${feed.title}</strong> <br>
    ${JSON.parse(feed.content)["items_count"]} posts |
    ID: ${feed.feed_id}, SQID: <a href="/blogs/${feed.feed_sqid}">${feed.feed_sqid}</a>
    ${feed["verified"] ? "✅" : "❌"}`;

    // const items_count = await c.env.DB.prepare(
    //   "SELECT COUNT(item_id) FROM Items where feed_id = ?",
    // )
    //   .bind(feed.feed_id)
    //   .all();
    // list += `${items_count.results[0]["COUNT(item_id)"]} items`;

    list += `<p>
    <button hx-post="/feeds/${feed.feed_sqid}/delete"
      hx-confirm="Sure?"
      hx-trigger="click"
      hx-target="#delete-indicator-${feed.feed_sqid}"
      hx-swap="outerHTML">
      delete
    </button>

    <button hx-post="/feeds/${feed.feed_sqid}/update"
      hx-confirm="Sure?"
      hx-trigger="click"
      hx-target="#update-indicator-${feed.feed_sqid}"
      hx-swap="outerHTML">
      update
    </button>

    <button hx-post="/feeds/${feed.feed_sqid}/scrape"
      hx-confirm="Sure?"
      hx-trigger="click"
      hx-target="#scrape-indicator-${feed.feed_sqid}"
      hx-swap="outerHTML">
      scrape
    </button>

    <button hx-post="/feeds/${feed.feed_sqid}/index"
      hx-confirm="Sure?"
      hx-trigger="click"
      hx-target="#index-indicator-${feed.feed_sqid}"
      hx-swap="outerHTML">
      re-index
    </button>

    <button hx-post="/feeds/${feed.feed_sqid}/rebuild_cache"
      hx-confirm="Sure?"
      hx-trigger="click"
      hx-target="#rebuild-cache-indicator-${feed.feed_sqid}"
      hx-swap="outerHTML">
      rebuild cache
    </button>

    <div>
    <span id="index-indicator-${feed.feed_sqid}"></span>
    <span id="update-indicator-${feed.feed_sqid}"></span>
    <span id="scrape-indicator-${feed.feed_sqid}"></span>
    <span id="delete-indicator-${feed.feed_sqid}"></span>
    <span id="rebuild-cache-indicator-${feed.feed_sqid}"></span>
    </div>
    </p>`;

    list += "</div>";
  }



  list += `<hr>
  <button hx-post="/feeds/index"
    hx-confirm="Sure?"
    hx-trigger="click"
    hx-target="#index-indicator-global"
    hx-swap="outerHTML">
    re-index all feeds
  </button>
  <button hx-post="/feeds/rebuild_cache"
    hx-confirm="Sure?"
    hx-trigger="click"
    hx-target="#rebuild-cache-indicator-global"
    hx-swap="outerHTML">
    rebuild caches all feeds
  </button>

  <div>
  <span id="index-indicator-global"></span>
  <span id="rebuild-cache-indicator-global"></span>
  </div>
  `;

  return c.html(
    renderHTML(`admin | minifeed`, html`${raw(list)}`, c.get("USERNAME"), ""),
  );
};
