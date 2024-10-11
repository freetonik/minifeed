import { html, raw } from "hono/html";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { renderHTML } from "./htmltools";
import { sendEmail } from "./email";
import { feedIdToSqid } from "./utils";
import { Bindings } from "./bindings";

export const handle_my_account = async (c: any) => {
    const user_id = c.get("USER_ID");
    const batch = await c.env.DB.batch([
        c.env.DB.prepare(`
            SELECT created, username, email_verified, status, email
            FROM users
            WHERE user_id = ?`
        ).bind(user_id),

        c.env.DB.prepare(`
            SELECT mblogs.feed_id, feeds.title, mblogs.slug
            FROM mblogs
            JOIN feeds ON mblogs.feed_id = feeds.feed_id
            WHERE user_id = ?`
        ).bind(user_id)
    ]);

    const user = batch[0];
    const user_mblogs = batch[1];

    let resend_verification_link_form = ``
    if (!user["results"][0]["email_verified"]) {
        resend_verification_link_form = `<form action="/my/account/resend_verification_link" method="post">
        <input type="submit" value="Resend verification link">
        </form>`;
    }

    const verified = user["results"][0]["email_verified"] ? "yes" : `no ${resend_verification_link_form}`;
    const email = user["results"][0]["email"] ? user["results"][0]["email"] : "no";
    const username = user["results"][0]["username"];
    const status = user["results"][0]["status"];

    let listOfMblogs = "";
    if (user_mblogs["results"].length >0 ) {
        listOfMblogs += `<h3>My blogs hosted at minifeed</h3><ul>`;
        for (const mblog of user_mblogs["results"]) {
            listOfMblogs += `<li><a href="https://${mblog["slug"]}.minifeed.net">${mblog["title"]}</a></li>`;
        }
        listOfMblogs += `</ul>`;
    }

    let list_of_lists = ``;
    const lists = await c.env.DB.prepare(
        `SELECT *
        FROM item_lists 
        WHERE user_id = ?`
    ).bind(user_id).all();
    console.log("lists", lists)
    if (lists.results.length > 0) {
        list_of_lists = `<h3>My lists</h3><ul>`;
        for (const list of lists.results) {
            list_of_lists += `<li><a href="/lists/${list.list_sqid}">${list.title}</a></li>`;
        }
        list_of_lists += `</ul>`;
    }

    let new_mblog_form = ``;
    if (user_id == 1) {
        new_mblog_form = `
        <details>
      <summary>Create new blog</summary>
      <div class="borderbox" style="margin-top: 1em;">
        <form action="/my/account/create_mblog" method="POST">
            <div style="max-width:25em;margin:0;">
                <h2 style="margin-top: 0;">Create new blog</h2>
                <div style="margin-bottom:1em;">
                    <label for="username">Address</label>
                    <div style="display: flex; flex-wrap: wrap;    align-items: flex-end;">
                    <input style="flex: 50%;" type="text" id="address" name="address" required />
                    <spanstyle="flex: 50%;"> .minifeed.net</span>
                    </div>

                </div>

                <div style="margin-bottom:1em;">
                    <label for="username">Title</label>
                    <input type="text" id="title" name="title" required />
                </div>

            <input type="submit" value="Create">
            </div>
        </form>
      </div>
    </details>`;
    }
    const list = `
    <h1>My account</h1>
    <p>
        Username: ${username}<br>
        Profile: <a href="/users/${username}">${username}</a><br>
        Account status: ${status}<br>
    </p>
    <p>
        Email: ${email}<br>
        Email verified: ${verified}<br>
    </p>
    ${listOfMblogs}
    ${new_mblog_form}
    ${list_of_lists}
    <p style="margin-top:2em;">
        <a href="/logout">Log out</a>
    </p>`;
    return c.html(
        renderHTML("My account | minifeed", html`${raw(list)}`, username, ""),
    );
};

