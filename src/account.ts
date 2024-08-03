import { html, raw } from "hono/html";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { renderHTML } from "./htmltools";
import { sendEmail } from "./email";

export const myAccountHandler = async (c: any) => {
  const user_id = c.get("USER_ID");
  const user = await c.env.DB.prepare(
    "SELECT created, username, email_verified, status, email from users WHERE user_id = ?",
  )
    .bind(user_id)
    .run();
  const verified = user["results"][0]["email_verified"] ? "yes" : "no";
  const email = user["results"][0]["email"];
  const username = user["results"][0]["username"];
  const status = user["results"][0]["status"];
  let list = `
    <h1>My account</h1>
    <p>
    Username: ${username}<br>
    Profile: <a href="/users/${username}">${username}</a><br>
    Email: ${email}<br>
    Email verified: ${verified}<br>
    Account status: ${status}<br>

    </p>
    <p style="margin-top:3em;">
    <a style="padding: 0.75em; border: 1px solid; background-color: #9c0000; color: white;" href="/logout">Log out</a>
    </p>`;
  return c.html(
    renderHTML("My account | minifeed", html`${raw(list)}`, username, ""),
  );
};

export const myAccountVerifyEmailHandler = async (c: any) => {
  const code = c.req.query("code");
  const username = c.get("USERNAME");
  const result = await c.env.DB.prepare(
    "SELECT * from email_verifications WHERE verification_code = ?",
  )
    .bind(code)
    .run();

  if (!result.results.length) {
    return c.html(
      renderHTML(
        "Email verification | minifeed",
        html`<div class="flash flash-red">
          Email verification code is invalid or has been used already.
        </div>`,
        username,
        "",
      ),
    );
  }

  const userId = result.results[0]["user_id"];
  await c.env.DB.prepare(
    "UPDATE users SET email_verified = 1 WHERE user_id = ?",
  )
    .bind(userId)
    .run();
  await c.env.DB.prepare(
    "DELETE FROM email_verifications WHERE verification_code = ?",
  )
    .bind(code)
    .run();

  let message = `Email verified!`;
  if (username) {
    message += ` You can now go to <a href="/my">your feed</a>... Or anywhere else, really.`;
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

export const logoutHandler = async (c: any) => {
  const sessionKey = getCookie(c, "minifeed_session");
  try {
    await c.env.DB.prepare("DELETE FROM sessions WHERE session_key = ?")
      .bind(sessionKey)
      .run();
  } catch (err) {
    return c.text(err);
  }
  deleteCookie(c, "minifeed_session");
  return c.redirect("/");
};

export const loginHandler = async (c: any) => {
  if (c.get("USER_ID")) return c.redirect("/my");

  let list = `
    <form action="/login" method="POST">
        <div class="formbg formbg-small">
            <h2>Log in</h2>
            <div style="margin-bottom:1em;">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required />
        </div>

        <div style="margin-bottom:2em;">
            <label for="pass">Password (8 characters minimum)</label>
            <input type="password" id="pass" name="password" minlength="8" required />
        </div>

        <input type="submit" value="Log in">
        </div>
    </form>

    <h3 style="margin: 3em 0;" class="decorated"><span>or</span></h3>

    <div class="formbg formbg-small">
    <h2>Create account</h2>
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
      "",
      "",
    ),
  );
};

export const loginPostHandler = async (c: any) => {
  const body = await c.req.parseBody();
  const username = body["username"].toString();
  const password = body["password"].toString();

  const { results } = await c.env.DB.prepare(
    `
    SELECT * FROM users WHERE users.username = ?`,
  )
    .bind(username)
    .run();

  if (!results.length) return c.text("Wrong username or password");

  const user = results[0];
  const salt = user.password_salt;
  const submittedPasswordHashed = await hashPassword(password, salt);

  if (user.password_hash === submittedPasswordHashed) {
    try {
      const result = await c.env.DB.prepare(
        "SELECT users.user_id FROM users WHERE username = ?",
      )
        .bind(username)
        .run();
      const userId = result.results[0]["user_id"];
      return await createSessionSetCookieAndRedirect(c, userId);
    } catch (err) {
      return c.text(err);
    }
  }
  return c.text("Wrong password");
};

export const signupPostHandler = async (c: any) => {
  const body = await c.req.parseBody();
  const username = body["username"].toString();
  const password = body["password"].toString();
  const email = body["email"].toString();
  const invitation_code = body["invitation_code"].toString();

  if (invitation_code !== "ARUEHW") return c.text("Invalid invitation code");

  if (!checkUsername(username)) return c.text("Invalid username");
  if (password.length < 8) return c.text("Password too short");
  if (!checkEmail(email)) return c.text("Invalid email");

  const salt = randomHash(32);
  const passwordHashed = await hashPassword(password, salt);
  try {
    await c.env.DB.prepare(
      "INSERT INTO users (username, email, password_hash, password_salt) values (?, ?, ?, ?)",
    )
      .bind(username, email, passwordHashed, salt)
      .run();
    const userId = (
      await c.env.DB.prepare(
        "SELECT users.user_id FROM users WHERE username = ?",
      )
        .bind(username)
        .run()
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
    return await createSessionSetCookieAndRedirect(c, userId);
  } catch (err) {
    return c.text(err);
  }
};

const createSessionSetCookieAndRedirect = async (
  c: any,
  userId: number,
  redirectTo = "/",
) => {
  const sessionKey = randomHash(16);
  try {
    await c.env.DB.prepare(
      "INSERT INTO sessions (user_id, session_key) values (?, ?)",
    )
      .bind(userId, sessionKey)
      .run();
  } catch (err) {
    return c.text(err);
  }
  setCookie(c, "minifeed_session", sessionKey, {
    path: "/",
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
