import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { SubscriptionTier } from './interface';

export const handleStripeCreateCheckoutSessionPOST = async (c: Context) => {
    const rootUrl = c.env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net';
    const user_id = c.get('USER_ID');
    const stripe = c.get('stripe');

    const user = await c.env.DB.prepare(`
        SELECT created, username, email_verified, status, email
        FROM users
        WHERE user_id = ?`)
        .bind(user_id)
        .first();

    const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        metadata: {
            user_id: user_id,
        },
        line_items: [
            {
                price: 'price_1QRcf4KC5WacZa26QtsqLKH9',
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: `${rootUrl}/account/billing/success`,
        cancel_url: `${rootUrl}/account/billing/cancel`,
        automatic_tax: { enabled: true },
    });

    return c.redirect(session.url, 303);
};

export const handleBillingSuccess = async (c: Context) => {
    return c.html(renderHTML('Billing | minifeed', raw(`<div class="flash">Success!.</div>`), c.get('USER_LOGGED_IN')));
};

export const handleBillingCancel = async (c: Context) => {
    return c.html(renderHTML('Billing | minifeed', raw(`<div class="flash">Cancel!.</div>`), c.get('USER_LOGGED_IN')));
};

async function fulfillCheckout(c: Context, sessionId: string) {
    const stripe = c.get('stripe');

    console.log(`Fulfilling Checkout Session ${sessionId}`);

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items'],
    });

    const customerEmail = checkoutSession.customer_details.email;
    const userId = checkoutSession.metadata.user_id;
    const customerId = checkoutSession.customer;

    console.log(`Checkout Session ${sessionId} fulfilled successfully for user ${userId} with email ${customerEmail}`);

    if (checkoutSession.payment_status !== 'unpaid') {
        await upgradeUser(c, userId, customerId, SubscriptionTier.PRO, 12);
        console.log(
            `Checkout Session ${sessionId} fulfilled successfully for user ${userId} with email ${customerEmail}`,
        );
    }
}

export const handleStripeWebhook = async (c: Context) => {
    const stripe = c.get('stripe');
    const endpointSecret = c.env.STRIPE_WEBHOOK_ENDPOINT_SECRET;

    const sig = c.req.header('stripe-signature');

    try {
        if (!sig) {
            return c.text('', 400);
        }
        const body = await c.req.text();
        const event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret);
        if (event.type === 'checkout.session.completed') {
            await fulfillCheckout(c, event.data.object.id);
        }

        return c.text('', 200);
    } catch (err) {
        const errorMessage = `⚠️  Webhook signature verification failed. ${err instanceof Error ? err.message : 'Internal server error'}`;
        console.log(errorMessage);
        return c.text(errorMessage, 400);
    }
};

export const handleStripeCustomerPortalPOST = async (c: Context) => {
    const stripe = c.get('stripe');
    const user_id = c.get('USER_ID');
    const user = await c.env.DB.prepare(`
        SELECT customer_id
        FROM users
        JOIN user_subscriptions ON users.user_id = user_subscriptions.user_id
        WHERE users.user_id = ?`)
        .bind(user_id)
        .first();

    if (!user) {
        return c.text('User not found', 404);
    }
    const session = await stripe.billingPortal.sessions.create({
        customer: user.customer_id,
        return_url: 'https://minifeed.net/account',
    });
    return c.redirect(session.url, 303);
};

const upgradeUser = async (c: Context, user_id: number, customerId: string, tier: SubscriptionTier, months: number) => {
    const until = new Date();
    until.setMonth(until.getMonth() + months);

    await c.env.DB.prepare(`
        INSERT OR REPLACE
        INTO user_subscriptions
        (tier, expires, user_id, customer_id)
        VALUES (?, ?, ?, ?)`)
        .bind(tier, until.toISOString(), user_id, customerId)
        .run();
};
