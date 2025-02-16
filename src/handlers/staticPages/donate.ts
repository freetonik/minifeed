import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from '../../htmltools';
import { SubscriptionTier } from '../../interface';
import { renderSubscriptionBlock } from '../account/handleMyAccount';

export async function handleDonate(c: Context) {
    const user_id = c.get('USER_ID');
    let user = undefined;
    if (user_id) {
        user = await c.env.DB.prepare(`
            SELECT
            users.created, username, status, email,
            tier, expires

            FROM users
            LEFT JOIN user_subscriptions on users.user_id = user_subscriptions.user_id

            WHERE users.user_id = ?`)
            .bind(user_id)
            .first();
    }

    let subscriptionInfoBlock = '';

    if (user && user.tier !== SubscriptionTier.PRO) {
        subscriptionInfoBlock = `
        <p class="util-mt-1">You can also become a paid member of Minifeed:
        ${renderSubscriptionBlock(false)}`;
    } else if (!user) {
        subscriptionInfoBlock = `
        <p>The best way to support this project is to <a href="/signup">sign up for a free account</a>, and later become a paid member to get some cool features.
        ${renderSubscriptionBlock(false, undefined, undefined, true)}
        </p>`;
    }

    const donate = `
    <h2>Support the development of Minifeed</h2>

    <p>Minifeed is built and maintained by one person (it's me, Rakhim 😬).</p>

    ${subscriptionInfoBlock}

    <p>
    If you just want to donate, it would've been so easy, but unfortunately, I live in Finland 🇫🇮, and we have this weird law which effectively prevents people from accepting donations (you need a special permit). But you can buy some of my books or courses:

    <ul>
        <li><a href="https://codexpanse.com/courses/conscious-attention">Conscious Attention</a> for $5 USD</li>
        <li><a href="https://codexpanse.com/courses/computer-science-for-the-busy-developer">Computer Science for The Busy Developer
</a> for $14 USD</li>
        <li><a href="https://codexpanse.com/courses/clojure">Clojure Basics</a> for $14 USD</li>
        <li><a href="https://codexpanse.com/courses/emacs">The Fundamentals of Emacs</a> for $14 USD</li>
    </ul>

    </p>


    `;
    return c.html(renderHTML('Donate | minifeed', raw(donate), c.get('USER_LOGGED_IN')));
}
