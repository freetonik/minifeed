import { html, raw } from "hono/html";
import { renderHTML, renderItemSearchResult } from "./htmltools";

export const search = async (c:any) => {
  const q = c.req.query('q');
  
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
  const response = await fetch(`https://${c.env.TYPESENSE_CLUSTER}:443/multi_search?per_page=${itemsPerPage}&page=${page}&query_by=title,content`, init);
  const results = await gatherResponse(response);
  const parsedResults = JSON.parse(results);

  console.log(parsedResults)
  const hasNextPage = parsedResults['results'][0]['found'] > (page * itemsPerPage)

  let list = `<h2>Search results for '${q}'</h2>`
  if (!parsedResults['results'][0]['hits'].length) list += `<p><i>No results found</i></p>`
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

export const indexMultipleDocuments = async (env:any, documents: object[]) => {
  const jsonlines = documents.map(item => JSON.stringify(item)).join('\n');
  const init = {
    body: jsonlines,
    method: "POST",
    headers: {
      "X-TYPESENSE-API-KEY": env.TYPESENSE_API_KEY,
      "Content-Type": "text/plain"
    },
  };
  
  let results;
  try {
    const response = await fetch(`https://${env.TYPESENSE_CLUSTER}:443/collections/${env.TYPESENSE_ITEMS_COLLECTION}/documents/import?action=create`, init);
    results = await gatherResponse(response);
  } catch (e) {
    console.log(`Error while indexing documents: ${e}`)
  }
}

/**
   * gatherResponse awaits and returns a response body as a string.
   * Use await gatherResponse(..) in an async function to get the response body
   * @param {Response} response
   */
async function gatherResponse(response: Response) {
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json());
  } else if (contentType.includes("application/text")) {
    return response.text();
  } else if (contentType.includes("text/html")) {
    return response.text();
  } else {
    return response.text();
  }
}
