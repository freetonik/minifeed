import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { raw } from 'hono/html';
import isEmail from 'validator/lib/isEmail';
import { sendEmail } from '../../email';
import { renderHTML } from '../../htmltools';
import { HomePageSubsectionPreference, SubscriptionTier } from '../../interface';
import { newsletterSubscribe } from '../../newsletter';
import type { Bindings } from './../../bindings';

function renderSubscriptionBlock(hasSubscription: boolean, userExpires?: string) {
    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    let subscriptionBlockInner = '';
    if (hasSubscription) {
        const subscriptionExpires = userExpires
            ? new Date(userExpires).toLocaleString('en-UK', date_format_opts)
            : 'N/A';
        subscriptionBlockInner = `

        Subscription renews: ${subscriptionExpires}
        <br>
        Features: <a href="/upgrade">check out the pricing</a>

        <form class="util-mt-1" method="POST" action="/account/billing/customer-portal">
        <button class="button" type="submit">📒 Manage billing</button>
        </form>
        `;
    } else {
        subscriptionBlockInner = `
            <strong>
                Support the development of Minifeed and get access to new features. $39 (€39) per year.
            </strong>
            <div>
                <a href='/upgrade' class="util-mt-1 button success">⚡ Check out paid features</a>
            </div>
    `;
    }
    return `<div class="borderbox fancy-gradient-bg"> ${subscriptionBlockInner} </div>`;
}

export async function handleMyAccount(c: Context) {
    const user_id = c.get('USER_ID');
    const user = await c.env.DB.prepare(`
            SELECT
            users.created, username, status, email,
            tier, expires,
            user_preferences.prefers_full_blog_post, user_preferences.default_homepage_subsection

            FROM users
            LEFT JOIN user_subscriptions on users.user_id = user_subscriptions.user_id
            LEFT JOIN user_preferences on users.user_id = user_preferences.user_id
            WHERE users.user_id = ?`)
        .bind(user_id)
        .first();

    const email = user.email;
    const username = user.username;
    const hasSubscription = user.tier === SubscriptionTier.PRO;
    const subscriptionBlock = renderSubscriptionBlock(hasSubscription, user.expires);

    const prefersFullBlogPost = user.prefers_full_blog_post !== null ? user.prefers_full_blog_post : true;
    const preferredHomepageSubsection = user.default_homepage_subsection || 'all';
    const preferencesBlock = `

    <div class="preferences-container borderbox util-mt-1" id="preferences">
        <h4 class="util-mt-0 util-mb-0">Preferences</h4>
        <form action="/account/preferences" method="POST" id="preferences-form">
            <div class="form-section util-mb-1">
                <span class="util-mr-05">Blog post view</span>

                <select name="blog-post-view" id="blog-post-select">
                    <option value="prefers-full-blog-post" ${prefersFullBlogPost ? 'selected' : ''}>Show blog posts in full (when available)</option>
                    <option value="prefers-short-blog-post" ${!prefersFullBlogPost ? 'selected' : ''}>Show excerpt only</option>
                </select>
            </div>

            <div class="form-section util-mb-2">
                <span class="util-mr-05">Home page default section</span>

                <select name="default-section" id="section-select">
                    <option value="${HomePageSubsectionPreference.ALL}" ${preferredHomepageSubsection === 'all' ? 'selected' : ''}>All</option>
                    <option value="${HomePageSubsectionPreference.SUBSCRIPTIONS}" ${preferredHomepageSubsection === 'subscriptions' ? 'selected' : ''}>Subscriptions</option>
                    <option value="${HomePageSubsectionPreference.FAVORITES}" ${preferredHomepageSubsection === 'favorites' ? 'selected' : ''}>Favorites</option>
                    <option value="${HomePageSubsectionPreference.FRIENDFEED}" ${preferredHomepageSubsection === 'friendfeed' ? 'selected' : ''}>Friendfeed</option>
                </select>
            </div>

            <button class="button" type="submit">Save Preferences</button>
        </form>
    </div>`;

    let list_of_lists = '';
    const lists = await c.env.DB.prepare(
        `SELECT *
        FROM item_lists
        WHERE user_id = ?`,
    )
        .bind(user_id)
        .all();

    if (lists.results.length > 0) {
        list_of_lists = '<h3>My lists</h3><ul>';
        for (const list of lists.results) {
            list_of_lists += `<li><a href="/lists/${list.list_sqid}">${list.title}</a></li>`;
        }
        list_of_lists += '</ul>';
    }

    const inner = `
    <h1>My account</h1>
    <p>
        Username: <a href="/users/${username}">${username}</a><br>
        Email: <code>${email}</code><br>

    </p>
    ${subscriptionBlock}
    ${preferencesBlock}

    ${list_of_lists}
    <p style="margin-top:2em; text-align:right;">
        <a class="button button-small" href="/logout">Log out</a>
    </p>`;

    return c.html(renderHTML(c, 'My account | minifeed', raw(inner)));
}

