import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const renderHTML = (title, inner, username = '?') => {
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
    <nav aria-label="Site sections">
      <div>
        <a href="/" class="logo bold">⨕</a>
        
        <a href="/my" class="bold">My stuff</a>
        (<a href="/my/subs">from subs</a> /
        <a href="/my/follows">from follows</a>)
        
        <a href="/all" class="bold" style="margin-left: 0.5em">Global stuff</a>
        <a href="/feeds" class="bold" style="margin-left: 0.5em">Feeds</a>
        <a href="/users" class="bold" style="margin-left: 0.5em">Users</a>
      </div>
      <div>
        <a href="/users" class="bold">${username}</a>
      </div>
    </nav>

    </nav>
</header>

  <main>${inner}</main>
  <footer> Minifeed.net </footer>
</body></html>`
}

const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };

export const renderItemShort = (item_id, title, url, feed_title, feed_id, pub_date='') => {
  const postDate = new Date(pub_date).toLocaleDateString('en-UK', dateFormatOptions)
  const feedSqid = idToSqid(feed_id)
  const itemSqid = idToSqid(item_id, 10)
  return `
  <div class="item-short">
    <a href="${url}" class="item-short-title">${title}</a> <br>
    <small>from <a style="color:inherit; text-decoration: none;" href="/feeds/${feedSqid}">${feed_title}</a> | 
    <a style="color:inherit; text-decoration: none;" href="/items/${itemSqid}">permalink</a> | 
    <time>${postDate}</time>
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