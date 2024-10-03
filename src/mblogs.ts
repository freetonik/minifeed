import { html, raw } from "hono/html";
import { renderHTML } from "./htmltools";
import { itemIdToSqid, sanitizeHTML } from "./utils";
import { marked } from 'marked';


export const handle_mblog = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");

    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;

    const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
        SELECT feeds.title, mblogs.user_id, mblogs.slug
        FROM feeds
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblogs.slug = ?`,
        ).bind(subdomain),

        c.env.DB.prepare(`
        SELECT items.item_id, items.title, items.content_html_scraped, mblog_items.slug, items.created, items.pub_date
        FROM items
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        WHERE mblogs.slug = ?
        ORDER BY items.created DESC`

        ).bind(subdomain),
    ]);

    if (!batch[0].results.length) return c.notFound();
    const mblog = batch[0].results[0];
    const items = batch[1].results;

    let list = `<h1>${mblog.title}</h1>`
    if (userLoggedIn && userId == mblog.user_id) {
        list += `
            <form style="margin-bottom: 3em;" method="POST">
                <div style="margin-bottom:1em;">
                    <input type="text" id="post-title" name="post-title" placeholder="New post title...">
                </div>
                <div style="margin-bottom:1em;">
                    <textarea id="contentful" name="post-content" placeholder="Here we go..." rows=12></textarea>
                </div>
                <input type="submit" value="Publish">
            </form>
            `
    }


    const formatDate = (date: Date) => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')}, ${date.getFullYear()}`;
    };

    list += `<ul style="list-style-type: none; padding-left: 0;">`
    for (const item of items) {
        const postDate = formatDate(new Date(item.pub_date));
        list += `
            <li>
                <span class="muted" style="font-family: monospace; letter-spacing: -0.07em; margin-right: 0.5em;">${postDate}</span>
                <a href="/${item.slug}">
                    ${item.title}
                </a>
            </li>
            `
    }
    list += `</ul>`


    return c.html(
        renderHTML(
            `${mblog.title}`,
            html`${raw(list)} `,
            userLoggedIn,
            "",
            "",
            "",
            true
        ),
    );
}

export const handle_mblog_POST = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;

    if (!userLoggedIn) return c.text("Unauthorized", 401);

    // get mblog_id, user_id, feed_id for the given subdomain
    const mblog_DB_entry = await c.env.DB.prepare(
        "SELECT mblogs.mblog_id, mblogs.user_id, mblogs.feed_id FROM mblogs WHERE mblogs.slug = ?",
    ).bind(subdomain).first();
    if (!mblog_DB_entry) return c.notFound();
    const mblog = mblog_DB_entry;
    if (userId != mblog.user_id) return c.text("Unauthorized", 401);

    // ok, user is logged in and is the owner of the mblog
    const body = await c.req.parseBody();
    const title = body["post-title"].toString();
    if (!title) return c.text("Post title is required");
    const post_content = body["post-content"].toString();
    if (!post_content) return c.text("Post content is required");

    let content_html_scraped = await marked.parse(post_content);
    content_html_scraped = await sanitizeHTML(content_html_scraped);

    try {
        let item_slug = generate_slug(title);

        // check if the slug already exists in mblog_items for this mblog
        const slug_check = await c.env.DB.prepare("SELECT * FROM mblog_items WHERE mblog_id = ? AND slug = ?").bind(mblog.mblog_id, item_slug).run();
        if (slug_check.results.length) {
            for (let i = 2; i <= 11; i++) {
                const new_slug = generate_slug(title + " " + i);
                const new_slug_check = await c.env.DB.prepare("SELECT * FROM mblog_items WHERE mblog_id = ? AND slug = ?").bind(mblog.mblog_id, new_slug).run();
                if (!new_slug_check.results.length) {
                    item_slug = new_slug;
                    break;
                }
            }
            if (item_slug === generate_slug(title)) {
                throw new Error("Unable to generate a unique slug after 10 attempts");
            }
        }

        const pub_date = new Date().toISOString();
        const insertion_results = await c.env.DB.prepare(
            "INSERT INTO items (feed_id, title, description, content_html, content_html_scraped, url, pub_date) values (?, ?, ?, ?, ?, ?, ?)",
        ).bind(mblog.feed_id, title, title, post_content, content_html_scraped, item_slug, pub_date).run();

        const new_item_id = insertion_results.meta.last_row_id;
        const new_item_sqid = itemIdToSqid(new_item_id);
        await c.env.DB.prepare("UPDATE items SET item_sqid = ? WHERE item_id = ?")
            .bind(new_item_sqid, new_item_id).run();

        await c.env.DB.prepare("INSERT INTO mblog_items (mblog_id, item_id, slug) values (?, ?, ?)")
            .bind(mblog.mblog_id, new_item_id, item_slug).run();

        return c.redirect(`/${item_slug}`);

    } catch (err) {
        return c.text(err);
    }
}

