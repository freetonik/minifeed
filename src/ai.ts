import type { Context } from 'hono';
import type { Bindings } from './bindings';
import type { FeedRow, ItemRow } from './interface';
import { enqueueVectorizeStoreItem } from './queue';
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
        return upserted;
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
    return await addVectorToDb(
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
    const type = c.req.param('type');
    if (!type) return c.text('No type provided', 400);

    const start = c.req.query('start');
    const stop = c.req.query('stop') || start;
    if (!start) return c.text('No start provided', 400);

    if (type === 'item') {
        const items = await env.DB.prepare(
            'SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?',
        )
            .bind(start, stop)
            .all<ItemRow>();

        let response = '<ol>';
        for (const item of items.results) {
            response += `<li>Generating related entries for item <a href="/items/${item.item_sqid}">${item.item_id} / ${item.item_sqid}: ${item.title}</a></li>`;

            await env.FEED_UPDATE_QUEUE.send({
                type: 'item_regenerate_related',
                item_id: item.item_id,
            });
        }
        response += '</ol>';
        return c.html(response);
    }

    if (type === 'feed') {
        const feeds = await env.DB.prepare(
            'SELECT feed_id, feed_sqid, title FROM feeds WHERE feed_id >= ? AND feed_id <= ?',
        )
            .bind(start, stop)
            .all<FeedRow>();

        let response = '<ol>';
        for (const feed of feeds.results) {
            const wf = await c.env.GENERATE_RELATED_FEEDS_WORKFLOW.create({ params: { feedId: feed.feed_id } });
            response += `<li>Generating related entries for feed <a href="/blogs/${feed.feed_sqid}">${feed.feed_id} ${feed.title}</a>
            <a href="https://dash.cloudflare.com/${c.env.CF_ACCOUNT_ID}/workers/workflows/generate-related-feeds-workflow/instance/${wf.id}">[WORKFLOW]</a></li>
         `;
        }
        response += '</ol>';
        return c.html(response);
    }

    return c.text('Wrong type provided', 400);
};
