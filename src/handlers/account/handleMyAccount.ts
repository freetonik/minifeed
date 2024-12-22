import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { raw } from 'hono/html';
import { sendEmail } from '../../email';
import { renderHTML } from '../../htmltools';
import { SubscriptionTier } from '../../interface';
import type { Bindings } from './../../bindings';

export const handleMyAccount = async (c: Context) => {
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
    const date_format_opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    let subscriptionBlockInner = '';
    if (hasSubscription) {
        const status = user.tier === SubscriptionTier.PRO ? 'Active' : 'Inactive';
        const subscriptionExpires = user.expires
            ? new Date(user.expires).toLocaleString('en-UK', date_format_opts)
            : 'N/A';
        subscriptionBlockInner = `
        Subscription status: ${status}<br>
        Subscription expires: ${subscriptionExpires}

        <form class="util-mt-1" method="POST" action="/account/billing/customer-portal">
        <button class="button" type="submit">📒 Manage billing</button>
        </form>
        `;
    } else {
        subscriptionBlockInner = `
            <strong>
                Subscribe to access cool features and support the development of Minifeed. $39 (€39) per year.
            </strong>
            Upcoming paid features include:
            <ul>
            <li>Weekly email digest</li>
            <li>Listen to articles (text-to-speech)</li>
            <li>Full-text search of your favorites</li>
            <li>Create your link blog</li>
            <li>Reader view</li>
            <li>OPML export</li>
            </ul>
            <form class="util-mt-1" action="/account/billing/create-checkout-session" method="POST">
                <button class="button success" type="submit" id="checkout-button">⚡ Subscribe</button>
            </form>
    `;
    }
    const subscriptionBlock = `<div class="borderbox fancy-gradient-bg util-mt-1"> ${subscriptionBlockInner} </div>`;

    const prefersFullBlogPost = user.prefers_full_blog_post !== null ? user.prefers_full_blog_post : true;
    const preferencesBlock = `
    <h4>Preferences</h4>
    <div class="preferences-container borderbox" id="preferences">
        <form action="/account/preferences" method="POST" id="preferences-form">
            <div class="form-section util-mb-1">
                <h4 class="util-mt-0">Blog posts view</h4>

                <div class="radio-group">
                    <div class="radio-option">
                        <input type="radio" id="prefers-full-blog-post" name="blog-post-view" value="prefers-full-blog-post" ${prefersFullBlogPost ? 'checked' : ''}>
                        <label for="prefers-full-blog-post">Show blog posts in full (when available)</label>
                    </div>
                    <div class="radio-option">
                        <input type="radio" id="prefers-short-blog-post" name="blog-post-view" value="prefers-short-blog-post" ${!prefersFullBlogPost ? 'checked' : ''}>
                        <label for="prefers-short-blog-post">Show excerpts only</label>
                    </div>
                </div>
            </div>

            <button class="button" type="submit">Save Preferences</button>
        </form>
    </div>

`;
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

    const list = `
    <h1>My account</h1>
    <p>
        Username: ${username}<br>
        Profile: <a href="/users/${username}">${username}</a><br>

    </p>

    <p>
        Email: <code>${email}</code><br>

    </p>
    ${preferencesBlock}
    ${c.get('USER_IS_ADMIN') ? subscriptionBlock : ''}

    ${list_of_lists}
    <p style="margin-top:2em; text-align:right;">
        <a class="button button-small" href="/logout">Log out</a>
    </p>`;

    return c.html(renderHTML('My account | minifeed', raw(list), username, ''));
};

export const handleVerifyEmail = async (c: Context) => {
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
                'Email verification | minifeed',
                raw(`<div class="flash flash-red">Email verification code is invalid or has been used already.</div>`),
                false,
                '',
            ),
        );
    }

    const userId = result.user_id;
    const username = result.username;
    await c.env.DB.batch([
        c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE user_id = ?').bind(userId),
        c.env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(userId),
    ]);

    return await createSessionSetCookieAndRedirect(c, userId, username, '/', true);
};

export const handleMyAccountPreferencesPOST = async (c: Context) => {
    const body = await c.req.parseBody();

    let prefersFullBlogPost = 1;
    // let defaultHomepageSubsection = 'all';

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

    // switch (body['default-section']) {
    //     case 'all':
    //         defaultHomepageSubsection = 'all';
    //         break;
    //     case 'subscriptions':
    //         defaultHomepageSubsection = 'subscriptions';
    //         break;
    //     case 'favorites':
    //         defaultHomepageSubsection = 'favorites';
    //         break;
    //     case 'friendfeed':
    //         defaultHomepageSubsection = 'friendfeed';
    //         break;
    //     default:
    //         throw new Error('Invalid default section preference');
    // }

    await c.env.DB.prepare(
        `INSERT OR REPLACE INTO user_preferences (user_id, prefers_full_blog_post)
        VALUES (?, ?)`,
    )
        .bind(c.get('USER_ID'), prefersFullBlogPost)
        .run();

    return c.redirect('/account#preferences');
};

// export const handleResentVerificationEmailPOST = async (c: Context) => {
//     const result = await c.env.DB.prepare(
//         `SELECT verification_code, email, username
//         FROM email_verifications
//         JOIN users ON email_verifications.user_id = users.user_id
//         WHERE email_verifications.user_id = ?`,
//     )
//         .bind(c.get('USER_ID'))
//         .first();

//     await send_email_verification_link(c.env, result.username, result.email, result.verification_code);

//     return c.html(
//         renderHTML(
//             'Email verification | minifeed',
//             raw(`<div class="flash flash-blue">Verification link is sent</div>`),
//             true,
//             '',
//         ),
//     );
// };

