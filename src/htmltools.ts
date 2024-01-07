import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const renderHTML = (title: string, inner, username:string = '?', active:string = 'all', searchQuery:string = '') => {

  return html`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="author" content="">
  <meta name="description" content="">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link
    rel="icon"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐾</text></svg>"
  />
  <link rel="stylesheet" href="/static/minifeed.css">
  <script src="/static/htmx.min.js"></script>
  

</head>

  <body>
    <header>
      <div class="logo">
        <a href="/"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;">minifeed</span>.net</a>
      </div>
      <nav aria-label="Site sections">
          <a href="/my" class="${active==='my' ? 'active' : ''}">Home</a>
          <a href="/all" class="${active==='all' ? 'active' : ''}" style="margin-left: 0.5em">Everything</a>
          <a href="/feeds" class="${active==='feeds' ? 'active' : ''}" style="margin-left: 0.5em">Feeds</a>
          <a href="/users" class="${active==='users' ? 'active' : ''}" style="margin-left: 0.5em">Users</a>
          <span class="search-form ${active==='search' ? 'active' : ''}">
          <form action="/search" method="GET">
            <input type="text" name="q" placeholder="Search..." style="width: 10em;" value="${searchQuery}">
          </form>
          </span>
      </nav>
    </header>

    <main>${inner}</main>

    <footer><div><a href="/my/account" class="bold">My account</a> / Minifeed.net </div></footer>

</header>

<div class="container">
    <div class="search-panel">
        <div class="search-panel__results">
            <div id="searchbox"></div>
            <div id="hits"></div>
        </div>
    </div>

    <div id="pagination"></div>
</div>

</body>
  </body>
</html>`
}

const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };

export const renderItemShort = (item_id, title, url, feed_title, feed_id, pub_date='') => {
  const postDate = new Date(pub_date).toLocaleDateString('en-UK', dateFormatOptions)
  const feedSqid = idToSqid(feed_id)
  const itemSqid = idToSqid(item_id, 10)

  const feedLink = feed_title ? `<a href="/feeds/${feedSqid}">${feed_title}</a>` : ''
  return `
  <div class="item-short">
    <a href="${url}" class="item-short-title">${title}</a> <br>
    <small class="muted">
    ${feedLink} |
    <time>${postDate}</time> |
      <a class="no-underline no-color" href="/items/${itemSqid}">permalink</a> 
    </small>
  </div>
  `
}

export const renderItemSearchResult = (searchResult) => {
  const item = searchResult['document']
  // item_id, title, url, feed_title, feed_id, pub_date=''
  const postDate = new Date(item['pub_date']).toLocaleDateString('en-UK', dateFormatOptions)
  const feedSqid = idToSqid(item['feed_id'])
  const itemSqid = idToSqid(item['item_id'], 10)
  console.log(searchResult);

  let title = item['title'];
  if (searchResult['highlight']['title'] && searchResult['highlight']['title']['snippet']) {
    title = searchResult['highlight']['title']['snippet']
  }
  let content = '';
  if (searchResult['highlight']['content'] && searchResult['highlight']['content']['snippet']) {
    content = searchResult['highlight']['content']['snippet']
  }
  
  return `
  <div class="item-short" style="margin-top:2em">
    <a href="${item['url']}" class="item-short-title">${title}</a> <br>
    <small class="muted">
      <a href="/feeds/${feedSqid}">${item['feed_title']}</a>
      <time>${postDate}</time> |
      <a class="no-underline no-color" href="/items/${itemSqid}">permalink</a> 
      <br>
      <span class="search-result-snippet">
        ${content}...
      </span>
    </small>
  </div>
  `
}

export const renderAddFeedForm = (url:string = '', flash:string = '') => {
  return `
  <h1>New feed</h1>
  <form action="/c/f/add" method="POST">
    <label for="url">Blog URL (or direct RSS URL):</label><br>
    <input type="text" id="url" name="url" value="${url}" style="width: 100%;"><br>
    <input type="submit" value="Submit">
  </form> 
  <div>${flash}</div>
  `
}

export const renderFeedLong = (feed_id, title, url, rss_url, items) => {
  const feedSqid = idToSqid(feed_id)
  let list = `<h1>${title}</h1><p><a href="${url}">${url}</a></p>
  `
}