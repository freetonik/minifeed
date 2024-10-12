import { Bindings } from "./bindings";
import { raw } from "hono/html";
import { stripTags } from "./utils";
import { enqueueVectorizeStoreItem } from "./queue";

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

export const add_vector_to_db = async (env:Bindings,  id: number, embeddings: EmbeddingResponse) => {
    let vectors: VectorizeVector[] = [];
    embeddings.data.forEach((vector) => {
        vectors.push({ id: `${id}`, values: vector });
    });
    await env.VECTORIZE.upsert(vectors);
}

export const vectorize_and_store_item = async (env:Bindings,  item_id: number) => {
    type ItemRow = {
        item_id: number;
        title: string;
        content_html: string;
        content_html_scraped: string;
        description: string;
    };
    const item = await env.DB.prepare(
        `SELECT item_id, title, description, content_html, content_html_scraped FROM items WHERE item_id = ?`,
    )
        .bind(item_id)
        .first<ItemRow>();

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

    contentBlock = stripTags(contentBlock);

    const full_text: string = `${item.title} ${contentBlock}`;
    const embeddings: EmbeddingResponse = await vectorize_text(env,  full_text);
    await add_vector_to_db(env,  item.item_id, embeddings);
}

export const handle_vectorize = async (c: any) => {
    const env = c.env as Bindings;
    const start = c.req.query("start");
    const stop = c.req.query("stop");

    if (!start || !stop) return c.text("No start or stop provided", 400);

    type ItemRow = {
        item_id: number;
        item_sqid:  string;
        title: string;
    };
    const items = await env.DB.prepare(
        `SELECT item_id, title, item_sqid FROM items WHERE item_id >= ? AND item_id <= ?`,
    )
        .bind(start, stop)
        .all<ItemRow>();

    let response = '';
    for (const item of items.results) {
        response += `Vectorizing item ${item.item_id} / ${item.item_sqid}: ${item.title}<br>`;
        await enqueueVectorizeStoreItem(c.env, item.item_id);
    }
    return c.html(response);
    
}