import { renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const itemsAll = async (c) => {
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

  let list = `<h1>Global stuff</h1>`
  results.forEach((item: any) => {
    list += renderItemShort(item.item_id, item.item_title, item.item_url, item.feed_title, item.feed_id, item.pub_date)
  })
  list += `<p>page ${page} / <a href="?p=${page+1}">More</a></p>`
  return c.html(renderHTML("Global stuff | minifeed", html`${raw(list)}`, c.get('USERNAME')))
}

// // MY HOME FEED: subs + follows
export const itemsMy = async (c) => {
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

  let list = ``
  results.forEach((item: any) => {
    list += renderItemShort(item.item_id, item.title, item.url, item.feed_title, item.feed_id)
  })
  list += `<p><a href="?p=${page+1}">More</a></p>`
  return c.html(renderHTML("My stuff | minifeed", html`${raw(list)}`))
}

export const itemsMySubs = async (c) => {
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

  let list = `<h1>From my subscriptions</h1>`
  results.forEach((item: any) => {
    list += renderItemShort(item.item_id, item.title, item.url, item.feed_title, item.feed_id, item.pub_date)
  })
  list += `<p><a href="?p=${page+1}">More</a></p>`
  return c.html(renderHTML("From my subscriptions", html`${raw(list)}`))
}

export const itemsMyFollows = async (c) => {
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

  let list = `<h1>From my follows</h1>`
  results.forEach((item: any) => {
    list += `<li><a href="${item.url}">${item.title}</a> (${item.feed_title})</li>`
  })
  return c.html(renderHTML("From my follows", html`${raw(list)}`))
}

export const itemsSingle = async (c) => {
  const item_id = parseInt(sqidToId(c.req.param('item_sqid'), 10), 10);
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title AS item_title, items.content, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.feed_id FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id 
      WHERE items.item_id = ? 
      ORDER BY items.pub_date DESC`
    )
    .bind(item_id)
    .run();

  if (!results.length) return c.notFound();

  const item = results[0];
  const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };
  const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)
  const feedSqid = idToSqid(item.feed_id)
  let list = `<h1>${item.item_title}</h1><p><time>${postDate}</time></p>`
  list += `
    from <a href="/feeds/${feedSqid}"">${item.feed_title}</a>
    <div class="post-content">${item.content}</div>
  `
  return c.html(renderHTML("All items", html`${raw(list)}`))
}