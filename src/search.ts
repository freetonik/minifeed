import { html, raw } from "hono/html";
import { renderHTML, renderItemSearchResult } from "./htmltools";

export const search = async (c) => {
  const q = c.req.query('q');

  const searchDocuments = {
    "searches": [
      {
        "collection": "blog_items",
        "q": q,
      },
      {
        "collection": "blog_feeds",
        "q": q,
      }
    ]
  }

  const init = {
    body: JSON.stringify(searchDocuments),
    method: "POST",
    headers: {
      "X-TYPESENSE-API-KEY": "G5t6CiQtDGFGW9XOOPWQRFhlXrtYvK6a",
      "Content-Type": "application/json"
    },
  };
  const response = await fetch("https://3afyidm6tgzxlvq7p-1.a1.typesense.net:443/multi_search?query_by=title,content", init);
  const results = await gatherResponse(response);
  const parsedReults = JSON.parse(results);

  let list = `<h2>Search results for '${q}'</h2>`
  parsedReults['results'][0]['hits'].forEach((item: any) => {
    list += renderItemSearchResult(item);    
  })
  return c.html(
      renderHTML(`${q} | minifeed`, html`${raw(list)}`, c.get('USERNAME'), 'search', q)
  )
}

export const indexMultipleDocuments = async (documents: object[]) => {
  console.log("indexing documents")
  const jsonlines = documents.map(item => JSON.stringify(item)).join('\n');
  const init = {
    body: jsonlines,
    method: "POST",
    headers: {
      "X-TYPESENSE-API-KEY": "G5t6CiQtDGFGW9XOOPWQRFhlXrtYvK6a",
      "Content-Type": "text/plain"
    },
  };
  try {
    const response = await fetch("https://3afyidm6tgzxlvq7p-1.a1.typesense.net:443/collections/blog_items/documents/import?action=create", init);
    const results = await gatherResponse(response);
    console.log(results)
  } catch (e) {
    console.log(e)
  }
}

/**
   * gatherResponse awaits and returns a response body as a string.
   * Use await gatherResponse(..) in an async function to get the response body
   * @param {Response} response
   */
async function gatherResponse(response) {
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
