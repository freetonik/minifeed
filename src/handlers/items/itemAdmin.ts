import { FeedData } from '@extractus/feed-extractor';
import type { Context } from 'hono';
import type { Bindings } from '../../bindings';
import { extractRSS } from '../../feed_extractor';
import { renderAddItemByURLForm, renderHTML } from '../../htmltools';
import { MFFeedEntry } from '../../interface';
import { addItem, deleteItem, scrapeIndexVectorizeItem } from '../../items';
import { scrapeURLIntoObject } from '../../scrape';
import { dbGetItem } from '../../sqlutils';
import { extractItemUrl, feedSqidToId, getText, itemSqidToId, stripNonLinguisticElements, truncate } from '../../utils';

export async function handleItemsAddItembyUrl(c: Context) {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    const blog = await c.env.DB.prepare('SELECT * FROM feeds WHERE feed_id = ?').bind(feedId).all();

    const blogTitle = blog.results[0].title;

    return c.html(renderHTML(c, 'Add new item', renderAddItemByURLForm('', '', '', blogTitle)));
}

export async function handleItemsDeletePOST(c: Context) {
    const body = await c.req.parseBody();
    const addToBlacklist = !!body?.blacklist;

    const itemSqid = c.req.param('item_sqid');
    const itemId = itemSqidToId(itemSqid);

    const deleted = await deleteItem(c.env, itemId, addToBlacklist);
    if (deleted) return c.html('Item deleted');
    return c.html('ERROR!');
}

export async function handleItemsAddItemByUrlPOST(c: Context) {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    const body = await c.req.parseBody();
    const url = body.url.toString();
    const urls = body.urls.toString();

    if (!url && !urls) return c.html('Both URL and URLs are empty');
    if (url && urls) return c.html('Both URL and URLs are filled in, please only fill in one');

    let urls_array: Array<string>;
    if (url) urls_array = [url];
    else if (urls) urls_array = urls.split('\r\n');
    else return c.html('No URLs provided');

    // remove empty strings from urls_array
    urls_array = urls_array.filter((url: string) => url !== '');
    if (!urls_array.length) return c.html('No URLs provided');

    for (const url_value of urls_array) {
        // TODO: this double-scrapes
        const articleContent = await scrapeURLIntoObject(url_value);
        const item = {
            feed_id: feedId,
            title: articleContent.title,
            link: url_value,
            published: articleContent.published,
            description: articleContent.description,
            content_from_content: articleContent.HTMLcontent,
        };

        await addItem(c.env, item, feedId);
    }

    return c.redirect(`/blogs/${feedSqid}`);
}

export async function handleItemRefresh(c: Context) {
    const itemSqid = c.req.param('item_sqid');
    const itemId = itemSqidToId(itemSqid);
    const item = await c.env.DB.prepare('SELECT items.url, items.title, rss_url, feeds.feed_id from ITEMS JOIN feeds ON feeds.feed_id = items.feed_id WHERE item_id=?').bind(itemId).all();
    if (item.results.length === 0) return c.html('Item not found');

    const itemURL = item.results[0].url;
    const feedRSSUrl = item.results[0].rss_url;
    const feedId = item.results[0].feed_id;
    const r: FeedData = await extractRSS(feedRSSUrl); // fetch RSS content
    let theEntry = undefined;
    for (const entry of r.entries || []) {
        const entryUrl = extractItemUrl(entry as MFFeedEntry, feedRSSUrl);
        if (entryUrl === itemURL) {
            theEntry = entry;
            break;
        }
    }

    if (theEntry) {
        let itemTitle = item.results[0].title;
        if (theEntry?.title) itemTitle = theEntry.title;

        const itemDescriptionWithoutSemanticElements = await stripNonLinguisticElements(item.description || '');
        const itemDescription = truncate(itemDescriptionWithoutSemanticElements, 350);


        const itemContentHTML =
            getText(theEntry.content_from_content) ||
            getText(theEntry.content_from_content_encoded) ||
            getText(theEntry.content_from_description) ||
            getText(theEntry.content_from_content_html) ||
            '';

        await c.env.DB.prepare(
            'UPDATE items set title = ?, description = ?, content_html = ? WHERE item_id = ?',
        )
            .bind(itemTitle, itemDescription, itemContentHTML, itemId)
            .run();

        console.log({
            message: 'Updated item from RSS',
            itemId,
            feedId,
            feedRSSUrl,
        });
    }

    await scrapeIndexVectorizeItem(c.env, itemId);
    return c.html('Enqueued...');
}

export async function handleRegenerateRelatedItemsNew(c: Context) {
    const itemSqid = c.req.param('item_sqid');
    await c.env.FEED_UPDATE_QUEUE.send({
        type: 'item_regenerate_related',
        item_id: itemSqidToId(itemSqid),
    });
    return c.html('Regenerating related items with new way...');
}

export async function regenerateRelatedForItem(env: Bindings, itemId: number) {
    const item = await dbGetItem(env, itemId);
    const relatedItemIds = [];

    if (env.ENVIRONMENT === 'dev') {
        const randomItems = await env.DB.prepare('SELECT item_id FROM items ORDER BY RANDOM() LIMIT 10').all();
        relatedItemIds.push(...randomItems.results.map((i: any) => i.item_id));
    } else {
        // if there is an item that is younger than 2 weeks, we don't need to regenerate the cache
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const oldestExistingRelatedItem = await env.DB.prepare(
            'SELECT item_id FROM related_items WHERE item_id = ? AND created > ?  LIMIT 1',
        )
            .bind(itemId, twoWeeksAgo.toISOString())
            .first();
        if (oldestExistingRelatedItem) return true;

        const matchesOtherBlogs = await env.VECTORIZE.queryById(`${itemId}`, {
            topK: 10,
            filter: { feed_id: { $ne: `${item?.feed_id}` } },
        });
        for (const match of matchesOtherBlogs.matches) relatedItemIds.push(match.id);

        // check if items exist in db
        for (const itemId of relatedItemIds) {
            const existingItem = await env.DB.prepare('SELECT item_id FROM items WHERE item_id = ?').bind(itemId).run();
            if (existingItem.results.length === 0) {
                relatedItemIds.splice(relatedItemIds.indexOf(itemId), 1);
            }
        }
    }

    // delete existing related items first
    await env.DB.prepare('DELETE FROM related_items WHERE item_id = ?').bind(itemId).run();

    // insert new related items
    const stmt = env.DB.prepare('INSERT INTO related_items (item_id, related_item_id) values (?, ?)');
    const binds: D1PreparedStatement[] = [];
    for (const relateItemId of relatedItemIds) {
        binds.push(stmt.bind(itemId, relateItemId));
    }

    if (binds.length > 0) {
        await env.DB.batch(binds);
        console.log({
            message: 'Regenerated cache for item',
            itemId,
        });
    }
    return true;
}
