import { html, raw } from "hono/html";
import { renderHTML, renderHTMLMblog } from "./htmltools";
import { itemIdToSqid } from "./utils";
import { marked } from 'marked';

export const handle_mblog = async (c: any) => {
    const subdomain = c.get("SUBDOMAIN");
    if (c.env.ENVIRONMENT != "dev") {
        console.log("redirecting to", `https://${subdomain}.minifeed.net`)
        return c.redirect(`https://${subdomain}.minifeed.net`, 301);
    }
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;

    let mblog_slug = subdomain;
    if (!subdomain) {
        mblog_slug = c.req.param("slug")
    }

    const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
        SELECT feeds.title, mblogs.user_id, mblogs.slug
        FROM feeds
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        WHERE mblogs.slug = ?`,
        ).bind(mblog_slug),

        c.env.DB.prepare(`
        SELECT items.item_id, items.title, items.content_html_scraped, mblog_items.slug, items.created
        FROM items
        JOIN feeds ON feeds.feed_id = items.feed_id
        JOIN mblogs ON mblogs.feed_id = feeds.feed_id
        JOIN mblog_items ON mblog_items.item_id = items.item_id
        WHERE mblogs.slug = ?
        ORDER BY items.created DESC`

        ).bind(mblog_slug),
    ]);

    if (!batch[0].results.length) return c.notFound();
    const mblog = batch[0].results[0];
    const items = batch[1].results;

    let list = ` <h1> ${mblog.title} </h1>`

    if (userLoggedIn && userId === mblog.user_id) {
        list += `
        <div class="form-mblog">
            <form action="/b/${mblog.slug}" method="POST">
                <div style="margin-bottom:1em;">
                    <input type="text" id="post-title" name="post-title" placeholder="Post title">
                </div>
                <div style="margin-bottom:1em;">
                    <textarea id="post-content" name="post-content" placeholder="Write a post" rows=12></textarea>
                </div>
                <input type="submit" value="Post" onclick="return confirm('All good, yeah?')">
            </form>
        </div>
            `
    }

    const item_url_prefix = c.env.ENVIRONMENT === "dev" ? `/b/${mblog.slug}/` : `/`;
    for (const item of items) {
        list += `
            <h2>
                <a href="${item_url_prefix}${item.slug}">
                    ${item.title}
                </a>
            </h2>
            <div>${raw(item.content_html_scraped)}</div>
            <br>
            `
        }


    return c.html(
        renderHTMLMblog(
            `${mblog.title}`,
            "",
            html`${raw(list)} `
        ),
    );
}

export const handle_mblog_POST = async (c: any) => {
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const mblog_slug = c.req.param("slug");

    if (!userLoggedIn) return c.text("Unauthorized", 401);

    const mblog_DB_entry = await c.env.DB.prepare(
        "SELECT mblogs.mblog_id, mblogs.user_id, mblogs.feed_id FROM mblogs WHERE mblogs.slug = ?",
    ).bind(mblog_slug).run();

    if (!mblog_DB_entry) return c.notFound();
    const mblog = mblog_DB_entry.results[0];

    if (userId != mblog.user_id) return c.text("Unauthorized", 401);

    const body = await c.req.parseBody();
    const title = body["post-title"].toString();
    if (!title) return c.text("Post title is required");
    const post_content = body["post-content"].toString();
    if (!post_content) return c.text("Post content is required");

    const content_html_scraped = marked.parse(post_content);

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

        const pub_date = new Date().toISOString()
        const insertion_results = await c.env.DB.prepare(
            "INSERT INTO items (feed_id, title, description, content_html, content_html_scraped, url, pub_date) values (?, ?, ?, ?, ?, ?, ?)",
        ).bind(mblog.feed_id, title, title, post_content, content_html_scraped, item_slug, pub_date).run();

        const new_item_id = insertion_results.meta.last_row_id;
        const new_item_sqid = itemIdToSqid(new_item_id);
        await c.env.DB.prepare("UPDATE items SET item_sqid = ? WHERE item_id = ?")
            .bind(new_item_sqid, new_item_id).run();

        await c.env.DB.prepare("INSERT INTO mblog_items (mblog_id, item_id, slug) values (?, ?, ?)")
            .bind(mblog.mblog_id, new_item_id, item_slug).run();

        if (c.env.ENVIRONMENT == "dev") {
            return c.redirect(`/b/${mblog_slug}/${item_slug}`);
        } else {
            return c.redirect(`https://${mblog_slug}.minifeed.net/${item_slug}`);
        }

    } catch (err) {
        return c.text(err);
    }
}

