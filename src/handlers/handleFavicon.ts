import type { Context } from 'hono';

export const handleFavicon = async (c: Context) => {
    const file = await c.env.ASSETS.get('favicon.ico');
    if (!file) return c.text('File not found', 404);

    return new Response(file.body, { headers: { 'Content-Type': 'image/x-icon' } });
};
