CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    password_salt TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    session_key TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feeds (
    feed_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    rss_url TEXT UNIQUE NOT NULL,
    verified INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	feed_id INTEGER NOT NULL,
	title TEXT NOT NULL,
    description TEXT,
    content_html TEXT,
    content_html_scraped TEXT,
	url TEXT NOT NULL,
    pub_date TIMESTAMP,
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
    favorite_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    item_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    UNIQUE (user_id, item_id)
);

CREATE TABLE subscriptions (
    subscription_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    feed_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE,
    UNIQUE (user_id, feed_id)
);

CREATE TABLE followings (
    following_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    follower_user_id INTEGER,
    followed_user_id INTEGER,
    FOREIGN KEY (follower_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (followed_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (follower_user_id, followed_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_on_username ON users(username);
-- Migration number: 0000 	 2024-01-15T15:25:45.272Z
