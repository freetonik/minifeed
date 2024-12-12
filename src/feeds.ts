import type { FeedData } from '@extractus/feed-extractor';
import type { Context } from 'hono';
import { raw } from 'hono/html';
import type { Bindings } from './bindings';
import { extractRSS, validateFeedData } from './feed_extractor';
import { guestFlash, renderAddFeedForm, renderBlogsSubsections, renderHTML, renderItemShort } from './htmltools';
import type { FeedRow, ItemRow, MFFeedEntry } from './interface';
import {
    enqueueFeedUpdate,
    enqueueIndexAllItemsOfFeed,
    enqueueIndexFeed,
    enqueueItemScrape,
    enqueueRebuildFeedTopItemsCache,
    enqueueScrapeAllItemsOfFeed,
} from './queue';
import { deleteFeedFromIndex } from './search';
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
    stripTagsSynchronously,
    truncate,
} from './utils';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ROUTE HANDLERS //////////////////////////////////////////////////////////////////////////////////////////////////////
export const handleBlogs = async (c: Context) => {
    const user_id = c.get('USER_ID') || -1;
    const userLoggedIn = c.get('USER_LOGGED_IN');

    const listingType = c.req.param('listingType') || 'newest';

    let ordering = 'feeds.created DESC';
    let filtering = '';

    if (listingType === 'random') ordering = 'RANDOM()';
    else if (listingType === 'newest') ordering = 'feeds.created DESC';
    else if (listingType === 'oldest') ordering = 'feeds.created ASC';
    else if (listingType === 'alphabetical') ordering = 'feeds.title';
    else if (listingType === 'subscribed') {
        if (!userLoggedIn) return c.redirect('/blogs');
        filtering = 'AND subscriptions.subscription_id IS NOT NULL';
        ordering = 'subscriptions.subscription_id DESC';
    } else return c.notFound();

    const { results, meta } = await c.env.DB.prepare(
        `
    SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, subscriptions.subscription_id, items_top_cache.content from feeds
    LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
    LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?
    WHERE feeds.type = 'blog' ${filtering}
    ORDER BY ${ordering}`,
    )
        .bind(user_id)
        .run();

    let list = '';

    if (!userLoggedIn) list += guestFlash;
    list += renderBlogsSubsections(listingType, userLoggedIn);

    for (const feed of results) {
        const subscriptionAction = feed.subscription_id ? 'unsubscribe' : 'subscribe';
        const subscriptionButtonText = feed.subscription_id ? 'subscribed' : 'subscribe';
        const feedDescriptionBlock = feed.description ? `<p>${feed.description}</p>` : '';

        const subscriptionBlock = userLoggedIn
            ? `<div><span id="subscription-${feed.feed_sqid}">
            <button hx-post="/feeds/${feed.feed_sqid}/${subscriptionAction}"
            class="button ${subscriptionButtonText}"
            hx-trigger="click"
            hx-target="#subscription-${feed.feed_sqid}"
            hx-swap="outerHTML">
            <span class="subscribed-text">${subscriptionButtonText}</span>
            <span class="unsubscribe-text">unsubscribe</span>
            </button>
        </span></div>`
            : `<div><span id="subscription">
            <button class="button"disabled title="Login to subscribe">
            <span>${subscriptionButtonText}</span>
            </button>
        </span></div>`;

        const cache_content = JSON.parse(feed.content);

        let top_items_list = '';
        if (cache_content?.top_items) {
            const top_items = cache_content.top_items;
            let items_count = 0;
            items_count = cache_content.items_count - top_items.length;
            top_items_list += '<ul>';
            for (const item of top_items) {
                top_items_list += `<li><a href="/items/${item.item_sqid}">${item.title}</a></li>`;
            }
            if (items_count > 0) {
                top_items_list += `<li><i>and <a href="/blogs/${feed.feed_sqid}">more...</a></i></li></ul>`;
            }
        }
        list += `
        <div class="blog-summary fancy-gradient-bg">
          <h2>
            <a class="no-color no-underline" href="/blogs/${feed.feed_sqid}">${feed.title}</a>
          </h2>
          <p class="urls">
            <a class="util-mr-05" href="${feed.url}">${feed.url}</a>
            <small>
                <a class="tag-label no-color" href="${feed.rss_url}">RSS↗</a>
            </small>
          </p>
          ${feedDescriptionBlock}
          ${subscriptionBlock}
          ${top_items_list}
        </div>`;
    }
    list += `<div style="margin-top:2em;text-align:center;"><a class="button" href="/suggest">+ suggest a blog</a></div>`;
    return c.html(
        renderHTML(
            'Blogs | minifeed',
            raw(list),
            c.get('USERNAME'),
            'blogs',
            '',
            '',
            false,
            c.get('USER_IS_ADMIN') ? `${meta.duration} ms., ${meta.rows_read} rows read` : '',
        ),
    );
};

