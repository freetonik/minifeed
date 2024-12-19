import type { Context } from 'hono';

export async function handleUsersFollowPOST(c: Context) {
    const userId = c.get('USER_ID');
    if (!userId) return c.html('');
    const username = c.req.param('username');

    const targetUser = await c.env.DB.prepare('SELECT users.user_id FROM users WHERE users.username = ?')
        .bind(username)
        .first();
    const userIdToFollow = targetUser.user_id;

    try {
        const result = await c.env.DB.prepare(
            'INSERT INTO followings (follower_user_id, followed_user_id) values (?, ?)',
        )
            .bind(userId, userIdToFollow)
            .run();
        if (result.success) {
            c.status(201);
            return c.html(`
                <span id="follow">
                    <button class="button" hx-post="/users/${username}/unfollow"
                        hx-trigger="click"
                        hx-target="#follow"
                        hx-swap="outerHTML">
                        unfollow
                    </button>
                </span>
                `);
        }
    } catch (err) {
        c.status(400);
        return c.body('bad request');
    }

    return c.html(`
    <span id="subscription">
    "Error"
    </span>
    `);
}

export async function handleUsersUnfollowPOST(c: Context) {
    const userId = c.get('USER_ID');
    if (!userId) return c.html('');
    const username = c.req.param('username');

    const targetUser = await c.env.DB.prepare('SELECT users.user_id FROM users WHERE users.username = ?')
        .bind(username)
        .first();
    const userIdToUnfollow = targetUser.user_id;

    try {
        await c.env.DB.prepare('DELETE FROM followings WHERE follower_user_id = ? AND followed_user_id = ?')
            .bind(userId, userIdToUnfollow)
            .run();
    } catch (err) {
        c.status(400);
        return c.html(` <span id="follow"> "Error" </span> `);
    }
    c.status(201);
    return c.html(`
        <span id="follow">
            <button class="button" hx-post="/users/${username}/follow"
                hx-trigger="click"
                hx-target="#follow"
                hx-swap="outerHTML">
                follow
            </button>
        </span>
    `);
}
