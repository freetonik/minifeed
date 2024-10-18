import type { Context } from 'hono';
import { raw } from 'hono/html';
import { marked } from 'marked';
import { renderHTML, renderHTMLMblog, render_mblog_editor } from './htmltools';
import { itemIdToSqid, sanitizeHTML, truncate } from './utils';

export const handleMblog = async (c: Context) => {
    const subdomain = c.get('SUBDOMAIN');

    const userId = c.get('USER_ID') || -1;
    const userLoggedIn = !!c.get('USER_LOGGED_IN');

    const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
        SELECT feeds.title, mblogs.user_id, mblogs.slug
        FROM feeds
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblogs.slug = ?`).bind(subdomain),

        c.env.DB.prepare(`
        SELECT items.item_id, items.title, items.content_html_scraped, mblog_items.slug, items.created, items.pub_date, mblog_items.status
        FROM items
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        WHERE mblogs.slug = ?
        ORDER BY items.created DESC`).bind(subdomain),
    ]);

    if (!batch[0].results.length) return c.notFound();
    const mblog = batch[0].results[0];
    const items = batch[1].results;

    let list = `<h1>${mblog.title}</h1>`;
    if (userLoggedIn && userId === mblog.user_id) {
        list += `
        <form style="margin-bottom: 3em;" method="POST">
        <div style="margin-bottom:1em;">
            <input type="text" id="post-title" name="post-title" hidden>
        </div>
        <div style="margin-bottom:1em;">
            <textarea style="resize: vertical;" id="txt" name="post-content" placeholder="Quick draft..." rows=10></textarea>
            
        </div>
        <div>
            <input type="submit" name="action" value="Quick save">
            <input type="submit" name="action" value="Continue editing in full">
        </div>

    </form>
        `;
    }

    const formatDate = (date: Date) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')}, ${date.getFullYear()}`;
    };

    list += `<ul style="list-style-type: none; padding-left: 0;">`;
    for (const item of items) {
        if (item.status !== 'public' && (!userLoggedIn || userId !== mblog.user_id)) continue;
        const postDate = formatDate(new Date(item.pub_date));
        let status_block = '';
        if (userLoggedIn && userId === mblog.user_id) {
            status_block = `(${item.status})`;
        }
        list += `
            <li>
                <span class="muted" style="font-family: monospace; letter-spacing: -0.07em; margin-right: 0.5em;">${postDate}</span>
                <a href="/${item.slug}">${item.title}</a> ${status_block}
            </li>
            `;
    }
    list += '</ul>';

    return c.html(renderHTML(`${mblog.title}`, raw(list), userLoggedIn, '', '', '', true));
};

export const handleMblogPOST = async (c: Context) => {
    const subdomain = c.get('SUBDOMAIN');
    const userId = c.get('USER_ID') || -1;

    if (!c.get('USER_LOGGED_IN')) return c.text('Unauthorized', 401);

    // get mblog_id, user_id, feed_id for the given subdomain
    const mblog_DB_entry = await c.env.DB.prepare(
        'SELECT mblogs.mblog_id, mblogs.user_id, mblogs.feed_id FROM mblogs WHERE mblogs.slug = ?',
    )
        .bind(subdomain)
        .first();
    if (!mblog_DB_entry) return c.notFound();
    const mblog = mblog_DB_entry;
    if (userId !== mblog.user_id) return c.text('Unauthorized', 401);

    // ok, user is logged in and is the owner of the mblog
    const body = await c.req.parseBody();
    let title = body['post-title'].toString();
    const post_content = body['post-content'].toString();
    if (!post_content) return c.text('Post content is required');

    if (!title.length) title = truncate(post_content, 45);
    let content_html_scraped = await marked.parse(post_content);
    content_html_scraped = await sanitizeHTML(content_html_scraped);

    try {
        let item_slug = generate_slug(title);

        // check if the slug already exists in mblog_items for this mblog
        const slug_check = await c.env.DB.prepare('SELECT * FROM mblog_items WHERE mblog_id = ? AND slug = ?')
            .bind(mblog.mblog_id, item_slug)
            .run();
        if (slug_check.results.length) {
            for (let i = 2; i <= 11; i++) {
                const new_slug = generate_slug(`${title} ${i}`);
                const new_slug_check = await c.env.DB.prepare(
                    'SELECT * FROM mblog_items WHERE mblog_id = ? AND slug = ?',
                )
                    .bind(mblog.mblog_id, new_slug)
                    .run();
                if (!new_slug_check.results.length) {
                    item_slug = new_slug;
                    break;
                }
            }
            if (item_slug === generate_slug(title)) {
                throw new Error('Unable to generate a unique slug after 10 attempts');
            }
        }

        const item_url = `https://${subdomain}.minifeed.io/${item_slug}`;

        const pub_date = new Date().toISOString();

        const status = body.action.toString().toLowerCase() === 'publish' ? 'public' : 'draft';
        const insertion_results = await c.env.DB.prepare(
            'INSERT INTO items (feed_id, title, description, content_html, content_html_scraped, url, pub_date) values (?, ?, ?, ?, ?, ?, ?)',
        )
            .bind(mblog.feed_id, title, title, post_content, content_html_scraped, item_url, pub_date)
            .run();

        const new_item_id = insertion_results.meta.last_row_id;
        const new_item_sqid = itemIdToSqid(new_item_id);
        await c.env.DB.prepare('UPDATE items SET item_sqid = ? WHERE item_id = ?')
            .bind(new_item_sqid, new_item_id)
            .run();

        await c.env.DB.prepare('INSERT INTO mblog_items (mblog_id, item_id, slug, status) values (?, ?, ?, ?)')
            .bind(mblog.mblog_id, new_item_id, item_slug, status)
            .run();

        if (body.action.toString().toLowerCase() === 'quick save') return c.redirect('/');
        if (body.action.toString().toLowerCase() === 'continue editing in full')
            return c.redirect(`/${item_slug}/edit`);
        return c.redirect(`/${item_slug}`);
    } catch (err) {
        return c.text('Error!');
    }
};

