import type { Context } from 'hono';
import { raw } from 'hono/html';
import { cacheResponse, getCachedResponse } from '../../cache';
import { renderBlogsSubsections, renderGuestFlash, renderHTML } from '../../htmltools';

export async function handleBlogs(c: Context) {
    const userId = c.get('USER_ID') || -1;
    const userLoggedIn = c.get('USER_LOGGED_IN');

    const listingType = c.req.param('listingType') || 'newest';
    const cacheKeyPattern = `https://minifeed-cache/blogs/by/${listingType}`;

    let ordering = 'feeds.created DESC';
    let filtering = 'WHERE verified = 1';

    // Caching for guests
    if (!userLoggedIn && listingType !== 'random') {
        const cachedResponse = await getCachedResponse(cacheKeyPattern);
        if (cachedResponse) return cachedResponse;
    }

    if (listingType === 'random') ordering = 'RANDOM()';
    else if (listingType === 'newest') ordering = 'feeds.created DESC';
    else if (listingType === 'oldest') ordering = 'feeds.created ASC';
    else if (listingType === 'alphabetical') ordering = 'feeds.title';
    else if (listingType === 'subscribed') {
        if (!userLoggedIn) return c.redirect('/blogs');
        filtering = 'WHERE subscriptions.subscription_id IS NOT NULL';
        ordering = 'subscriptions.subscription_id DESC';
    } else return c.notFound();

    const { results, meta } = await c.env.DB.prepare(`
        SELECT feeds.feed_id, feeds.feed_sqid, feeds.title, feeds.url, feeds.rss_url, feeds.description, subscriptions.subscription_id, items_top_cache.content, verified
        FROM feeds
        LEFT JOIN items_top_cache on feeds.feed_id = items_top_cache.feed_id
        LEFT JOIN subscriptions on feeds.feed_id = subscriptions.feed_id AND subscriptions.user_id = ?
        ${filtering} AND items_top_cache.content IS NOT NULL
        ORDER BY ${ordering}`)
        .bind(userId)
        .run();

    let inner = '';
    if (!userLoggedIn) inner += renderGuestFlash();
    inner += renderBlogsSubsections(listingType, userLoggedIn);

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

        const relatedCache = JSON.parse(feed.content);

        let topItems = '';
        if (relatedCache?.top_items) {
            topItems += '<ul>';
            for (const item of relatedCache.top_items)
                topItems += `<li><a href="/items/${item.item_sqid}">${item.title}</a></li>`;

            if (relatedCache.items_count > relatedCache.top_items.length)
                topItems += `<li><i>and <a href="/blogs/${feed.feed_sqid}">more...</a></i></li></ul>`;
        }

        inner += `
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
          ${topItems}
        </div>`;
    } // iterate over feeds

    let opmlLink = '';
    if (listingType === 'subscribed' && c.get('USER_HAS_SUBSCRIPTION'))
        opmlLink = ` <a class="button util-ml-1" href="/blogs/by/subscribed/opml.xml">OPML export</a>`;
    else if (listingType === 'newest' || listingType === 'oldest' || listingType === 'alphabetical')
        opmlLink = ` <a class="button util-ml-1" href="/blogs/opml.xml">OPML export</a>`;

    inner += `<div style="margin-top:2em;text-align:center;"><a class="button" href="/suggest">+ suggest a blog</a>${opmlLink}</div>`;

    const html = renderHTML(c, 'Blogs | minifeed', raw(inner), `${meta.duration} ms., ${meta.rows_read} rows read`);

    if (!userLoggedIn && listingType !== 'random') await cacheResponse(cacheKeyPattern, html);

    const response = c.html(html);
    return response;
}