export const handle_verify_email = async (c: any) => {
    const code = c.req.query("code");
    const username = c.get("USERNAME");
    const result = await c.env.DB.prepare(
        "SELECT * from email_verifications WHERE verification_code = ?",
    ).bind(code).run();

    if (!result.results.length) {
        return c.html(
            renderHTML(
                "Email verification | minifeed",
                html`<div class="flash flash-red">Email verification code is invalid or has been used already.</div>`,
                username,
                "",
            ),
        );
    }

    const userId = result.results[0]["user_id"];
    await c.env.DB.prepare(
        "UPDATE users SET email_verified = 1 WHERE user_id = ?",
    ).bind(userId).run();
    await c.env.DB.prepare(
        "DELETE FROM email_verifications WHERE verification_code = ?",
    ).bind(code).run();

    const message_flash = username ?
        html`<div class="flash flash-blue">You can now go to <a href="/my">your feed</a>... Or contemplate life.</div>` :
        html`<div class="flash flash-blue">You can now <a href="/login">log in</a>.</div>`

    return c.html(
        renderHTML(
            "Email verification | minifeed",
            message_flash,
            username,
            "",
        ),
    );
};

export const handle_resend_verification_link_POST = async (c: any) => {
    const result = await c.env.DB.prepare(
        `SELECT verification_code, email, username
        FROM email_verifications 
        JOIN users ON email_verifications.user_id = users.user_id
        WHERE email_verifications.user_id = ?`,
    ).bind(c.get("USER_ID")).first();

    console.log(result)

    await send_email_verification_link(
        c.env, 
        result["username"],
        result["email"],
        result["verification_code"]
    );

    return c.html(
        renderHTML(
            "Email verification | minifeed",
            html`<div class="flash flash-blue">Verification link is sent</div>`,
            true,
            "",
        ),
    );
}

export const handle_logout = async (c: any) => {
    const sessionKey = getCookie(c, "minifeed_session");
    if (!sessionKey) {
        return c.redirect("/");
    }
    await c.env.SESSIONS_KV.delete(sessionKey);
    deleteCookie(c, "minifeed_session");
    return c.redirect("/");
};

export const handle_login = async (c: any) => {
    if (c.get("USER_ID")) return c.redirect("/my");

    let list = `
    <div style="max-width:25em;margin:auto;">
        <div class="borderbox">
            <h2 style="margin-top:0;">Log in</h2>
            <form action="/login" method="POST">
                <div style="margin-bottom:1em;">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required />
                </div>

                <div style="margin-bottom:2em;">
                <label for="pass">Password (8 characters minimum)</label>
                <input type="password" id="pass" name="password" minlength="8" required />
                </div>

                <input type="submit" value="Log in">
            </form>
        </div>
        <p style="text-align:center;">
            Forgot your password? <a href="/reset_password">Reset it here</a>.<br>
            Don't have an account? <a href="/signup">Sign up here</a>.
        </p>
    </div>

    `;
    return c.html(
        renderHTML(
            "Login or create account | minifeed",
            html`${raw(list)}`,
            false,
            "",
            "",
        ),
    );
};

export const handle_reset_password = async (c: any) => {
    if (c.get("USER_LOGGED_IN")) return c.redirect("/my");

    let list = `
    <div style="max-width:25em;margin:auto;">
        <div class="borderbox">
            <h2 style="margin-top:0;">Reset password</h2>
            <form action="/reset_password" method="POST">
                <div style="margin-bottom:2em;">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required />
                </div>
                <input type="submit" value="Reset password">
            </form>
        </div>
    </div>
    `;
    return c.html(
        renderHTML(
            "Reset password | minifeed",
            html`${raw(list)}`,
            false,
            "",
            "",
        ),
    );
}

export const handle_reset_password_POST = async (c: any) => {
    
}

export const handle_signup = async (c: any) => {
    if (c.get("USER_LOGGED_IN")) return c.redirect("/my");

    let list = `
    <div style="max-width:25em;margin:auto;">

    <div class="borderbox">
        <h2 style="margin-top:0;">Create account</h2>
        <form action="/signup" method="POST">
            <div style="margin-bottom:1em;">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required />
        </div>

        <div style="margin-bottom:1em;">
            <label for="pass">Password (8 characters minimum)</label>
            <input type="password" id="pass" name="password" minlength="8" required />
        </div>

        <div style="margin-bottom:2em;">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required />
        </div>

        <div style="margin-bottom:2em;">
            <label for="invitation_code">Invitation code:</label>
            <input type="text" id="invitation_code" name="invitation_code" required />
        </div>

        <input class="blue" type="submit" value="Create account">
    </form>
    </div>
    `;
    return c.html(
        renderHTML(
            "Login or create account | minifeed",
            html`${raw(list)}`,
            false,
            "",
            "",
        ),
    );
};

