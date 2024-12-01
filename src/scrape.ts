import type { Bindings } from './bindings';

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { ArticleInfo } from './interface';
import { enqueueItemIndex } from './queue';
import { updateItemIndex } from './search';

export async function scrapeItem(env: Bindings, itemId: number) {
    // TODO: probably should not couple indexing with scraping
    const item = await env.DB.prepare('SELECT url, description FROM items WHERE item_id = ?').bind(itemId).first();

    if (!item) {
        console.log(`Item ${itemId} not found`);
        return;
    }

    const itemURL = String(item.url);
    let itemDescription = String(item.description);

    console.log(`Scraping item ${itemId} (${itemURL})`);

    try {
        const scrapedArticle = await scrapeURLIntoObject(itemURL);
        // if no description was set, use the scraped one
        if (!itemDescription || itemDescription.length < 5) itemDescription = scrapedArticle.description;

        await env.DB.prepare('UPDATE items SET content_html_scraped = ?, description = ? WHERE item_id = ?')
            .bind(scrapedArticle.HTMLcontent, itemDescription, itemId)
            .run();

        // scraping succeeded, update index directly
        await updateItemIndex(env, itemId, scrapedArticle.textContent);
    } catch (err) {
        console.log(`Error scraping item ${itemId} (${itemURL}): ${err?.toString()}`);
        // scraping failed, enqueue indexing
        await enqueueItemIndex(env, itemId);
    }
}

export async function scrapeURLIntoObject(url: string): Promise<ArticleInfo> {
    const response = await fetch(url);
    const html = await response.text();
    const { document } = parseHTML(html);
    const cleanArticleContent = new Readability(document).parse();

    if (cleanArticleContent?.textContent) {
        return {
            url,
            title: cleanArticleContent.title,
            HTMLcontent: cleanArticleContent.content,
            textContent: cleanArticleContent.textContent,
            description: cleanArticleContent.excerpt,
            published: cleanArticleContent.publishedTime,
        };
    }
    throw new Error('Error parsing article content');
}
