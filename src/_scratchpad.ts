// =================================
// check subscription on single page
// =================================
// export const itemsSingle = async (c:any) => {
//   const item_id:number = itemSqidToId(c.req.param('item_sqid'))
//   const userId = c.get('USER_ID') || -1;

//   const batch = await c.env.DB.batch([
//     // find subscription status of user to this feed
//     c.env.DB.prepare(`
//       SELECT subscriptions.subscription_id 
//       FROM subscriptions 
//       JOIN items ON subscriptions.feed_id = items.feed_id 
//       WHERE subscriptions.user_id = ? AND items.item_id = ?`).bind(userId, item_id),

//     // find item
//     c.env.DB.prepare(`
//       SELECT items.item_id, items.title AS item_title, items.description, items.content_html, items.pub_date, items.url AS item_url, feeds.title AS feed_title, feeds.feed_id FROM items 
//       JOIN feeds ON items.feed_id = feeds.feed_id 
//       WHERE items.item_id = ? 
//       ORDER BY items.pub_date DESC`).bind(item_id),
//   ]);

//   const userIsSubscribed = batch[0].results.length ? true : false;
//   const userLoggedIn = userId != -1;
//   if (!batch[1].results.length) return c.notFound();

//   const item = batch[1].results[0];
//   const dateFormatOptions:Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', };
//   const postDate = new Date(item.pub_date).toLocaleDateString('en-UK', dateFormatOptions)
//   const feedSqid = feedIdToSqid(item.feed_id)

//   let contentBlock;
//   if (userLoggedIn) {
//     contentBlock = raw(item.content_html)
//   }
//   else {
//     contentBlock = `${truncate(item.description, 250)} <p>Log in and subscribe to the feed to this feed to view full content</p>`;
//   }
  
//   let list = `<h1>${item.item_title}</h1>`
//   let subscriptionBlock = userIsSubscribed ? `subscribed` : `not subscribed`
//   list += `
//     <div>
//       from <a href="/feeds/${feedSqid}"">${item.feed_title}</a> (${subscriptionBlock})
//     </div>
//     <hr style="margin-top:1em;">
//     <div class="post-content">${contentBlock}
//     <p style="text-align:right; font-size:smaller; margin-top:1em;">
//       <time>${postDate}</time> (<a href="${item.item_url}">original</a>)
//     </p>
//     </div>
//   `
//   return c.html(renderHTML(
//     `${item.item_title} | ${item.feed_title} | minifeed`, 
//     html`${raw(list)}`,
//     c.get('USERNAME'),
//     'items',
//     '',
//     item.item_url
//     ))
// }


// #### Origin of item
// ```
// SELECT items.item_id, items.title, items.url, 'placeholder' AS followed_user_id
// FROM items
// JOIN subscriptions ON items.feed_id = subscriptions.feed_id
// WHERE subscriptions.user_id = ?

// UNION

// SELECT items.item_id, items.title, items.url, followings.followed_user_id
// FROM items
// JOIN subscriptions ON items.feed_id = subscriptions.feed_id
// JOIN followings ON subscriptions.user_id = followings.followed_user_id
// WHERE followings.follower_user_id = ?

// ```

// #### Getting CDATA content via custom parser

// ```
// const r = await extract(rssUrl, {
// 		descriptionMaxLen: 0,
// 		getExtraEntryFields: (feedEntry) => {
// 			const { description: content } = feedEntry
// 			return {
// 			  content,
// 			}
// 		}
// 	});
// ```

// #### MAE service

// ```
// let req;
//   const maeServiceUrl = `https://mae.deno.dev/?apikey=ZKQABMTSZCHMXEPGZMRKOXWODWELAVLN&url=${item.item_url}`
//   <!-- https://mae.deno.dev/?apikey=ZKQABMTSZCHMXEPGZMRKOXWODWELAVLN&url=https://antonz.org/go-1-22/ -->
//   try {
// 		req = await fetch(maeServiceUrl);
// 	} catch (err) {
// 		throw new Error(`Cannot fetch url: ${maeServiceUrl}`)
// 	}
// 	const articleInfo = await req.text();
//   const content = JSON.parse(articleInfo).data.content;

//   list += html`${raw(content)}`
//   ```