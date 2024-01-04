```
npm install
npm run dev
npm run dev-remote
```

```
npm run deploy
```

### TODO
- [x] properly parse atom vs rss2.0
- [x] queues
- [x] cron jobs to refresh feeds
- [ ] auto tagging of items
- [ ] feed tags from item tags
- [ ] favorite items
- [x] pagination
- [x] user sign up
- [ ] youtube channels
- [ ] adding custom missing pages
- [ ] click to add note
- [x] full-text search
- [ ] search form and pretty results
- [ ] refactor rendering functions
- [ ] decide whether: 
    1. parse RSS better by getting content and description separately; content is optional in feeds; sometimes description is encoded
    2. get each article content separately via extractus (probably better idea, because this is needed anyway + will result in better search; this requires stripping HTML tags from the doc though); but this doesn't always work, see https://antonz.org/go-1-22/ for example
- [ ] request for post, voted and commented by users

### Maybe
- [ ] show origin of item in listing (from my subs vs. from followings), see 'origin of item' below

#### Origin of item
```
SELECT items.item_id, items.title, items.url, 'placeholder' AS followed_user_id
FROM items
JOIN subscriptions ON items.feed_id = subscriptions.feed_id
WHERE subscriptions.user_id = ?

UNION

SELECT items.item_id, items.title, items.url, followings.followed_user_id
FROM items
JOIN subscriptions ON items.feed_id = subscriptions.feed_id
JOIN followings ON subscriptions.user_id = followings.followed_user_id
WHERE followings.follower_user_id = ?

```

#### Getting CDATA content via custom parser

```
const r = await extract(rssUrl, {
		descriptionMaxLen: 0,
		getExtraEntryFields: (feedEntry) => {
			const { description: content } = feedEntry
			return {
			  content,
			}
		}
	});
```