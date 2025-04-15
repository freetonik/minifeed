import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from './htmltools';
import { SubscriptionTier } from './interface';

export async function handleStripeCreateCheckoutSessionPOST(c: Context) {
    const rootUrl = c.env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net';
    const priceId = c.env.ENVIRONMENT === 'dev' ? 'price_1R9pucKC5WacZa26gpbziU6Q' : 'price_1QYnPcKC5WacZa262IMq0DLn';
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
            c,
            'Billing | minifeed',
            raw(
                `<div class="flash">❤️ Your subscription is now active! You can manage it in <a href="/account">your account</a>.</div>`,
            ),
        ),
    );
}

export async function handleBillingCancel(c: Context) {
    return c.html(
        renderHTML(
            c,
            'Billing | minifeed',
            raw(`<div class="flash">Something went wrong, or you have changed your mind, maybe? It's ok...</div>`),
        ),
    );
}

async function fulfillCheckout(c: Context, customerEmail: string, customerId: string) {
    console.log({
        message: 'Fulfilling Checkout Session',
        userEmail: customerEmail,
        customerId,
    });

    const userRecord = await c.env.DB.prepare(`
        SELECT user_id
        FROM users
        WHERE email = ?`)
        .bind(customerEmail)
        .first();
    if (!userRecord) {
        console.log({
            message: 'User not found',
            customerEmail,
            customerId,
        });
        return;
    }
    const userId = userRecord.user_id;

    await upgradeOrRenewUserSubscription(c, userId, customerId, SubscriptionTier.PRO, 12);
    console.log({
        message: 'Checkout Session fulfilled successfully',
        userId,
        userEmail: customerEmail,
    });
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
        if (event.type === 'invoice.payment_succeeded') {
            await fulfillCheckout(c, event.data.object.customer_email, event.data.object.customer);
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

const upgradeOrRenewUserSubscription = async (
    c: Context,
    userId: number,
    customerId: string,
    tier: SubscriptionTier,
    months: number,
) => {
    const until = new Date();
    until.setMonth(until.getMonth() + months);

    await c.env.DB.prepare(`
        INSERT OR REPLACE
        INTO user_subscriptions
        (tier, expires, user_id, customer_id)
        VALUES (?, ?, ?, ?)`)
        .bind(tier, until.toISOString(), userId, customerId)
        .run();
};
