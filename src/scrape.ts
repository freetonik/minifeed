import type { Bindings } from './bindings';
import { enqueueItemIndex, enqueueVectorizeStoreItem } from './queue';
import { stripTags, truncate } from './utils';

export async function scrapeItem(env: Bindings, item_id: number) {
    const { results: items } = await env.DB.prepare('SELECT url, description FROM items WHERE item_id = ?')
        .bind(item_id)
        .all();

    const item_url = String(items[0].url);
    let item_description = String(items[0].description);

    console.log(`Scraping item ${item_id} (${item_url})`);

    try {
        const articleInfoParsed = await scrapeURLIntoObject(env, item_url);
        const content = articleInfoParsed.data.content;
        if (!item_description || item_description.length < 5)
            item_description = await stripTags(truncate(content, 500));
        await env.DB.prepare('UPDATE items SET content_html_scraped = ?, description = ? WHERE item_id = ?')
            .bind(content, item_description, item_id)
            .run();
    } catch (err: unknown) {
        console.log(
            `Error scraping item ${item_id} (${item_url}): ${err instanceof Error ? err.message : String(err)}`,
        );
    }

    // TODO: probably should not bind indexing and vectorizing to scraping
    await enqueueItemIndex(env, item_id);
    await enqueueVectorizeStoreItem(env, item_id);
}

export async function scrapeURLIntoObject(env: Bindings, url: string) {
    const maeServiceUrl = `https://mae.deno.dev/?apikey=${env.MAE_SERVICE_API_KEY}&url=${url}`;
    try {
        const req = await fetch(maeServiceUrl);
        const articleInfo = await req.text();
        const articleInfoParsed = JSON.parse(articleInfo);
        return articleInfoParsed;
    } catch (err: any) {
        console.log(`Error scraping URL ${url}: ${err.toString()}`);
    }
}
