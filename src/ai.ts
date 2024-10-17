import type { Context } from 'hono';
import { raw } from 'hono/html';
import type { Bindings } from './bindings';
import type { ItemRow } from './interface';
import { enqueueRegenerateItemRelatedCache, enqueueVectorizeStoreItem } from './queue';
import { stripNonLinguisticElements } from './utils';

export interface EmbeddingResponse {
    shape: number[];
    data: number[][];
}

export const vectorize_text = async (env: Bindings, text: string): Promise<EmbeddingResponse> => {
    return await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] });
};

export const summarizeText = async (env: Bindings, text: string) => {
    const response = await env.AI.run('@cf/facebook/bart-large-cnn', {
        input_text: text,
        max_length: 1024,
    });
    return response;
};

export const add_vector_to_db = async (
    env: Bindings,
    id: number,
    embeddings: EmbeddingResponse,
    namespace: string,
    metadata?: Record<string, VectorizeVectorMetadata>,
) => {
    const vectors: VectorizeVector[] = [];
    for (const vector of embeddings.data) {
        vectors.push({
            id: `${id}`,
            values: vector,
            namespace: namespace,
            metadata: metadata,
        });
    }
    const upserted = await env.VECTORIZE.upsert(vectors);
    if (upserted) {
        await env.DB.prepare('REPLACE INTO items_vector_relation (item_id, vectorized) VALUES (?,?)').bind(id, 1).run();
    }
};

export const vectorize_and_store_item = async (env: Bindings, item_id: number) => {
    // if item is already in vector store, skip
    const vectors = await env.VECTORIZE.getByIds([`${item_id}`]);
    if (vectors.length) return;

    const item = await env.DB.prepare(
        'SELECT item_id, feed_id, title, description, content_html, content_html_scraped FROM items WHERE item_id = ?',
    )
        .bind(item_id)
        .first<ItemRow>();

    if (!item) return;

    let contentBlock = '';

    if (!item.description && !item.content_html && !item.content_html_scraped) {
        // We have nothing but title
        contentBlock = item.title;
    } else {
        // We have some content
        if (item.content_html) {
            // We have full content from feed
            if (item.content_html_scraped) {
                // We have scraped content
                if (item.content_html.length > item.content_html_scraped.length * 0.5) {
                    contentBlock = raw(item.content_html);
                } else {
                    contentBlock = raw(item.content_html_scraped);
                }
            } else {
                // No scraped content, use full content
                contentBlock = raw(item.content_html);
            }
        } else if (item.content_html_scraped) {
            // no full content, use scraped
            contentBlock = raw(item.content_html_scraped);
        } else {
            // nothing but description
            contentBlock = item.description;
        }
        if (contentBlock.length < 10) {
            contentBlock = item.title;
        } else {
            const stripped = await stripNonLinguisticElements(contentBlock);
            contentBlock = `${item.title}. ${stripped}`;
        }
    }

    const embeddings: EmbeddingResponse = await vectorize_text(env, `${contentBlock}`);
    await add_vector_to_db(
        env,
        item.item_id,
        embeddings,
        'items', // namespace
        {
            feed_id: item.feed_id, // metadata
        },
    );

    // after item is vectorized, generate related items cache
    await enqueueRegenerateItemRelatedCache(env, item.item_id);
};

// export const summarize_and_store_item = async (env: Bindings, itemId: number) => {
//     const item = await env.DB.prepare(
//         'SELECT title, description, content_html, content_html_scraped FROM items WHERE item_id = ?',
//     )
//         .bind(itemId)
//         .first<ItemRow>();
//     if (!item) return;

//     const parts: { title: string; description: string; fullContent: string } = {
//         title: item.title,
//         description: item.description || '',
//         fullContent: item.content_html || item.content_html_scraped || '',
//     };

//     parts.fullContent = await stripNonLinguisticElements(parts.fullContent);
//     parts.fullContent = await stripTags(parts.fullContent);

//     const result = await summarizeText(env, parts.fullContent);
//     await env.DB.prepare('UPDATE items SET summary = ? WHERE item_id = ?').bind(result.summary, itemId).run();
//     return;
// };

export const handle_vectorize = async (c: Context) => {
    const env = c.env as Bindings;
    const start = c.req.query('start');
    const stop = c.req.query('stop');

    if (!start || !stop) return c.html('start and stop required');

    const items = await env.DB.prepare(
        'SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?',
    )
        .bind(start, stop)
        .all<ItemRow>();

    let response = '<ol>';
    for (const item of items.results) {
        response += `<li>Vectorizing item <a href="/items/${item.item_sqid}">${item.item_id} / ${item.item_sqid}: ${item.title}</a>`;
        await enqueueVectorizeStoreItem(c.env, item.item_id);
    }
    response += '</ol>';
    return c.html(response);
};

// export const handle_summarize = async (c: Context) => {
//     const env = c.env as Bindings;
//     const start = c.req.query('start');
//     const stop = c.req.query('stop');

//     if (!start || !stop) return c.html('start and stop required');

//     const items = await env.DB.prepare(
//         'SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?',
//     )
//         .bind(start, stop)
//         .all<ItemRow>();

//     let response = '<ol>';
//     for (const item of items.results) {
//         response += `<li>Summarizing <a href="/items/${item.item_sqid}">${item.item_id} / ${item.item_sqid}: ${item.title}</a>`;
//         await summarize_and_store_item(c.env, item.item_id);
//     }
//     response += '</ol>';
//     return c.html(response);
// };

export const handle_generate_related = async (c: Context) => {
    const env = c.env as Bindings;
    const start = c.req.query('start');
    const stop = c.req.query('stop');
    if (!start || !stop) return c.text('No start or stop provided', 400);

    const items = await env.DB.prepare(
        'SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?',
    )
        .bind(start, stop)
        .all<ItemRow>();

    let response = '<ol>';
    for (const item of items.results) {
        response += `<li>Generating related cache for item <a href="/items/${item.item_sqid}">${item.item_id} / ${item.item_sqid}: ${item.title}</a>`;
        await enqueueRegenerateItemRelatedCache(c.env, item.item_id);
    }
    response += '</ol>';
    return c.html(response);
};
