import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from '../../htmltools';

export async function handleUpgrade(c: Context) {
    c.set('ACTIVE_PAGE', 'upgrade');
    const userLoggedIn = c.get('USER_LOGGED_IN');
    const userHasSubscription = c.get('USER_HAS_SUBSCRIPTION');

    let freeBlockCTA = '';
    let proBlockCTA = '';

    if (userLoggedIn) {
        if (userHasSubscription) {
            proBlockCTA = `
            <div class="cta">
            <form class="util-mt-1" method="POST" action="/account/billing/customer-portal">
            <button class="button" type="submit">📒 Manage billing</button>
            </form>
            </div>
            `;
        } else {
            proBlockCTA = `
            <div class="cta">
            <form class="util-mt-1" action="/account/billing/create-checkout-session" method="POST">
                <button class="button success" type="submit" id="checkout-button">⚡ Subscribe</button>
            </form>
            </div>`;
        }
    } else {
        freeBlockCTA = `
        <div class="cta">
            <a href='/signup' class="util-mt-1 button success">⚡ Sign up for free</a>
        </div>`;
    }

    const inner = `
<style>
.pricing-container {
    display: flex;
    flex-direction: row;
}
.pricing {
    flex:1;
    padding: 1.25rem 1.75rem;
}
.pricing ul {
    list-style: none;
    padding: 0;
    margin: 0;
}
.pricing ul li {
    margin-bottom: 0.5rem;
}
.pricing .icon {
    margin-right: 0.3rem;
}
.pricing .cta {
    text-align: center;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
}
.pricing:first-child {
    margin-right: 1rem;
}
.pricing:last-child {
    margin-left: 1rem;
}
.pricing h3 {
    padding: 0.5rem 0 1rem 0;
    margin: 0;
}

@media (max-width: 880px) {
    .pricing {
        flex:1;
        padding: 0.75rem 1.25rem;
    }
    .pricing:first-child {
        margin-right: 0.5rem;
    }
    .pricing:last-child {
        margin-left: 0.5rem;
    }
}

@media (max-width: 600px) {
    .pricing-container {
        display: flex;
        flex-direction: column;
    }
    .pricing:first-child {
        margin-right: 0;
    }
    .pricing:last-child {
        margin-top: 1rem;
        margin-left: 0;
    }
}
</style>


<h2>Pricing</h2>

<p>
    Minifeed is free to use, but you can become a paid member to get some cool features and support the development of this project. Feel free to <a href="/support">suggest new features</a>. See <a href="https://github.com/users/freetonik/projects/7/views/1">our roadmap</a>.
</p>

<div class="pricing-container">

<div class="box-grid fancy-gradient-bg borderbox pricing">
    <h3>FREE</h3>
    <ul>
    <li><span class="icon">✅</span> Curate your own feed</li>
    <li><span class="icon">✅</span> Follow people</li>
    <li><span class="icon">✅</span> Favorites</li>
    <li><span class="icon">❌</span> Create lists</li>
    <li><span class="icon">❌</span> Reader view</li>
    <li><span class="icon">❌</span> Search in your personal feed</li>
    <li><span class="icon">❌</span> Weekly email digest (soon)</li>
    <li><span class="icon">❌</span> OPML export</li>
    <li><span class="icon">💰</span> Zero moneys</li>
    </ul>

    ${freeBlockCTA}
</div>

<div class="box-grid fancy-gradient-bg borderbox pricing">
    <h3>PRO</h3>
    <ul>
    <li><span class="icon">✅</span> Curate your own feed</li>
    <li><span class="icon">✅</span> Follow people</li>
    <li><span class="icon">✅</span> Favorites</li>
    <li><span class="icon">✅</span> Create lists</li>
    <li><span class="icon">✅</span> Reader view</li>
    <li><span class="icon">✅</span> Search in your personal feed</li>
    <li><span class="icon">✅</span> Weekly email digest (soon)</li>
    <li><span class="icon">✅</span> OPML export</li>
    <li><span class="icon">💰</span> $39 (€39) per year</li>
    </ul>

    ${proBlockCTA}
</div>

</div>

    `;
    return c.html(renderHTML(c, 'Donate | minifeed', raw(inner)));
}