const generate_slug = (title: string) => {
    if (title === 'rss') return 'rss-2';
    return title
        .substring(0, 32)
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .toLowerCase();
};

export const handleMblogItemSingle = async (c: Context) => {
    const subdomain = c.get('SUBDOMAIN');
    const userId = c.get('USER_ID') || -1;
    const userLoggedIn = !!c.get('USER_LOGGED_IN');
    const post_slug = c.req.param('post_slug');

    const mblog_post_entry = await c.env.DB.prepare(
        `
            SELECT items.title, items.content_html_scraped, mblogs.user_id, items.pub_date, mblog_items.status, feeds.title as feed_title
            FROM items
            JOIN mblog_items ON mblog_items.item_id = items.item_id
            JOIN feeds ON feeds.feed_id = items.feed_id
            JOIN mblogs ON mblogs.feed_id = feeds.feed_id
            WHERE mblogs.slug = ? AND mblog_items.slug = ?
        `,
    )
        .bind(subdomain, post_slug)
        .run();

    const post = mblog_post_entry.results[0];
    if (!post) return c.notFound();
    if ((!userLoggedIn || userId !== post.user_id) && post.status !== 'public') return c.notFound();

    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    const post_date = new Date(post.pub_date).toLocaleDateString('en-UK', date_format_opts);

    let list = `
        <a href="/"><h3>${post.feed_title}</h3></a>
        <h1>${post.title}</h1>
        <div>${post.content_html_scraped}</div>
        <time>${post_date}</time>
        `;

    if (userLoggedIn && userId === post.user_id) {
        list += `
            | <strong>${post.status}</strong>
            <div style="display: flex; gap: 10px;margin-top:1em;">
                <form action="${post_slug}/delete" method="POST">
                    <input type="submit" value="Delete" onclick="return confirm('Are you sure?')">
                </form>
                <form action="${post_slug}/edit" method="GET">
                    <input type="submit" value="Edit">
                </form>
            </div>`;
    }

    return c.html(renderHTML(`${post.title} | minifeed`, raw(list), c.get('USER_LOGGED_IN'), '', '', '', true));
};

export const handleMblogDeletePOST = async (c: Context) => {
    const userId = c.get('USER_ID') || -1;
    const post_slug = c.req.param('post_slug');

    const mblog_post_entry = await c.env.DB.prepare(`
        SELECT items.item_id, items.feed_id, mblogs.user_id
        FROM items
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblog_items.slug = ?
    `)
        .bind(post_slug)
        .run();

    const post = mblog_post_entry.results[0];

    if (!c.get('USER_LOGGED_IN') || userId !== post.user_id) return c.text('Unauthorized', 401);

    await c.env.DB.prepare('DELETE FROM items WHERE item_id = ?').bind(post.item_id).run();

    return c.redirect('/');
};

export const handleMblogEditItem = async (c: Context) => {
    const userId = c.get('USER_ID') || -1;
    const post_slug = c.req.param('post_slug');

    const post = await c.env.DB.prepare(`
        SELECT items.item_id, items.title, items.content_html, items.content_html_scraped, mblogs.user_id, feeds.title as feed_title
        FROM items
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblog_items.slug = ?`)
        .bind(post_slug)
        .first();

    if (!c.get('USER_LOGGED_IN') || userId !== post.user_id) return c.text('Unauthorized', 401);

    const list = render_mblog_editor(post.title, post.content_html);

    return c.html(renderHTMLMblog(`${post.title} | ${post.feed_title}`, raw(list), c.get('USER_LOGGED_IN')));
};

export const handleBlogItemEditPOST = async (c: Context) => {
    const userId = c.get('USER_ID') || -1;
    const post_slug = c.req.param('post_slug');

    const mblog_post_entry = await c.env.DB.prepare(
        `
            SELECT items.item_id, items.feed_id, mblogs.user_id
            FROM items
            JOIN mblog_items ON mblog_items.item_id = items.item_id
            JOIN feeds ON feeds.feed_id = items.feed_id
            JOIN mblogs ON mblogs.feed_id = feeds.feed_id
            WHERE mblog_items.slug = ?
        `,
    )
        .bind(post_slug)
        .run();

    const post = mblog_post_entry.results[0];

    if (!c.get('USER_LOGGED_IN') || userId !== post.user_id) return c.redirect('/');
    if (userId !== post.user_id) return c.redirect('/');

    const body = await c.req.parseBody();
    console.log('body', body);
    const post_title = body['post-title'].toString();
    if (!post_title) return c.text('Post title is required');
    const post_content = body['post-content'].toString();
    if (!post_content) return c.text('Post content is required');

    let content_html_scraped = await marked.parse(post_content);
    content_html_scraped = await sanitizeHTML(content_html_scraped);

    const status = body.action.toString().toLowerCase() === 'publish' ? 'public' : 'draft';
    await c.env.DB.batch([
        c.env.DB.prepare(
            'UPDATE items SET title = ?, content_html = ?, content_html_scraped = ? WHERE item_id = ?',
        ).bind(post_title, post_content, content_html_scraped, post.item_id),
        c.env.DB.prepare('UPDATE mblog_items SET status = ? WHERE item_id = ?').bind(status, post.item_id),
    ]);

    return c.redirect(`/${post_slug}`);
};

export const handleMblogRss = async (c: Context) => {
    return c.html('RSS SOON');
};
