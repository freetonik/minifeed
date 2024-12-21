import type { Context } from 'hono';
import { decode } from 'html-entities';
import robotsParser from 'robots-parser';
import { getRssUrlsFromHtmlBody } from 'rss-url-finder';
import Sqids from 'sqids';
import { detectAll } from 'tinyld';
import type { FeedRow, MFFeedEntry } from './interface';

const idToSqid = (id: number, length: number): string => {
    const sqids = new Sqids({
        minLength: length,
        alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',
    });
    return sqids.encode(
        id
            .toString()
            .split('')
            .map((char) => Number.parseInt(char, 10)),
    );
};

const sqidToId = (sqid: string, length: number): number => {
    const sqids = new Sqids({
        minLength: length,
        alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',
    });
    return Number.parseInt(sqids.decode(sqid).join(''), 10);
};

export const feedIdToSqid = (feedId: number): string => idToSqid(feedId, 5);
export const feedSqidToId = (feedSqid: string): number => sqidToId(feedSqid, 5);
export const itemIdToSqid = (itemId: number): string => idToSqid(itemId, 10);
export const itemSqidToId = (itemSqid: string): number => sqidToId(itemSqid, 10);

export async function getRSSLinkFromUrl(url: string) {
    let req: Response;
    try {
        req = await fetch(url);
    } catch (err) {
        throw new Error(`Cannot fetch url: ${url}, error ${err}`);
    }
    const pageContent = await req.text();

    if (!pageContent.length) throw new Error(`Empty content at url: ${url}`);

    // the content of the page is HTML, try to find RSS link
    if (pageContent.includes('<html') || pageContent.includes('<!DOCTYPE html>')) {
        const rssUrlObj = getRssUrlsFromHtmlBody(pageContent);
        if (!rssUrlObj.length || !rssUrlObj[0].url) throw new Error(`Cannot find RSS link in HTML of URL: ${url}`);
        let foundRSSLink = rssUrlObj[0].url;
        // the found rss link may be relative or absolute; handle both cases here
        if (foundRSSLink.substring(0, 4) !== 'http') {
            if (url.substring(url.length - 1) !== '/') foundRSSLink = `${url}/${foundRSSLink}`;
            else foundRSSLink = url + foundRSSLink;
        }
        return foundRSSLink;
    }

    // otherwise assume the url is direct RSS url, so just return it
    return url;
}

export async function getFeedIdByRSSUrl(c: Context, rssUrl: string) {
    const { results } = await c.env.DB.prepare('SELECT feed_id FROM feeds where rss_url = ?').bind(rssUrl).all();
    return results[0].feed_id;
}

/**
 * Returns the text value of the given input.
 * If the input is an object, it checks for properties like '_text', '#text', '_cdata', or '$t' to extract the text value.
 * If the input is a string, it trims and decodes the string before returning.
 * @param val - The input value.
 * @returns The text value of the input.
 */
export const getText = (val: any) => {
    const txt = isObject(val) ? val._text || val['#text'] || val._cdata || val.$t : val;
    return txt ? decode(String(txt).trim()) : '';
};
const ob2Str = (val: any) => {
    return {}.toString.call(val);
};

export const isObject = (val: any) => {
    return ob2Str(val) === '[object Object]' && !Array.isArray(val);
};

export const absolutifyImageUrls = async (html: string, rootUrl: string): Promise<string> => {
    const rewriter = new HTMLRewriter().on('img', {
        element(element) {
            const src = element.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('//')) {
                const absoluteUrl = new URL(src, rootUrl).toString();
                element.setAttribute('src', absoluteUrl);
            }
        },
    });

    const response = new Response(html);
    const transformedResponse = rewriter.transform(response);
    return await transformedResponse.text();
};

/**
 * Returns the root URL of the given URL.
 *
 * @param url - The URL to extract the root URL from.
 * @returns The root URL of the given URL.
 */
