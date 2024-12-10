import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
const Stripe = require('stripe');

// Set user_id and username in context if user is logged in
export async function authCheckMiddleware(c: Context, next: () => Promise<void>) {
    const sessionKey = getCookie(c, 'minifeed_session');
    if (sessionKey) {
        const kv_value = await c.env.SESSIONS_KV.get(sessionKey);
        if (kv_value != null) {
            const values = kv_value.split(';');
            c.set('USER_ID', Number.parseInt(values[0]));
            c.set('USERNAME', values[1]);
            c.set('USER_LOGGED_IN', true);
            c.set('USER_IS_ADMIN', values[0] === '1');
            // TODO: upsert KV only when key is expiring soon
            await c.env.SESSIONS_KV.put(sessionKey, kv_value, {
                expirationTtl: 31536000, // 1 year
            });
        } else {
            c.set('USER_LOGGED_IN', false);
        }
    } else {
        c.set('USER_LOGGED_IN', false);
    }

    await next();
}

// User must be logged in
export async function authRequiredMiddleware(c: Context, next: () => Promise<void>) {
    if (!c.get('USER_ID')) return c.redirect('/login');
    await next();
}

// User must be logged in and be admin
export async function adminRequiredMiddleware(c: Context, next: () => Promise<void>) {
    if (!c.get('USER_IS_ADMIN')) return c.notFound();

    await next();
}

export const stripeMiddleware = async (c: Context, next: () => Promise<void>) => {
    const stripeKey = c.env.STRIPE_API_KEY;

    const stripe = new Stripe(stripeKey, {
        maxNetworkRetries: 3,
        timeout: 30 * 1000,
    });
    c.set('stripe', stripe);

    await next();
};
