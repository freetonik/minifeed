import type { Context } from 'hono';
import type { Bindings } from '../../bindings';
import { renderAddItemByURLForm, renderHTML } from '../../htmltools';
import { deleteItem } from '../../items';
import { scrapeURLIntoObject } from '../../scrape';
import { dbGetItem } from '../../sqlutils';
import { feedSqidToId, itemSqidToId } from '../../utils';

export const handleItemsAddItembyUrl = async (c: Context) => {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    const blog = await c.env.DB.prepare('SELECT * FROM feeds WHERE feed_id = ?').bind(feedId).all();

    const blogTitle = blog.results[0].title;

    return c.html(
        renderHTML('Add new item', renderAddItemByURLForm('', '', '', blogTitle), c.get('USERNAME'), 'blogs'),
    );
};

export const handleItemsDelete = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId = itemSqidToId(itemSqid);

    const deleted = await deleteItem(c.env, itemId);
    if (deleted) return c.html('Item deleted');
    return c.html('ERROR!');
};

export const handleItemsAddItemByUrlPOST = async (c: Context) => {
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

        await c.env.ADD_ITEM_WORKFLOW.create({
            params: { item, feedId },
        });
    }

    return c.redirect(`/blogs/${feedSqid}`);
};

export const handleItemRefresh = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId = itemSqidToId(itemSqid);
    const wf = await c.env.UPDATE_ITEM_WORKFLOW.create({ params: { itemId } });
    return c.html(`
        <a href="https://dash.cloudflare.com/${c.env.CF_ACCOUNT_ID}/workers/workflows/update-item-workflow/instance/${wf.id}">WORKFLOW STARTED</a>
        `);
};

export async function handleRegenerateRelatedItemsNew(c: Context) {
    const itemSqid = c.req.param('item_sqid');
    await c.env.FEED_UPDATE_QUEUE.send({
        type: 'item_update_related_cache_new',
        item_id: itemSqidToId(itemSqid),
    });
    return c.html('Regenerating related items with new way...');
}

export const regenerateRelatedCacheForItemNEW = async (env: Bindings, itemId: number) => {
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
    await env.DB.batch(binds);
    console.log({
        message: 'Regenerated cache for item',
        itemId,
    });
    return true;
};
