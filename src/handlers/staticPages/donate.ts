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
        subscriptionInfoBlock = `<hr class="util-mt-1">
        <p class="util-mt-1">You can also become a paid member of Minifeed:
        ${renderSubscriptionBlock(false)}`;
    } else if (!user) {
        subscriptionInfoBlock = `<hr class="util-mt-1">
        <p>You can also <a href="/signup">sign up for a free account</a>, and later become a paid member to get some cool features.</p>`;
    }

    const donate = `
    <h2>Donate to Minifeed</h2>

    <p>Minifeed is built and maintained by one person (it's me, Rakhim 😬). If you want to support this project, there are options!
    You can become a Github sponsor:</p>

    <p><iframe src="https://github.com/sponsors/freetonik/button" title="Sponsor freetonik" height="32" width="114" style="border: 0; border-radius: 6px;height:32px;"></iframe></p>

    <p>
    Or donate via PayPal:
    <form action="https://www.paypal.com/donate" method="post" target="_top">
    <input type="hidden" name="hosted_button_id" value="ZFUSYXP3FJ8PS" />
    <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="Donate with PayPal button" />
    <img alt="" border="0" src="https://www.paypal.com/en_FI/i/scr/pixel.gif" width="1" height="1" />
    </form>

    <p>Or become a Patron on Patreon:</p>

    <p style="min-height: 2em;">
    <a style="border: 1px solid black; padding: 0.5em 0.75em;
    text-decoration: none;
    font-weight: bold;
    background-color: darkseagreen; border-radius: 4px;" href="https://www.patreon.com/bePatron?u=14297268">Become a patron</a></p>

    ${subscriptionInfoBlock}

    </p>
    `;
    return c.html(renderHTML('Donate | minifeed', raw(donate), c.get('USER_LOGGED_IN')));
}
