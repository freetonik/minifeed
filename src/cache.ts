export async function getCachedResponse(cacheKeyPattern: string): Promise<Response | undefined> {
    try {
        const cacheKey = new Request(cacheKeyPattern);
        const cache = caches.default;
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            return new Response(cachedResponse.body, {
                headers: {
                    'Content-Type': 'text/html;charset=UTF-8',
                    'Cache-Hit': 'true',
                },
            });
        }
    } catch (error) {
        console.error('Cache retrieval error:', error);
    }
}

export async function cacheResponse(cacheKeyPattern: string, html: string, sMaxAgeSeconds = 3600): Promise<void> {
    try {
        const cacheKey = new Request(cacheKeyPattern);
        const cache = caches.default;
        const cacheResponse = new Response(html, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': `public, s-max-age=${sMaxAgeSeconds}`,
            },
        });
        await cache.put(cacheKey, cacheResponse);
    } catch (error) {
        console.error('Cache storage error:', error);
    }
}
