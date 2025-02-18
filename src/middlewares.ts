import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { SubscriptionTier } from './interface';
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

export async function paidSubscriptionRequiredMiddleware(c: Context, next: () => Promise<void>) {
    // TODO:
    // 1. if session info has subscription info, just go next
    // 2. if not, check and modify the current session info

    const user_id = c.get('USER_ID');
    const userLoggedIn = c.get('USER_LOGGED_IN');
    const user = await c.env.DB.prepare(`
        SELECT
        tier
        FROM users
        LEFT JOIN user_subscriptions on users.user_id = user_subscriptions.user_id
        WHERE users.user_id = ?`)
        .bind(user_id)
        .first();

    const hasSubscription = user.tier === SubscriptionTier.PRO;
    if (!hasSubscription) {
        return c.html(
            renderHTML(
                'Paid feature | minifeed',
                raw(`<div class="flash flash-blue">
                    This feature requires a paid subscription. Consider upgrading your account <a href="/account">here</a>.
                </div>`),
                userLoggedIn,
            ),
        );
    }

    await next();
}
