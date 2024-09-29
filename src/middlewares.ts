import { Context } from "hono";
import { getCookie } from "hono/cookie";

// Set user_id and username in context if user is logged in
export async function authMiddleware(
    c: Context<any, any, {}>,
    next: () => any,
) {
    const sessionKey = getCookie(c, "minifeed_session");
    const kv_value = await c.env.SESSIONS_KV.get(sessionKey);
    if (kv_value != null) {
        const values = kv_value.split(";");
        c.set("USER_ID", values[0]);
        c.set("USERNAME", values[1]);
        await c.env.SESSIONS_KV.put(sessionKey, kv_value, {
            expirationTtl: 31536000, // 1 year
        });
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
