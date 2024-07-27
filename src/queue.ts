import { Bindings } from "./bindings";

///////////////////////////////
// FEED UPDATES ///////////////
export async function enqueueFeedUpdate(env: Bindings, feed_id: number) {
  await env.FEED_UPDATE_QUEUE.send({
    type: "feed_update",
    feed_id: feed_id,
  });
}

export async function enqueueUpdateAllFeeds(env: Bindings) {
  // usually triggered by CRON
  type FeedsRowPartial = {
    feed_id: number;
    rss_url: string;
  };
  const { results: feeds } = await env.DB.prepare(
    "SELECT feed_id, rss_url FROM feeds",
  ).all<FeedsRowPartial>();
  for (const feed of feeds) {
    await enqueueFeedUpdate(env, feed["feed_id"]);
  }
}

///////////////////////////////
// SCRAPES ////////////////////
export async function enqueueScrapeAllItemsOfFeed(
  env: Bindings,
  feed_id: number,
) {
  type ItemsRowPartial = {
    item_id: number;
    url: string;
  };
  const { results: items } = await env.DB.prepare(
    "SELECT item_id, url FROM items WHERE feed_id = ?",
  )
    .bind(feed_id)
    .all<ItemsRowPartial>();
  for (const item of items) {
    await enqueueItemScrape(env, item["item_id"]);
  }
}

export async function enqueueItemScrape(env: Bindings, item_id: number) {
  await env.FEED_UPDATE_QUEUE.send({
    type: "item_scrape",
    item_id: item_id,
  });
}

///////////////////////////////
// INDEXING ///////////////////
export async function enqueueItemIndex(env: Bindings, item_id: number) {
  await env.FEED_UPDATE_QUEUE.send({
    type: "item_index",
    item_id: item_id,
  });
}

export async function enqueueIndexAllItemsOfFeed(
  env: Bindings,
  feed_id: number,
) {
  await env.FEED_UPDATE_QUEUE.send({
    type: "feed_index",
    feed_id: feed_id,
  });
}