export async function handleVerifyEmail(c: Context) {
    if (c.get('USER_LOGGED_IN')) return c.redirect('/');

    const code = c.req.query('code');
    const result = await c.env.DB.prepare(
        'SELECT * from email_verifications JOIN users ON users.user_id = email_verifications.user_id WHERE verification_code = ?',
    )
        .bind(code)
        .first();

    if (!result) {
        return c.html(
            renderHTML(
                c,
                'Email verification | minifeed',
                raw(`<div class="flash flash-red">Email verification code is invalid or has been used already.</div>`),
            ),
        );
    }

    const userId = result.user_id;
    await c.env.DB.batch([
        c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE user_id = ?').bind(userId),
        c.env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(userId),
    ]);

    const userWantedToSubscribeToNewsletter = await c.env.UTILITY_LISTS_KV.get(`user_${userId}_newsletter_subscribed`);
    if (userWantedToSubscribeToNewsletter) {
        console.log('User wanted to subscribe to newsletter');
        await newsletterSubscribe(c.env, result.email);
        await c.env.UTILITY_LISTS_KV.delete(`user_${userId}_newsletter_subscribed`);
    }

    return await createSessionSetCookieAndRedirect(c, userId, '/', true);
}

export async function handleMyAccountPreferencesPOST(c: Context) {
    const body = await c.req.parseBody();

    let prefersFullBlogPost = 1;
    let defaultHomepageSubsection = 'all';

    switch (body['blog-post-view']) {
        case 'prefers-full-blog-post':
            prefersFullBlogPost = 1;
            break;
        case 'prefers-short-blog-post':
            prefersFullBlogPost = 0;
            break;
        default:
            throw new Error('Invalid blog post view preference');
    }

    switch (body['default-section']) {
        case 'all':
            defaultHomepageSubsection = HomePageSubsectionPreference.ALL;
            break;
        case 'subscriptions':
            defaultHomepageSubsection = HomePageSubsectionPreference.SUBSCRIPTIONS;
            break;
        case 'favorites':
            defaultHomepageSubsection = HomePageSubsectionPreference.FAVORITES;
            break;
        case 'friendfeed':
            defaultHomepageSubsection = HomePageSubsectionPreference.FRIENDFEED;
            break;
        default:
            throw new Error('Invalid default section preference');
    }

    await c.env.DB.prepare(
        `INSERT OR REPLACE INTO user_preferences (user_id, prefers_full_blog_post, default_homepage_subsection)
        VALUES (?, ?, ?)`,
    )
        .bind(c.get('USER_ID'), prefersFullBlogPost, defaultHomepageSubsection)
        .run();

    return c.redirect('/account#preferences');
}

export async function handleLogout(c: Context) {
    const sessionKey = getCookie(c, 'minifeed_session');
    if (!sessionKey) {
        return c.redirect('/');
    }
    await c.env.DB.prepare('DELETE FROM sessions WHERE session_key = ?').bind(sessionKey).run();
    deleteCookie(c, 'minifeed_session');
    return c.redirect('/');
}

export async function handleLogin(c: Context) {
    if (c.get('USER_ID')) return c.redirect('/');

    const list = `
    <div style="max-width:25em;margin:auto;">
        <div class="borderbox fancy-gradient-bg">
            <h2 style="margin-top:0;">Log in</h2>
            <form action="/login" method="POST">
                <div style="margin-bottom:1em;">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required />
                </div>

                <div style="margin-bottom:2em;">
                <label for="pass">Password</label>
                <input type="password" id="pass" name="password" minlength="8" required />
                </div>

                <input class="button" type="submit" value="Log in">
            </form>
        </div>
        <p style="text-align:center;">
            Forgot your password? <a href="/reset_password">Reset it here</a>.<br>
            Don't have an account? <a href="/signup">Sign up here</a>.
        </p>
    </div>

    `;
    return c.html(renderHTML(c, 'Log in | minifeed', raw(list)));
}

