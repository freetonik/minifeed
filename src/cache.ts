export async function getCachedResponse(cacheKeyPattern: string): Promise<Response | undefined> {
    const cacheKey = new Request(cacheKeyPattern);
    const cache = caches.default;

    try {
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

export async function cacheResponse(cacheKeyPattern: string, html: string): Promise<void> {
    try {
        const cacheKey = new Request(cacheKeyPattern);
        const cache = caches.default;
        const cacheResponse = new Response(html, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });
        await cache.put(cacheKey, cacheResponse);
    } catch (error) {
        // Log cache error but continue with normal response
        console.error('Cache storage error:', error);
    }
}