export const handleLogout = async (c: Context) => {
    const sessionKey = getCookie(c, 'minifeed_session');
    if (!sessionKey) {
        return c.redirect('/');
    }
    await c.env.SESSIONS_KV.delete(sessionKey);
    deleteCookie(c, 'minifeed_session');
    return c.redirect('/');
};

export const handleLogin = async (c: Context) => {
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
    return c.html(renderHTML('Login or create account | minifeed', raw(list), false));
};

export const handleResetPassword = async (c: Context) => {
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

    return c.html(renderHTML('Reset password | minifeed', raw(inner), false));
};

export const handleResetPasswordPOST = async (c: Context) => {
    const body = await c.req.parseBody();
    const email = body.email.toString().toLowerCase();

    if (!email) throw new Error('Email is required');
    if (!checkEmail(email)) throw new Error('Invalid email');

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
            'Password reset | minifeed',
            raw(`<div class="flash flash-blue">
                If the email address you entered is associated with an account, you will receive an email with a link to reset your password.
            </div>`),
            false,
        ),
    );
};

export const handleSetPasswordPOST = async (c: Context) => {
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

    return c.html(renderHTML('Reset password | minifeed', inner, false));
};

export const handleSignup = async (c: Context) => {
    if (c.get('USER_LOGGED_IN')) return c.redirect('/');

    const inner = `
    <div style="max-width:25em;margin:auto;">

    <div class="borderbox fancy-gradient-bg">
        <h2 style="margin-top:0;">Create account</h2>
        <form action="/signup" method="POST">
            <div style="margin-bottom:1em;">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required />
        </div>

        <div style="margin-bottom:1em;">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required />
        </div>

        <div style="margin-bottom:2em;">
            <label for="pass">Password (8 characters minimum)</label>
            <input type="password" id="pass" name="password" minlength="8" required />
        </div>

        <input class="button" type="submit" value="Create account">
    </form>
    </div>
    `;
    return c.html(renderHTML('Login or create account | minifeed', raw(inner), false));
};

export const handleLoginPOST = async (c: Context) => {
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
                    'Almost there | minifeed',
                    raw(`<div class="flash flash-blue">
                    You have not verified your email yet. Please check your email (${user.email}) for the verification link.
                    </div>`),
                    false,
                ),
            );
        }
        try {
            return await createSessionSetCookieAndRedirect(c, user.user_id, user.username);
        } catch (err) {
            throw new Error('Something went horribly wrong.');
        }
    }
    throw new Error('Wrong email or password');
};

export const handleSignupPOST = async (c: Context) => {
    const body = await c.req.parseBody();
    const username = body.username.toString();
    const password = body.password.toString();
    const email = body.email.toString().toLowerCase();

    if (!checkUsername(username))
        throw new Error(
            'Invalid username. Please, use only letters, numbers, and underscores. Minimum 3 characters, maximum 16 characters.',
        );
    if (password.length < 8) throw new Error('Password too short. Minimum 8 characters.');
    if (!checkEmail(email)) throw new Error('Invalid email');

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
        return c.html(
            renderHTML(
                'Account created | minifeed',
                raw(`<div class="flash flash-blue">
                    Huzzah! Check your email for a verification link.
                </div>`),
                false,
            ),
        );
    } catch (err) {
        throw new Error('Something went horribly wrong.');
    }
};

const send_email_verification_link = async (
    env: Bindings,
    username: string,
    email: string,
    email_verification_code: string,
) => {
    const emailVerificationLink = `${env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net'}/verify_email?code=${email_verification_code}`;

    const emailBody = `Welcome to minifeed, ${username}!<br><br>Please, verify your email by clicking on <strong><a href="${emailVerificationLink}">this link</a></strong>.`;

    await sendEmail(env, email, 'Welcome to minifeed', emailBody);
};

const send_password_reset_link = async (env: Bindings, email: string, password_reset_code: string) => {
    const passwordResetLink = `${env.ENVIRONMENT === 'dev' ? 'http://localhost:8181' : 'https://minifeed.net'}/reset_password?code=${password_reset_code}`;

    const emailBody = `You have requested to reset your password for your minifeed account. If you did not request it, please ignore this email. Otherwise, please click on <strong><a href="${passwordResetLink}">this link</a></strong> to reset your password.`;

    await sendEmail(env, email, 'Password reset request', emailBody);
};

const createSessionSetCookieAndRedirect = async (
    c: Context,
    userId: number,
    username: string,
    redirectTo = '/',
    firstLogin = false,
) => {
    const sessionKey = randomHash(32);
    const kv_value = `${userId};${username}`;
    await c.env.SESSIONS_KV.put(sessionKey, kv_value);
    setCookie(c, 'minifeed_session', sessionKey, {
        path: '/',
        domain: c.env.ENVIRONMENT === 'dev' ? '.localhost' : '.minifeed.net',
        secure: true,
        httpOnly: true,
        maxAge: 34560000,
    });

    if (firstLogin) {
        return c.html(
            renderHTML(
                'Account created | minifeed',
                raw(`<div class="flash flash-blue">
                    Your account is now verified, and you are logged in. What next?
                    <ul>
                    <li>Browse <a href="/blogs">blogs</a>, <a href="/lists">lists</a>, and <a href="/users">users</a> to subscribe to</li>
                    <li>Try searching for stuff (top of the page)</li>
                    <li><a href="/feedback">Send any feedback</a> </li>
                    </ul>
                </div>`),
                true,
            ),
        );
    }

    return c.redirect(redirectTo);
};

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

function checkEmail(email: string) {
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
}
