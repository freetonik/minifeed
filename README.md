```
npm install
npm run dev
```

```
npm run deploy
```

### TODO
- [ ] properly parse atom vs rss2.0
- [ ] show origin of item in listing (from my subs vs. from followings), see 'origin of item' below
- [x] queues
- [x] cron jobs to refresh feeds
- [ ] auto tagging of items
- [ ] feed tags from item tags

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