const generate_slug = (title: string) => {
    return title.toLowerCase().replace(/ /g, "-");
}

export const mblogSinglePostHandler = async (c: any) => {
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const subdomain = c.get("SUBDOMAIN");

    let mblog_slug;
    if (subdomain) {
        mblog_slug = subdomain
    }
    else {
        mblog_slug = c.req.param("slug");
    }
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
    ).bind(mblog_slug, post_slug).run();

    const post = mblog_post_entry.results[0];
    if (!post) return c.notFound();

    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
    };
    const post_date = new Date(post.pub_date).toLocaleDateString(
        "en-UK",
        date_format_opts,
    );

    let list = `
        <h3>${mblog_slug}</h3>
        <h1>${post.title}</h1>
        <div>${post.content_html_scraped}</div>
        <time>${post_date}</time>
        `

    if (userLoggedIn && userId === post.user_id) {
        // add delete button
        list += `
            <div style="display: flex; gap: 10px;margin-top:1em;">
                <form action="/b/${mblog_slug}/${post_slug}/delete" method="POST">
                    <input type="submit" value="Delete" onclick="return confirm('Are you sure?')">
                </form>
                <form action="/b/${mblog_slug}/${post_slug}/edit" method="GET">
                    <input type="submit" value="Edit">
                </form>
            </div>

            `
    }

    return c.html(
        renderHTML(
            `${post.title} | minifeed`,
            html`${raw(list)} `,
            c.get("USERNAME"),
            "blogs",
            "",
        ),
    );
}

export const mblogSinglePostDeleteHandler = async (c: any) => {
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const mblog_slug = c.req.param("slug");
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

    if (!userLoggedIn || userId !== post.user_id) return c.redirect("/");
    if (userId != post.user_id) return c.redirect("/");

    await c.env.DB.prepare("DELETE FROM items WHERE item_id = ?").bind(post.item_id).run();

    return c.redirect(`/b/${mblog_slug}`);
}

export const mblogSinglePostEditHandler = async (c: any) => {
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const mblog_slug = c.req.param("slug");
    const post_slug = c.req.param("post_slug");

    const mblog_post_entry = await c.env.DB.prepare(
        `
            SELECT items.item_id, items.title, items.content_html, items.content_html_scraped, mblogs.user_id
            FROM items
            JOIN mblog_items ON mblog_items.item_id = items.item_id
            JOIN feeds ON feeds.feed_id = items.feed_id
            JOIN mblogs ON mblogs.feed_id = feeds.feed_id
            WHERE mblog_items.slug = ?
        `,
    ).bind(post_slug).run();

    const post = mblog_post_entry.results[0];

    if (!userLoggedIn || userId !== post.user_id) return c.redirect("/");
    if (userId != post.user_id) return c.redirect("/");

    let list = `


        <div class="form-mblog">
        <form action="/b/${mblog_slug}/${post_slug}/edit" method="POST">
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
            `${post.title} | minifeed`,
            html`${raw(list)} `,
            c.get("USERNAME"),
            "blogs",
            "",
        ),
    );
}

export const mblogSinglePostEditPostHandler = async (c: any) => {
    const userId = c.get("USER_ID") || -1;
    const userLoggedIn = c.get("USER_ID") ? true : false;
    const mblog_slug = c.req.param("slug");
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

    if (!userLoggedIn || userId !== post.user_id) return c.redirect("/");
    if (userId != post.user_id) return c.redirect("/");

    const body = await c.req.parseBody();
    const post_title = body["post-title"].toString();
    if (!post_title) return c.text("Post title is required");
    const post_content = body["post-content"].toString();
    if (!post_content) return c.text("Post content is required");


    console.log(post_content)

    const content_html_scraped = marked.parse(post_content);

    await c.env.DB.prepare("UPDATE items SET title = ?, content_html = ?, content_html_scraped = ? WHERE item_id = ?")
        .bind(post_title, post_content, content_html_scraped, post.item_id).run();

    return c.redirect(`/b/${mblog_slug}/${post_slug}`);
}


export const mblogRSSHandler = async (c: any) => {
    return c.html("RSS SOON")
}
