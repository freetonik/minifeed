import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const renderHTML = (title, inner) => {
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

  
  <link rel="stylesheet" href="https://unpkg.com/missing.css@1.1.1">
  <script src="/static/htmx.min.js"></script>
</head>

<body>
  <header class="navbar">
  <p><a href="/" class="allcaps bold">Minifeed</a></p>
  <nav aria-label="Site sections">
    <ul role="list">
      <li><a href="/my">My all</a></li>
      <li><a href="/my/subs">My subs</a></li>
      <li><a href="/my/follows">My follows</a></li>
      <li><a href="/feeds">Feeds</a></li>
      <li><a href="/users">Users</a></li>
    </ul>
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
  <div style="margin-bottom: 0.5em">
    <a href="${url}">${title}</a> 
    <small>(<a style="color:inherit; text-decoration: none;" href="/feeds/${feedSqid}">${feed_title}</a>)</small>
    <br>
    <small>
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