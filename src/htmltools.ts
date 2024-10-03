import { html } from "hono/html";

export const renderHTML = (
    title: string,
    inner: any,
    user_logged_in: boolean = false,
    active: string = "all",
    searchQuery: string = "",
    canonicalUrl: string = "",
    prefix_root_url: boolean = false,
    debug_info: string = ""
) => {
    const root_url = prefix_root_url ? "https://minifeed.net" : "";

    const canonicalUrlBlock = canonicalUrl ? html`<link rel="canonical" href="${canonicalUrl}" />` : "";

    let userBlock = html``;
    if (user_logged_in) {
        userBlock = html`<a href="${root_url}/my/account">account</a>`;
    } else {
        userBlock = html`<span><a href="${root_url}/login" class="bold">Log in</a> or <a class="bold" href="${root_url}/signup">sign up</a></span>`;
    }

    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${canonicalUrlBlock}
        <link rel="shortcut icon" href="data:image/x-icon;base64,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" />

        <style>
        :root {
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
                sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            --font-serif: "PT Serif", Georgia, serif;
            --font-monospace: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas,
                "Liberation Mono", monospace;

            --color-text: #000;
            --color-link: rgb(0, 0, 238);
            --color-green: #05620f;
            --color-red: #620529;

            --color-gray: #555;
            --color-bg: hsla(50, 25%, 96%);
            --color-highlight: #ebebeb;

            --padding: 1.25em;
        }

        html {
            box-sizing: border-box;
        }

        *,
        *:before,
        *:after {
            box-sizing: inherit;
        }

        body {
            color: var(--color-text);
            background: var(--color-bg);
            font-family: var(--font-sans);
            font-size: 16px;
            font-weight: normal;
            margin: auto;
            padding: 1em;
            max-width: 900px;
            line-height: 1.35;
            overflow-wrap: break-word;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        a,
        a:visited {
            color: var(--color-text);
        }

        article a {
            color: var(--color-link);
        }

        article a:visited {
            color: purple;
        }

        header {
            margin-bottom: 2em;
            display: flex;
            flex-direction: column;
        }

        header a {
            text-decoration: none;
            color: black;
            font-size: 1em;
        }

        header nav {
            display: flex;
            justify-content: space-between;
        }

        footer {
            border-top: 1px solid black;
            margin-top: 2em;
            text-align: center;
        }

        nav.subsections {
            margin-bottom: 2em;
            border: 1px solid black;
            padding: 0;
            display: flex;
            align-items: stretch;
        }

        nav.subsections a {
            padding: 0.25em 0.5em;
            display: flex;
            align-items: center;
            border-right: 1px solid black;
            transition: background-color 0.3s ease;
        }

        nav.subsections a:hover,
        nav.subsections a.active {
            background-color: var(--color-highlight);
        }

        nav.subsections a:first-child {
            border-left: none;
        }

        img,
        video,
        iframe {
            max-width: 100%;
            height: auto;
        }

        code,
        pre {
            overflow: auto;
            text-wrap: scroll;
            background-color: #f3f3f3;
        }

        iframe,
        embed {
            max-width: 100%;
            height: auto;
            max-height: 30em;
        }

        figure {
            margin: 0;
            overflow: scroll;
        }

        /* ITEMS */

        .item-short {
            margin-bottom: 2.5em;
        }


        .item-short p.item-summary {
            margin-top: 0.5em;
        }

        .item-actions {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
        }

        /* BUTTONS */

        button,
        .button,
        a.button:visited {
            appearance: none;
            text-decoration: none;
            background-color: #FAFBFC;
            border: 1px solid black;
            box-shadow: rgba(27, 31, 35, 0.04) 0 1px 0, rgba(255, 255, 255, 0.25) 0 1px 0 inset;
            box-sizing: border-box;
            color: #24292E;
            box-sizing: border-box;
            color: #24292e;
            cursor: pointer;
            display: inline-block;
            font-family: var(--font-sans);
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            list-style: none;
            padding: 6px 16px;
            position: relative;
            transition: background-color 0.15s cubic-bezier(0.3, 0, 0.5, 1);
            user-select: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            vertical-align: middle;
            white-space: nowrap;
            word-wrap: break-word;
        }

        button:hover,
        a.button:hover {
            background-color: hsl(0, 0%, 86%);
            text-decoration: none;
            transition-duration: 0.1s;
        }

        button:disabled,
        a.button:disabled {
            color: #959da5;
            border-color: #959da5;
            pointer-events: none;
        }

        button:disabled:hover,
        a.button:disabled:hover {
            background-color: #FAFBFC;
        }

        button:enabled:active,
        a.button:active {
            background-color: #edeff2;
            box-shadow: rgba(225, 228, 232, 0.2) 0 1px 0 inset;
            transition: none 0s;
        }

        button:focus,
        a.button:focus {
            outline: 1px transparent;
        }

        button:before {
            display: none;
        }

        button:-webkit-details-marker {
            display: none;
        }

        button.subscribed {
            background-color: var(--color-green);
            color: white;
            box-shadow: none;
            min-width: 9em;
        }

        button.subscribe {
            min-width: 9em;
        }

        button.subscribe .unsubscribe-text,
        button.subscribed .unsubscribe-text {
            display: none;
        }

        button.subscribed:hover .subscribed-text {
            display: none;
        }

        button.subscribed:hover .unsubscribe-text {
            display: inline;
        }

        button.subscribed:hover {
            background-color: var(--color-red);
        }

        /* FORMS */

        input[type="text"],
        input[type="password"],
        input[type="email"],
        input[type="url"],
        textarea {
            font-size: 1.25em;
            line-height: 28px;
            padding: 8px 16px;
            font-family: var(--font-sans);
            width: 100%;
            min-height: 1em;
            border: unset;
            outline-color: rgb(84 105 212 / 0.5);
            background-color: --var(color-bg);
            box-shadow:
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(60, 66, 87, 0.16) 0px 0px 0px 1px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px;
        }

        .search-input {
            padding: 0.25em 0.5em !important;
            width: 100%;
            font-size: inherit !important;
            min-height: 0 !important;
            background-color: #ebebe8;
            transition: background-color 0.75s ease;
        }

        .search-input:focus {
            background-color: white;
            transition: background-color 0.4s ease;
            outline: none;
        }

        textarea::placeholder {
            font-family: var(--font-sans);

        }

        label,
        label {
            font-size: 14px;
            font-weight: 600;
            display: block;
            margin-bottom: 0.5em;
        }

        textarea.contentful {
            font-family: inherit;
            resize: vertical;
            line-height: inherit;
        }

        /* UTILS */

        .bold {
            font-weight: bold;
        }

        a.no-underline {
            border-bottom: none;
            text-decoration: none;
        }

        a.no-color {
            color: var(--color-text) !important;
        }

        .muted,
        .muted a {
            color: var(--color-gray) !important;
        }

        .blog-summary {
            border: 1px solid black;
            padding: 0 1.25em 1em;
            margin-bottom: 3em;
        }


        .related-items {
            border: 1px solid black;
            padding: 1.25em;
            margin: 2em 0;
        }

        .related-items h4 {
            margin-top: 0;
        }

        .related-items .item-short:last-child {
            margin-bottom: 0;
        }

        .flash {
            margin-bottom: 2em;
            border: 1px solid black;
            padding: 1.25em;
            background-color: antiquewhite;
            border-bottom: 2px solid black;
        }

        .flash-red {
            background-color: lightcoral;
        }

        .borderbox {
            border: 1px solid black;
            padding: 1.25em;
        }

        .search-result mark {
            background-color: inherit;
            font-weight: bold;
        }

        /* ADMIN CONTROLS */
        .admin-control#hidden {
            display: none;
        }

        .admin-control#hidden:target {
            display: block;
        }

        @media (max-width: 550px) {
            header .logo {
                display: block;
                margin-bottom: 0.65em;
            }
            nav.subsections {
                display: inline-flex;
            }
            nav.subsections a:last-child {
                border-right: none;
            }
        }

        </style>
        <script defer src="https://unpkg.com/htmx.org@2.0.2" integrity="sha384-Y7hw+L/jvKeWIRRkqWYfPcvVxHzVzn5REgzbawhxAuQGwX1XWe70vji+VSeHOThJ" crossorigin="anonymous"></script>
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
                    <a href="${root_url}/" class="logo"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;margin-right:1.5em;">minifeed</span></a>
                    <a href="${root_url}/my" class="${active === "my" ? "bold" : ""}">My feed</a>
                    <a href="${root_url}/global" class="${active === "global" ? "bold" : ""}" style="margin-left: 0.5em">Global feed</a>
                    <a href="${root_url}/blogs" class="${active === "blogs" ? "bold" : ""}" style="margin-left: 0.5em">Blogs</a>
                    <a href="${root_url}/users" class="${active === "users" ? "bold" : ""}" style="margin-left: 0.5em">Users</a>
                </div>
                    ${userBlock}
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
        <p>
            ${debug_info}
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
        <a href="/my" class="no-color no-underline ${active === "my" ? "active bold" : ""}">all</a>
        <a href="/my/subscriptions" class="no-color no-underline ${active === "subscriptions" ? "active bold" : ""}">subscriptions</a>
        <a href="/my/favorites" class="no-color no-underline ${active === "favorites" ? "active bold" : ""}">favorites</a>
        <a href="/my/friendfeed" class="no-color no-underline ${active === "friendfeed" ? "active bold" : ""}">friendfeed</a>
    </nav>
    `;
}