export const handle_login_POST = async (c: any) => {
    const body = await c.req.parseBody();
    const username = body["username"].toString();
    const password = body["password"].toString();

    if (!username || !password) {
        throw new Error("Username and password are required");
    }

    const user = await c.env.DB.prepare(` SELECT * FROM users WHERE users.username = ?`).bind(username).first();
    if (!user) {
        // though user may not exist, we should not leak this information
        throw new Error("Wrong username or password");
    }

    const salt = user.password_salt;
    const submittedPasswordHashed = await hashPassword(password, salt);

    if (user.password_hash === submittedPasswordHashed) {
        try {
            // remove unnecessary query
            const userId = user["user_id"];
            return await createSessionSetCookieAndRedirect(c, userId, username);
        } catch (err) {
            throw new Error("Something went horribly wrong.");
        }
    }
    throw new Error("Wrong username or password");
};

export const handle_signup_POST = async (c: any) => {
    const body = await c.req.parseBody();
    const username = body["username"].toString();
    const password = body["password"].toString();
    const email = body["email"].toString().toLowerCase();
    const invitation_code = body["invitation_code"].toString();

    if (invitation_code !== "ARUEHW") throw new Error("Invalid invitation code");
    
    if (!checkUsername(username)) throw new Error("Invalid username");
    if (password.length < 8) throw new Error("Password too short");
    if (!checkEmail(email)) throw new Error("Invalid email");

    // Check if username already exists
    const existingUser = await c.env.DB.prepare("SELECT username FROM users WHERE username = ?").bind(username.toLowerCase()).first();
    if (existingUser) {
        throw new Error("Username already taken. Please choose a different username.");
    }
    // Check if email already exists
    const existing_email = await c.env.DB.prepare("SELECT email FROM users WHERE email = ?").bind(email).first();
    if (existing_email['email'] == email) {
        throw new Error("Email already taken. Please use a different email.");
    }

    const salt = randomHash(32);
    const passwordHashed = await hashPassword(password, salt);
    try {
        await c.env.DB.prepare(
            "INSERT INTO users (username, email, password_hash, password_salt) values (?, ?, ?, ?)",
        ).bind(username, email, passwordHashed, salt).run();

        const userId = (
            await c.env.DB.prepare("SELECT users.user_id FROM users WHERE username = ?").bind(username).run()
        ).results[0]["user_id"];

        const email_verification_code = randomHash(32);
        await c.env.DB.prepare(
            "INSERT INTO email_verifications (user_id, verification_code) values (?, ?)",
        )
            .bind(userId, email_verification_code)
            .run();

        await send_email_verification_link(c.env, username, email, email_verification_code);
        return await createSessionSetCookieAndRedirect(c, userId, username, '/', true); // first login ever
    } catch (err) {
        throw new Error("Something went horribly wrong.");
    }
};

const send_email_verification_link = async (env: Bindings, username: string, email: string, email_verification_code: string) => {
    const emailVerificationLink = `${env.ENVIRONMENT == "dev" ? "http://localhost:8181" : "https://minifeed.net"}/verify_email?code=${email_verification_code}`;
    
    const emailBody = `Welcome to minifeed, ${username}!<br><br>Please, verify your email by clicking on <strong><a href="${emailVerificationLink}">this link</a></strong>.`;

    await sendEmail(
        env,
        email,
        "no-reply@minifeed.net",
        "Welcome to minifeed",
        emailBody,
    );
}

const createSessionSetCookieAndRedirect = async (
    c: any,
    userId: number,
    username: string,
    redirectTo = "/",
    first_login = false,
) => {
    const sessionKey = randomHash(16);
    const kv_value = `${userId};${username}`
    await c.env.SESSIONS_KV.put(sessionKey, kv_value);
    setCookie(c, "minifeed_session", sessionKey, {
        path: "/",
        domain: c.env.ENVIRONMENT == "dev" ? ".localhost" : ".minifeed.net",
        secure: true,
        httpOnly: true,
        maxAge: 34560000,
    });

    if (first_login) {
        return c.html(
            renderHTML(
                "Account created | minifeed",
                html`<div class="flash flash-blue">
                    Great! You are now registered and logged in. Check your email for a verification link. Go browse some <a href="/blogs">blogs</a>, <a href="/lists">lists</a>, and <a href="/users">users</a> to subscribe to.
                </div>`,
                true,
                "",
            ),
        );
    }
    
    return c.redirect(redirectTo);
};

