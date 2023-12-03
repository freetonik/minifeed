import { renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const itemsAll = async (c) => {
  // const user = c.get('USER_ID')
  // return c.text(`User: ${user}`)
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title 
      FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id`)
    .run();

  let list = `<h1>All items</h1>`
  results.forEach((item: any) => {
    list += renderItemShort(item.item_title, item.item_url, item.feed_title, item.feed_id)
  })
  return c.html(renderHTML("All items", html`${raw(list)}`))
}

// // MY HOME FEED: subs + follows
export const itemsMy = async (c) => {
  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, feeds.title AS feed_title 
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      WHERE subscriptions.user_id = ?

      UNION

      SELECT items.item_id, items.title, items.url, feeds.title AS feed_title 
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      WHERE followings.follower_user_id = ?
      `)
    .bind(userId, userId)
    .all();

  let list = `<h1>All my items</h1>`
  results.forEach((item: any) => {
    list += `<li><a href="${item.url}">${item.title}</a> (${item.feed_title})</li>`
  })
  return c.html(renderHTML("All items", html`${raw(list)}`))
}

export const itemsMySubs = async (c) => {
  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, feeds.title AS feed_title 
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      WHERE subscriptions.user_id = ?
      `)
    .bind(userId)
    .all();

  let list = `<h1>From my subscriptions</h1>`
  results.forEach((item: any) => {
    list += `<li><a href="${item.url}">${item.title}</a> (${item.feed_title})</li>`
  })
  return c.html(renderHTML("From my subscriptions", html`${raw(list)}`))
}

export const itemsMyFollows = async (c) => {
  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, feeds.title AS feed_title
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      WHERE followings.follower_user_id = ?
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

  if (results.length === 0) return c.notFound();
  const item = results[0];
  const dateFormatOptions = {year: 'numeric', month: 'short', day: 'numeric', };

  const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)

  let list = `<h1>${item.item_title}</h1><p><time>${postDate}</time></p>`
  list += `<a href="${item.item_url}">${item.item_title}</a> / <a href="/i/${item.item_id}">read</a> </li><div class="post-content">${item.content}</div>`

  return c.html(renderHTML("All items", html`${raw(list)}`))
}