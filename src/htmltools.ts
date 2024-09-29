import { html } from "hono/html";

export const renderHTML = (
    title: string,
    inner: any,
    user_logged_in: boolean = false,
    active: string = "all",
    searchQuery: string = "",
    canonicalUrl: string = "",
    prefix_root_url: boolean = false,
) => {
    const root_url = prefix_root_url ? "https://minifeed.net" : "";

    const canonicalUrlBlock = canonicalUrl ? html`<link rel="canonical" href="${canonicalUrl}" />` : "";

    let userBlock = html``;
    if (user_logged_in) {
        userBlock = html`
      <a href="/my/account">account</a>
    `;
    } else {
        userBlock = html`<a href="/login" class="bold">Log in</a> or <a class="bold" href="/signup">sign up</a>`;
    }

    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <meta name="author" content="">
        <meta name="description" content="">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${canonicalUrlBlock}
        <link rel="apple-touch-icon" sizes="180x180" href="/static/favicons/apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/static/favicons/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/static/favicons/favicon-16x16.png">
        <link rel="manifest" href="/static/favicons/site.webmanifest">
        <link rel="stylesheet" href="/static/minifeed.css">
        <script defer src="/static/htmx.min.js"></script>
    </head>

    <body>
    <header>
        <form action="${root_url}/search" method="GET" style="width:100%;margin-bottom:1.25em;">
            <input class="search-input"
            type="text" name="q" placeholder="search..." minlength="2" autocomplete="off" value="${searchQuery}">
        </form>
        <div>
            <nav aria-label="Site navigation">
                <div>
                    <a href="${root_url}/"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;margin-right:1.5em;">minifeed</span></a>
                    <a href="${root_url}/my" class="${active === "my" ? "bold" : ""}">My</a>
                    <a href="${root_url}/global" class="${active === "global" ? "bold" : ""}" style="margin-left: 0.5em">All</a>
                    <a href="${root_url}/blogs" class="${active === "blogs" ? "bold" : ""}" style="margin-left: 0.5em">Blogs</a>
                    <a href="${root_url}/users" class="${active === "users" ? "bold" : ""}" style="margin-left: 0.5em">Users</a>
                </div>
                <div class="user-block">
                    ${userBlock}
                </div>
            </nav>
        </div>

    </header>

    <main>${inner}</main>

    <footer>
        <p>
            Minifeed.net ::
            <a href="${root_url}/about/changelog">changelog</a> /
            <a href="https://status.minifeed.net/">status</a> /
            <a href="${root_url}/feedback">feedback</a>
        </p>
    </footer>

    </body>
    </html>`;
};

const dateFormatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
};

export const renderItemShort = (
    item_sqid: string,
    title: string,
    url: string,
    feed_title: string,
    feed_sqid: string,
    pub_date: string = "",
    summary: string = "",
) => {
    const postDate = new Date(pub_date).toLocaleDateString(
        "en-UK",
        dateFormatOptions,
    );

    const feedLink = feed_title
        ? `<a href="/blogs/${feed_sqid}">${feed_title}</a> | `
        : "";
    const summaryContent = summary
        ? `<p class="item-summary">${summary}</p>`
        : "";

    return `
    <div class="item-short">
        <a href="/items/${item_sqid}" class="bold no-color no-underline">${title}</a> <br>
        <div class="muted">
            <small>
                ${feedLink}
                <span>${postDate}</span> |
                <a class="no-underline no-color" href="${url}">original</a>
            </small>
        </div>
        ${summaryContent}
    </div>
    `;
};

export const renderItemSearchResult = (searchResult: any) => {
    const item = searchResult["document"];
    // item_id, title, url, feed_title, feed_id, pub_date=''
    const postDate = new Date(item["pub_date"]).toLocaleDateString(
        "en-UK",
        dateFormatOptions,
    );
    const feedSqid = item["feed_sqid"];
    const itemSqid = item["item_sqid"];
    const uri_root_from_type = item["type"] === "blog" ? "blogs" : "";

    let title = item["title"];
    if (
        searchResult["highlight"]["title"] &&
        searchResult["highlight"]["title"]["snippet"]
    ) {
        title = searchResult["highlight"]["title"]["snippet"];
    }
    let content = "";
    if (
        searchResult["highlight"]["content"] &&
        searchResult["highlight"]["content"]["snippet"]
    ) {
        content = searchResult["highlight"]["content"]["snippet"];
    }

    return `
    <div class="item-short search-result">
        <a href="/items/${itemSqid}" class="no-underline bold">${title}</a> <br>
        <div class="muted"><small>
            from ${item["type"]} <a href="/${uri_root_from_type}/${feedSqid}">${item["feed_title"]}</a> |
            <time>${postDate}</time> |
            <a class="no-underline no-color" href="${item["url"]}">original</a>
        </small></div>
        <p class="item-summary">
        ${content}...
        </p>
    </div>
    `;
};

export const renderAddFeedForm = (url: string = "", flash: string = "") => {
    let flash_test = "";
    if (flash.includes("Cannot find RSS link"))
        flash_test +=
            "Cannot find RSS link on that page. Try entering direct RSS URL.";
    else if (flash.includes("UNIQUE constraint failed: feeds.rss_url"))
        flash_test += "Blog already exists.";
    else if (flash.includes("Cannot fetch url"))
        flash_test += "That page does not exist.";
    else if (flash.includes("error code 530"))
        flash_test += "That page does not exist.";
    else flash_test += flash;

    const flashBlock = flash
        ? html`<div class="flash flash-red">${flash_test}</div>`
        : "";
    return html`
    <h1>Add new blog</h1>
    ${flashBlock}
      <form action="/blogs/new" method="POST">
        <div style="margin-bottom:1em;">
          <label for="url">Blog URL (or direct RSS URL):</label>
          <input
            type="url"
            id="url"
            name="url"
            value="${url}"
            style="width: 100%;"
          /><br />
        </div>
        <input type="submit" value="Add blog" />
      </form>
  `;
};

export const renderAddItemByURLForm = (
    url: string = "",
    urls: string = "",
    flash: string = "",
    blogTitle: string = "",
) => {
    let flash_test = "";
    if (flash.includes("Cannot fetch url"))
        flash_test += "That page does not exist.";
    else flash_test += flash;

    const flashBlock = flash
        ? html`<div class="flash flash-red">${flash_test}</div>`
        : "";
    return html`
    <h1>Add new item by URL to ${blogTitle}</h1>
    ${flashBlock}
    <div class="formbg">
      <form action="new" method="POST">
        <div style="margin-bottom:1em;">
          <label for="url">URL:</label>
          <input
            type="url"
            id="url"
            name="url"
            value="${url}"
            style="width: 100%;"
          />

          <p>Or add multiple URLs separated by new lines:</p>

          <label for="urls">URLs:</label>
          <textarea
            id="urls"
            name="urls"
            rows="7"

            value="${urls}"
            style="width: 100%;resize: vertical;"
          /></textarea><br />
        </div>
        <input type="submit" value="Add item(s)" />
      </form>
    </div>
  `;
};

export const render_my_subsections = (active: string = "all") => {
    return html`
    <nav class="subsections">
        <a href="/my" class="no-color no-underline ${active === "my" ? "active bold" : ""}">everything</a>
        <a href="/my/subscriptions" class="no-color no-underline ${active === "subscriptions" ? "active bold" : ""}">subscriptions</a>
        <a href="/my/favorites" class="no-color no-underline ${active === "favorites" ? "active bold" : ""}">favorites</a>
        <a href="/my/friendfeed" class="no-color no-underline ${active === "friendfeed" ? "active bold" : ""}">friendfeed</a>
    </nav>
    `;
}
