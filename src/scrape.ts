import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { ArticleInfo } from './interface';

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
