import { renderHTML, renderItemShort } from "./htmltools";
import { html, raw } from "hono/html";
import { feedIdToSqid } from "./utils";

export const usersHandler = async (c: any) => {
  const username = c.get("USERNAME");
  const { results } = await c.env.DB.prepare(
    "SELECT * from users ORDER BY created ASC",
  ).run();

  let list = `<div class="main">`;
  results.forEach((user: any) => {
    if (user.username == username)
      list += `<div><strong><a href="/users/${user.username}">${user.username}</a></strong> (this is me)</div>`;
    else
      list += `<div><a href="/users/${user.username}">${user.username}</a></div>`;
  });
  list += "</div>";
  return c.html(
    renderHTML("Users", html`${raw(list)}`, c.get("USERNAME"), "users"),
  );
};

export const usersSingleHandler = async (c: any) => {
  const userId = c.get("USER_ID") || "0";
  const currentUsername = c.get("USERNAME");

  const userLoggedIn = c.get("USER_ID") ? true : false;
  const username = c.req.param("username");
  const batch = await c.env.DB.batch([
    // who this user is and if he is followed by current user batch[0]
    c.env.DB.prepare(
      `
        SELECT users.user_id, users.username
        FROM users
        WHERE users.username = ?`,
    ).bind(username),

    // subscriptions batch[1]
    c.env.DB.prepare(
      `
        SELECT *
        FROM feeds
        JOIN subscriptions on feeds.feed_id = subscriptions.feed_id
        JOIN users on subscriptions.user_id = users.user_id
        WHERE users.username = ?`,
    ).bind(username),

    // who this user follows (FOLLOWEDS) batch[2]
    c.env.DB.prepare(
      `
        SELECT b.username as followed
        FROM users a
        JOIN followings on a.user_id = followings.follower_user_id
        JOIN users b on b.user_id = followings.followed_user_id
        WHERE a.username = ?`,
    ).bind(username),

    // who this follows this user (FOLLOWERS) batch[3]
    c.env.DB.prepare(
      `
        SELECT b.username as follower FROM users a
        JOIN followings on a.user_id = followings.followed_user_id
        JOIN users b on b.user_id = followings.follower_user_id
        WHERE a.username = ?`,
    ).bind(username),

    // favorites batch[4]
    c.env.DB.prepare(
      `
        SELECT items.item_sqid, items.feed_id, items.url, items.title, items.pub_date, feeds.title as feed_title, feeds.feed_sqid
        FROM items
        JOIN favorites on items.item_id = favorites.item_id
        JOIN feeds on items.feed_id = feeds.feed_id
        JOIN users on favorites.user_id = users.user_id
        WHERE users.username = ?`,
    ).bind(username),
  ]);

  if (!batch[0].results.length) return c.notFound();

  let list = "";

  // user favorited these jabronis
  list += `<h2>Favorites:</h2>`;
  if (!batch[4].results.length) list += `<p><i>None yet</i></p>`;
  batch[4].results.forEach((item: any) => {
    list += renderItemShort(
      item.item_sqid,
      item.title,
      item.url,
      item.feed_title,
      item.feed_sqid,
      item.pub_date,
    );
  });

  // user subscribed to these jabronis
  list += `<hr><h2>Subscriptions:</h2>`;
  if (!batch[1].results.length) list += `<p><i>None yet</i></p>`;
  batch[1].results.forEach((feed: any) => {
    const sqid = feedIdToSqid(feed.feed_id);
    list += `<li><a href="/blogs/${sqid}">${feed.title}</a></li>`;
  });

  // user follows these jabronis
  list += `<hr><h2>Follows:</h2>`;
  if (!batch[2].results.length) list += `<p><i>None yet</i></p>`;
  batch[2].results.forEach((user: any) => {
    list += `<li><a href="${user.followed}">${user.followed}</a></li>`;
  });

  list += `<hr><h2>Followers:</h2>`;
  let followButtonText = "follow";
  if (!batch[3].results.length) list += `<p><i>None yet</i></p>`;
  batch[3].results.forEach((user: any) => {
    followButtonText =
      user.follower === currentUsername ? "unfollow" : "follow";
    list += `<li><a href="${user.follower}">${user.follower}</a></li>`;
  });

  let top_block = `<h1>@${username}</h1>`;

  if (userLoggedIn) {
    if (userId != batch[0].results[0]["user_id"]) {
      top_block += `
            <span id="follow">
            <button hx-post="/users/${username}/${followButtonText}"
            hx-trigger="click"
            hx-target="#follow"
            hx-swap="outerHTML">
            ${followButtonText}
            </button>
            </span><hr>`;
    } else {
      top_block += `<div class="flash flash-blue">This is your public profile (<a href="/my/account">account settings</a>)</div>`;
    }
  } else {
    top_block += `<p><i>Once logged in, you'll be able to follow users and read their feeds on your home page.</i></p>`;
  }

  list = top_block + list;

  return c.html(
    renderHTML(
      `${username} | minifeed`,
      html`${raw(list)}`,
      c.get("USERNAME"),
      "users",
    ),
  );
};

export const usersFollowPostHandler = async (c: any) => {
  if (!c.get("USER_ID")) return c.html("");
  const userId = c.get("USER_ID");
  const username = c.req.param("username");

  const { results } = await c.env.DB.prepare(
    `SELECT users.user_id FROM users WHERE users.username = ?`,
  )
    .bind(username)
    .all();
  const userIdToFollow = results[0]["user_id"];

  let result;
  try {
    result = await c.env.DB.prepare(
      "INSERT INTO followings (follower_user_id, followed_user_id) values (?, ?)",
    )
      .bind(userId, userIdToFollow)
      .run();
  } catch (err) {
    c.status(400);
    return c.body("bad request");
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
};

export const usersUnfollowPostHandler = async (c: any) => {
  if (!c.get("USER_ID")) return c.html("");
  const userId = c.get("USER_ID");
  const username = c.req.param("username");

  const { results } = await c.env.DB.prepare(
    `SELECT users.user_id FROM users WHERE users.username = ?`,
  )
    .bind(username)
    .all();
  const userIdToUnfollow = results[0]["user_id"];

  try {
    await c.env.DB.prepare(
      "DELETE FROM followings WHERE follower_user_id = ? AND followed_user_id = ?",
    )
      .bind(userId, userIdToUnfollow)
      .run();
  } catch (err) {
    c.status(400);
    return c.html(` <span id="follow"> "Error" </span> `);
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
};
