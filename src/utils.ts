import Sqids from "sqids";
import { getRssUrlsFromHtmlBody } from "rss-url-finder";
import { Context } from "hono";
import { decode } from "html-entities";

const idToSqid = (id: number, length: number): string => {
  const sqids = new Sqids({
    minLength: length,
    alphabet: "UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0",
  });
  return sqids.encode(
    id
      .toString()
      .split("")
      .map((char) => parseInt(char, 10)),
  );
};

const sqidToId = (sqid: string, length: number): number => {
  const sqids = new Sqids({
    minLength: length,
    alphabet: "UV8E4hOJwLiXMpYBsWyQ7rNoeDgm9TGxbFI5aknAztjC2K3uZ6cldSqRv1PfH0",
  });
  return parseInt(sqids.decode(sqid).join(""), 10);
};

export const feedIdToSqid = (feedId: number): string => idToSqid(feedId, 5);
export const feedSqidToId = (feedSqid: string): number => sqidToId(feedSqid, 5);
export const itemIdToSqid = (itemId: number): string => idToSqid(itemId, 10);
export const itemSqidToId = (itemSqid: string): number =>
  sqidToId(itemSqid, 10);

export async function getRSSLinkFromUrl(url: string) {
  let req;
  try {
    req = await fetch(url);
  } catch (err) {
    throw new Error(`Cannot fetch url: ${url}`);
  }
  const pageContent = await req.text();

  if (!pageContent.length) throw new Error(`Empty content at url: ${url}`);

  // the content of the page is HTML, try to find RSS link
  if (
    pageContent.includes("<html") ||
    pageContent.includes("<!DOCTYPE html>")
  ) {
    const rssUrlObj = getRssUrlsFromHtmlBody(pageContent);
    if (!rssUrlObj.length || !rssUrlObj[0]["url"])
      throw new Error(`Cannot find RSS link in HTML of URL: ${url}`);
    let foundRSSLink = rssUrlObj[0]["url"];
    // the found rss link may be relative or absolute; handle both cases here
    if (foundRSSLink.substring(0, 4) != "http") {
      if (url.substring(url.length - 1) != "/")
        foundRSSLink = url + "/" + foundRSSLink;
      else foundRSSLink = url + foundRSSLink;
    }
    return foundRSSLink;
  }

  // otherwise assume the url is direct RSS url, so just return it
  return url;
}

export async function getFeedIdByRSSUrl(c: Context, rssUrl: string) {
  const { results } = await c.env.DB.prepare(
    "SELECT feed_id FROM feeds where rss_url = ?",
  )
    .bind(rssUrl)
    .all();
  return results[0]["feed_id"];
}

/**
 * Returns the text value of the given input.
 * If the input is an object, it checks for properties like '_text', '#text', '_cdata', or '$t' to extract the text value.
 * If the input is a string, it trims and decodes the string before returning.
 * @param val - The input value.
 * @returns The text value of the input.
 */
export const getText = (val: any) => {
  const txt = isObject(val)
    ? val._text || val["#text"] || val._cdata || val.$t
    : val;
  return txt ? decode(String(txt).trim()) : "";
};
const ob2Str = (val: any) => {
  return {}.toString.call(val);
};

export const isObject = (val: any) => {
  return ob2Str(val) === "[object Object]" && !Array.isArray(val);
};

/**
 * Replaces relative image URLs in the given content with absolute URLs based on the provided base URL.
 *
 * @param content - The content string containing HTML with image tags.
 * @param baseUrl - The base URL to resolve relative image URLs.
 * @returns The modified content string with absolute image URLs.
 */
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
  return str.replace(/[|│┤┼├┌┬┐└┴┘—─\-–▬░▒▓┫]/g, " ");
}

/**
 * Collapses consecutive whitespace characters into a single space and trims leading and trailing whitespace.
 *
 * @param str - The input string to collapse whitespace.
 * @returns The input string with collapsed whitespace.
 */
export function collapseWhitespace(str: string) {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * gatherResponse awaits and returns a response body as a string.
 * Use await gatherResponse(..) in an async function to get the response body
 * @param {Response} response
 */
export async function gatherResponse(response: Response) {
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json());
  } else if (contentType.includes("application/text")) {
    return response.text();
  } else if (contentType.includes("text/html")) {
    return response.text();
  } else {
    return response.text();
  }
}

export const truncate = (s: string, len = 140) => {
  const txt = s.toString();
  const txtlen = txt.length;
  if (txtlen <= len) return txt;

  const subtxt = txt.substring(0, len).trim();
  const subtxtArr = subtxt.split(" ");
  const subtxtLen = subtxtArr.length;
  if (subtxtLen > 1) {
    subtxtArr.pop();
    return subtxtArr.map((word: string) => word.trim()).join(" ") + "...";
  }
  return subtxt.substring(0, len - 3) + "...";
};

export const stripTags = (s: string) => {
  return s
    .toString()
    .replace(/(<([^>]+)>)/gi, "")
    .trim();
};

export const extractItemUrl = (item: any, feedUrl: string) => {
  let link = item.link || item.guid || item.id;
  console.log(item);
  // if link does not start with http, it's probably a relative link, so we need to absolutify it
  if (!link.startsWith("http")) link = new URL(link, feedUrl).toString();
  return link;
};
