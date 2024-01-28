import { renderHTML, renderItemShort } from './htmltools';
import { html, raw } from 'hono/html'
import { feedIdToSqid, itemSqidToId } from './utils'
import { truncate } from 'bellajs'

export const itemsAll = async (c:any) => {
  const userId = c.get('USER_ID') || -1;
  const itemsPerPage = 30
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.pub_date, items.title AS item_title, items.url AS item_url, feeds.feed_id, feeds.title AS feed_title, favorite_id
      FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      ORDER BY items.pub_date DESC
      LIMIT ? OFFSET ?`)
    .bind(userId, itemsPerPage, offset)
    .run();

  let list = `<p></p>`;
  
  if (!results.length) list += `<p><i>Nothing exists on minifeed yet...</i></p>`

  results.forEach((item: any) => {
    const itemTitle = item.favorite_id ? `★ ${item.item_title}` : item.item_title;
    list += renderItemShort(item.item_id, itemTitle, item.item_url, item.feed_title, item.feed_id, item.pub_date)
  })

  if (results.length) list += `<a href="?p=${page + 1}">More</a></p>`
  return c.html(
    renderHTML("Everything | minifeed", html`${raw(list)}`, c.get('USERNAME'), 'all')
  )
}

// // MY HOME FEED: subs + follows
export const itemsMy = async (c:any) => {
  const itemsPerPage = 30
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage

  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id, favorite_id
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      WHERE subscriptions.user_id = ?

      UNION

      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id, favorite_id  
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      WHERE followings.follower_user_id = ?

      ORDER BY items.pub_date DESC

      LIMIT ? OFFSET ?
      `)
    .bind(userId, userId, userId, userId, itemsPerPage, offset)
    .all();

  let list = `<nav class="my-menu"><small><a href="/my" class="active">all</a> / <a href="/my/subs">from subscriptions</a> / <a href="/my/follows">from follows</a></small></nav>
    <div class="main">`
  if (results.length) {
    
    results.forEach((item: any) => {
      let title = item.favorite_id ? `★ ${item.title}` : item.title;
      list += renderItemShort(item.item_id, title, item.url, item.feed_title, item.feed_id, item.pub_date)
    })
    list += `<p><a href="?p=${page + 1}">More</a></p></div>`
  } else {
    if (page == 1) {

      list += `Your home is empty :-( <br>Subscribe to some <strong><a href="/feeds">feeds</a></strong> or follow some <strong><a href="/users">users</a></strong>.`
    }

    list += ` </div>`
  }

  return c.html(renderHTML("My stuff | minifeed", html`${raw(list)}`, c.get('USERNAME'), 'my'))
}

