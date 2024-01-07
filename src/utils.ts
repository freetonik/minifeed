import Sqids from 'sqids'
import { getRssUrlsFromHtmlBody } from 'rss-url-finder'
import { Context } from 'hono'
import { decode } from 'html-entities'
import { isObject } from 'bellajs'

const idToSqid = (id:number, length:number): string => {
  const sqids = new Sqids({minLength: length, alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',})
  return sqids.encode(id.toString().split('').map(char => parseInt(char, 10)))
}

const sqidToId = (sqid:string, length:number): number => {
  const sqids = new Sqids({minLength: length, alphabet: 'UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0',})
  if(sqid.length != length) return 0;
  return parseInt(sqids.decode(sqid).join(''), 10)
}

export const feedIdToSqid = (feedId:number): string => idToSqid(feedId, 5)
export const feedSqidToId = (feedSqid:string): number => sqidToId(feedSqid, 5)
export const itemIdToSqid = (itemId:number): string => idToSqid(itemId, 10)
export const itemSqidToId = (itemSqid:string): number => sqidToId(itemSqid, 10)

export async function getRSSLinkFromUrl(url: string) {
	let req;
	try {
		req = await fetch(url);
	} catch (err) {
		throw new Error(`Cannot fetch url: ${url}`)
	}
	const pageContent = await req.text();

	if (!pageContent.length) throw new Error(`Empty content at url: ${url}`)

	// the content of the page is HTML, try to find RSS link
	if (pageContent.includes('<html') || pageContent.includes('<!DOCTYPE html>')) {
		const rssUrlObj = getRssUrlsFromHtmlBody(pageContent)
		if (!rssUrlObj.length || !rssUrlObj[0]['url']) throw new Error(`Cannot find RSS link in HTML of URL: ${url}`)
		let foundRSSLink = rssUrlObj[0]['url']
		// the found rss link may be relative or absolute; handle both cases here
		if (foundRSSLink.substring(0, 4) != "http") {
			if (url.substring(url.length - 1) != "/") foundRSSLink = url + '/' + foundRSSLink;
			else foundRSSLink = url + foundRSSLink;
		}
		return foundRSSLink
	}

	// otherwise assume the url is direct RSS url, so just return it
	return url
}

export async function getFeedIdByRSSUrl(c: Context, rssUrl: string) {
	const { results } = await c.env.DB.prepare("SELECT feed_id FROM feeds where rss_url = ?").bind(rssUrl).all()
	return results[0]['feed_id']
}

export const getText = (val:any) => {
	const txt = isObject(val) ? (val._text || val['#text'] || val._cdata || val.$t) : val
	return txt ? decode(String(txt).trim()) : ''
  }

export function absolitifyImageUrls(content: string, baseUrl: string) {
	const regex = /<img[^>]+src="([^">]+)"/g;
	let m;
	while ((m = regex.exec(content)) !== null) {
		if (m.index === regex.lastIndex) {
			regex.lastIndex++;
		}
		const imgSrc = m[1];
		if (imgSrc.substring(0, 4) != "http") {
			content = content.replace(imgSrc, new URL(imgSrc, baseUrl).toString());
		}
	}
	return content;
}