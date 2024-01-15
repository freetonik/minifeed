import { renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { feedIdToSqid, itemSqidToId } from './utils'
import { truncate } from 'bellajs'

export const itemsAll = async (c:any) => {
  const itemsPerPage = 10
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title 
      FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id
      ORDER BY items.pub_date DESC
      LIMIT ? OFFSET ?`)
    .bind(itemsPerPage, offset)
    .run();

  if (!results.length) return c.notFound();

  let list = `<p></p>`
  results.forEach((item: any) => {
    list += renderItemShort(item.item_id, item.item_title, item.item_url, item.feed_title, item.feed_id, item.pub_date)
  })
  list += `<a href="?p=${page + 1}">More</a></p>`
  return c.html(
    renderHTML("Everything | minifeed", html`${raw(list)}`, c.get('USERNAME'), 'all')
  )
}

// // MY HOME FEED: subs + follows
export const itemsMy = async (c:any) => {
  const itemsPerPage = 10
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage

  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id 
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      WHERE subscriptions.user_id = ?

      UNION

      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id  
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      WHERE followings.follower_user_id = ?

      ORDER BY items.pub_date DESC

      LIMIT ? OFFSET ?
      `)
    .bind(userId, userId, itemsPerPage, offset)
    .all();

  let list = `<nav class="my-menu"><small><a href="/my" class="active">all</a> / <a href="/my/subs">from subscriptions</a> / <a href="/my/follows">from follows</a></small></nav>
    <div class="main">`
  if (results.length) {

    results.forEach((item: any) => {
      list += renderItemShort(item.item_id, item.title, item.url, item.feed_title, item.feed_id, item.pub_date)
    })
    list += `<p><a href="?p=${page + 1}">More</a></p></div>`
  } else {
    list += `Your home is empty :-( <br>Subscribe to some <strong><a href="/feeds">feeds</a></strong> or follow some <strong><a href="/users">users</a></strong>.
      </div>`
  }

  return c.html(renderHTML("My stuff | minifeed", html`${raw(list)}`, c.get('USERNAME'), 'my'))
}

export const itemsMySubs = async (c:any) => {
  const itemsPerPage = 10
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage

  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id  
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      WHERE subscriptions.user_id = ?
      ORDER BY items.pub_date DESC
      LIMIT ? OFFSET ?
      `)
    .bind(userId, itemsPerPage, offset)
    .all();

  let list = `<nav class="my-menu"><small><a href="/my">all</a> / <a class="active" href="/my/subs">from subscriptions</a> / <a href="/my/follows">from follows</a></small></nav>
    <div class="main">`
  if (results.length) {
    results.forEach((item: any) => {
      list += renderItemShort(item.item_id, item.title, item.url, item.feed_title, item.feed_id, item.pub_date)
    })
    list += `<p><a href="?p=${page + 1}">More</a></p></div>`
  } else {
    list += `Your have no subscriptions :-( <br>Subscribe to some <strong><a href="/feeds">feeds</a></strong>.</div>`
  }
  return c.html(renderHTML(
    "From my subscriptions", 
    html`${raw(list)}`,
    c.get('USERNAME'),
    'my'
    ))
}

export const itemsMyFollows = async (c:any) => {
  const itemsPerPage = 10
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage

  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      WHERE followings.follower_user_id = ?
      ORDER BY items.pub_date DESC
      `)
    .bind(userId)
    .all();

  let list = `<nav class="my-menu"><small><a href="/my">all</a> / <a href="/my/subs">from subscriptions</a> / <a class="active" href="/my/follows">from follows</a></small></nav>
    <div class="main">`
  if (results.length) {
    results.forEach((item: any) => {
      list += `<li><a href="${item.url}">${item.title}</a> (${item.feed_title})</li>`
    })
    list += `<p><a href="?p=${page + 1}">More</a></p></div>`
  } else {
    list += `Your don't follow anyone, or you do, but they aren't subscribed to anything :-( <br> Go find some <strong><a href="/users">users to follow</a></strong>`
  }

  return c.html(renderHTML("From my follows", html`${raw(list)}`, c.get('USERNAME'), 'my'))
}

export const itemsSingle = async (c:any) => {
  const item_id:number = itemSqidToId(c.req.param('item_sqid'))
  const userId = c.get('USER_ID') || -1;
  const userLoggedIn = userId != -1;

  const batch = await c.env.DB.batch([
    // find subscription status of user to this feed
    c.env.DB.prepare(`
      SELECT subscriptions.subscription_id 
      FROM subscriptions 
      JOIN items ON subscriptions.feed_id = items.feed_id 
      WHERE subscriptions.user_id = ? AND items.item_id = ?`).bind(userId, item_id),

    // find item
    c.env.DB.prepare(`
      SELECT items.item_id, items.title AS item_title, items.description, items.content_html, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.feed_id FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id 
      WHERE items.item_id = ? 
      ORDER BY items.pub_date DESC`).bind(item_id),
  ]);

  const userIsSubscribed = batch[0].results.length ? true : false;
  if (!batch[1].results.length) return c.notFound();

  const item = batch[1].results[0];
  const dateFormatOptions:Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', };
  const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)
  const feedSqid = feedIdToSqid(item.feed_id)

  let contentBlock;
  if (userLoggedIn) {
    contentBlock = raw(item.content_html)
  }
  else {
    contentBlock = `${truncate(item.description, 250)} <div class="flash-blue"><a href="/login">Log in</a> to view full content</div>`;
  }
  
  let list = `<h1>${item.item_title}</h1>`
  let subscriptionBlock = '';
  if (userLoggedIn) {
    if (userIsSubscribed) {
      subscriptionBlock = `(subscribed)`
    } else {
      subscriptionBlock = `(not subscribed)`
    }
  }
  list += `
    <div>
      from <a href="/feeds/${feedSqid}"">${item.feed_title}</a> ${subscriptionBlock}
    </div>
    <hr style="margin-top:1em;">
    <div class="post-content">${contentBlock}
    <p style="text-align:right; font-size:smaller; margin-top:1em;">
      <time>${postDate}</time> (<a href="${item.item_url}">original</a>)
    </p>
    </div>
  `
  return c.html(renderHTML(
    `${item.item_title} | ${item.feed_title} | minifeed`, 
    html`${raw(list)}`,
    c.get('USERNAME'),
    'items',
    '',
    item.item_url
    ))
}

