# Minifeed.net

Community curated RSS reader.

## Development

### Local development

Env variables are in `.dev.vars`

```
npm install
npm run dev
npm run dev-remote
```

### Migrations

```
npx wrangler d1 migrations create minifeed --local
npx wrangler d1 migrations apply minifeed --local
npx wrangler d1 migrations list minifeed --local
```

### Deployment

```
npm run deploy
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
- [ ] custom 404 pages
- [ ] click to add note
- [x] full-text search
- [x] search form and pretty results
- [ ] refactor rendering functions
- [ ] decide whether: 
    1. parse RSS better by getting content and description separately; content is optional in feeds; sometimes description is encoded
    2. get each article content separately via extractus (probably better idea, because this is needed anyway + will result in better search; this requires stripping HTML tags from the doc though); but this doesn't always work, see https://antonz.org/go-1-22/ for example
- [ ] request for post, voted and commented by users
- [ ] download images?
- [x] summary for posts
