import { html, raw } from "hono/html";
import { renderHTML, renderItemSearchResult } from "./htmltools";
import { Bindings } from "./bindings";
import { collapseWhitespace, gatherResponse, stripASCIIFormatting, stripTags } from "./utils";

export const searchHandler = async (c:any) => {
    const q = c.req.query('q');

    // if query only contains spaces, return error
    if (!q || q.trim().length === 0) {
        return c.html(
            renderHTML(`Search | minifeed`, html`<div class="flash-red">Search query cannot be empty</div>`, c.get('USERNAME'), 'search', q)
        )
    }

    // if query is over 50 characters, return error
    if (q.length > 50) {
        return c.html(
            renderHTML(`Search | minifeed`, html`<div class="flash-red">Search query cannot be longer than 50 characters</div>`, c.get('USERNAME'), 'search', q)
        )
    }

    // if query is does not contain any letters, return error
    if (!q.match(/[a-zA-Z]/)) {
        return c.html(
            renderHTML(`Search | minifeed`, html`<div class="flash-red">Search query must contain at least one letter</div>`, c.get('USERNAME'), 'search', q)
        )
    }
    
    const itemsPerPage = 30
    const page = Number(c.req.query('p')) || 1
    
    const searchDocuments = {
        "searches": [
            {
                "collection": c.env.TYPESENSE_ITEMS_COLLECTION,
                "q": q,
            },
            {
                "collection": c.env.TYPESENSE_BLOG_FEEDS_COLLECTION,
                "q": q,
            }
        ]
    }
    
    const init = {
        body: JSON.stringify(searchDocuments),
        method: "POST",
        headers: {
            "X-TYPESENSE-API-KEY": c.env.TYPESENSE_API_KEY_SEARCH,
            "Content-Type": "application/json"
        },
    };
    let response = await fetch(`https://${c.env.TYPESENSE_CLUSTER}:443/multi_search?per_page=${itemsPerPage}&page=${page}&query_by=title, content&num_typos=0`, init);
    let results = await gatherResponse(response);
    let parsedResults = JSON.parse(results);
    
    const hasNextPage = parsedResults['results'][0]['found'] > (page * itemsPerPage)
    
    let list = `<h2>Search results for '${q}'</h2>`
    if (!parsedResults['results'][0]['hits'].length) {
        
        response = await fetch(`https://${c.env.TYPESENSE_CLUSTER}:443/multi_search?per_page=${itemsPerPage}&page=${page}&query_by=title,content`, init);
        results = await gatherResponse(response);
        parsedResults = JSON.parse(results);
        if (parsedResults['results'][0]['hits'].length) {
            list += `<div class="flash-blue">No exact results found. Below are potentially relevant results.</div>`;
        } else {
            list += `<div class="flash-blue">No results found</i></div>`;
        }
        
    }
    parsedResults['results'][0]['hits'].forEach((item: any) => {
        list += renderItemSearchResult(item);    
    });
    
    if (hasNextPage) {
        list += `<p><a href="/search?q=${q}&p=${page + 1}">More</a></p>`
    }
    
    return c.html(
        renderHTML(`${q} | minifeed`, html`${raw(list)}`, c.get('USERNAME'), 'search', q)
        )
    }

////////////////////////////////
// SEARCH INDEX MANAGEMENT /////
export const upsertSingleDocument = async (env: Bindings, document: object) => {
    const json = JSON.stringify(document);
    const init = {
        body: json,
        method: "POST",
        headers: {
            "X-TYPESENSE-API-KEY": env.TYPESENSE_API_KEY,
            "Content-Type": "application/json"
        },
    };
    
    try {
        const response = await fetch(`https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/import?action=upsert`, init);
        await gatherResponse(response);
    } catch (e) {
        console.log(`Error while upserting document: ${e}`)
    }
}
    
export const deleteFeedFromIndex = async (env: Bindings, feedId: number) => {
    const init = {
        method: "DELETE",
        headers: {
            "X-TYPESENSE-API-KEY": env.TYPESENSE_API_KEY
        },
    };
    
    let results;
    try {
        const response = await fetch(`https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/?filter_by=feed_id:=${feedId}`, init);
        results = await gatherResponse(response);
    } catch (e) {
        console.log(`Error while deleting feed from index: ${e}`)
    }
    
    return results;
}

// Upserts the search index for a single item
export async function updateItemIndex(env: Bindings, item_id: number) {
    type ItemsFeedsRowPartial = {
        title: string;
        type: string;
        content_html: string;
        description: string;
        content_html_scraped: string;
        url: string;
        pub_date: string;
        feed_title: string;
        feed_id: number;
    }
    const { results: items } = await env.DB.prepare(
        `SELECT items.title, feeds.type, items.content_html, items.description, items.content_html_scraped, items.url, items.pub_date, feeds.title as feed_title, items.feed_id
        FROM items 
        JOIN feeds ON feeds.feed_id = items.feed_id
        WHERE item_id = ?`
        ).bind(item_id).all<ItemsFeedsRowPartial>();
        
    const item = items[0];
    let content;
    // prefer scraped content over content_html over description
    if (item['content_html_scraped'] && item['content_html_scraped'].length > 0) content = stripTags(item['content_html_scraped'])
    else if (item['content_html'] && item['content_html'].length > 0)            content = stripTags(item['content_html'])
    else                                                                         content = item['description'];

    const searchDocument = {
        // we provide explicit id so it will be used as id in the typesense index
        'id': item_id.toString(),
        // searchable fields
        'title': item['title'],
        'content': collapseWhitespace(stripASCIIFormatting(content)),
        'type': item['type'],
        // non-searchable fields
        'url': item['url'],
        'pub_date': item['pub_date'],
        'feed_id': item['feed_id'],
        'feed_title': item['feed_title']
    }

    await upsertSingleDocument(env, searchDocument);
}

// at some point we need to use bulk indexing, but it needs to be controllable with up to 40 documents per request
export async function updateFeedIndex(env: Bindings, feed_id: number) {
    type ItemsRowPartial = {
        item_id: number;
    }
    const { results: items } = await env.DB.prepare(`SELECT item_id FROM items WHERE feed_id = ?`).bind(feed_id).all<ItemsRowPartial>();
    for (const item of items) await updateItemIndex(env, item['item_id']);
}