export const handleBlogsSingle = async (c: Context) => {
    // TODO: we're assuming that feed always has items; if feed has 0 items, this will return 404, but maybe we want to
    // show the feed still as "processing"; use https://developers.cloudflare.com/d1/platform/client-api/#batch-statements
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

    let list = `
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
    if (!batch[1].results.length) list += '<p>Feed is being updated, come back later...</p>';
    else {
        for (const item of batch[1].results) {
            const itemTitle = item.favorite_id ? `★ ${item.item_title}` : item.item_title;
            list += renderItemShort(
                item.item_sqid,
                itemTitle,
                item.item_url,
                '', // don't show feed title
                '', // don't show feed link
                item.pub_date,
                item.description,
            );
        }
    }

    list += `
    <div class="flash">↑ These items are from RSS. Visit the blog itself at <strong><a href="${feedUrl}">${feedUrl}</a></strong> to find everything else and to appreciate author's digital home.</div>
    `;

    let debug_info = '';
    if (c.get('USER_IS_ADMIN')) {
        debug_info = `${batch[0].meta.duration}+${batch[1].meta.duration} ms;,
            ${batch[0].meta.rows_read}+${batch[1].meta.rows_read} rows read`;
    }
    return c.html(
        renderHTML(`${feedTitle} | minifeed`, raw(list), c.get('USERNAME'), 'blogs', '', '', false, debug_info),
    );
};

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

export const handleFeedsDelete = async (c: Context) => {
    const feedId: number = feedSqidToId(c.req.param('feed_sqid'));

    const ids_of_feed_items = await c.env.DB.prepare('SELECT item_id FROM items WHERE feed_id = ?').bind(feedId).all();

    if (ids_of_feed_items.results.length > 0) {
        const item_ids_to_delete_from_vectorize = ids_of_feed_items.results.map((item: ItemRow) =>
            item.item_id.toString(),
        );
        // split array into chunks of 100
        const chunks = [];
        for (let i = 0; i < item_ids_to_delete_from_vectorize.length; i += 100) {
            chunks.push(item_ids_to_delete_from_vectorize.slice(i, i + 100));
        }
        for (const chunk of chunks) {
            try {
                await c.env.VECTORIZE.deleteByIds(chunk);
            } catch (e) {
                console.log({
                    message: `Error deleting items from vectorize: ${e}`,
                    itemId: chunk,
                    feedId: feedId,
                });
            }
        }
    }

    await c.env.DB.prepare('DELETE from feeds where feed_id = ?').bind(feedId).run();
    await deleteFeedFromIndex(c.env, feedId);

    return c.html(`Feed ${feedId} deleted`);
};

export const handleBlogsNew = async (c: Context) => {
    if (!c.get('USER_ID')) return c.redirect('/login');
    return c.html(renderHTML('Add new blog', renderAddFeedForm(), c.get('USERNAME'), 'blogs'));
};

export const handleBlogsNewPOST = async (c: Context) => {
    const body = await c.req.parseBody();
    const url = body.url.toString();
    let rssUrl: string | undefined;
    try {
        const verified = !!c.get('USER_IS_ADMIN');
        rssUrl = await addFeed(c.env, url, verified); // MAIN MEAT!
    } catch (e: unknown) {
        const errorMessage = (e as Error).toString();
        return c.html(renderHTML('Add new blog', renderAddFeedForm(url, errorMessage), c.get('USERNAME'), 'blogs'));
    }

    // Redirect
    if (rssUrl) {
        const feedId = await getFeedIdByRSSUrl(c, rssUrl);
        const sqid = feedIdToSqid(feedId);
        return c.redirect(`/blogs/${sqid}`, 301);
    }
    return c.text('Something went wrong');
};

export async function handleFeedsUpdate(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueFeedUpdate(c.env, feed_id);
    return c.text('Feed update enqueued...');
}

export async function handleFeedsScrape(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueScrapeAllItemsOfFeed(c.env, feed_id);
    return c.html('Feed scrape enqueued...');
}

export async function handleFeedsItemsIndexing(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueIndexAllItemsOfFeed(c.env, feed_id);
    return c.html('Feed index enqueued...');
}

export async function handleFeedsIndexing(c: Context) {
    const feedId: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueIndexFeed(c.env, feedId);
    return c.html('Feed index enqueued...');
}

export async function handleFeedsItemsGlobalIndex(c: Context) {
    const feeds = await c.env.DB.prepare('SELECT feed_id FROM feeds').all();
    for (const feed of feeds.results) {
        await enqueueIndexAllItemsOfFeed(c.env, feed.feed_id);
    }
    return c.html('Feed index enqueued FOR ALL FEEDS...');
}

export async function handleFeedsGlobalIndex(c: Context) {
    const feeds = await c.env.DB.prepare('SELECT feed_id FROM feeds').all<FeedRow>();
    for (const feed of feeds.results) {
        await enqueueIndexFeed(c.env, feed.feed_id);
    }
    return c.html('Feed indexing enqueued FOR ALL FEEDS...');
}

export async function handleFeedsCacheRebuild(c: Context) {
    const feed_id: number = feedSqidToId(c.req.param('feed_sqid'));
    await enqueueRebuildFeedTopItemsCache(c.env, feed_id);
    return c.html('Feed cache rebuild enqueued...');
}

export async function handleFeedsGlobalCacheRebuild(c: Context) {
    const feeds = await c.env.DB.prepare('SELECT feed_id FROM feeds').all();
    for (const feed of feeds.results) {
        await enqueueRebuildFeedTopItemsCache(c.env, feed.feed_id);
    }
    return c.html('Feed cache rebuild enqueued FOR ALL FEEDS...');
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FEED FUNCTIONS (NOT ROUTE HANDLERS)

async function addFeed(env: Bindings, url: string, verified = false) {
    let r: FeedData;
    let RSSUrl: string = url;
    // first, try to use RSS extractor right away
    try {
        r = await extractRSS(url);
    } catch (err) {
        // if RSS extractor failed, try to get RSS link from URL and then try to use RSS extractor again
        RSSUrl = await getRSSLinkFromUrl(url);
        r = await extractRSS(RSSUrl);
    }

    const feedValidationResult = validateFeedData(r);
    if (!feedValidationResult.validated) {
        throw new Error(`Feed data verification failed: ${feedValidationResult.messages.join('; ')}`);
    }

    // if url === rssUrl that means the submitted URL was RSS URL, so retrieve site URL from RSS; otherwise use submitted URL as site URL
    const attemptedSiteUrl = r.link && r.link.length > 0 ? r.link : getRootUrl(url);
    const siteUrl = url === RSSUrl ? attemptedSiteUrl : url;
    const verified_as_int = verified ? 1 : 0;
    let feedTitle = r.title;
    if (!feedTitle || feedTitle.length === 0) {
        const siteUrlHost = new URL(siteUrl).host;
        feedTitle = `${siteUrlHost}`;
    }

    try {
        const dbQueryResult = await env.DB.prepare(
            'INSERT INTO feeds (title, type, url, rss_url, verified) values (?, ?, ?, ?, ?)',
        )
            .bind(feedTitle, 'blog', siteUrl, RSSUrl, verified_as_int)
            .all();
        if (dbQueryResult.success === true) {
            if (r.entries) {
                const feed_id: number = dbQueryResult.meta.last_row_id;

                // update feed_sqid
                const feed_sqid = feedIdToSqid(feed_id);
                await env.DB.prepare('UPDATE feeds SET feed_sqid = ? WHERE feed_id = ?').bind(feed_sqid, feed_id).run();

                await enqueueFeedUpdate(env, feed_id);
            }
            return RSSUrl;
        }
    } catch (e: any) {
        if (e.toString().includes('UNIQUE constraint failed')) {
            return RSSUrl;
        }
    }
}

export async function updateFeed(env: Bindings, feedId: number) {
    // get RSS url of feed
    const feed = await env.DB.prepare('SELECT rss_url, description FROM feeds WHERE feed_id = ?').bind(feedId).first();
    if (!feed) return;

    const feedRSSUrl = String(feed.rss_url);
    const currentDescription = String(feed.description);
    console.log({
        message: 'Updating feed',
        feedId,
        feedRSSUrl,
    });

    const r: FeedData = await extractRSS(feedRSSUrl); // fetch RSS content

    if (r.description && r.description.length > 7) {
        const desc = await stripTags(r.description);
        if (!desc.includes('<img') && desc !== currentDescription) {
            await env.DB.prepare('UPDATE feeds SET description = ? WHERE feed_id = ?').bind(desc, feedId).run();
            console.log({
                message: 'Updated feed description',
                feedId,
                feedRSSUrl,
            });
        }
        // this may be the first time we are setting the description, so we need to update the index
        await enqueueIndexFeed(env, feedId);
    }

    // get URLs of existing items from DB
    const existingItems = await env.DB.prepare('SELECT url FROM items WHERE feed_id = ?').bind(feedId).all();
    const existingUrls = existingItems.results.map((obj) => obj.url);

    // if remote RSS entries exist
    if (r.entries) {
        const newItemsToBeAdded = r.entries.filter(
            (entry) => !existingUrls.includes(extractItemUrl(entry as MFFeedEntry, feedRSSUrl)),
        );
        console.log({
            message: `Updating feed, fetched ${r.entries.length} items, of which new items added: ${newItemsToBeAdded.length}`,
            feedId,
            feedRSSUrl,
        });

        // OLD CODE
        // if (newItemsToBeAdded.length) {
        //     await addItemsToFeed(env, newItemsToBeAdded, feedId);
        //     await regenerateTopItemsCacheForFeed(env, feedId);
        // }

        for (const item of newItemsToBeAdded) {
            await env.ADD_UPDATE_ITEM_WORKFLOW.create({
                params: { item, feedId },
            });
        }
        return;
    }

    console.log({
        message: 'Updating feed, no items fetched',
        feedId,
        feedRSSUrl,
    });
}

// TODO: deprecate
export async function addItemsToFeed(
    env: Bindings,
    items: Array<MFFeedEntry>,
    feedId: number,
    scrapeAfterAdding = true,
) {
    if (!items.length) return;

    const { results: feeds } = await env.DB.prepare('SELECT title, rss_url FROM feeds WHERE feed_id = ?')
        .bind(feedId)
        .all();
    const feedRSSUrl = String(feeds[0].rss_url);

    const stmt = env.DB.prepare(
        'INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)',
    );
    const binds: D1PreparedStatement[] = [];

    for (const item of items) {
        let link: string;
        try {
            link = extractItemUrl(item, feedRSSUrl);
        } catch (e) {
            console.log({
                message: `Error extracting item URL ${e}`,
                feedId,
                feedRSSUrl,
            });
            continue;
        }

        if (item.published) {
            // if item.published is in future, set it to current date
            if (new Date(item.published) > new Date()) item.published = new Date().toISOString();
        } else {
            // if date was not properly parsed, try to parse it (expects 'pubdate' to be retrieved by feed_extractor's extractRSS function)
            if (item.pubdate) {
                const dateFromPubdate = new Date(item.pubdate);
                // if date is in future, set it to current date
                if (dateFromPubdate > new Date()) {
                    item.published = new Date().toISOString();
                }
                // if date is older than unix epoch start date, set it to current date
                else if (dateFromPubdate < new Date('1970-01-01')) {
                    item.published = new Date().toISOString();
                } else {
                    item.published = dateFromPubdate.toISOString();
                }
            } else {
                item.published = new Date().toISOString(); // if date is still not available, use current date
            }
        }

        let content_html =
            item.content_from_content ||
            item.content_from_content_encoded ||
            item.content_from_description ||
            item.content_from_content_html ||
            '';

        content_html = getText(content_html);

        let itemTitle = item.title?.length ? item.title : item.published.slice(0, 10);
        itemTitle = await stripTags(itemTitle);

        binds.push(
            stmt.bind(
                feedId,
                itemTitle,
                link,
                item.published,
                truncate(stripTagsSynchronously(item.description), 350),
                content_html,
            ),
        );
    }

    const results_of_insert = await env.DB.batch(binds);
    for (const result of results_of_insert) {
        if (result.success) {
            const item_id = result.meta.last_row_id;
            const item_sqid = itemIdToSqid(item_id);

            console.log({
                message: 'Item added to feed',
                itemId: item_id,
                feedId: feedId,
            });

            await env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?').bind(item_sqid, item_id).run();
            console.log(`Item: ${item_id} set sqid ${item_sqid}`);

            if (scrapeAfterAdding) {
                console.log(`Item: ${item_id} queued for scraping`);
                await enqueueItemScrape(env, item_id);
            }
        }
    }

    return results_of_insert;
}

export async function regenerateTopItemsCacheForFeed(env: Bindings, feedId: number) {
    const { results: top_items } = await env.DB.prepare(
        'SELECT item_id, title FROM items WHERE feed_id = ? ORDER BY items.pub_date DESC LIMIT 5',
    )
        .bind(feedId)
        .all();

    top_items.forEach((item: any) => {
        item.item_sqid = itemIdToSqid(item.item_id);
        delete item.item_id;
    });

    const items_count = await env.DB.prepare('SELECT COUNT(item_id) FROM Items where feed_id = ?').bind(feedId).all();

    const cache_content = {
        top_items: top_items,
        items_count: items_count.results[0]['COUNT(item_id)'],
    };

    await env.DB.prepare('REPLACE INTO items_top_cache (feed_id, content) values (?, ?)')
        .bind(feedId, JSON.stringify(cache_content))
        .run();
}
