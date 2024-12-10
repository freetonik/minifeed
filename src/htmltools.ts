import { html, raw } from 'hono/html';
import { renderedCSS } from './css';
import type { FeedSearchResult, ItemSearchResult } from './interface';

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
        ? raw(`<a href="${root_url}/account">account</a>`)
        : raw(
              `<span><a href="${root_url}/login" class="bold">Log&nbsp;in</a> | <a class="bold" href="${root_url}/signup">Sign&nbsp;up</a></span>`,
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
        <form action="${root_url}/search" method="GET" style="width:100%;margin-bottom:1.25em;">
            <input class="search-input"
            type="text" name="q" placeholder="search..." minlength="2" autocomplete="off" value="${searchQuery}">
        </form>
        <nav aria-label="Site navigation">
            <div>
                <a href="${root_url}/" class="logo"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;margin-right:1.5em;">minifeed</span></a>
                <a href="${root_url}/" class="${active === 'my' && user_logged_in ? 'chapter bold active' : 'chapter'}">My feed</a>
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
        <a href="/blogs" class="no-color no-underline ${active === 'newest' ? 'active bold' : ''}">newest</a>
        <a href="/blogs/by/oldest" class="no-color no-underline ${active === 'oldest' ? 'active bold' : ''}">oldest</a>
        <a href="/blogs/by/alphabetical" class="no-color no-underline ${active === 'alphabetical' ? 'active bold' : ''}">alphabetical</a>
        <a href="/blogs/by/random" class="no-color no-underline ${active === 'random' ? 'active bold' : ''}">random</a>
        <a ${userLoggedIn ? 'href="/blogs/by/subscribed"' : ''} class="no-color no-underline ${active === 'subscribed' ? 'active bold' : ''}
        ${!userLoggedIn ? 'disabled' : ''} ">subscribed</a>
    </nav>
    `;
};
