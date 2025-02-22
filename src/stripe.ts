import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { SubscriptionTier } from './interface';

export async function handleStripeCreateCheckoutSessionPOST(c: Context) {
    const rootUrl = c.env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net';
    const priceId = c.env.ENVIRONMENT === 'dev' ? 'price_1QRcf4KC5WacZa26QtsqLKH9' : 'price_1QYnPcKC5WacZa262IMq0DLn';
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
                price: priceId,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        success_url: `${rootUrl}/account/billing/success`,
        cancel_url: `${rootUrl}/account/billing/cancel`,
        automatic_tax: { enabled: true },
    });

    return c.redirect(session.url, 303);
}

export async function handleBillingSuccess(c: Context) {
    return c.html(
        renderHTML(
            'Billing | minifeed',
            raw(
                `<div class="flash">❤️ Your subscription is now active! You can manage it in <a href="/account">your account</a>.</div>`,
            ),
            c.get('USER_LOGGED_IN'),
        ),
    );
}

export async function handleBillingCancel(c: Context) {
    return c.html(
        renderHTML(
            'Billing | minifeed',
            raw(`<div class="flash">Something went wrong, or you have changed your mind, maybe? It's ok...</div>`),
            c.get('USER_LOGGED_IN'),
        ),
    );
}

async function fulfillCheckout(c: Context, sessionId: string) {
    const stripe = c.get('stripe');

    console.log({
        message: 'Fulfilling Checkout Session',
        sessionId,
    });

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items'],
    });

    const customerEmail = checkoutSession.customer_details.email;
    const userId = checkoutSession.metadata.user_id;
    const customerId = checkoutSession.customer;

    if (checkoutSession.payment_status !== 'unpaid') {
        await upgradeUser(c, userId, customerId, SubscriptionTier.PRO, 12);
        console.log({
            message: 'Checkout Session fulfilled successfully',
            sessionId,
            userId,
            userEmail: customerEmail,
        });
    }
}

export async function handleStripeWebhook(c: Context) {
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
}

export async function handleStripeCustomerPortalPOST(c: Context) {
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
}

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
