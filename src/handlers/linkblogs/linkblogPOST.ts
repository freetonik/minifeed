import type { Context } from 'hono';
import { parseHTML } from 'linkedom';
import { stripTags } from '../../utils';

export async function handleLinkblogPOST(c: Context) {
    const body = await c.req.parseBody();
    const url = body.url.toString();
    let userTitle = body.title.toString().trim() || null;
    const userId = c.get('USER_ID');
    const username = c.get('USERNAME');
    const targetUsername = c.req.param('username');

    if (targetUsername !== username) {
        throw new Error('You are not authorized to post to this linkblog');
    }

    // check if url is valid
    if (!url.match(/^https?:\/\//)) {
        throw new Error('Invalid URL');
    }

    if (userTitle) {
        userTitle = await stripTags(userTitle);
    }
    if (userTitle && userTitle.length > 250) {
        throw new Error('Title too long');
    }

    // check if url exists in DB table linkblog_items
    const existingUrl = await c.env.DB.prepare('SELECT * FROM linkblog_items WHERE url = ?').bind(url).first();

    if (existingUrl) {
        // check if it exists in user's linkblog
        const existingUrlForUser = await c.env.DB.prepare(
            'SELECT * FROM linkblog_user_items WHERE linkblog_user_item_id = ? AND user_id = ?',
        )
            .bind(existingUrl.linkblog_item_id, userId)
            .first();
        if (existingUrlForUser) {
            return c.redirect(`/l/${username}`);
        }

        // add to user's linkblog
        await c.env.DB.prepare('INSERT INTO linkblog_user_items (linkblog_item_id, user_id, title) VALUES (?, ?, ?)')
            .bind(existingUrl.linkblog_item_id, userId, userTitle)
            .run();
        return c.redirect(`/l/${username}`);
    }

    let fetchedTitle: string;
    try {
        fetchedTitle = await getTitle(url);
    } catch (e) {
        fetchedTitle = url;
    }
    // add to linkblog_items
    const newUrl = await c.env.DB.prepare('INSERT INTO linkblog_items (url, title) VALUES (?, ?) RETURNING *')
        .bind(url, fetchedTitle)
        .first();

    const newLinkblogItemId = newUrl.linkblog_item_id;
    // add to user's linkblog
    await c.env.DB.prepare('INSERT INTO linkblog_user_items (linkblog_item_id, user_id, title) VALUES (?, ?, ?)')
        .bind(newLinkblogItemId, userId, userTitle)
        .run();

    return c.redirect(`/l/${username}`);
}

async function getTitle(url: string) {
    const response = await fetch(url);
    const html = await response.text();
    const { document } = parseHTML(html);
    return document.querySelectorAll('head title')[0].textContent.trim() || '';
}