export function getRootUrl(url: string) {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.hostname}`;
}

/**
 * Removes ASCII formatting characters from a string.
 *
 * @param str - The input string.
 * @returns The string with ASCII formatting characters replaced by spaces.
 */
export function stripASCIIFormatting(str: string) {
    return str.replace(/[|│┤┼├┌┬┐└┴┘—─\-–▬░▒▓┫]/g, ' ');
}

/**
 * Collapses consecutive whitespace characters into a single space and trims leading and trailing whitespace.
 *
 * @param str - The input string to collapse whitespace.
 * @returns The input string with collapsed whitespace.
 */
export function collapseWhitespace(str: string) {
    return str.replace(/\s+/g, ' ').trim();
}

/**
 * gatherResponse awaits and returns a response body as a string.
 * Use await gatherResponse(..) in an async function to get the response body
 * @param {Response} response
 */
export async function gatherResponse(response: Response) {
    const { headers } = response;
    const contentType = headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return JSON.stringify(await response.json());
    }
    if (contentType.includes('application/text')) {
        return response.text();
    }
    if (contentType.includes('text/html')) {
        return response.text();
    }
    return response.text();
}

export const truncate = (s: string, len = 140) => {
    if (s.length <= len || s.length === 0) return s;
    const txt = s.toString();
    const txt_length = txt.length;
    if (txt_length <= len) return txt;

    const sub_text = txt.substring(0, len).trim();
    const sub_text_array = sub_text.split(' ');
    const sub_text_length = sub_text_array.length;
    if (sub_text_length > 1) {
        sub_text_array.pop();
        return `${sub_text_array.map((word: string) => word.trim()).join(' ')}...`;
    }
    return `${sub_text.substring(0, len - 3)}...`;
};

export const stripTags = (s: string) => {
    const stripped_text = new HTMLRewriter()
        .on('*', {
            text(textChunk) {
                // Keep the text content as-is, effectively stripping tags
                textChunk.after(textChunk.text, { html: false });
            },
            element(element) {
                // Remove all HTML elements
                element.removeAndKeepContent();
            },
        })
        .transform(new Response(s))
        .text();

    return stripped_text;
};

export const stripTagsSynchronously = (s: string | undefined) => {
    if (!s) return '';
    return s
        .toString()
        .replace(/(<([^>]+)>)/gi, '')
        .trim();
};

export const extractItemUrl = (item: MFFeedEntry, feedRSSUrl: string) => {
    if (!item.link && !item.id) throw new Error('Cannot extract item URL: missing link, guid, or id');

    let link = item.link || item.id;
    // if link does not start with http, it's probably a relative link, so we need to absolutify it by prepending the RSS URL origin
    if (!link.startsWith('http')) {
        const feedRSSUrlBase = new URL(feedRSSUrl).origin;
        link = new URL(link, feedRSSUrlBase).toString();
    }

    if (link.startsWith('http://localhost') || link.startsWith('http://127.0.0.1')) {
        throw new Error('Cannot extract item URL: localhost is used as the URL');
    }

    if (feedRSSUrl.startsWith('https') && !link.startsWith('https')) {
        throw new Error('Feed is HTTPS but item URL is not');
    }

    return link;
};

export const getItemPubDate = (item: MFFeedEntry): Date => {
    // published date was parsed OK
    if (item.published) {
        // if item.published is in future, set it to current date
        if (new Date(item.published) > new Date()) return new Date();
        return new Date(item.published);
    }
    // if date was not properly parsed, try to parse it (expects 'pubdate' to be retrieved by feed_extractor's extractRSS function)
    if (item.pubdate) {
        const dateFromPubdate = new Date(item.pubdate);
        // if date is in future, set it to current date
        if (dateFromPubdate > new Date()) {
            return new Date();
        }
        // if date is older than unix epoch start date, set it to current date
        if (dateFromPubdate < new Date('1970-01-01')) {
            return new Date();
        }
        return dateFromPubdate;
    }
    // if no date was found, set it to current date
    return new Date();
};

// This is used e.g. for preparing plaintext description and for vectorization
export const stripNonLinguisticElements = async (s: string) => {
    if (s.length === 0) return '';
    const badList = [
        'img',
        'video',
        'audio',
        'form',
        'button',
        'code',
        'canvas',
        'iframe',
        'script',
        'style',
        'input',
        'textarea',
        'frameset',
        'footer',
        'header',
    ];
    const stripped = new HTMLRewriter()
        .on('*', {
            element(element) {
                if (badList.includes(element.tagName)) {
                    element.remove();
                }
            },
        })
        .transform(new Response(s))
        .text();

    return stripped;
};

export const sanitizeHTML = async (contentBlock: string): Promise<string> => {
    const sanitizedContentBlock = new HTMLRewriter()
        .on('*', {
            element(element) {
                // Remove potentially dangerous attributes
                const dangerousAttributes = [
                    'onabort',
                    'onanimationcancel',
                    'onanimationend',
                    'onanimationiteration',
                    'onanimationstart',
                    'onauxclick',
                    'onblur',
                    'oncancel',
                    'oncanplay',
                    'oncanplaythrough',
                    'onchange',
                    'onclick',
                    'onclose',
                    'oncontextmenu',
                    'oncopy',
                    'oncuechange',
                    'oncut',
                    'ondblclick',
                    'ondrag',
                    'ondragend',
                    'ondragenter',
                    'ondragleave',
                    'ondragover',
                    'ondragstart',
                    'ondrop',
                    'ondurationchange',
                    'onemptied',
                    'onended',
                    'onerror',
                    'onfocus',
                    'onformdata',
                    'onfullscreenchange',
                    'onfullscreenerror',
                    'ongotpointercapture',
                    'oninput',
                    'oninvalid',
                    'onkeydown',
                    'onkeypress',
                    'onkeyup',
                    'onload',
                    'onloadeddata',
                    'onloadedmetadata',
                    'onloadstart',
                    'onlostpointercapture',
                    'onmousedown',
                    'onmouseenter',
                    'onmouseleave',
                    'onmousemove',
                    'onmouseout',
                    'onmouseover',
                    'onmouseup',
                    'onpaste',
                    'onpause',
                    'onplay',
                    'onplaying',
                    'onpointercancel',
                    'onpointerdown',
                    'onpointerenter',
                    'onpointerleave',
                    'onpointermove',
                    'onpointerout',
                    'onpointerover',
                    'onpointerup',
                    'onprogress',
                    'onratechange',
                    'onreset',
                    'onresize',
                    'onscroll',
                    'onsecuritypolicyviolation',
                    'onseeked',
                    'onseeking',
                    'onselect',
                    'onselectionchange',
                    'onselectstart',
                    'onslotchange',
                    'onstalled',
                    'onsubmit',
                    'onsuspend',
                    'ontimeupdate',
                    'ontoggle',
                    'ontouchcancel',
                    'ontouchend',
                    'ontouchmove',
                    'ontouchstart',
                    'ontransitioncancel',
                    'ontransitionend',
                    'ontransitionrun',
                    'ontransitionstart',
                    'onvolumechange',
                    'onwaiting',
                    'onwheel',
                ];
                for (const attr of dangerousAttributes) {
                    element.removeAttribute(attr);
                }

                // Sanitize href attributes
                if (element.tagName === 'a' && element.getAttribute('href')) {
                    const href = element.getAttribute('href');
                    if (href?.toLowerCase().startsWith('javascript:')) {
                        element.removeAttribute('href');
                    }
                }

                // Remove script and style tags
                if (element.tagName === 'script' || element.tagName === 'style') {
                    element.remove();
                }

                // Remove all iframes except for YouTube
                if (element.tagName === 'iframe') {
                    const src = element.getAttribute('src');
                    if (!src || !src.includes('youtube.com/embed/')) {
                        element.remove();
                    }
                }
            },
        })
        .transform(new Response(contentBlock))
        .text();

    return sanitizedContentBlock;
};

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getRobots(url: string) {
    let baseUrl = '';
    try {
        baseUrl = new URL(url).origin;
    } catch (error) {
        console.error(`Error getting base URL from ${url}`);
        return;
    }

    const robotsUrl = new URL('/robots.txt', baseUrl);
    try {
        const response = await fetch(robotsUrl.toString());
        if (response.ok) {
            const robotsTxt = await response.text();
            const robots = robotsParser(robotsUrl.toString(), robotsTxt);
            console.log(`Robots.txt found at ${robotsUrl.toString()}`);
            return robots;
        }
        console.log(`No robots.txt found at ${robotsUrl.toString()}`);

        return;
    } catch (error) {
        console.error(`Error fetching robots.txt from ${robotsUrl.toString()}`);
    }
}

export function findObjsUniqueToListOne(list1: any, list2: any) {
    const list2Ids = new Set(list2.map((obj) => obj.id));

    return list1.filter((obj) => !list2Ids.has(obj.id));
}

export function groupObjectsByProperty(objects: Array<any>, prop: string): Array<any> {
    return Object.values(
        objects.reduce((acc, item) => {
            acc[item[prop]] = acc[item[prop]] || [];
            acc[item[prop]].push(item);
            return acc;
        }, {}),
    );
}

export function sortByFrequency(arr: Array<number>): Array<number> {
    // Count occurrences
    const frequency = arr.reduce<Record<number, number>>((acc, num) => {
        acc[num] = (acc[num] || 0) + 1;
        return acc;
    }, {});

    // Create array of [number, count] pairs and sort by count descending
    // If counts are equal, sort by the number value ascending
    return Object.entries(frequency)
        .map(([num, count]): [number, number] => [Number.parseInt(num), count])
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .map((pair) => pair[0]);
}

export function isDefinitelyNotEnglish(text?: string): boolean {
    if (!text) return false;
    const langDetectionResults = detectAll(text);

    // nothing detected
    if (langDetectionResults.length === 0) return false;

    // however many languages detected, first has non-English accuracy > 0.5, SURE TRUE
    if (langDetectionResults[0].lang !== 'en' && langDetectionResults[0].accuracy > 0.7) return true;

    // more than 3 languages detected, inconclusive
    if (langDetectionResults.length > 3) return false;

    // exactly one language detected, and it's english
    if (langDetectionResults.length === 1 && langDetectionResults[0].lang === 'en') return false;

    // exactly one language detected, and it's not english, SURE TRUE
    if (langDetectionResults.length === 1 && langDetectionResults[0].lang !== 'en') return true;

    // potentially 2 or 3 languages detected, first is English with enough accuracy
    if (langDetectionResults[0].lang === 'en' && langDetectionResults[0].accuracy > 0.2) return false;

    // potentially 2 or 3 languages detected, first is not English with enough accuracy
    if (langDetectionResults[0].lang !== 'en' && langDetectionResults[0].accuracy > 0.2) return true;

    return false;
}

export function generateOPML(feeds: Array<FeedRow>) {
    let opml = `

    <opml version="1.0">
    <head>
    <title>RSS feeds from Minifeed.net</title>
    <dateCreated>${new Date()}</dateCreated>
    </head>
    <body>
    `;

    for (const feed of feeds) {
        opml += `
        <outline type="rss" text="${escapeStrForXML(feed.title)}" title="${escapeStrForXML(feed.title)}" xmlUrl="${feed.rss_url}" htmlUrl="${feed.url}" />
        `;
    }

    opml += `</body>
    </opml>
    `;

    return opml;
}

function escapeStrForXML(str: string) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