export async function handleResetPassword(c: Context) {
    if (c.get('USER_LOGGED_IN')) return c.redirect('/');
    const code = c.req.query('code');
    let inner = '';

    if (code) {
        const result = await c.env.DB.prepare('SELECT * from password_resets WHERE reset_code = ?').bind(code).first();
        if (!result) throw new Error('Reset code is invalid or has been used already');

        inner = `
            <div style="max-width:25em;margin:auto;">
                <div class="borderbox">
                    <h2 style="margin-top:0;">Set new password</h2>
                    <form action="/set_password" method="POST">
                        <div style="margin-bottom:2em;">
                            <label for="pass">Password (8 characters minimum)</label>
                            <input type="password" id="password" name="password" minlength="8" required />
                            <input type="text" id="reset_code" name="reset_code" required value="${code}" readonly="readonly" hidden  />
                        </div>
                        <input class="button" type="submit" value="Set password">
                    </form>
                </div>
            </div>`;
    } else {
        // no code provided, show form to enter email
        inner = `
        <div style="max-width:25em;margin:auto;">
            <div class="borderbox">
            <h2 style="margin-top:0;">Reset password</h2>
            <form action="/reset_password" method="POST">
                <div style="margin-bottom:2em;">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required />
                </div>
                <input class="button" type="submit" value="Reset password">
            </form>
            </div>
        </div>
        `;
    }

    return c.html(renderHTML(c, 'Reset password | minifeed', raw(inner)));
}

export async function handleResetPasswordPOST(c: Context) {
    const body = await c.req.parseBody();
    const email = body.email.toString().toLowerCase();

    if (!email) throw new Error('Email is required');
    if (!isEmail(email)) throw new Error('Invalid email');

    const existing_user = await c.env.DB.prepare('SELECT user_id, username, email FROM users WHERE email = ?')
        .bind(email)
        .first();

    if (existing_user) {
        const password_reset_code = randomHash(32);
        await c.env.DB.prepare('INSERT INTO password_resets (user_id, reset_code) VALUES (?, ?)')
            .bind(existing_user.user_id, password_reset_code)
            .run();

        await send_password_reset_link(c.env, email, password_reset_code);
    }

    return c.html(
        renderHTML(
            c,
            'Password reset | minifeed',
            raw(`<div class="flash flash-blue">
                If the email address you entered is associated with an account, you will receive an email with a link to reset your password.
            </div>`),
        ),
    );
}

export async function handleSetPasswordPOST(c: Context) {
    const body = await c.req.parseBody();
    const password = body.password.toString();
    const reset_code = body.reset_code.toString();

    if (password.length < 8) throw new Error('Password too short');

    const code_from_db = await c.env.DB.prepare('SELECT * from password_resets WHERE reset_code = ?')
        .bind(reset_code)
        .first();

    if (!code_from_db) throw new Error('Reset code is invalid or has been used already.');

    const user_id = code_from_db.user_id;
    const [new_password_hash, new_salt] = await hashPassword(password);
    const updating_query = await c.env.DB.prepare(
        'UPDATE users SET password_hash = ?, password_salt = ? WHERE user_id = ?',
    )
        .bind(new_password_hash, new_salt, user_id)
        .run();

    if (!updating_query.success) throw new Error('Something went wrong when updating your password.');

    // Delete all password reset codes of user, verify their email
    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user_id),
        c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE user_id = ?').bind(user_id),
        c.env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(user_id),
    ]);

    const inner = raw(
        `<div class="flash flash-blue">Password reset successfully. <a href="/login">Log in now</a>.</div>`,
    );

    return c.html(renderHTML(c, 'Reset password | minifeed', inner));
}