async function hashPassword(password: string, salt: string) {
    const saltedPassword = new TextEncoder().encode(password + salt);
    const digest = await crypto.subtle.digest(
        { name: "SHA-256" },
        saltedPassword,
    );
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert bytes to hex string
}

function randomHash(len: number): string {
    return Array.from(
        crypto.getRandomValues(new Uint8Array(Math.ceil(len / 2))),
        (b) => ("0" + (b & 0xff).toString(16)).slice(-2),
    ).join("");
}

// export async function hashPassword(password: string, providedSalt?: Uint8Array ): Promise<[string, string]> {
//     const encoder = new TextEncoder();
//     // Use provided salt if available, otherwise generate a new one
//     const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));
    
//     const keyMaterial = await crypto.subtle.importKey(
//         "raw",
//         encoder.encode(password),
//         { name: "PBKDF2" },
//         false,
//         ["deriveBits", "deriveKey"]
//     );

//     const key = await crypto.subtle.deriveKey(
//         {
//             name: "PBKDF2",
//             salt: salt,
//             iterations: 100000,
//             hash: "SHA-256",
//         },
//         keyMaterial,
//         { name: "AES-GCM", length: 256 },
//         true,
//         ["encrypt", "decrypt"]
//     );
//     const exportedKey = (await crypto.subtle.exportKey( "raw", key )) as ArrayBuffer; 
    
//     const hashBuffer = new Uint8Array(exportedKey);
//     const hashArray = Array.from(hashBuffer);
//     const hashHex = hashArray
//       .map((b) => b.toString(16).padStart(2, "0"))
//       .join("");
//     const saltHex = Array.from(salt)
//       .map((b) => b.toString(16).padStart(2, "0"))
//       .join("");
    
//       return [hashHex, saltHex];
// }

// export async function verifyPassword(hash: string, salt:string, passwordAttempt: string ): Promise<boolean> {
//     const matchResult = salt.match(/.{1,2}/g);
//     if (!matchResult) throw new Error("Invalid salt format");

//     const saltUint = new Uint8Array(matchResult.map((byte) => parseInt(byte, 16)));
//     const [attemptHash, _] = await hashPassword(passwordAttempt, saltUint);
//     return attemptHash === hash;
// }

// export const test_passwords = async (c:any) => {
//     const [originalHash, saltHex] = await hashPassword("abc");
//     const verified = verifyPassword(originalHash, saltHex, "abc")
//     return c.html(verified)
// };

function checkUsername(username: string) {
    return /^[a-zA-Z0-9_]{3,16}$/.test(username);
}

function checkEmail(email: string) {
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
}

export const handle_create_mblog_POST = async (c: any) => {
    const user_id = c.get("USER_ID");

    const body = await c.req.parseBody();
    const slug = body["address"].toString();
    if (!slug) throw new Error("Address is required");
    const title = body["title"].toString();
    if (!title) throw new Error("Title is required");

    const full_final_url = `https://${slug}.minifeed.net`;
    const full_final_rss_url = `https://${slug}.minifeed.net/rss`;

    try {
        const feed_insertion_results = await c.env.DB.prepare(
            "INSERT INTO feeds (title, type, url, rss_url, verified) values (?,?,?,?,?)"
        ).bind(title, "mblog", full_final_url, full_final_rss_url, 0).run();

        if (feed_insertion_results.success) {
            const new_feed_id = feed_insertion_results.meta.last_row_id;
            // update feed_sqid
            const new_feed_sqid = feedIdToSqid(new_feed_id);
            await c.env.DB.prepare("UPDATE feeds SET feed_sqid = ? WHERE feed_id = ?")
                .bind(new_feed_sqid, new_feed_id)
                .run();

            const mblog_insertion_results = await c.env.DB.prepare(
                "INSERT INTO mblogs (user_id, feed_id, slug) values (?,?,?)"
            ).bind(user_id, new_feed_id, slug).run();

            if (mblog_insertion_results.success) {
                if (c.env.ENVIRONMENT == "dev") {
                    return c.redirect(`/b/${slug}`);
                } else {
                    return c.redirect(`https://${slug}.minifeed.net`);
                }
            }

        }
        return c.redirect("/");
    } catch (err) {
        throw new Error("Something went horribly wrong.");
    }
}