const generate_slug = (title: string) => {
    if (title.length > 32) {
        title = title.substring(0, 32);
    }
    if (title == 'rss') return 'rss-2';
    return title.replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .toLowerCase();
}

export const handle_mblog_post_single = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const post_slug = c.req.param("post_slug");

    const mblog_post_entry = await c.env.DB.prepare(
        `
            SELECT items.title, items.content_html_scraped, mblogs.user_id, items.pub_date
            FROM items
            JOIN mblog_items ON mblog_items.item_id = items.item_id
            JOIN feeds ON feeds.feed_id = items.feed_id
            JOIN mblogs ON mblogs.feed_id = feeds.feed_id
            WHERE mblogs.slug = ? AND mblog_items.slug = ?
        `,
    ).bind(subdomain, post_slug).run();

    const post = mblog_post_entry.results[0];
    if (!post) return c.notFound();

    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    const post_date = new Date(post.pub_date).toLocaleDateString(
        "en-UK",
        date_format_opts,
    );

    let list = `
        <a href="/"><h3>${subdomain}</h3></a>
        <h1>${post.title}</h1>
        <div>${post.content_html_scraped}</div>
        <time>${post_date}</time>
        `

    if (userLoggedIn && userId == post.user_id) {
        list += `
            <div style="display: flex; gap: 10px;margin-top:1em;">
                <form action="${post_slug}/delete" method="POST">
                    <input type="submit" value="Delete" onclick="return confirm('Are you sure?')">
                </form>
                <form action="${post_slug}/edit" method="GET">
                    <input type="submit" value="Edit">
                </form>
            </div>`
    }

    return c.html(
        renderHTML(
            `${post.title} | minifeed`,
            html`${raw(list)} `,
            c.get("USERNAME"),
            "",
            "",
            "",
            true
        ),
    );
}

export const handle_mblog_post_delete = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const post_slug = c.req.param("post_slug");

    const mblog_post_entry = await c.env.DB.prepare(`
        SELECT items.item_id, items.feed_id, mblogs.user_id
        FROM items
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblog_items.slug = ?
    `).bind(post_slug).run();

    const post = mblog_post_entry.results[0];

    if (!userLoggedIn || userId != post.user_id) return c.text("Unauthorized", 401);

    await c.env.DB.prepare("DELETE FROM items WHERE item_id = ?").bind(post.item_id).run();

    return c.redirect(`/`);
}

export const handle_mblog_post_edit = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const post_slug = c.req.param("post_slug");

    const post = await c.env.DB.prepare(`
        SELECT items.item_id, items.title, items.content_html, items.content_html_scraped, mblogs.user_id, feeds.title as feed_title
        FROM items
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblog_items.slug = ?`
    ).bind(post_slug).first();

    if (!userLoggedIn || userId != post.user_id) return c.text("Unauthorized", 401);

    const list = html`
        <div class="form-mblog">
        <form action="/${post_slug}/edit" method="POST">
            <div style="margin-bottom:1em;">
            <input type="text" name="post-title" value="${post.title}" style="width: 100%; font-size: 1.5em;">
            </div>
            <div style="margin-bottom:1em;">
            <textarea name="post-content" style="height: 70vh;">${post.content_html}</textarea>
            </div>
            <input type="submit" value="Save">
        </form></div>`

    return c.html(
        renderHTML(
            `${post.title} | ${post.feed_title}`,
            list,
            c.get("USERNAME"),
            "blogs",
            "",
        ),
    );
}

export const handle_mblog_post_edit_POST = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const post_slug = c.req.param("post_slug");

    const mblog_post_entry = await c.env.DB.prepare(
        `
            SELECT items.item_id, items.feed_id, mblogs.user_id
            FROM items
            JOIN mblog_items ON mblog_items.item_id = items.item_id
            JOIN feeds ON feeds.feed_id = items.feed_id
            JOIN mblogs ON mblogs.feed_id = feeds.feed_id
            WHERE mblog_items.slug = ?
        `,
    ).bind(post_slug).run();

    const post = mblog_post_entry.results[0];

    if (!userLoggedIn || userId != post.user_id) return c.redirect("/");
    if (userId != post.user_id) return c.redirect("/");

    const body = await c.req.parseBody();
    const post_title = body["post-title"].toString();
    if (!post_title) return c.text("Post title is required");
    const post_content = body["post-content"].toString();
    if (!post_content) return c.text("Post content is required");

    let content_html_scraped = await marked.parse(post_content);
    content_html_scraped = await sanitizeHTML(content_html_scraped);

    await c.env.DB.prepare("UPDATE items SET title = ?, content_html = ?, content_html_scraped = ? WHERE item_id = ?")
        .bind(post_title, post_content, content_html_scraped, post.item_id).run();

    return c.redirect(`/${post_slug}`);
}


export const mblogRSSHandler = async (c: any) => {
    return c.html("RSS SOON")
}
