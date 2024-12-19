import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML, renderItemShort } from '../../htmltools';
import { feedIdToSqid } from '../../utils';

export async function handleUsersSingle(c: Context) {
    const userId = c.get('USER_ID') || '0';
    const currentUsername = c.get('USERNAME');
    const userLoggedIn = c.get('USER_LOGGED_IN');
    const username = c.req.param('username');

    const batch = await c.env.DB.batch([
        // who this user is and if he is followed by current user batch[0]
        c.env.DB.prepare(
            `
        SELECT users.user_id, users.username
        FROM users
        WHERE users.username = ?`,
        ).bind(username),

        // subscriptions batch[1]
        c.env.DB.prepare(
            `
        SELECT *
        FROM feeds
        JOIN subscriptions on feeds.feed_id = subscriptions.feed_id
        JOIN users on subscriptions.user_id = users.user_id
        WHERE users.username = ?`,
        ).bind(username),

        // who this user follows (FOLLOWEDS) batch[2]
        c.env.DB.prepare(
            `
        SELECT b.username as followed
        FROM users a
        JOIN followings on a.user_id = followings.follower_user_id
        JOIN users b on b.user_id = followings.followed_user_id
        WHERE a.username = ?`,
        ).bind(username),

        // who this follows this user (FOLLOWERS) batch[3]
        c.env.DB.prepare(
            `
        SELECT b.username as follower FROM users a
        JOIN followings on a.user_id = followings.followed_user_id
        JOIN users b on b.user_id = followings.follower_user_id
        WHERE a.username = ?`,
        ).bind(username),

        // favorites batch[4]
        c.env.DB.prepare(
            `
        SELECT items.item_sqid, items.feed_id, items.url, items.title, items.pub_date, feeds.title as feed_title, feeds.feed_sqid
        FROM items
        JOIN favorites on items.item_id = favorites.item_id
        JOIN feeds on items.feed_id = feeds.feed_id
        JOIN users on favorites.user_id = users.user_id
        WHERE users.username = ?`,
        ).bind(username),

        // lists batch[5]
        c.env.DB.prepare(
            `
        SELECT list_id, title, list_sqid
        FROM item_lists
        JOIN users on item_lists.user_id = users.user_id
        WHERE users.username = ?`,
        ).bind(username),
    ]);

    if (!batch[0].results.length) return c.notFound();

    let inner = '';

    // user favorited these jabronis
    inner += '<h2>Favorites:</h2>';
    if (!batch[4].results.length) inner += '<p><i>None yet</i></p>';
    for (const item of batch[4].results) {
        inner += renderItemShort(item.item_sqid, item.title, item.url, item.feed_title, item.feed_sqid, item.pub_date);
    }

    // user created these lists
    inner += '<h2>Lists:</h2>';
    if (!batch[5].results.length) inner += '<p><i>None yet</i></p>';
    for (const list of batch[5].results) {
        inner += `<li><a href="/lists/${list.list_sqid}">${list.title}</a></li>`;
    }

    // user subscribed to these jabronis
    inner += '<h2>Subscriptions:</h2>';
    if (!batch[1].results.length) inner += '<p><i>None yet</i></p>';
    for (const feed of batch[1].results) {
        const sqid = feedIdToSqid(feed.feed_id);
        inner += `<li><a href="/blogs/${sqid}">${feed.title}</a></li>`;
    }

    // user follows these jabronis
    inner += '<h2>Follows:</h2>';
    if (!batch[2].results.length) inner += '<p><i>None yet</i></p>';
    for (const user of batch[2].results) {
        inner += `<li><a href="${user.followed}">${user.followed}</a></li>`;
    }

    inner += '<h2>Followers:</h2>';
    let followButtonText = 'follow';
    if (!batch[3].results.length) inner += '<p><i>None yet</i></p>';
    for (const user of batch[3].results) {
        followButtonText = user.follower === currentUsername ? 'unfollow' : 'follow';
        inner += `<li><a href="${user.follower}">${user.follower}</a></li>`;
    }

    let top_block = `<h1>@${username}</h1>`;

    if (userLoggedIn) {
        if (userId !== batch[0].results[0].user_id) {
            top_block += `
            <span id="follow">
            <button class="button" hx-post="/users/${username}/${followButtonText}"
            hx-trigger="click"
            hx-target="#follow"
            hx-swap="outerHTML">
            ${followButtonText}
            </button>
            </span>`;
        } else {
            top_block += `<div class="flash flash-blue">This is your public profile (<a href="/account">account settings</a>)</div>`;
        }
    } else {
        top_block += `<div class="flash"><a href="/login">Log in</a> to follow users and read their feeds on your home page.</div>`;
    }

    inner = top_block + inner;

    return c.html(renderHTML(`${username} | minifeed`, raw(inner), c.get('USER_LOGGED_IN'), 'users'));
}
