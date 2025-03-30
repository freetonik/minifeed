import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderReaderView } from '../../htmltools';
import { absolutifyImageUrls, getRootUrl, itemSqidToId, sanitizeHTML } from '../../utils';

export async function handleItemReaderView(c: Context) {
    const itemSqid = c.req.param('item_sqid');
    const itemId: number = itemSqidToId(itemSqid);
    const hasSubscription = c.get('USER_HAS_SUBSCRIPTION');

    if (!hasSubscription) {
        return c.html(
            renderHTML(
                c,
                'Subscription required | minifeed',
                raw(
                    `<div class="flash">This feature requires a subscription. Go to <a href="/account">your account</a> to subscribe. </div>`,
                ),
            ),
        );
    }

    const item = await c.env.DB.prepare(`
    SELECT
        items.item_id,
        items.feed_id,
        items.title AS item_title,
        items.description,
        items.content_html,
        items.content_html_scraped,
        items.pub_date,
        items.url AS item_url,
        feeds.title AS feed_title,
        feeds.feed_sqid
    FROM items
    JOIN feeds ON items.feed_id = feeds.feed_id
    WHERE items.item_id = ?
    ORDER BY items.pub_date DESC`)
        .bind(itemId)
        .first();

    if (!item) return c.notFound();

    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    const post_date = new Date(item.pub_date).toLocaleDateString('en-UK', date_format_opts);

    let contentBlock = '';
    contentBlock = item.content_html_scraped || item.content_html;
    contentBlock = await sanitizeHTML(contentBlock);
    contentBlock = await absolutifyImageUrls(contentBlock, getRootUrl(item.item_url));

    const inner = `
    <article>
        <h1>${item.item_title}</h1>
        <p>
        ← <a href="/items/${itemSqid}">back</a> |
        from <a href="${item.feed_sqid}">${item.feed_title}</a> | ${post_date} | <a href="${item.item_url}">original ↗</a>
        </p>
        <hr style="margin:2em 0;">
        ${contentBlock}
    </article>
    `;

    return c.html(renderReaderView(`${item.item_title} | ${item.feed_title} | minifeed`, raw(inner)));
}