export async function handleSignup(c: Context) {
    if (c.get('USER_LOGGED_IN')) return c.redirect('/');

    const inner = `
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <div style="max-width:30em;margin:auto;">

    <div class="borderbox fancy-gradient-bg">
        <h2 style="margin-top:0;">Create account</h2>
        <form action="/signup" method="POST">
            <div class="util-mb-1">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required />
        </div>

        <div class="util-mb-1">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required />
        </div>

        <div class="util-mb-1">
            <label for="pass">Password (8 characters minimum)</label>
            <input type="password" id="pass" name="password" minlength="8" required />
        </div>

        <div class="util-mb-1 cf-turnstile" data-sitekey="0x4AAAAAAA36sJM6uC8FfZ--"></div>
        <div class="util-mb-1 large-checkbox-container">
            <input type="checkbox" id="newsletter" name="newsletter" value="yes" />
            <label for="newsletter">Receive our newsletter: editor's picks & feature updates</label>
        </div>


        <input class="button" type="submit" value="Create account">
    </form>

    </div>
    `;
    return c.html(renderHTML(c, 'Create account | minifeed', raw(inner)));
}

export async function handleLoginPOST(c: Context) {
    const body = await c.req.parseBody();
    const email = body.email.toString();
    const attempted_password = body.password.toString();

    if (!email || !attempted_password) {
        throw new Error('Email and password are required');
    }

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE users.email = ?').bind(email).first();
    if (!user) {
        // though user may not exist, we should not leak this information
        throw new Error('Wrong email or password.');
    }

    const passwordVerified = await verifyPassword(user.password_hash, user.password_salt, attempted_password);
    if (passwordVerified) {
        if (user.email_verified !== 1) {
            return c.html(
                renderHTML(
                    c,
                    'Almost there | minifeed',
                    raw(`<div class="flash flash-blue">
                    You have not verified your email yet. Please check your email (${user.email}) for the verification link.
                    </div>`),
                ),
            );
        }
        try {
            return await createSessionSetCookieAndRedirect(c, user.user_id);
        } catch (err) {
            throw new Error('Something went horribly wrong.');
        }
    }
    throw new Error('Wrong email or password');
}

