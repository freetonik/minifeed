import { Context } from "hono";
import { getCookie } from "hono/cookie";

// Set user_id and username in context if user is logged in
export async function authMiddleware(
    c: Context<any, any, {}>,
    next: () => any,
) {
    const sessionKey = getCookie(c, "minifeed_session");
    if (sessionKey) {
        const result = await c.env.DB.prepare(
            `
        SELECT sessions.user_id, users.username
        FROM sessions
        JOIN users on users.user_id = sessions.user_id
        WHERE session_key = ?`,
        )
            .bind(sessionKey)
            .run();
        if (result && result.results && result.results.length) {
            c.set("USER_ID", result.results[0]["user_id"]);
            c.set("USERNAME", result.results[0]["username"]);
        }
    }
    await next();
}

// User must be logged in
export async function authRequiredMiddleware(
    c: Context<any, any, {}>,
    next: () => any,
) {
    if (!c.get("USER_ID")) return c.redirect("/login");
    await next();
}

// User must be logged in and be admin
export async function adminRequiredMiddleware(
    c: Context<any, any, {}>,
    next: () => any,
) {
    if (!c.get("USER_ID") || c.get("USER_ID") != 1) {
        c.status(401);
        return c.body("Unauthorized");
    }
    await next();
}
