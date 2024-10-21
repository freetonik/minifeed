import { html, raw } from 'hono/html';
import { renderedCSS } from './css';
import type { FeedSearchResult, ItemSearchResult } from './interface';

export const renderHTMLMblog = (title: string, inner: string, user_logged_in: boolean) => {
    return html`
    <!DOCTYPE html>
    <html lang="en" style="height: 100%;">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <meta name="description" content="${title}">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="shortcut icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJtMTIuNjcyLjY2OCAzLjA1OSA2LjE5NyA2LjgzOC45OTNhLjc1Ljc1IDAgMCAxIC40MTYgMS4yOGwtNC45NDggNC44MjMgMS4xNjggNi44MTJhLjc1Ljc1IDAgMCAxLTEuMDg4Ljc5TDEyIDE4LjM0N2wtNi4xMTYgMy4yMTZhLjc1Ljc1IDAgMCAxLTEuMDg4LS43OTFsMS4xNjgtNi44MTEtNC45NDgtNC44MjNhLjc0OS43NDkgMCAwIDEgLjQxNi0xLjI3OWw2LjgzOC0uOTk0TDExLjMyNy42NjhhLjc1Ljc1IDAgMCAxIDEuMzQ1IDBaIj48L3BhdGg+PC9zdmc+" />
        <style>${renderedCSS}</style>
    </head>
    <body style="height: 100%; display: flex; flex-direction: column;">
    ${inner}
    </body>
    </html>`;
};