export async function handleSignupPOST(c: Context) {
    const body = await c.req.parseBody();
    const username = body.username.toString();
    const password = body.password.toString();
    const email = body.email.toString().toLowerCase();
    const newsletter = body.newsletter === 'yes';

    // CLOUDFLARE TURNSTILE
    const token = body['cf-turnstile-response']?.toString();
    const localEnv = c.env.ENVIRONMENT === 'dev';
    if (!token && !localEnv) {
        return c.text('Missing captcha token', 400);
    }

    const ip = c.req.header('CF-Connecting-IP');
    const formData = new FormData();
    formData.append('secret', c.env.CF_TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    if (!localEnv) {
        const result = await fetch(url, {
            body: formData,
            method: 'POST',
        });
        const outcome = await result.json();
        if (!outcome.success) {
            return c.text('Missing captcha token', 400);
        }
    }

    if (!checkUsername(username))
        throw new Error(
            'Invalid username. Please, use only letters, numbers, and underscores. Minimum 3 characters, maximum 16 characters.',
        );
    if (password.length < 8) throw new Error('Password too short. Minimum 8 characters.');
    if (!isEmail(email)) throw new Error('Invalid email');

    // Check if username already exists
    const existingUser = await c.env.DB.prepare('SELECT username FROM users WHERE username = ?')
        .bind(username.toLowerCase())
        .first();
    if (existingUser) {
        throw new Error('Username already taken. Please choose a different username.');
    }
    // Check if email already exists
    const existing_email = await c.env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
    if (existing_email && existing_email.email === email) {
        throw new Error('Email already taken. Please use a different email.');
    }

    const [password_hash, salt] = await hashPassword(password);
    try {
        await c.env.DB.prepare('INSERT INTO users (username, email, password_hash, password_salt) values (?, ?, ?, ?)')
            .bind(username, email, password_hash, salt)
            .run();

        const userId = (
            await c.env.DB.prepare('SELECT users.user_id FROM users WHERE username = ?').bind(username).first()
        ).user_id;

        await c.env.DB.prepare('INSERT INTO user_preferences (user_id) values (?)').bind(userId).run();

        const email_verification_code = randomHash(32);
        await c.env.DB.prepare('INSERT INTO email_verifications (user_id, verification_code) values (?, ?)')
            .bind(userId, email_verification_code)
            .run();

        await send_email_verification_link(c.env, username, email, email_verification_code);
        if (newsletter) await c.env.UTILITY_LISTS_KV.put(`user_${userId}_newsletter_subscribed`, 'true');

        return c.html(
            renderHTML(
                c,
                'Account created | minifeed',
                raw(`<div class="flash flash-blue">
                    Huzzah! Check your email for a verification link.<br>
                    Please verify your email within 3 days. Otherwise, your account will be deleted. Sorry for this, we just have to keep bots out. But you're totally human!
                </div>`),
            ),
        );
    } catch (err) {
        throw new Error('Something went horribly wrong.');
    }
}

async function send_email_verification_link(
    env: Bindings,
    username: string,
    email: string,
    email_verification_code: string,
) {
    const emailVerificationLink = `${env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net'}/verify_email?code=${email_verification_code}`;

    const emailBody = `Welcome to minifeed, ${username}!<br><br>Verify your email by clicking on <strong><a href="${emailVerificationLink}">this link</a></strong>.
    <br>
    Please do it within 3 days. Otherwise, your account will be deleted. Sorry for this, we just have to keep bots out. But you're totally human!
    `;

    await sendEmail(env, email, 'Welcome to minifeed', emailBody);
}

async function send_password_reset_link(env: Bindings, email: string, password_reset_code: string) {
    const passwordResetLink = `${env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net'}/reset_password?code=${password_reset_code}`;

    const emailBody = `You have requested to reset your password for your minifeed account. If you did not request it, please ignore this email. Otherwise, please click on <strong><a href="${passwordResetLink}">this link</a></strong> to reset your password.`;

    await sendEmail(env, email, 'Password reset request', emailBody);
}

async function createSessionSetCookieAndRedirect(c: Context, userId: number, redirectTo = '/', firstLogin = false) {
    const sessionKey = randomHash(32);

    const sessionIdResult = await c.env.DB.prepare(
        'INSERT INTO sessions (user_id, session_key) values (?, ?) RETURNING session_id',
    )
        .bind(userId, sessionKey)
        .first();

    if (!sessionIdResult.session_id) throw new Error('Could not create session');

    setCookie(c, 'minifeed_session', sessionKey, {
        path: '/',
        domain: c.env.ENVIRONMENT === 'dev' ? '.localhost' : '.minifeed.net',
        secure: true,
        httpOnly: true,
        maxAge: 34560000,
    });

    c.set('USER_ID', userId);
    c.set('USER_LOGGED_IN', true);

    if (firstLogin) {
        return c.html(
            renderHTML(
                c,
                'Account created | minifeed',
                raw(`<div class="flash flash-blue">
                    Your account is now verified, and you are logged in. What next?
                    <ul>
                    <li>Browse <a href="/blogs">blogs</a>, <a href="/lists">lists</a>, and <a href="/users">users</a> to subscribe to</li>
                    <li>Try searching for stuff (top of the page)</li>
                    <li><a href="/support">Need support? Have feedback?</a> </li>
                    </ul>
                </div>`),
            ),
        );
    }

    return c.redirect(redirectTo);
}

function randomHash(len: number): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(len / 2))), (b) =>
        `0${(b & 0xff).toString(16)}`.slice(-2),
    ).join('');
}

export async function hashPassword(password: string, providedSalt?: Uint8Array): Promise<[string, string]> {
    const encoder = new TextEncoder();
    // Use provided salt if available, otherwise generate a new one
    const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, [
        'deriveBits',
        'deriveKey',
    ]);

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
    const exportedKey = (await crypto.subtle.exportKey('raw', key)) as ArrayBuffer;

    const hashBuffer = new Uint8Array(exportedKey);
    const hashArray = Array.from(hashBuffer);
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    return [hashHex, saltHex];
}

export async function verifyPassword(hash: string, salt: string, passwordAttempt: string): Promise<boolean> {
    const matchResult = salt.match(/.{1,2}/g);
    if (!matchResult) throw new Error('Invalid salt format');

    const saltUint = new Uint8Array(matchResult.map((byte) => Number.parseInt(byte, 16)));
    const [attemptHash, _] = await hashPassword(passwordAttempt, saltUint);
    return attemptHash === hash;
}

function checkUsername(username: string) {
    return /^[a-zA-Z0-9_]{3,16}$/.test(username);
}
