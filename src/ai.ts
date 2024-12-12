import type { Context } from 'hono';
import type { Bindings } from './bindings';
import { regenerateRelatedCacheForItemMOCK } from './handlers/items/itemAdmin';
import type { ItemRow } from './interface';
import { enqueueRegenerateItemRelatedCache, enqueueVectorizeStoreItem } from './queue';
import { stripNonLinguisticElements, stripTags } from './utils';

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

export const addVectorToDb = async (
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

export const vectorizeAndStoreItem = async (env: Bindings, item_id: number) => {
    if (env.ENVIRONMENT === 'dev') {
        console.log('DEV MODE: Skipping vectorizeAndStoreItem');
        return;
    }
    // if item is already in vector store, skip
    const vectors = await env.VECTORIZE.getByIds([`${item_id}`]);
    if (vectors.length) return;

    const item = await env.DB.prepare(
        'SELECT item_id, feed_id, title, description, content_html FROM items WHERE item_id = ?',
    )
        .bind(item_id)
        .first<ItemRow>();
    if (!item) return;

    let contentBlock = '';

    if (!item.description && !item.content_html) {
        contentBlock = item.title; // We have nothing but title
    } else {
        // We have some content
        contentBlock += `. ${item.content_html || item.description}`;

        try {
            const stripped = await stripNonLinguisticElements(contentBlock);
            contentBlock = await stripTags(stripped);
        } catch {
            contentBlock = `${item.title}. ${item.description || ''}`;
        }
    }

    const embeddings: EmbeddingResponse = await vectorize_text(env, `${contentBlock}`);
    await addVectorToDb(
        env,
        item.item_id,
        embeddings,
        'items', // namespace
        {
            feed_id: item.feed_id, // metadata
        },
    );
};

export const handleVectorize = async (c: Context) => {
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

export const handleGenerateRelated = async (c: Context) => {
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
        if (c.env.ENVIRONMENT === 'dev') {
            await regenerateRelatedCacheForItemMOCK(c.env, item.item_id);
        } else {
            await enqueueRegenerateItemRelatedCache(c.env, item.item_id);
        }
    }
    response += '</ol>';
    return c.html(response);
};
