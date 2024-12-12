import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderItemShort } from '../../htmltools';
import { absolutifyImageUrls, getRootUrl, itemSqidToId, sanitizeHTML } from '../../utils';

export async function handleItemsSingle(c: Context) {
    const item_sqid = c.req.param('item_sqid');
    const item_id: number = itemSqidToId(item_sqid);
    const user_id = c.get('USER_ID') || -1;
    const user_logged_in = c.get('USER_LOGGED_IN');

    const batch = await c.env.DB.batch([
        // find subscription status of user to this feed
        c.env.DB.prepare(
            `
    SELECT subscriptions.subscription_id
    FROM subscriptions
    JOIN items ON subscriptions.feed_id = items.feed_id
    WHERE subscriptions.user_id = ? AND items.item_id = ?`,
        ).bind(user_id, item_id),

        // find item
        c.env.DB.prepare(
            `
    SELECT
        items.item_id,
        items.feed_id,
        items.title AS item_title,
        items.description,
        items.content_html,
        items.pub_date,
        items.url AS item_url,
        feeds.title AS feed_title,
        feeds.feed_sqid,
        feeds.type,
        favorite_id,
        items_related_cache.content AS related_content,
        user_preferences.prefers_full_blog_post
    FROM items
    JOIN feeds ON items.feed_id = feeds.feed_id
    LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
    LEFT JOIN items_related_cache on items.item_id = items_related_cache.item_id
    LEFT JOIN user_preferences ON user_preferences.user_id = ?
    WHERE items.item_id = ?
    ORDER BY items.pub_date DESC`,
        ).bind(user_id, user_id, item_id),

        // find other items from this feed
        c.env.DB.prepare(
            `
    WITH FeedInfo AS (
        SELECT feed_id
        FROM items
        WHERE item_id = ?
        )
        SELECT
        items.item_sqid,
        items.title AS item_title,
        items.description,
        items.pub_date,
        items.url AS item_url,
        favorite_id
        FROM items
        JOIN FeedInfo fi ON items.feed_id = fi.feed_id
        LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
        WHERE items.item_id != ?
        ORDER BY items.pub_date DESC
        LIMIT 5`,
        ).bind(item_id, user_id, item_id),
    ]);

    if (!batch[1].results.length) return c.notFound();

    const user_is_subscribed = batch[0].results.length;
    const userPrefersFullPost =
        batch[1].results[0].prefers_full_blog_post !== null ? batch[1].results[0].prefers_full_blog_post : true;

    const item = batch[1].results[0];
    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    const post_date = new Date(item.pub_date).toLocaleDateString('en-UK', date_format_opts);

    let contentBlock = '';

    if (!item.description && !item.content_html) {
        contentBlock = `<div class="flash" style="margin-top:1em;">This post cannot be viewed on Minifeed. <a href="${item.item_url}" target="_blank">↗ Open original</a></div>`;
    } else {
        if (user_logged_in && userPrefersFullPost) {
            contentBlock = item.content_html || item.description;
            try {
                contentBlock = await sanitizeHTML(contentBlock);
                contentBlock = await absolutifyImageUrls(contentBlock, getRootUrl(item.item_url));
            } catch {
                contentBlock = item.description;
            }
            contentBlock += `<div class="flash" style="margin-top:1em;">This page shows contents from RSS. <a href="${item.item_url}" target="_blank">↗ Open original to view full content</a></div>`;
        } else {
            // User is not logged in; description has tags stripped, no need to sanitize
            contentBlock = `${item.description} <div class="flash" style="margin-top:1em;">This is a short summary. <strong><a class="no-color" href="${item.item_url}" target="_blank">↗ Open original to view full content</a></strong></div>`;
        }
    }

    let favoriteBlock = '';
    let subscriptionBlock = '';
    let lists_block = '';
    if (user_logged_in) {
        lists_block = `
        <span id="lists">
            <button class="button" hx-get="/items/${item_sqid}/lists"
            class="button"
            hx-target="#lists_section"
            hx-swap="outerHTML">
            ⛬ list
            </button>
        </span>
        `;

        if (item.favorite_id) {
            favoriteBlock = `<span id="favorite">
            <button hx-post="/items/${item_sqid}/unfavorite"
            class="button"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ★ unfavorite
            </button>
            </span>`;
        } else {
            favoriteBlock = `<span id="favorite">
            <button hx-post="/items/${item_sqid}/favorite"
            class="button"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ☆ favorite
            </button>
            </span>`;
        }

        if (user_is_subscribed) {
            subscriptionBlock = `
            <span id="subscription-${item.feed_sqid}">
            <button hx-post="/feeds/${item.feed_sqid}/unsubscribe"
            class="button subscribed"
            hx-trigger="click"
            hx-target="#subscription-${item.feed_sqid}"
            hx-swap="outerHTML">
            <span class="subscribed-text">subscribed</span>
            <span class="unsubscribe-text">unsubscribe</span>
            </button>
            </span>`;
        } else {
            subscriptionBlock = `
            <span id="subscription-${item.feed_sqid}">
            <button hx-post="/feeds/${item.feed_sqid}/subscribe"
            class="button subscribe"
            hx-trigger="click"
            hx-target="#subscription-${item.feed_sqid}"
            hx-swap="outerHTML">
            subscribe
            </button>
            </span>`;
        }
    } else {
        lists_block = `<span id="favorite"> <button class="button" title="Log in to add to list" disabled>⛬ list</button> </span>`;
        favoriteBlock = `<span id="favorite"> <button class="button" title="Log in to favorite" disabled> ☆ favorite </button> </span>`;
        subscriptionBlock = `<span id="subscription"> <button class="button" disabled title="Login to subscribe"> <span>subscribe</span> </button> </span>`;
    }

    let otherItemsBlock = '';
    if (batch[2].results.length) {
        otherItemsBlock += `<div class="related-items fancy-gradient-bg"><h4>More from <a href="/blogs/${item.feed_sqid}"">${item.feed_title}</a></h4><div class="items">`;
        for (const related_item of batch[2].results) {
            const itemTitle = related_item.favorite_id ? `★ ${related_item.item_title}` : related_item.item_title;
            otherItemsBlock += renderItemShort(
                related_item.item_sqid,
                itemTitle,
                related_item.item_url,
                '',
                '',
                related_item.pub_date,
                related_item.description,
            );
        }
        otherItemsBlock += '</div></div>';
    }

    let related_block = '';
    if (item.related_content) {
        const related_content = JSON.parse(item.related_content);
        const related_from_other_blogs = related_content.relatedFromOtherBlogs;

        related_block += `<div class="related-items">`;
        if (related_from_other_blogs?.length) related_block += '<h4>Related</h4><div class="items fancy-gradient-bg">';
        for (const i of related_from_other_blogs) {
            related_block += renderItemShort(i.item_sqid, i.title, i.url, i.feed_title, i.feed_sqid);
        }
        related_block += '</div></div>';
    }

    let list = `
    <h1 style="margin-bottom: 0.25em;">${item.item_title} </h1>

    <div class="item-metadata">
        from ${item.type} <a href="/blogs/${item.feed_sqid}"">${item.feed_title}</a>, <time>${post_date}</time> | <a href="${item.item_url}" target="_blank">↗&nbsp;original</a>
    </div>
    <div class="item-actions">
        <div style="display: flex; gap: 0.25em;">
        ${favoriteBlock}
        ${lists_block}
        <a class="button" href="${item.item_url}" target="_blank">↗ original</a>
        </div>
        <div>
        ${subscriptionBlock}
        </div>
    </div>
    <div id="lists_section" class="lists-section"></div>
    <article style="margin-top:3em;">
    ${contentBlock}
    </article>
    ${related_block}
    ${otherItemsBlock}
    `;

    let debug_info = '';
    if (c.get('USER_IS_ADMIN')) {
        debug_info = `${batch[0].meta.duration}+${batch[1].meta.duration}+${batch[2].meta.duration} ms.;
            ${batch[0].meta.rows_read}+${batch[1].meta.rows_read}+${batch[2].meta.rows_read} rows read`;

        list += `
        <p style="text-align:center;"><a class="no-underline" href="#hidden">🦎</a></p>
        <div class="borderbox admin-control" id="hidden">
        <table>
        <tr>
        <td>Item ID:</td>
        <td>${item.item_id}</td>
        </tr>
        <tr>
        <td>Item sqid:</td>
        <td>${item_sqid}</td>
        </tr>
        <tr>
        <td>Item url:</td>
        <td>${item.item_url}</td>
        </tr>
        <tr>
        <td>Length of description:</td>
        <td>${item.description ? item.description.length : 0}</td>
        </tr>
        <tr>
        <td>Length of content_html:</td>
        <td>${item.content_html ? item.content_html.length : 0}</td>
        </tr>
        </table>

        <p>
        <button hx-post="/admin/items/${item_sqid}/refresh"
            hx-trigger="click"
            hx-target="#refresh-indicator"
            hx-swap="outerHTML">
            update (scrape, index, vectorize, gen.related)
        </button>
        <span id="refresh-indicator"></span>



        <button hx-post="/admin/items/${item_sqid}/delete"
            hx-trigger="click"
            hx-target="#delete-indicator"
            hx-swap="outerHTML">
            ❌ delete
        </button>
        <span id="delete-indicator"></span>
        </p>

        </div>
        `;
    }

    return c.html(
        renderHTML(
            `${item.item_title} | ${item.feed_title} | minifeed`,
            raw(list),
            c.get('USERNAME'),
            'blogs',
            '',
            item.item_url,
            false,
            debug_info,
        ),
    );
}
