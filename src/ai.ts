import { Context } from "hono";
import { html, raw } from "hono/html";
import { Bindings } from "./bindings";
import { renderHTML } from "./htmltools";
import { ItemRow } from "./interface";
import { enqueueRegenerateItemRelatedCache, enqueueVectorizeStoreItem } from "./queue";
import { stripNonLinguisticElements, stripTags } from "./utils";

export interface EmbeddingResponse {
    shape: number[];
    data: number[][];
}

export const vectorize_text = async (env:Bindings,  text: string): Promise<EmbeddingResponse> => {
    return await env.AI.run(
        "@cf/baai/bge-base-en-v1.5",
        { text: [ text ], },
    );
}

export const add_vector_to_db = async (env:Bindings,  id: number, embeddings: EmbeddingResponse, namespace: string, metadata?: Record<string, VectorizeVectorMetadata>) => {
    const vectors: VectorizeVector[] = [];
    embeddings.data.forEach((vector) => {
        vectors.push({ id: `${id}`, values: vector, namespace: namespace, metadata: metadata });
    });
    await env.VECTORIZE.upsert(vectors);
}

export const vectorize_and_store_item = async (env:Bindings,  item_id: number) => {
    // if item is already in vector store, skip
    const vectors = await env.VECTORIZE.getByIds([`${item_id}`]);
    if (vectors.length) return;

    const item = await env.DB.prepare(
        `SELECT item_id, feed_id, title, description, content_html, content_html_scraped FROM items WHERE item_id = ?`,
    ).bind(item_id).first<ItemRow>();
    if (!item) return;

    let contentBlock;
    if (item.content_html) { // We have full content from feed
        if (item.content_html_scraped) { // We have scraped content
            if ( item.content_html.length > item.content_html_scraped.length * 0.65 ) {
                    contentBlock = raw(item.content_html);
                } else {
                    contentBlock = raw(item.content_html_scraped);
                }
            } else { // No scraped content, use full content
                contentBlock = raw(item.content_html);
            }
    } else if (item.content_html_scraped) { // no full content, use scraped
        contentBlock = raw(item.content_html_scraped);
    }
    else { // nothing but description
        contentBlock = item.description;
    }

    contentBlock = await stripTags(await stripNonLinguisticElements(contentBlock));
    const embeddings: EmbeddingResponse = await vectorize_text(env,  `${item.title}. ${contentBlock}`);
    await add_vector_to_db(
        env, 
        item.item_id, 
        embeddings, 
        "items", // namespace
        {
            feed_id: item.feed_id // metadata
        }
    );
}

export const handle_vectorize = async (c: Context) => {
    const env = c.env as Bindings;
    const start = c.req.query("start");
    const stop = c.req.query("stop");

    if (!start || !stop) {

        const list = 'Here we will find unvectorized items maybe?'
        return c.html(
            renderHTML(`admin | minifeed`, html(list), c.get("USERNAME"), ""),
        );
    }


    const items = await env.DB.prepare(
        `SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?`,
    ).bind(start, stop).all<ItemRow>();

    let response = '<ol>';
    for (const item of items.results) {
        // response += `<li>Vectorizing item <a href="/items/${item.item_sqid}">${item.item_id} / ${item.item_sqid}: ${item.title}</a>`;
        await enqueueVectorizeStoreItem(c.env, item.item_id);
    }
    response += '</ol>';
    return c.html(response);
    
}

export const handle_generate_related = async (c: Context) => {
    const env = c.env as Bindings;
    const start = c.req.query("start");
    const stop = c.req.query("stop");
    if (!start || !stop) return c.text("No start or stop provided", 400);

    const items = await env.DB.prepare(
        `SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?`,
    ).bind(start, stop).all<ItemRow>();

    let response = '<ol>';
    for (const item of items.results) {
        response += `<li>Generating related cache for item <a href="/items/${item.item_sqid}">${item.item_id} / ${item.item_sqid}: ${item.title}</a>`;
        await enqueueRegenerateItemRelatedCache(c.env, item.item_id);
    }
    response += '</ol>';
    return c.html(response);

}