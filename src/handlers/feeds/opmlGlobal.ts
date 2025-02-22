import type { Context } from 'hono';
import { generateOPML } from '../../utils';

export async function handleOPMLGlobal(c: Context) {
    const { results } = await c.env.DB.prepare('SELECT * FROM feeds ORDER BY feed_id ASC').all();
    const opml = generateOPML(results);
    return c.body(opml, 200, { 'Content-Type': 'text/xml' });
}
