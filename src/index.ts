import { Hono } from 'hono'
import { getCookie, getSignedCookie, setCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import { html } from 'hono/html'
import { XMLParser } from 'fast-xml-parser'

type Bindings = {
	DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('Hello Hono!'))

app.get('/login', async (c) => {
	const user_token = getCookie(c, 'minifeed_user_token');

	if (user_token) {
		const { results } = await c.env.DB.prepare("SELECT * FROM Users WHERE Token = ?")
			.bind(user_token).all();
		if (results.length > 0) {
			return c.text(`Hello ${results[0].Username}`);
		}
	}

	const new_uuid = crypto.randomUUID();
	return c.html(
		html`<!DOCTYPE html>
			<form action="" method="post">
				<button name="Register" value=${new_uuid}>Register</button>
			</form>`);
});

app.post('/login', async (c) => {
	const body = await c.req.parseBody();
	console.log(body);
	// todo: check KV, create user, set cookie
	return c.text('ok');
	const new_token = body['token'];
});

app.post('/service/fetch_feed', async (c) => {
	const b = await c.req.parseBody();
	const url = b['url'].toString();
	const r = await fetch(url);
	const rssText = await r.text();
	const parser = new XMLParser();
	const rssJson = parser.parse(rssText);
  const items = rssJson.rss.channel.item;

  const { feedsResults } = await c.env.DB.prepare(
        "SELECT * FROM Feeds WHERE RSSUrl = ? LIMIT 1"
      )
        .bind(url)
        .all();
  const feedId = feedsResults[0]['FeedId'];
  console.log(feedId)

	// let binds = [];
	// const stmt = c.env.DB.prepare("INSERT INTO Items (FeedId, Title, Url) values (?, ?, ?)");

	// items.forEach((item: any) => {
	// 	binds.push(stmt.bind(1, item.title, item.link));
	// });

	// await c.env.DB.batch(binds);
});

export default app
