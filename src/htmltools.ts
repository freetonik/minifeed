import { html, raw } from 'hono/html';
import { renderedCSS } from './css';
import type { FeedSearchResult, ItemSearchResult } from './interface';

export const renderHTML = (
    title: string,
    inner: string,
    loggedIn = false,
    active = 'all',
    searchQuery = '',
    canonicalUrl = '',
    debugInfo = '',
) => {
    const canonicalUrlBlock = canonicalUrl ? raw(`<link rel="canonical" href="${canonicalUrl}" />`) : '';

    const userBlock = loggedIn
        ? raw(`<a href="/account">account</a>`)
        : raw(
              `<span><a href="/login" class="bold">Log&nbsp;in</a> | <a class="bold" href="/signup">Sign&nbsp;up</a></span>`,
          );

    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>

        <meta name="description" content="${title}">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="search" type="application/opensearchdescription+xml" title="Minifeed" href="/opensearch.xml" />
        ${canonicalUrlBlock}

        <style>${renderedCSS}</style>

        <link rel="shortcut icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJtMTIuNjcyLjY2OCAzLjA1OSA2LjE5NyA2LjgzOC45OTNhLjc1Ljc1IDAgMCAxIC40MTYgMS4yOGwtNC45NDggNC44MjMgMS4xNjggNi44MTJhLjc1Ljc1IDAgMCAxLTEuMDg4Ljc5TDEyIDE4LjM0N2wtNi4xMTYgMy4yMTZhLjc1Ljc1IDAgMCAxLTEuMDg4LS43OTFsMS4xNjgtNi44MTEtNC45NDgtNC44MjNhLjc0OS43NDkgMCAwIDEgLjQxNi0xLjI3OWw2LjgzOC0uOTk0TDExLjMyNy42NjhhLjc1Ljc1IDAgMCAxIDEuMzQ1IDBaIj48L3BhdGg+PC9zdmc+" />

        <script defer src="https://cdnjs.cloudflare.com/ajax/libs/htmx/2.0.3/htmx.min.js" integrity="sha512-dQu3OKLMpRu85mW24LA1CUZG67BgLPR8Px3mcxmpdyijgl1UpCM1RtJoQP6h8UkufSnaHVRTUx98EQT9fcKohw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    </head>

    <body>
    <header>
        <form action="/search" method="GET" style="width:100%;margin-bottom:1.25em;">
            <input class="search-input"
            type="text" name="q" placeholder="search..." minlength="2" autocomplete="off" value="${searchQuery}">
        </form>
        <nav aria-label="Site navigation">
            <div>
                <a href="/" class="logo"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;margin-right:1.5em;">minifeed</span></a>
                <a href="/" class="${active === 'my' && loggedIn ? 'chapter bold active' : 'chapter'}">My feed</a>
                <a href="/global" class="${active === 'global' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Global</a>
                <a href="/blogs" class="${active === 'blogs' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Blogs</a>
                <a href="/lists" class="${active === 'lists' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Lists</a>
                <a href="/users" class="${active === 'users' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Users</a>
            </div>
            ${userBlock}
        </nav>
    </header>
    <main>${inner}</main>
    <footer>
        <p>
            Minifeed.net ::
            <a href="/about">about</a> /
            <a href="/about/changelog">changelog</a> /
            <a href="https://status.minifeed.net/">status</a> /
            <a href="/feedback">feedback</a>
        </p>
        <p> ${debugInfo} </p>
    </footer>
    </body>
    </html>`;
};

export function renderReaderView(title: string, inner: string) {
    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>

        <meta name="description" content="${title}">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="search" type="application/opensearchdescription+xml" title="Minifeed" href="/opensearch.xml" />

        <link rel="shortcut icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJtMTIuNjcyLjY2OCAzLjA1OSA2LjE5NyA2LjgzOC45OTNhLjc1Ljc1IDAgMCAxIC40MTYgMS4yOGwtNC45NDggNC44MjMgMS4xNjggNi44MTJhLjc1Ljc1IDAgMCAxLTEuMDg4Ljc5TDEyIDE4LjM0N2wtNi4xMTYgMy4yMTZhLjc1Ljc1IDAgMCAxLTEuMDg4LS43OTFsMS4xNjgtNi44MTEtNC45NDgtNC44MjNhLjc0OS43NDkgMCAwIDEgLjQxNi0xLjI3OWw2LjgzOC0uOTk0TDExLjMyNy42NjhhLjc1Ljc1IDAgMCAxIDEuMzQ1IDBaIj48L3BhdGg+PC9zdmc+" />

        <style>
        /* Base styles */
        :root {
        --text-color: #222;
        --bg-color: #fff;
        --max-width: 680px;
        --body-padding: 2rem;
        --line-height: 1.6;
        }

        @media (prefers-color-scheme: dark) {
        :root {
            --text-color: #eee;
            --bg-color: #222;
        }
        }

        body {
        margin: 0 auto;
        max-width: var(--max-width);
        padding: var(--body-padding);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
        line-height: var(--line-height);
        color: var(--text-color);
        background: var(--bg-color);
        }

        /* Typography */
        h1, h2, h3, h4, h5, h6 {
        line-height: 1.2;
        margin-top: 2em;
        margin-bottom: 1em;
        }

        h1 { font-size: 2em; }
        h2 { font-size: 1.75em; }
        h3 { font-size: 1.5em; }
        h4 { font-size: 1.25em; }
        h5, h6 { font-size: 1em; }

        p {
        margin-bottom: 1.5em;
        }

        /* Links */
        a {
        color: #0066cc;
        text-decoration: none;
        }

        a:hover {
        text-decoration: underline;
        }

        @media (prefers-color-scheme: dark) {
        a {
            color: #66b3ff;
        }
        }

        /* Lists */
        ul, ol {
        margin: 1em 0;
        padding-left: 2em;
        }

        li {
        margin-bottom: 0.5em;
        }

        /* Images */
        img {
        max-width: 100%;
        height: auto;
        margin: 1em 0;
        }

        /* Code blocks */
        pre, code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
        font-size: 0.9em;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 3px;
        }

        pre {
        padding: 1em;
        overflow-x: auto;
        }

        code {
        padding: 0.2em 0.4em;
        }

        @media (prefers-color-scheme: dark) {
        pre, code {
            background: rgba(255, 255, 255, 0.1);
        }
        }

        /* Blockquotes */
        blockquote {
        margin: 1em 0;
        padding-left: 1em;
        border-left: 4px solid rgba(0, 0, 0, 0.1);
        font-style: italic;
        }

        @media (prefers-color-scheme: dark) {
        blockquote {
            border-left-color: rgba(255, 255, 255, 0.2);
        }
        }

        /* Tables */
        table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        }

        th, td {
        padding: 0.5em;
        border: 1px solid rgba(0, 0, 0, 0.1);
        text-align: left;
        }

        @media (prefers-color-scheme: dark) {
        th, td {
            border-color: rgba(255, 255, 255, 0.1);
        }
        }

        /* Mobile adjustments */
        @media (max-width: 600px) {
        :root {
            --body-padding: 1rem;
        }

        h1 { font-size: 1.75em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        h4, h5, h6 { font-size: 1em; }
        }

        /* Print styles */
        @media print {
        body {
            max-width: none;
            padding: 1.5cm;
            color: black;
            background: white;
        }

        a {
            color: black;
            text-decoration: underline;
        }

        @page {
            margin: 2cm;
        }
        }
        </style>

    </head>

    <body>
    ${inner}
    </body>
    </html>`;
}

const dateFormatOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export const renderItemShort = (
    item_sqid: string,
    title: string,
    url: string,
    feed_title?: string,
    feed_sqid?: string,
    pub_date?: string,
    summary?: string,
) => {
    const divClass = summary ? 'item-short' : 'item-tiny';
    const postDate = pub_date ? `${new Date(pub_date).toLocaleDateString('en-UK', dateFormatOptions)} | ` : '';
    const feedLink = feed_title ? `<a href="/blogs/${feed_sqid}">${feed_title}</a> | ` : '';
    const summaryContent = summary ? `<p class="item-summary">${summary}</p>` : '';

    return `
    <div class="${divClass}">
        <a href="/items/${item_sqid}" class="bold no-color no-underline">${title}</a> <br>
        <div class="muted">
            <small>
                ${feedLink}
                <span>${postDate}</span>
                <a class="no-underline no-color" href="${url}">original ↗</a>
            </small>
        </div>
        ${summaryContent}
    </div>
    `;
};

export const renderItemSearchResult = (searchResult: ItemSearchResult) => {
    const item = searchResult.document;
    const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions);
    const uri_root_from_type = item.type === 'blog' ? 'blogs' : '';

    let title = item.title;
    if (searchResult.highlight.title?.snippet) {
        title = searchResult.highlight.title.snippet;
    }
    let content = '';
    if (searchResult.highlight.content?.snippet) {
        content = searchResult.highlight.content.snippet;
    }

    return `
    <div class="item-short search-result">
        <a href="/items/${item.item_sqid}" class="no-underline bold">${title}</a> <br>
        <div class="muted"><small>
            from ${item.type} <a href="/${uri_root_from_type}/${item.feed_sqid}">${item.feed_title}</a> |
            <time>${postDate}</time> |
            <a class="no-underline no-color" href="${item.url}">original ↗</a>
        </small></div>
        <p class="item-summary">
        ${content}...
        </p>
    </div>
    `;
};

