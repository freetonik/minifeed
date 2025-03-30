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
        const sessionWithDetails = await c.env.DB.prepare(`
            SELECT sessions.created, session_id, users.user_id, users.username, tier
            FROM sessions
            JOIN users ON sessions.user_id = users.user_id
            LEFT JOIN user_subscriptions on users.user_id = user_subscriptions.user_id
            WHERE session_key = ?
            `)
            .bind(sessionKey)
            .first();

        if (sessionWithDetails) {
            c.set('USER_ID', sessionWithDetails.user_id);
            c.set('USERNAME', sessionWithDetails.username);
            c.set('USER_LOGGED_IN', true);
            c.set('USER_IS_ADMIN', sessionWithDetails.user_id === 1);
            c.set('USER_TIER', sessionWithDetails.tier || SubscriptionTier.FREE);
            c.set('USER_HAS_SUBSCRIPTION', sessionWithDetails.tier === SubscriptionTier.PRO);

            // if sessionWithDetails.created is older than 11 months, update created to today
            const created = new Date(sessionWithDetails.created);
            const elevenMonthsAgo = new Date(Date.now() - 11 * 30 * 24 * 60 * 60 * 1000);
            if (created < elevenMonthsAgo) {
                await c.env.DB.prepare(`
                    UPDATE sessions
                    SET created = ?
                    WHERE session_id = ?`)
                    .bind(new Date().toISOString(), sessionWithDetails.session_id)
                    .run();
            }
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

export async function stripeMiddleware(c: Context, next: () => Promise<void>) {
    const stripeKey = c.env.STRIPE_API_KEY;
    const stripe = new Stripe(stripeKey, {
        maxNetworkRetries: 3,
        timeout: 30 * 1000,
    });
    c.set('stripe', stripe);
    await next();
}

export async function paidSubscriptionRequiredMiddleware(c: Context, next: () => Promise<void>) {
    const hasSubscription = c.get('USER_HAS_SUBSCRIPTION');

    if (!hasSubscription) {
        return c.html(
            renderHTML(
                c,
                'Paid feature | minifeed',
                raw(`<div class="flash flash-blue">
                    This feature requires a paid subscription. Consider upgrading your account <a href="/account">here</a>.
                </div>`),
            ),
        );
    }

    await next();
}

export async function basicContextMiddleware(c: Context, next: () => Promise<void>) {
    const pathname = c.req.path; // e.g. /items/123
    const base = pathname.split('/')[1]; // e.g. items

    switch (base) {
        case 'all':
        case 'subscriptions':
        case 'favorites':
        case 'friendfeed':
            c.set('ACTIVE_PAGE', 'my');
            break;

        case 'global':
            c.set('ACTIVE_PAGE', 'global');
            break;

        case 'blogs':
        case 'items':
            c.set('ACTIVE_PAGE', 'blogs');
            break;

        case 'lists':
            c.set('ACTIVE_PAGE', 'lists');
            break;

        case 'users':
            c.set('ACTIVE_PAGE', 'users');
            break;

        case 'links':
        case 'linkblogs':
            c.set('ACTIVE_PAGE', 'links');
            break;

        case 'account':
            c.set('ACTIVE_PAGE', 'account');
            break;

        default:
            //statements;
            break;
    }

    await next();
}
