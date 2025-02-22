import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderLinkShort } from '../../htmltools';
import { SubscriptionTier } from '../../interface';

export async function handleLinkblog(c: Context) {
    const userId = c.get('USER_ID') || '0';
    const currentUsername = c.get('USERNAME');
    const userLoggedIn = c.get('USER_LOGGED_IN');
    const username = c.req.param('username');

    const queryUrl = c.req.query('url') || '';
    const queryTitle = c.req.query('title') || '';

    const itemsPerPage = 1000;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    const batch = await c.env.DB.batch([
        // target user batch[0]
        c.env.DB.prepare(`
        SELECT users.user_id, users.username, tier
        FROM users
        LEFT JOIN user_subscriptions on users.user_id = user_subscriptions.user_id
        WHERE users.username = ?`).bind(username),

        // follower stuff [1]
        c.env.DB.prepare(`
        SELECT follower_user_id, followed_user_id
        FROM followings
        WHERE follower_user_id = ? and followed_user_id = (SELECT user_id FROM users WHERE username = ?)
        `).bind(userId, username),

        // link blog items batch[2]
        c.env.DB.prepare(
            `
            SELECT
            linkblog_user_items.linkblog_user_item_id, linkblog_items.url, linkblog_items.title as linkblog_title, linkblog_user_items.title as linkblog_title_custom,
            linkblog_user_items.created, description

            FROM linkblog_user_items
            JOIN linkblog_items on linkblog_items.linkblog_item_id = linkblog_user_items.linkblog_item_id
            JOIN users on linkblog_user_items.user_id = users.user_id

            WHERE users.username = ?

            ORDER BY linkblog_user_items.created DESC
            LIMIT ? OFFSET ?
            `,
        ).bind(username, itemsPerPage + 1, offset),
    ]);

    // user not found
    if (!batch[0].results.length) return c.notFound();

    const hasSubscription = batch[0].results[0].tier === SubscriptionTier.PRO;

    let inner = '';

    const rootUrl = c.env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net';
    let bookmarklet = '';
    if (username === currentUsername && hasSubscription) {
        bookmarklet = `
<span class="muted">
  Drag to bookmarks:
  <a
    href="javascript:(function(){ const currentUrl = encodeURIComponent(window.location.href); const currentTitle = encodeURIComponent(document.title); const formUrl = '${rootUrl}/linkblogs/${username}?url=' + currentUrl + '&title=' + currentTitle; window.location.href = formUrl; })();"

    onclick="event.preventDefault(); alert('Drag this link to your bookmarks bar instead of clicking it!');"
  >
    ➕ link blog
  </a>
</span>`;
    }

    if (batch[2].results.length === 0) inner += '<p>No links yet.</p>';

    for (let i = 0; i < batch[2].results.length - 1; i++) {
        const item = batch[2].results[i];
        const title = item.linkblog_title_custom ? item.linkblog_title_custom : item.linkblog_title;
        inner += renderLinkShort(
            title,
            item.url,
            item.description,
            item.created,
            item.linkblog_user_item_id,
            username === currentUsername ? username : undefined,
        );
    }

    if (batch[2].results.length > itemsPerPage) inner += `<a href="?p=${page + 1}">More...</a></p>`;

    let followButtonText = 'follow';
    if (batch[1].results.length) {
        followButtonText = 'unfollow';
    }

    let top_block = `<h1>@${username}'s linkblog</h1>`;

    if (userLoggedIn) {
        if (userId !== batch[0].results[0].user_id) {
            top_block += `
            <div id="follow" class="util-mb-2">
            <button class="button" hx-post="/users/${username}/${followButtonText}"
            hx-trigger="click"
            hx-target="#follow"
            hx-swap="outerHTML">
            ${followButtonText}
            </button>
            </div>`;
        } else {
            if (!hasSubscription) {
                top_block += `<div class="flash">
            Linkblogs are a Pro feature. <a href="/account">Upgrade</a> to start your own linkblog.
            </div>`;
            }

            top_block += `
            <div class="borderbox fancy-gradient-bg util-mb-2">
            <form action="/linkblogs/${username}" method="POST">
            <input type="url" name="url" placeholder="url" value="${queryUrl}" required ${hasSubscription ? '' : 'disabled'} />
            <input class="util-mt-1" type="text" name="title" placeholder="title (optional)" value="${queryTitle}" ${hasSubscription ? '' : 'disabled'} />
            <textarea rows=5 class="contentful util-mt-1" type="text" name="description" placeholder="description (optional)" ${hasSubscription ? '' : 'disabled'}></textarea>

            <div style="display: flex ; flex-direction: row; align-items: baseline; justify-content: space-between;">
                <input class="button util-mt-1" type="submit" value="Add link" ${hasSubscription ? '' : 'disabled'} />
                ${bookmarklet}
            </div>
            </form>

            </div>
            `;
        }
    }

    inner = top_block + inner;

    return c.html(renderHTML(`${username} | minifeed`, raw(inner), c.get('USER_LOGGED_IN'), 'links'));
}
