import type { Context } from 'hono';
import { itemSqidToId } from '../../utils';

export async function handleListsSingleDeletePOST(c: Context) {
    const list_id = itemSqidToId(c.req.param('list_sqid'));
    const user_id = c.get('USER_ID');

    const list = await c.env.DB.prepare('SELECT * FROM item_lists WHERE list_id = ?').bind(list_id).first();
    if (!list || list.user_id !== user_id) return c.text('Unauthorized', 401);

    await c.env.DB.prepare('DELETE FROM item_lists WHERE list_id = ?').bind(list_id).run();

    return c.html(
        `<div class="flash">List deleted. This page is now a ghost. Refresh to let it ascent into ether.</div>`,
    );
}
