import type { Context } from 'hono';
import type { Bindings } from '../../bindings';
import { addItemsToFeed, regenerateTopItemsCacheForFeed } from '../../feeds';
import { renderAddItemByURLForm, renderHTML } from '../../htmltools';
import type { RelatedItemCached } from '../../interface';
import { enqueueVectorizeStoreItem } from '../../queue';
import { scrapeURLIntoObject } from '../../scrape';
import { updateItemIndex } from '../../search';
import { feedSqidToId, itemIdToSqid, itemSqidToId } from '../../utils';

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

    const itemToBeDeleted = await c.env.DB.prepare('SELECT * FROM items WHERE item_id = ?').bind(itemId).first();
    const feedId = itemToBeDeleted.feed_id;

    const dbDeleteResults = await c.env.DB.prepare('DELETE FROM items WHERE item_id = ?').bind(itemId).run();
    if (dbDeleteResults.success) {
        if (c.env.ENVIRONMENT !== 'dev') await c.env.VECTORIZE.deleteByIds([`${itemId}`]);
        await regenerateTopItemsCacheForFeed(c.env, feedId);
        return c.html('Item deleted. Delete it from the index yourself dude');
    }
    return c.html('ERROR while deleting item from DB');
};

export const handleItemsAddItemByUrlPOST = async (c: Context) => {
    const feedSqid = c.req.param('feed_sqid');
    const feedId = feedSqidToId(feedSqid);

    const body = await c.req.parseBody();
    const url = body.url.toString();
    const urls = body.urls.toString();
    if (!url && !urls) {
        return c.html('Both URL and URLs are empty');
    }
    if (url && urls) {
        return c.html('Both URL and URLs are filled in, please only fill in one');
    }

    let urls_array: Array<string>;
    if (url) {
        urls_array = [url];
    } else if (urls) {
        urls_array = urls.split('\r\n');
    } else urls_array = [];

    if (!urls_array.length) return c.html('No URLs provided');

    // remove empty strings from urls_array
    urls_array = urls_array.filter((url: string) => url !== '');

    const added_items_sqids = [];

    for (const url_value of urls_array) {
        // check if item url already exists in the db
        const existingItem = await c.env.DB.prepare('SELECT items.item_id FROM items WHERE url = ?')
            .bind(url_value)
            .run();
        if (existingItem.results.length > 0) {
            continue;
        }
        const articleContent = await scrapeURLIntoObject(url_value);
        const item = {
            feed_id: feedId,
            title: articleContent.title,
            link: url_value,
            published: articleContent.published,
            description: articleContent.description,
            content_from_content: articleContent.HTMLcontent,
        };

        const insert_results = await addItemsToFeed(c.env, [item], feedId, false); // don't scrape after adding
        const addedItemId = insert_results[0].meta.last_row_id;

        // await enqueueItemIndex(c.env, addedItemId); // addItemsToFeed(..scrapeAfterAdding=false), so scrape it...
        await updateItemIndex(c.env, addedItemId, articleContent.textContent);
        await enqueueVectorizeStoreItem(c.env, addedItemId); // ... and vectorize it...

        const addedItemSqid = itemIdToSqid(addedItemId);
        added_items_sqids.push(addedItemSqid);
    }
    // it was a single URL, redirect to new post
    if (url) {
        if (added_items_sqids.length > 1) {
            return c.redirect(`/items/${added_items_sqids[0]}`);
        }
        throw new Error('No items added. Probably all of them already exist in the database by unique URL');
    }
    // it was multiple URLs, redirect to blog
    return c.redirect(`/blogs/${feedSqid}`);
};

export const handleItemRefresh = async (c: Context) => {
    const itemSqid = c.req.param('item_sqid');
    const itemId = itemSqidToId(itemSqid);
    const wf = await c.env.ADD_UPDATE_ITEM_WORKFLOW.create({ params: { itemId } });
    return c.html(`
        <a href="https://dash.cloudflare.com/${c.env.CF_ACCOUNT_ID}/workers/workflows/add-item-workflow/instance/${wf.id}">WORKFLOW STARTED</a>
        `);
};

