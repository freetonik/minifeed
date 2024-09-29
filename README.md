# Minifeed.net

Community curated RSS reader.

## Development

### Local development

Env variables are in `.dev.vars`

```
npm install
npm run dev
npm run dev-remote
npx wrangler tail
npm run unused-exports
```

### Migrations

```
npx wrangler d1 migrations create minifeed MIGR_NAME
npx wrangler d1 migrations apply minifeed --local
npx wrangler d1 migrations list minifeed --local
```

Removing a migration from the list of applied:

```
npx wrangler d1 execute minifeed --local --command="DELETE FROM d1_migrations WHERE id=2"
```

### Show table info

`SELECT * FROM sqlite_schema WHERE name='favorites'`
`PRAGMA foreign_key_list('favorites');`

### Sessions

```
npx wrangler kv key list --binding SESSIONS_KV --local
npx wrangler kv key get "319dcbbb68883cda" --binding SESSIONS_KV --text --local
```



### Deployment

```
npm run deploy
npx wrangler d1 migrations list minifeed --local
npx wrangler d1 execute minifeed --local --file=./data/fake_data.sql
npx wrangler d1 execute minifeed --local --command="SELECT * FROM Items"

npx wrangler d1 execute minifeed --command="SELECT COUNT(item_id) FROM Items"
```

### Subdomains

```
npx wrangler dev src/index.ts --host slugger.localhost.dev
```

### TODO
- [x] properly parse atom vs rss2.0
- [x] queues
- [x] cron jobs to refresh feeds
- [ ] auto tagging of items
- [ ] feed tags from item tags
- [x] favorite items
- [x] pagination
- [x] user sign up
- [ ] youtube channels
- [x] custom 404 pages
- [ ] click to add note
- [x] full-text search
- [x] search form and pretty results
- [ ] refactor rendering functions
- [x] don't show items in lists until they have sqids
- [x] decide whether:
    1. parse RSS better by getting content and description separately; content is optional in feeds; sometimes description is encoded
    2. get each article content separately via extractus (probably better idea, because this is needed anyway + will result in better search; this requires stripping HTML tags from the doc though); but this doesn't always work, see https://antonz.org/go-1-22/ for example
- [ ] request for post, voted and commented by users
- [ ] download images?
- [x] summary for posts
- [x] get blog description from RSS feed (optionally)
- [x] validate feed before adding it:
  - has title
  - has entries
  - entry has link
- [ ] re-check typesense api keys leak
- [x] add posts to feed manually
- [ ] index post after adding posts to feed manually

### TODO: remove uniqueness constraint from items url

```
npx wrangler d1 execute minifeed --local --command="CREATE TABLE IF NOT EXISTS items2 ( item_id INTEGER PRIMARY KEY, created TIMESTAMP DEFAULT CURRENT_TIMESTAMP, feed_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, content_html TEXT, content_html_scraped TEXT, url TEXT NOT NULL, pub_date TIMESTAMP, FOREIGN KEY(feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE );"

npx wrangler d1 execute minifeed --local --command="INSERT INTO items2 SELECT * FROM items;"

npx wrangler d1 execute minifeed --local --command="SELECT * from items2"

npx wrangler d1 execute minifeed --command="ALTER TABLE items RENAME TO items_old;"
npx wrangler d1 execute minifeed --command="ALTER TABLE items2 RENAME TO items;"
```
