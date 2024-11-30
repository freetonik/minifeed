import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderFeedSearchResult, renderHTML, renderItemSearchResult } from '../../htmltools';
import type { FeedSearchResult, ItemSearchResult } from '../../interface';
import { gatherResponse } from '../../utils';

// Handle /search endpoint
export async function handleSearch(c: Context) {
    const q = c.req.query('q');
    const scope = c.req.query('scope') || 'all';

    // if query only contains spaces
    if (!q || q.trim().length === 0) return returnError(c, 'Search query cannot be empty', q || '');
    // if query is over 50 characters
    if (q.length > 50) return returnError(c, 'Search query cannot be longer than 50 characters', q);
    // if query is does not contain any letters
    if (!q.match(/[a-zA-Z]/)) return returnError(c, 'Search query must contain at least one letter', q);
    // scope exists, but wrong
    if (scope !== 'all' && scope !== 'blogs' && scope !== 'posts') return returnError(c, 'Wrong scope', q);

    const itemsPerPage = 30;
    const page = Number(c.req.query('p')) || 1;

    const searchDocuments: {
        searches: Array<{ collection: string; q: string; per_page: number; num_typos?: number }>;
    } = {
        searches: [],
    };

    if (scope === 'all') {
        searchDocuments.searches.push(
            {
                collection: c.env.TYPESENSE_FEEDS_COLLECTION,
                q: q,
                per_page: 5,
                num_typos: 0,
            },
            {
                collection: c.env.TYPESENSE_ITEMS_COLLECTION,
                q: q,
                per_page: itemsPerPage,
            },
        );
    } else if (scope === 'blogs') {
        searchDocuments.searches.push({
            collection: c.env.TYPESENSE_FEEDS_COLLECTION,
            q: q,
            per_page: 5,
        });
    } else if (scope === 'posts') {
        searchDocuments.searches.push({
            collection: c.env.TYPESENSE_ITEMS_COLLECTION,
            q: q,
            per_page: itemsPerPage,
        });
    }

    const init = {
        body: JSON.stringify(searchDocuments),
        method: 'POST',
        headers: {
            'X-TYPESENSE-API-KEY': c.env.TYPESENSE_API_KEY_SEARCH,
            'Content-Type': 'application/json',
        },
    };

    const response = await fetch(
        `https://${c.env.TYPESENSE_CLUSTER}:443/multi_search?page=${page}&query_by=title,content`,
        init,
    );
    const results = await gatherResponse(response);
    const parsedResults = JSON.parse(results);

    let hasNextPage = false;
    let resultsForBlogs: Array<FeedSearchResult> = [];
    let resultsForPosts: Array<ItemSearchResult> = [];
    if (scope === 'all') {
        hasNextPage = parsedResults.results[1].found > page * itemsPerPage;
        resultsForBlogs = parsedResults.results[0].hits;
        resultsForPosts = parsedResults.results[1].hits;
    } else if (scope === 'blogs') {
        hasNextPage = parsedResults.results[0].found > page * itemsPerPage;
        resultsForBlogs = parsedResults.results[0].hits;
    } else if (scope === 'posts') {
        hasNextPage = parsedResults.results[0].found > page * itemsPerPage;
        resultsForPosts = parsedResults.results[0].hits;
    }

    let inner = `<h2 style="margin-bottom:1.25em;">Search results for '${q}':</h2>`;

    // found feeds
    if (resultsForBlogs?.length) {
        inner += `<div class="container-grid util-mb-2">`;
        for (const feed of resultsForBlogs) inner += renderFeedSearchResult(feed);
        inner += '</div>';
    }

    // found posts
    if (resultsForPosts) {
        for (const item of resultsForPosts) {
            inner += renderItemSearchResult(item);
        }
    }

    if (!resultsForBlogs?.length && !resultsForPosts?.length) {
        inner += `<div class="flash flash-blue">No results found</i></div>`;
    }

    if (hasNextPage) {
        inner += `<p><a href="/search?q=${q}&p=${page + 1}&scope=${scope}">More</a></p>`;
    }

    return c.html(renderHTML(`${q} | minifeed`, raw(inner), c.get('USERNAME'), 'search', q));
}

function returnError(c: Context, description: string, q: string) {
    return c.html(
        renderHTML(
            'Search | minifeed',
            raw(`<div class="flash flash-red">${description}</div>`),
            c.get('USERNAME'),
            'search',
            q,
        ),
    );
}
