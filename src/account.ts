import { html, raw } from 'hono/html'
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from 'hono/cookie'

import { renderHTML, renderItemShort } from './htmltools';


export const loginOrCreateAccount = async (c, flash='') => {
  const userId = c.get('USER_ID') || "0";
  if (c.get('USER_ID')) return c.redirect('/')

  let list = `
  <h1>Log in</h1>
  <form action="/login" method="POST">
    <label for="username">Username:</label>
    <input type="text" id="username" name="username" required />

    <label for="pass">Password (8 characters minimum):</label>
    <input type="password" id="pass" name="password" minlength="8" required />

    <br>
    <input type="submit" value="Log in">
  </form> 

  <h1>Create account</h1>
  <form action="/signup" method="POST">
    <label for="username">Username:</label>
    <input type="text" id="username" name="username" required />

    <label for="pass">Password (8 characters minimum):</label>
    <input type="password" id="pass" name="password" minlength="8" required />

    <label for="invitation_code">Invitation code:</label>
    <input type="text" id="invitation_code" name="invitation_code" required />

    <br>
    <input type="submit" value="Create account">
  </form> 
  `
  return c.html(renderHTML("All items", html`${raw(list)}`))
}

export const loginPost = async (c) => {
  const body = await c.req.parseBody();
  const username = body['username'].toString();
  const password = body['password'].toString();

  const { results } = await c.env.DB
    .prepare(`
      SELECT * FROM users WHERE users.username = ?`
    )
    .bind(username)
    .run();

  if (!results.length) return c.notFound();

  const user = results[0];
  const salt = user.password_salt
  const submittedPasswordHashed = await hashPassword(password, salt)
  
  if (user.password_hash === submittedPasswordHashed) {
    const sessionKey = randomHash(16);
    try {
      const result = await c.env.DB.prepare("SELECT users.user_id FROM users WHERE username = ?").bind(username).run();
      const userId = result.results[0]['user_id'];
      await c.env.DB.prepare("INSERT INTO sessions (user_id, session_key) values (?, ?)").bind(userId, sessionKey).run();
    } catch (err) {
      return c.text(err);
    }
    setCookie(c, 'minifeed_session', sessionKey, {path: '/', secure: true, httpOnly: true, maxAge: 34560000, sameSite: 'Strict', })

  }
  return c.redirect('/')
  
  // return c.text(`${password} : ${salt} : ${submittedPasswordHashed} -> ${password+salt}`)
}

// const salt = randomHash(32)
async function hashPassword(password:string, salt:string) {
  const saltedPassword = new TextEncoder().encode(password+salt);
  const digest = await crypto.subtle.digest( {name: 'SHA-256', }, saltedPassword);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
} 

function randomHash (len:number):string {
    return Array.from(
        crypto.getRandomValues(new Uint8Array(Math.ceil(len / 2))),
        (b) => ("0" + (b & 0xFF).toString(16)).slice(-2)
    ).join("")
}