export const regenerateRelatedCacheForItem = async (env: Bindings, itemId: number) => {
    if (env.ENVIRONMENT === 'dev') {
        await regenerateRelatedCacheForItemMOCK(env, itemId);
        return true;
    }
    const vectors = await env.VECTORIZE.getByIds([`${itemId}`]);
    if (!vectors.length) {
        console.log({
            message: 'Unable to generate related cache: item not found in vector store',
            itemId,
        });
        return false;
    }

    const item = await env.DB.prepare(
        `SELECT items.item_id, feeds.title as feed_title
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        WHERE item_id = ?`,
    )
        .bind(itemId)
        .first();

    if (!item) {
        console.log({
            message: 'Unable to generate related cache: item not found in database',
            itemId,
        });
        return false;
    }

    const cacheContent: { relatedFromOtherBlogs: RelatedItemCached[]; relatedFromThisBlog: RelatedItemCached[] } = {
        relatedFromOtherBlogs: [],
        relatedFromThisBlog: [],
    };

    // Processing items from other blogs
    const matchesOtherBlogs = await env.VECTORIZE.query(vectors[0].values, {
        topK: 11,
        filter: { feed_id: { $ne: `${item.feed_id}` } },
    });

    const relatedIDsOtherBlog: Array<string> = [];
    for (const match of matchesOtherBlogs.matches) {
        if (match.id === `${itemId}`) continue; // skip current item itself
        relatedIDsOtherBlog.push(match.id);
    }

    const queryBindPlaceholders = relatedIDsOtherBlog.map(() => '?').join(','); // Generate '?,?,...,?'
    const relatedItemsOtherBlog = await env.DB.prepare(
        `SELECT item_id, item_sqid, items.title, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, items.url
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        WHERE item_id IN (${queryBindPlaceholders})`,
    )
        .bind(...relatedIDsOtherBlog)
        .all();

    for (const i of relatedItemsOtherBlog.results) {
        cacheContent.relatedFromOtherBlogs.push({
            title: i.title as string,
            item_id: i.item_id as number,
            item_sqid: i.item_sqid as string,
            feed_title: i.feed_title as string,
            feed_id: i.feed_id as number,
            feed_sqid: i.feed_sqid as string,
            url: i.url as string,
        });
    }

    await env.DB.prepare(
        'INSERT OR REPLACE INTO items_related_cache (item_id, content, created) values (?, ?, CURRENT_TIMESTAMP)',
    )
        .bind(itemId, JSON.stringify(cacheContent))
        .run();

    console.log({
        message: 'Regenerated cache for item',
        itemId,
    });
    return true;
};

export const regenerateRelatedCacheForItemMOCK = async (env: Bindings, itemId: number) => {
    if (env.ENVIRONMENT !== 'dev') return;
    console.log('DEV MODE: Regenerating cache with random items');

    const item = await env.DB.prepare(
        `SELECT items.item_id, feeds.title as feed_title
        FROM items
        JOIN feeds ON items.feed_id = feeds.feed_id
        WHERE item_id = ?`,
    )
        .bind(itemId)
        .first();

    if (!item) throw new Error(`Item with id ${itemId} not found`);

    const cache_content: { relatedFromOtherBlogs: RelatedItemCached[]; relatedFromThisBlog: RelatedItemCached[] } = {
        relatedFromOtherBlogs: [],
        relatedFromThisBlog: [],
    };

    const relatedIDsOtherBlog: Array<string> = [];

    const randomItems = await env.DB.prepare(
        `SELECT item_id, item_sqid, items.title, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, items.url
        FROM items
        JOIN  feeds ON items.feed_id = feeds.feed_id
        ORDER BY RANDOM()
        LIMIT 10`,
    ).all();

    relatedIDsOtherBlog.push(...randomItems.results.map((i: any) => i.item_id));

    const queryBindPlaceholders = relatedIDsOtherBlog.map(() => '?').join(','); // Generate '?,?,...,?'
    const relatedItemsOtherBlog = await env.DB.prepare(
        `SELECT item_id, item_sqid, items.title, feeds.title as feed_title, items.feed_id, feeds.feed_sqid, items.url
        FROM items
        JOIN  feeds ON items.feed_id = feeds.feed_id
        WHERE item_id IN (${queryBindPlaceholders})`,
    )
        .bind(...relatedIDsOtherBlog)
        .all();

    for (const i of relatedItemsOtherBlog.results) {
        cache_content.relatedFromOtherBlogs.push({
            title: i.title as string,
            item_id: i.item_id as number,
            item_sqid: i.item_sqid as string,
            feed_title: i.feed_title as string,
            feed_id: i.feed_id as number,
            feed_sqid: i.feed_sqid as string,
            url: i.url as string,
        });
    }
    console.log({
        message: 'Regenerated related cache for item',
        itemId,
    });
    await env.DB.prepare(
        'REPLACE INTO items_related_cache (item_id, content, created) values (?, ?, CURRENT_TIMESTAMP)',
    )
        .bind(itemId, JSON.stringify(cache_content))
        .run();
};
