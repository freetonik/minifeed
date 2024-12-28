import type { Context } from 'hono';

export async function handleLinkblogDELETE(c: Context) {
    const body = await c.req.parseBody();
    const userId = c.get('USER_ID');
    const username = c.get('USERNAME');
    const targetUsername = c.req.param('username');
    const targetLinkId = c.req.param('link_id');

    if (targetUsername !== username) {
        throw new Error('You are not authorized to post to this linkblog');
    }

    // delete link
    await c.env.DB.prepare('DELETE FROM linkblog_user_items WHERE linkblog_user_item_id = ?').bind(targetLinkId).run();

    return c.html('<strong>Link deleted</strong>');
}
