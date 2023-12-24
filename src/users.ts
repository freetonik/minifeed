import { renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { idToSqid, sqidToId } from './utils'

export const usersAll = async (c) => {
  const userId = c.get('USER_ID') || "0";
  const { results } = await c.env.DB
    .prepare("SELECT * from users")
    .run();

  let list = `<div class="main">`
  results.forEach((user: any) => {
    list += `<div><a href="/users/${user.username}">${user.username}</a></div>`
  })
  list += "</div>"
  return c.html(renderHTML("All items", html`${raw(list)}`, c.get('USERNAME'), 'users'))
}

export const usersSingle = async (c) => {
  const userId = c.get('USER_ID') || "0";
  const username = c.req.param('username');
  const batch = await c.env.DB.batch([
    // who this user is and if he is followed by current user batch[0]
    c.env.DB.prepare(`
      SELECT users.user_id, users.username, followings.following_id
      FROM users
      LEFT JOIN followings on users.user_id = followings.followed_user_id 
      WHERE users.username = ?`).bind(username),

    // subscriptions batch[1]
    c.env.DB.prepare(`
      SELECT * 
      FROM feeds
      JOIN subscriptions on feeds.feed_id = subscriptions.feed_id
      JOIN users on subscriptions.user_id = users.user_id
      WHERE users.username = ?`).bind(username),

    // who this user follows (FOLLOWEDS) batch[2]
    c.env.DB.prepare(`
      SELECT b.username as followed 
      FROM users a 
      JOIN followings on a.user_id = followings.follower_user_id 
      JOIN users b on b.user_id = followings.followed_user_id 
      WHERE a.username = ?`).bind(username),

    // who this follows this user (FOLLOWERS) batch[3]
    c.env.DB.prepare(`
      SELECT b.username as follower FROM users a 
      JOIN followings on a.user_id = followings.followed_user_id 
      JOIN users b on b.user_id = followings.follower_user_id 
      WHERE a.username = ?`).bind(username),

    // favorites batch[4]
    c.env.DB.prepare(`
      SELECT items.item_id, items.feed_id, items.url, items.title, feeds.title as feed_title 
      FROM items
      JOIN favorites on items.item_id = favorites.item_id
      JOIN feeds on items.feed_id = feeds.feed_id
      JOIN users on favorites.user_id = users.user_id
      WHERE users.username = ?`).bind(username),
  ]);

  if (!batch[0].results.length) return c.notFound();

  const followButtonText = batch[0].results[0]['following_id'] ? "unfollow" : "follow";

  let list = `<h1>${username}</h1>`;
  if (userId != batch[0].results[0]['user_id']) { 
    list += `
    <span id="follow">
      <button hx-post="/users/${username}/${followButtonText}"
        hx-trigger="click"
        hx-target="#follow"
        hx-swap="outerHTML">
        ${followButtonText}
      </button>
    </span>`;
  } else {
    list += "<span>this is me</span>"
  }

  // user favorited these jabronis
  list += `<h2>Favorites:</h2>`
  batch[4].results.forEach((item: any) => {
    // list += `<li><a href="${fav.url}">${fav.title}</a></li>`
    list += renderItemShort(item.item_id, item.title, item.url, item.feed_title, item.feed_id)
    // const sqid = idToSqid(fav.feed_id)
    // list += `<li><a href="/feeds/${sqid}">${fav.title}</a></li>`
  })

  // user subscribed to these jabronis
  list += `<h2>Subscriptions:</h2>`
  batch[1].results.forEach((feed: any) => {
    const sqid = idToSqid(feed.feed_id)
    list += `<li><a href="/feeds/${sqid}">${feed.title}</a></li>`
  })

  // user follows these jabronis
  list += `<h2>Follows:</h2>`
  batch[2].results.forEach((user: any) => {
    list += `<li><a href="${user.followed}">${user.followed}</a></li>`
  })

  list += `<h2>Followers:</h2>`
  batch[3].results.forEach((user: any) => {
    list += `<li><a href="${user.follower}">${user.follower}</a></li>`
  })


  return c.html(renderHTML("All items", html`${raw(list)}`))

}

export const usersFollow = async (c) => {
  if (!c.get('USER_ID')) return c.html('');
  const userId = c.get('USER_ID');
  const username = c.req.param('username')

  const { results } = await c.env.DB.prepare(`SELECT users.user_id FROM users WHERE users.username = ?`).bind(username).all()
  const userIdToFollow = results[0]['user_id']

  let result
  try {
    result = await c.env.DB.prepare("INSERT INTO followings (follower_user_id, followed_user_id) values (?, ?)").bind(userId, userIdToFollow).run()
  } catch (err) {
    c.status(400);
    return c.body('bad request');
  }
  if (result.success) {
    c.status(201);
    return c.html(`
      <span id="follow">
        <button hx-post="/users/${username}/unfollow"
          hx-trigger="click"
          hx-target="#follow"
          hx-swap="outerHTML">
          unfollow
        </button>
      </span>
    `);
  }
  return c.html(`
      <span id="subscription">
        "Error"
      </span>
    `);
}

export const usersUnfollow = async (c) => {
  if (!c.get('USER_ID')) return c.html('');
  const userId = c.get('USER_ID');
  const username = c.req.param('username')

  const { results } = await c.env.DB.prepare(`SELECT users.user_id FROM users WHERE users.username = ?`).bind(username).all()
  const userIdToUnfollow = results[0]['user_id']

  let result
  try {
    await c.env.DB.prepare("DELETE FROM followings WHERE follower_user_id = ? AND followed_user_id = ?").bind(userId, userIdToUnfollow).run()
  } catch (err) {
    c.status(400);
    return c.html(`
      <span id="follow">
        "Error"
      </span>
    `);
  }
  c.status(201);
  return c.html(`
      <span id="follow">
        <button hx-post="/users/${username}/follow"
          hx-trigger="click"
          hx-target="#follow"
          hx-swap="outerHTML">
          follow
        </button>
      </span>
    `);
}