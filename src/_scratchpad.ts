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

// export const indexMultipleDocuments = async (env:any, documents: object[]) => {
//     const jsonlines = documents.map(item => JSON.stringify(item)).join('\n');
//     const init = {
//         body: jsonlines,
//         method: "POST",
//         headers: {
//             "X-TYPESENSE-API-KEY": env.TYPESENSE_API_KEY,
//             "Content-Type": "text/plain"
//         },
//     };

//     try {
//         const response = await fetch(`https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/import?action=create`, init);
//         await gatherResponse(response);
//     } catch (e) {
//         console.log(`Error while indexing documents: ${e}`)
//     }
// }

// export const upsertMultipleDocuments = async (env:any, documents: object[]) => {
//     const jsonlines = documents.map(item => JSON.stringify(item)).join('\n');
//     const init = {
//         body: jsonlines,
//         method: "POST",
//         headers: {
//             "X-TYPESENSE-API-KEY": env.TYPESENSE_API_KEY,
//             "Content-Type": "text/plain"
//         },
//     };

//     try {
//         const response = await fetch(`https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/import?action=upsert`, init);
//         await gatherResponse(response);
//     } catch (e) {
//         console.log(`Error while upserting documents: ${e}`)
//     }
// }

// export async function indexItemById(env: Bindings, item_id: Number) {
//     const { results: items } = await env.DB.prepare(
//         `SELECT items.title, feeds.type, items.content_html, items.description, items.content_html_scraped, items.url, items.pub_date, feeds.title as feed_title, items.feed_id
//         FROM items
//         JOIN feeds ON feeds.feed_id = items.feed_id
//         WHERE item_id = ?`
//         ).bind(item_id).all();


//     const item = items[0];
//     let content;
//     // prefer scraped content over content_html over description
//     if (item['content_html_scraped'] && item['content_html_scraped'].length > 0) {
//         content = stripTags(item['content_html_scraped'])
//     } else if (item['content_html'] && item['content_html'].length > 0) {
//         content = stripTags(item['content_html'])
//     } else {
//         content = item['description']
//     }

//     const searchDocument = {
//         'title': item['title'],
//         'content': collapseWhitespace(stripASCIIFormatting(content)),
//         'type': item['type'],
//         'item_id': item_id,
//         // non-searchable fields
//         'url': item['url'],
//         'pub_date': item['pub_date'],
//         'feed_id': item['feed_id'],
//         'feed_title': item['feed_title']
//     }
//     await indexMultipleDocuments(env, [searchDocument]);
// }
//
//
//
// app.get("/populate", async (c: any) => {
//   const feed_id = 1;
//   for (let i = 0; i < 1000; i++) {
//     const title =
//       (Math.random() + 1).toString(36).substring(7) +
//       " " +
//       (Math.random() + 1).toString(36).substring(7);

//     const url = `https://example.com/${title}`;
//     const pub_date = new Date().toISOString();
//     const description = title.repeat(
//       (Math.floor(Math.random() * 10) + 1) * Math.floor(Math.random() * 3) + 1,
//     );
//     const content_html = title.repeat(
//       (Math.floor(Math.random() * 100) + 1) * Math.floor(Math.random() * 10) +
//         1,
//     );

//     const insert_results = await c.env.DB.prepare(
//       "INSERT INTO items (feed_id, title, url, pub_date, description, content_html) values (?, ?, ?, ?, ?, ?)",
//     )
//       .bind(feed_id, title, url, pub_date, description, content_html)
//       .run();

//     const item_id = insert_results.meta.last_row_id;
//     const item_sqid = itemIdToSqid(item_id);
//     await c.env.DB.prepare("UPDATE items SET item_sqid = ? WHERE item_id = ?")
//       .bind(item_sqid, item_id)
//       .run();
//   }
//   return c.html(
//     renderHTML(
//       "!",
//       raw(`<div class="flash flash-blue">Done.</div>`),
//       c.get("USERNAME"),
//     ),
//   );
// });