export const itemsMySubs = async (c:any) => {
  const itemsPerPage = 30
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage

  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id, favorite_id
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      WHERE subscriptions.user_id = ?
      ORDER BY items.pub_date DESC
      LIMIT ? OFFSET ?
      `)
    .bind(userId, userId, itemsPerPage, offset)
    .all();

  let list = `<nav class="my-menu"><small><a href="/my">all</a> / <a class="active" href="/my/subs">from subscriptions</a> / <a href="/my/follows">from follows</a></small></nav>
    <div class="main">`
  if (results.length) {
    results.forEach((item: any) => {
      let title = item.favorite_id ? `★ ${item.title}` : item.title;
      list += renderItemShort(item.item_id, title, item.url, item.feed_title, item.feed_id, item.pub_date)
    })
    list += `<p><a href="?p=${page + 1}">More</a></p></div>`
  } else {
    if (page == 1) {
      list += `Your have no subscriptions :-( <br>Subscribe to some <strong><a href="/feeds">feeds</a></strong>.`
    }
    list += `</div>`
    
  }
  return c.html(renderHTML(
    "From my subscriptions", 
    html`${raw(list)}`,
    c.get('USERNAME'),
    'my'
    ))
}

export const itemsMyFollows = async (c:any) => {
  const itemsPerPage = 30
  const page = Number(c.req.query('p')) || 1
  const offset = (page * itemsPerPage) - itemsPerPage

  const userId = c.get('USER_ID')
  const { results } = await c.env.DB
    .prepare(`
      SELECT items.item_id, items.title, items.url, items.pub_date, feeds.title AS feed_title, feeds.feed_id as feed_id, favorite_id
      FROM items
      JOIN subscriptions ON items.feed_id = subscriptions.feed_id
      JOIN feeds ON items.feed_id = feeds.feed_id
      JOIN followings ON subscriptions.user_id = followings.followed_user_id
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      WHERE followings.follower_user_id = ?
      ORDER BY items.pub_date DESC
      LIMIT ? OFFSET ?
      `)
    .bind(userId, userId, itemsPerPage, offset)
    .all();

  let list = `<nav class="my-menu"><small><a href="/my">all</a> / <a href="/my/subs">from subscriptions</a> / <a class="active" href="/my/follows">from follows</a></small></nav>
    <div class="main">`
  if (results.length) {
    results.forEach((item: any) => {
      const title = item.favorite_id ? `★ ${item.title}` : item.title;
      list += renderItemShort(item.item_id, title, item.url, item.feed_title, item.feed_id, item.pub_date)
    })
    list += `<p><a href="?p=${page + 1}">More</a></p></div>`
  } else {
    if (page == 1) {
      list += `Your don't follow anyone, or you do, but they aren't subscribed to anything :-( <br> Go find some <strong><a href="/users">users to follow</a></strong>`
    }
  }

  return c.html(renderHTML("From my follows", html`${raw(list)}`, c.get('USERNAME'), 'my'))
}

export const itemsSingle = async (c:any) => {
  const item_sqid = c.req.param('item_sqid');
  const item_id:number = itemSqidToId(item_sqid)
  const user_id = c.get('USER_ID') || -1;
  const user_logged_in = user_id != -1;

  const batch = await c.env.DB.batch([
    // find subscription status of user to this feed
    c.env.DB.prepare(`
        SELECT subscriptions.subscription_id 
        FROM subscriptions 
        JOIN items ON subscriptions.feed_id = items.feed_id 
        WHERE subscriptions.user_id = ? AND items.item_id = ?`)
      .bind(user_id, item_id),

    // find item
    c.env.DB.prepare(`
      SELECT 
        items.item_id, 
        items.title AS item_title, 
        items.description, 
        items.content_html, 
        items.content_html_scraped,
        items.pub_date, 
        items.url AS item_url, 
        feeds.title AS feed_title, 
        feeds.feed_id, 
        favorite_id 
      FROM items 
      JOIN feeds ON items.feed_id = feeds.feed_id 
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      WHERE items.item_id = ? 
      ORDER BY items.pub_date DESC`)
      .bind(user_id, item_id),

    // find other items from this feed
    c.env.DB.prepare(`
      WITH FeedInfo AS (
        SELECT feed_id
        FROM items
        WHERE item_id = ?
    )
      SELECT 
        items.item_id, 
        items.title AS item_title, 
        items.description, 
        items.pub_date, 
        items.url AS item_url, 
        items.feed_id,
        favorite_id 
      FROM items 
      JOIN FeedInfo fi ON items.feed_id = fi.feed_id
      LEFT JOIN favorites ON items.item_id = favorites.item_id AND favorites.user_id = ?
      WHERE items.item_id != ? 
      ORDER BY items.pub_date DESC
      LIMIT 5`)
      .bind(item_id, user_id, item_id)
  ]);

  if (!batch[1].results.length) return c.notFound();
  
  const user_is_subscribed = batch[0].results.length ? true : false;

  const item = batch[1].results[0];
  const date_format_opts:Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', };
  const post_date = new Date(item.pub_date).toLocaleDateString('en-UK', date_format_opts)
  const feed_sqid = feedIdToSqid(item.feed_id)

  let contentBlock;
  if (user_logged_in) {
    if (item.content_html) {
      if (item.content_html_scraped) {
        if (item.content_html.length > item.content_html_scraped.length * 0.65) {
          contentBlock = raw(item.content_html)
        } else {
          contentBlock = raw(item.content_html_scraped)
        }
      } else {
        contentBlock = raw(item.content_html)
      }
    }
    else contentBlock = item.description
  }
  else contentBlock = `${truncate(item.description, 250)} <div class="flash-blue"><a href="/login">Log in</a> to view full content</div>`;
  
  let favoriteBlock = '';
  let subscriptionBlock = '';
  
  if (user_logged_in) {
    if (item.favorite_id) {
      favoriteBlock = 
        `<span id="favorite">
          <button hx-post="/items/${item_sqid}/unfavorite"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ★ unfavorite
          </button>
        </span>`
    } else {
      favoriteBlock = 
        `<span id="favorite">
          <button hx-post="/items/${item_sqid}/favorite"
            hx-trigger="click"
            hx-target="#favorite"
            hx-swap="outerHTML">
            ☆ favorite
          </button>
        </span>`
    }
      
    if (user_is_subscribed) {
      subscriptionBlock = `
        <span id="subscription">
        <button hx-post="/feeds/${feed_sqid}/unsubscribe"
          hx-trigger="click"
          hx-target="#subscription"
          hx-swap="outerHTML">
          unsubscribe
        </button>
      </span>`
    } else {
      subscriptionBlock = `
      <span id="subscription">
      <button hx-post="/feeds/${feed_sqid}/subscribe"
        hx-trigger="click"
        hx-target="#subscription"
        hx-swap="outerHTML">
        subscribe
      </button>
    </span>`
    }
  }

  let otherItemsBlock = '';
  if (batch[2].results.length) {
    otherItemsBlock += `<div class="related-items"><h3>More from <a href="/feeds/${feed_sqid}"">${item.feed_title}</a>:</h3>`
      batch[2].results.forEach((related_item: any) => {
        otherItemsBlock += `<div class="related-item">`
        const itemTitle = related_item.favorite_id ? `★ ${related_item.item_title}` : related_item.item_title;
        otherItemsBlock += renderItemShort(related_item.item_id, itemTitle, related_item.item_url, '', related_item.feed_id, related_item.pub_date, truncate(related_item.description, 350));
        otherItemsBlock += `</div>`
      })
    otherItemsBlock += `</div>`
  }
      
  let list = `
    <h1 style="margin-bottom: 0.25em;">${item.item_title} </h1>
    <div style="margin-bottom:1.25em;"><small>from <a href="/feeds/${feed_sqid}"">${item.feed_title}</a>, <time>${post_date}</time></small></div>

    <a class="button" href="${item.item_url}" target="_blank">↗ open original</a>
    ${favoriteBlock}
    <hr>
    <div class="post-content">
    ${contentBlock}
    
    </div>

    
    ${otherItemsBlock}
  `

  if (c.get('USER_ID') == 1) {
    const show_content_html_over_scraped = (item.content_html && item.content_html_scraped) && (item.content_html.length > item.content_html_scraped.length * 0.65);
    let show_content_html_over_scraped_block = 'not applicable';
    if (item.content_html_scraped && show_content_html_over_scraped) show_content_html_over_scraped_block = `yes`
    else if (item.content_html_scraped && !show_content_html_over_scraped) show_content_html_over_scraped_block = `no`;
    list += `
    <div class="admin-control">
    <table>
      <tr>
        <td>Item ID:</td>
        <td>${item.item_id}</td>
      </tr>
      <tr>
        <td>Item sqid:</td>
        <td>${item_sqid}</td>
      </tr>
      <tr>
        <td>Item url:</td>
        <td>${item.item_url}</td>
      </tr>
      <tr>
        <td>Length of description:</td>
        <td>${item.description ? item.description.length : 0}</td>
      </tr>
      <tr>
        <td>Length of content_html:</td>
        <td>${item.content_html ? item.content_html.length : 0}</td>
      </tr>
      <tr>
        <td>Show content_html over scraped:</td>
        <td>${show_content_html_over_scraped_block}</td>
      </tr>
      <tr>
        <td>Scraped:</td>
        <td>${item.content_html_scraped ? 'yes' : 'no'}</td>
      </tr>
      <tr>
        <td>Length of content_html_scraped:</td>
        <td>${item.content_html_scraped ? item.content_html_scraped.length : "not applicable"}</td>
      </tr>
    </table>

    <p>
        <button hx-post="/items/${item_sqid}/scrape"
          hx-trigger="click"
          hx-target="#scrape-indicator"
          hx-swap="outerHTML">
          scrape
        </button>
        <span id="scrape-indicator"></span>
    </p>

    </div>
    `
  }

  return c.html(renderHTML(
    `${item.item_title} | ${item.feed_title} | minifeed`, 
    html`${raw(list)}`,
    c.get('USERNAME'),
    'feeds',
    '',
    item.item_url
    ))
}

export const itemsAddToFavorites = async (c:any) => {
  const itemSqid = c.req.param('item_sqid')
  const itemId:number = itemSqidToId(itemSqid)
  const userId = c.get('USER_ID');

  let result;
  try {
    console.log(`INSERT INTO favorites (user_id, itemId) VALUES (${userId}, ${itemId})`);
    result = await c.env.DB.prepare(`INSERT INTO favorites (user_id, item_id) VALUES (?, ?)`).bind(userId, itemId).run();
  } catch (e) {
    c.status(400);
    console.log(e)
    return c.body(e);
  }

  if (result.success) {
    c.status(201);
    return c.html(`
      <span id="favorite">
        <button hx-post="/items/${itemSqid}/unfavorite"
          hx-trigger="click"
          hx-target="#favorite"
          hx-swap="outerHTML">
          ★ unfavorite
        </button>
      </span>
    `);
  }

  return c.html(`
      <span id="favorite">
        "Error"
      </span>
    `);
}

export const itemsRemoveFromFavorites = async (c:any) => {
  const itemSqid = c.req.param('item_sqid')
  const itemId:number = itemSqidToId(itemSqid)
  const userId = c.get('USER_ID');

  let result;
  try {
    result = await c.env.DB.prepare(`DELETE FROM favorites WHERE user_id = ? AND item_id = ?`).bind(userId, itemId).run();
  } catch (e) {
    c.status(400);
    return c.body(e);
  }

  if (result.success) {
    c.status(201);
    return c.html(`
      <span id="favorite">
        <button hx-post="/items/${itemSqid}/favorite"
          hx-trigger="click"
          hx-target="#favorite"
          hx-swap="outerHTML">
          ☆ favorite
        </button>
      </span>
    `);
  }

  return c.html(`
      <span id="favorite">
        "Error"
      </span>
    `);
}

export const itemsScrape = async (c:any) => {
  const itemSqid = c.req.param('item_sqid')
  const itemId:number = itemSqidToId(itemSqid)
  
  await c.env.FEED_UPDATE_QUEUE.send(
    {
        'type': 'item_scrape',
        'item_id': itemId
    }
  );
  return c.html('Scrape queued...');
}