export const renderHTML = (
    title: string,
    inner: string,
    user_logged_in = false,
    active = 'all',
    searchQuery = '',
    canonicalUrl = '',
    prefix_root_url = false,
    debug_info = '',
) => {
    const root_url = prefix_root_url ? 'https://minifeed.net' : '';
    const canonicalUrlBlock = canonicalUrl ? raw(`<link rel="canonical" href="${canonicalUrl}" />`) : '';

    const userBlock = user_logged_in
        ? raw(`<a href="${root_url}/my/account">account</a>`)
        : raw(
              `<span><a href="${root_url}/login" class="bold">Log in</a> | <a class="bold" href="${root_url}/signup">Sign up</a></span>`,
          );

    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <meta name="description" content="${title}">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${canonicalUrlBlock}
        <link rel="shortcut icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJtMTIuNjcyLjY2OCAzLjA1OSA2LjE5NyA2LjgzOC45OTNhLjc1Ljc1IDAgMCAxIC40MTYgMS4yOGwtNC45NDggNC44MjMgMS4xNjggNi44MTJhLjc1Ljc1IDAgMCAxLTEuMDg4Ljc5TDEyIDE4LjM0N2wtNi4xMTYgMy4yMTZhLjc1Ljc1IDAgMCAxLTEuMDg4LS43OTFsMS4xNjgtNi44MTEtNC45NDgtNC44MjNhLjc0OS43NDkgMCAwIDEgLjQxNi0xLjI3OWw2LjgzOC0uOTk0TDExLjMyNy42NjhhLjc1Ljc1IDAgMCAxIDEuMzQ1IDBaIj48L3BhdGg+PC9zdmc+" />
        <style>${renderedCSS}</style>
        <script defer src="https://unpkg.com/htmx.org@2.0.2" integrity="sha384-Y7hw+L/jvKeWIRRkqWYfPcvVxHzVzn5REgzbawhxAuQGwX1XWe70vji+VSeHOThJ" crossorigin="anonymous"></script>
    </head>

    <body>
    <header>
        <form action="${root_url}/search" method="GET" style="width:100%;margin-bottom:1.25em;">
            <input class="search-input"
            type="text" name="q" placeholder="search..." minlength="2" autocomplete="off" value="${searchQuery}">
        </form>
        <nav aria-label="Site navigation">
            <div>
                <a href="${root_url}/" class="logo"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;margin-right:1.5em;">minifeed</span></a>
                <a href="${root_url}/my" class="${active === 'my' ? 'chapter bold active' : 'chapter'}">My feed</a>
                <a href="${root_url}/global" class="${active === 'global' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Global</a>
                <a href="${root_url}/blogs" class="${active === 'blogs' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Blogs</a>
                <a href="${root_url}/lists" class="${active === 'lists' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Lists</a>
                <a href="${root_url}/users" class="${active === 'users' ? 'chapter bold active' : 'chapter'}" style="margin-left: 0.5em">Users</a>
            </div>
            ${userBlock}
        </nav>
    </header>
    <main>${inner}</main>
    <footer>
        <p>
            Minifeed.net ::
            <a href="${root_url}/about">about</a> /
            <a href="${root_url}/about/changelog">changelog</a> /
            <a href="https://status.minifeed.net/">status</a> /
            <a href="${root_url}/feedback">feedback</a>
        </p>
        <p> ${debug_info} </p>
    </footer>
    </body>
    </html>`;
};

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
                <a class="no-underline no-color" href="${url}">original</a>
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
            <a class="no-underline no-color" href="${item.url}">original</a>
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

    return `
    <div class="item-tiny search-result">
        <span class="label">${type}</span> 
        <strong><a href="/${uri_root_from_type}/${feed.feed_sqid}">${feed.title}</a></strong>
        <br>
        <small class="muted">
            <a target="_blank" href=${feed.url}>↗ ${feed.url}</a> | <a target="_blank" href=${feed.rss_url}>↗ RSS</a>
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
        <a href="/my" class="no-color no-underline ${active === 'my' ? 'active bold' : ''}">all</a>
        <a href="/my/subscriptions" class="no-color no-underline ${active === 'subscriptions' ? 'active bold' : ''}">subscriptions</a>
        <a href="/my/favorites" class="no-color no-underline ${active === 'favorites' ? 'active bold' : ''}">favorites</a>
        <a href="/my/friendfeed" class="no-color no-underline ${active === 'friendfeed' ? 'active bold' : ''}">friendfeed</a>
    </nav>
    `;
};

export const renderGlobalSubsections = (active = 'latest') => {
    return `
    <nav class="subsections">
        <a href="/global" class="no-color no-underline ${active === 'latest' ? 'active bold' : ''}">latest</a>
        <a href="/global/oldest" class="no-color no-underline ${active === 'oldest' ? 'active bold' : ''}">oldest</a>
        <a href="/global/random" class="no-color no-underline ${active === 'random' ? 'active bold' : ''}">random</a>
    </nav>
    `;
};

export const renderBlogsSubsections = (active = 'latest') => {
    return `
    <nav class="subsections">
        <a href="/blogs" class="no-color no-underline ${active === 'latest' ? 'active bold' : ''}">latest</a>
        <a href="/blogs/by/oldest" class="no-color no-underline ${active === 'oldest' ? 'active bold' : ''}">oldest</a>
        <a href="/blogs/by/alphabetical" class="no-color no-underline ${active === 'alphabetical' ? 'active bold' : ''}">alphabetical</a>
        <a href="/blogs/by/random" class="no-color no-underline ${active === 'random' ? 'active bold' : ''}">random</a>
    </nav>
    `;
};

export const renderMblogEditor = (title = '', content = '') => {
    return `
    <script src="https://unpkg.com/tiny-markdown-editor/dist/tiny-mde.min.js"></script>

    <form style="height: 100%; display: flex; flex-direction: column;" method="POST">
        <div style="margin-bottom:1em;">
            <input type="text" id="post-title" name="post-title" value="${title}">
        </div>
        <div style="flex-grow: 1; height: 100%; display: flex; flex-direction: column;">
            <textarea id="txt" name="post-content" placeholder="Here we go..." rows=12>${content}</textarea>
            <div id="toolbar"></div>
            <div id="tinymde" style="height:300px; overflow-y:scroll; border:1px solid #c0c0c0; background-color: white;padding:0.25em;flex-grow: 1;"></div>
        </div>
        <div style="padding-top: 1em;">
            <input type="submit" name="action" value="Publish">
            <input type="submit" name="action" value="Save">
        </div>
    </form>

    <script>
    var tinyMDE = new TinyMDE.Editor({element: 'tinymde', textarea: "txt" });
    var commandBar = new TinyMDE.CommandBar({
        element: "toolbar",
        editor: tinyMDE,
        commands: ['bold', 'italic', 'strikethrough', '|', 'code', 'h2', 'ul', 'ol', 'blockquote', '|', 'insertLink', 'insertImage',]
    });
    </script>

    <style>
    .TinyMDE {
        background-color:#fff;
        color:#000;
        font-size:16px;
        line-height:24px;
        outline: none;
        padding:5px;
        height: 100%;
    }

    .TMBlankLine {
        height:24px;
    }

    .TMH1, .TMSetextH1 {
        font-size:22px;
        line-height:32px;
        font-weight:bold;
        margin-bottom:8px;
    }

    .TMSetextH1 {
        margin-bottom:0px;
    }

    .TMSetextH1Marker {
        margin-bottom:8px;
    }

    .TMH2, .TMSetextH2 {
        font-size:20px;
        line-height:28px;
        font-weight:bold;
        margin-bottom:4px;
    }

    .TMMark_TMCode {
        font-family:monospace;
        font-size:.9em;
    }

    .TMFencedCodeBacktick, .TMFencedCodeTilde, .TMIndentedCode, .TMCode {
        font-family:monospace;
        font-size:.9em;
        background-color:#e0e0e0;
    }

    .TMCodeFenceBacktickOpen, .TMCodeFenceTildeOpen {
        border-bottom: 1px solid #c0c0c0;
        font-family: monospace;
        font-size:.9em;
    }

    .TMCodeFenceBacktickClose, .TMCodeFenceTildeClose {
        border-top: 1px solid #c0c0c0;
        font-family: monospace;
        font-size:.9em;
    }

    .TMInfoString {
        color: #0000ff;
    }

    .TMCode {
        border:1px solid #c0c0c0;
        border-radius: 2px;
    }

    .TMBlockquote {
        font-style: italic;
        border-left:2px solid #c0c0c0;
        padding-left:10px;
        margin-left:10px;
    }

    .TMMark {
        color:#a0a0a0;
    }

    .TMMark_TMH1, .TMMark_TMH2 {
        color:#ff8080;
    }

    .TMMark_TMUL, .TMMark_TMOL {
        color:#ff8080;
    }

    .TMImage {
    text-decoration: underline;
    text-decoration-color: #00ff00;
    }

    .TMLink {
    text-decoration: underline;
    text-decoration-color: #0000ff;
    }

    .TMLinkLabel {
    text-decoration: underline;
    font-family: monospace;
    }

    .TMLinkLabel_Definition, .TMLinkLabel_Valid {
    color: #40c040;
    }

    .TMLinkLabel_Invalid {
    color: #ff0000;
    }

    .TMLinkTitle {
    font-style:italic;
    }

    .TMLinkDestination, .TMAutolink {
    text-decoration: underline;
    color: #0000ff;
    }

    .TMHR {
    position: relative;
    }

    .TMHR:before {
    content: '';
    position: absolute;
    bottom: 50%;
    left: 40%;
    border-bottom: 2px solid #808080;
    width: 20%;
    z-index:0;
    }

    .TMHTML, .TMHTMLBlock {
    font-family:monospace;
    font-size:.9em;
    color:#8000ff;
    }

    .TMHTMLBlock {
    color:#6000c0;
    }

    .TMCommandBar {
    background-color:#f8f8f8;
    height:24px;
    border:4px solid #f8f8f8;
    box-sizing: content-box;
    display:flex;
    -webkit-user-select: none;
            user-select: none;
    overflow-x: scroll;
        overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    }

    .TMCommandBar::-webkit-scrollbar {
    display: none;
    }

    .TMCommandButton {
    box-sizing: border-box;
    display: inline-block;
    height:24px;
    width:24px;
    padding:3px;
    margin-right:4px;
    color:#404040;
    fill:#404040;
    text-align: center;
    cursor: pointer;
    vertical-align: middle;
    font-size:20px;
    line-height:18px;
    font-family: sans-serif;
    }

    .TMCommandDivider {
    box-sizing: content-box;
    height:24px;
    margin-left:4px;
    margin-right:8px;
    width:0px;
    border-left:1px solid #c0c0c0;
    border-right:1px solid #ffffff;
    }

    .TMCommandButton_Active {
    font-weight:bold;
    color:#000080;
    background-color: #c0c0ff;
    fill:#000080;
    }

    .TMCommandButton_Inactive {
    background-color:#f8f8f8;
    }

    .TMCommandButton_Disabled {
    color:#a0a0a0;
    fill:#a0a0a0;
    }

    @media (hover: hover) {
    .TMCommandButton_Active:hover, .TMCommandButton_Disabled:hover, .TMCommandButton_Inactive:hover {
        background-color:#e0e0ff;
        fill:#000000;
    }
    }
    </style>
    `;
};