export const renderFeedSearchResult = (searchResult: FeedSearchResult) => {
    const feed = searchResult.document;
    const uri_root_from_type = feed.type === 'blog' ? 'blogs' : '';
    const type = feed.type === 'blog' ? 'blog' : 'Minifeed blog';
    const url = feed.type === 'blog' ? `/${uri_root_from_type}/${feed.feed_sqid}` : feed.url;

    return `
    <div class="item-tiny search-result box-grid fancy-gradient-bg borderbox">
        <span class="label">${type}</span>
        <strong><a href="${url}">${feed.title}</a></strong>
        <br>
        <small class="muted">
            <a target="_blank" href=${feed.url}>${feed.url}</a> | <a target="_blank" href=${feed.rss_url}>RSS↗</a>
        </small>
    </div>
    `;
};

export const renderAddFeedForm = (url = '', flash = '') => {
    let flash_test = '';
    if (flash.includes('Cannot find RSS link'))
        flash_test += 'Cannot find RSS link on that page. Try entering direct RSS URL.';
    else if (flash.includes('UNIQUE constraint failed: feeds.rss_url')) flash_test += 'Blog already exists.';
    else if (flash.includes('Cannot fetch url')) flash_test += 'That page does not exist.';
    else if (flash.includes('error code 530')) flash_test += 'That page does not exist.';
    else flash_test += flash;

    const flashBlock = flash ? html`<div class="flash flash-red">${flash_test}</div>` : '';
    return raw(`
    <h1>Add new blog</h1>
    ${flashBlock}
      <form action="/admin/blogs/new" method="POST">
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
  `);
};

export const renderAddItemByURLForm = (url = '', urls = '', flash = '', blogTitle = '') => {
    let flash_test = '';
    if (flash.includes('Cannot fetch url')) flash_test += 'That page does not exist.';
    else flash_test += flash;

    const flashBlock = flash ? html`<div class="flash flash-red">${flash_test}</div>` : '';
    return raw(`
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
  `);
};

export const renderMySubsections = (active = 'all') => {
    return `
    <nav class="subsections">
        <a href="/" class="no-color no-underline ${active === 'my' ? 'active bold' : ''}">all</a>
        <a href="/subscriptions" class="no-color no-underline ${active === 'subscriptions' ? 'active bold' : ''}">subscriptions</a>
        <a href="/favorites" class="no-color no-underline ${active === 'favorites' ? 'active bold' : ''}">favorites</a>
        <a href="/friendfeed" class="no-color no-underline ${active === 'friendfeed' ? 'active bold' : ''}">friendfeed</a>
    </nav>
    `;
};

export const renderGlobalSubsections = (active = 'newest') => {
    return `
    <nav class="subsections">
        <a href="/global" class="no-color no-underline ${active === 'newest' ? 'active bold' : ''}">newest</a>
        <a href="/global/oldest" class="no-color no-underline ${active === 'oldest' ? 'active bold' : ''}">oldest</a>
        <a href="/global/random" class="no-color no-underline ${active === 'random' ? 'active bold' : ''}">random</a>
    </nav>
    `;
};

export const renderBlogsSubsections = (active = 'newest', userLoggedIn = true) => {
    return `
    <nav class="subsections">
        <a href="/blogs" class="no-color no-underline ${active === 'newest' ? 'active bold' : ''}">new</a>
        <a href="/blogs/by/oldest" class="no-color no-underline ${active === 'oldest' ? 'active bold' : ''}">old</a>
        <a href="/blogs/by/alphabetical" class="no-color no-underline ${active === 'alphabetical' ? 'active bold' : ''}">a→z</a>
        <a href="/blogs/by/random" class="no-color no-underline ${active === 'random' ? 'active bold' : ''}">random</a>
        <a ${userLoggedIn ? 'href="/blogs/by/subscribed"' : ''} class="no-color no-underline ${active === 'subscribed' ? 'active bold' : ''}
        ${!userLoggedIn ? 'disabled' : ''} ">subscribed</a>
    </nav>
    `;
};

export const renderGuestFlash = `<div class="flash">
    <strong>Minifeed</strong> is a curated blog reader and search engine.
    We collect humans-written blogs to make them discoverable and searchable.
    Sign up to subscribe to blogs, follow people, save favorites, and create lists.
    </div>`;
