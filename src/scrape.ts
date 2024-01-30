import { Bindings } from "./bindings";
import { indexItemById } from "./search";

export async function scrapeItem(env: Bindings, item_id: Number) {
    const { results: items } = await env.DB.prepare("SELECT url FROM items WHERE item_id = ?").bind(item_id).all();
    const item_url = String(items[0]['url']);
    console.log(`Scraping item ${item_id} (${item_url})`);
    let req;
    const maeServiceUrl = `https://mae.deno.dev/?apikey=${env.MAE_SERVICE_API_KEY}&url=${item_url}`
    try {
        req = await fetch(maeServiceUrl);
    } catch (err: any) {
        throw new Error(`Cannot fetch url: ${maeServiceUrl}, error: ${err.toString()}`)
    }
    const articleInfo = await req.text();
    const content = JSON.parse(articleInfo).data.content;

    await env.DB.prepare("UPDATE items SET content_html_scraped = ? WHERE item_id = ?").bind(content, item_id).run();
}

export async function scrapeAndIndex(env: Bindings, item_id: Number) {
    try {
        await scrapeItem(env, item_id);
    } catch (error) {
        console.log(`scrapeAndIndex: Error scraping item: ${item_id}, continuing to index without scraped content`)
    }
    await indexItemById(env, item_id);
}