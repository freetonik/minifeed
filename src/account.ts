import { html, raw } from "hono/html";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { renderHTML } from "./htmltools";
import { sendEmail } from "./email";
import { feedIdToSqid } from "./utils";

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

    const verified = user["results"][0]["email_verified"] ? "yes" : "no";
    const email = user["results"][0]["email"] ? user["results"][0]["email"] : "no";
    const username = user["results"][0]["username"];
    const status = user["results"][0]["status"];

    let listOfMblogs = "";
    if (user_mblogs["results"]) {
        listOfMblogs += `<h3>My blogs hosted at minifeed</h3><ul>`;
        if (c.env.ENVIRONMENT == "dev") {
            for (const mblog of user_mblogs["results"]) {
                listOfMblogs += `<li><a href="/b/${mblog["slug"]}">${mblog["title"]}</a></li>`;
            }
        } else {
            for (const mblog of user_mblogs["results"]) {
                listOfMblogs += `<li><a href="https://${mblog["slug"]}.minifeed.net">${mblog["title"]}</a></li>`;
            }
        }
        listOfMblogs += `</ul>`;
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
        Email: ${email}<br>
        Email verified: ${verified}<br>
        Account status: ${status}<br>
    </p>
    ${listOfMblogs}
    ${new_mblog_form}
    <p style="margin-top:3em;">
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

    let message = `Email verified!`;
    if (username) {
        message += ` You can now go to <a href="/my">your feed</a>... Or contemplate life.`;
    } else {
        message += ` You can now <a href="/login">log in</a>.`;
    }
    return c.html(
        renderHTML(
            "Email verification | minifeed",
            html`<div class="flash flash-blue">Email verified!</div>`,
            username,
            "",
        ),
    );
};

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
        <p style="text-align:center;">Don't have an account? <a href="/signup">Sign up here</a>.</p>
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

export const handle_signup = async (c: any) => {
    if (c.get("USER_ID")) return c.redirect("/my");

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
    const email = body["email"].toString();
    const invitation_code = body["invitation_code"].toString();

    if (invitation_code !== "ARUEHW") throw new Error("Invalid invitation code");

    if (!checkUsername(username)) throw new Error("Invalid username");
    if (password.length < 8) throw new Error("Password too short");
    if (!checkEmail(email)) throw new Error("Invalid email");

    // Check if username already exists
    const existingUser = await c.env.DB.prepare("SELECT username FROM users WHERE username = ?").bind(username).run();
    if (existingUser.results.length > 0) {
        throw new Error("Username already exists. Please choose a different username.");
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
        const emailVerificationLink = `${c.env.ENVIRONMENT == "dev" ? "http://localhost:8787" : "https://minifeed.net"}/verify_email?code=${email_verification_code}`;
        const emailBody = `Welcome to minifeed, ${username}! Please verify your email by clicking this link: ${emailVerificationLink}`;

        await sendEmail(
            email,
            username,
            "no-reply@minifeed.net",
            "Welcome to minifeed",
            emailBody,
            c.env.ENVIRONMENT == "dev",
        );
        return await createSessionSetCookieAndRedirect(c, userId, username);
    } catch (err) {
        throw new Error("Something went horribly wrong.");
    }
};

const createSessionSetCookieAndRedirect = async (
    c: any,
    userId: number,
    username: string,
    redirectTo = "/",
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
    if (!slug) return c.text("Address is required");
    const title = body["title"].toString();
    if (!title) return c.text("Title is required");

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
        return c.text(err);
    }
}
