import type { Context } from 'hono';

export async function handleFavicon(c: Context) {
    const file = await c.env.ASSETS.get('favicon.ico');
    if (!file) return c.text('File not found', 404);
    return new Response(file.body, { headers: { 'Content-Type': 'image/x-icon' } });
}
