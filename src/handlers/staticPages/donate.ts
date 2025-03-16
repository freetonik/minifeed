import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from '../../htmltools';
import { renderSubscriptionBlock } from '../account/handleMyAccount';

export async function handleDonate(c: Context) {
    // const user_id = c.get('USER_ID');
    const userLoggedIn = c.get('USER_LOGGED_IN');
    const userHasSubscription = c.get('USER_HAS_SUBSCRIPTION');

    let subscriptionInfoBlock = '';

    if (userLoggedIn && !userHasSubscription) {
        subscriptionInfoBlock = `
        <p class="util-mt-1">You can also become a paid member of Minifeed:
        ${renderSubscriptionBlock(false)}`;
    } else if (!userLoggedIn) {
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
        You can become a Github sponsor:
        <div><iframe src="https://github.com/sponsors/freetonik/button" title="Sponsor freetonik" height="32" width="114" style="border: 0; border-radius: 6px;height:32px;"></iframe></div>
    </p>

    <p>
        Or donate via PayPal:
        <form action="https://www.paypal.com/donate" method="post" target="_top">
        <input type="hidden" name="hosted_button_id" value="ZFUSYXP3FJ8PS" />
        <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="Donate with PayPal button" />
        <img alt="" border="0" src="https://www.paypal.com/en_FI/i/scr/pixel.gif" width="1" height="1" />
        </form>
    </p>

    <p>
        Or become a Patron on Patreon:
    </p>

    <p style="min-height: 2em;">
        <a style="border: 1px solid black; padding: 0.5em 0.75em; text-decoration: none; font-weight: bold; background-color: darkseagreen; border-radius: 4px;" href="https://www.patreon.com/bePatron?u=14297268">Become a patron</a>
    </p>

    <p>
        If you live in Finland 🇫🇮, then it is illegal for me to collect donations from you (it requires a separate paid permit). You can support me by buying some of my courses or e-books:

        <ul>
        <li><a href="https://leanpub.com/conscious-attention/">Conscious Attention</a> for any price</li>
        <li><a href="https://leanpub.com/foundations-of-clojure-programming/">Foundations of Clojure</a> for $19 USD</li>
        <li><a href="https://codexpanse.com/courses/computer-science-for-the-busy-developer">Computer Science for The Busy Developer</a> for $14 USD</li>
        <li><a href="https://codexpanse.com/courses/emacs">The Fundamentals of Emacs</a> for $14 USD</li>
        </ul>

    </p>

    <p>
    Thank you for your support!
    </p>


    `;
    return c.html(renderHTML('Donate | minifeed', raw(donate), userLoggedIn));
}
