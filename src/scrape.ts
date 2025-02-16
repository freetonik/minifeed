import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { ArticleInfo } from './interface';
import { getRobots } from './utils';

export async function scrapeURLIntoObject(url: string): Promise<ArticleInfo> {
    const robots = await getRobots(url);
    if (robots) {
        const iaArchiverAllowed = robots.isAllowed(url, 'ia_archiver');
        const minifeedAllowed = robots.isAllowed(url, 'minifeed_archiver');
        if (!iaArchiverAllowed || !minifeedAllowed) throw new Error('robots.txt disallows archiving');
    }

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'minifeed_archiver',
        },
    });

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
