import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderGuestFlash, renderHTML } from '../../htmltools';

export async function handleUsers(c: Context) {
    const username = c.get('USERNAME');
    const { results } = await c.env.DB.prepare(
        `SELECT * from users
        LEFT JOIN favorites ON favorites.user_id = users.user_id
        LEFT JOIN item_lists ON item_lists.user_id = users.user_id
        WHERE
            users.email_verified = 1
            AND (item_lists.list_id IS NOT NULL OR favorites.favorite_id IS NOT NULL)
        ORDER BY created ASC `,
    ).run();

    let inner = '';
    if (!c.get('USER_LOGGED_IN')) inner += renderGuestFlash;

    for (const user of results) {
        if (user.username === username)
            inner += `<div><strong><a href="/users/${user.username}">${user.username}</a></strong> (this is me)</div>`;
        else inner += `<div><a href="/users/${user.username}">${user.username}</a></div>`;
    }
    return c.html(renderHTML('Users', raw(inner), c.get('USER_LOGGED_IN'), 'users'));
}
