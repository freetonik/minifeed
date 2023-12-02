import { html, raw } from 'hono/html'

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

  <link rel="stylesheet" href="/static/simple.css">
  <script src="/static/htmx.min.js"></script>
</head>

<body style="grid-template-columns: 1fr min(60rem,90%) 1fr;">
  <header>
    <strong>Minifeed</strong>
    <a href="/my">My home</a>
    <a href="/all">All Posts</a>
    <a href="/feeds">Feeds</a>
  </header>
  <main>${inner}</main>
  <footer> Minifeed.net </footer>
</body></html>`
}