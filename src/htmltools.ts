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

// <link rel="stylesheet" href="/static/sp.css">

export const renderItemShort = (title, url, feed_title, feed_id) => {
  const sqid = idToSqid(feed_id)
  return `
  <div style="margin-bottom: 0.5em">
    <a href="${url}">${title}</a> 
    <br><small><a style="color:inherit; text-decoration: none;" href="/feeds/${sqid}">${feed_title}</a></small>
  </div>
  `
}