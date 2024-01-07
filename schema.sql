DROP TABLE IF EXISTS followings;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS favorites;

DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS feeds;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY, 
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username TEXT, 
    password_hash TEXT, 
    password_salt TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    session_key TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS feeds (
    feed_id INTEGER PRIMARY KEY, 
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL, 
    url TEXT UNIQUE NOT NULL, 
    rss_url Text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	feed_id INTEGER NOT NULL, 
	title TEXT NOT NULL, 
    description TEXT,
    content_html TEXT,
    content_html_scraped TEXT,
	url TEXT UNIQUE NOT NULL, 
    pub_date TIMESTAMP,
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id)
);

CREATE TABLE IF NOT EXISTS favorites (
    favorite_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    item_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    UNIQUE (user_id, item_id)
);

CREATE TABLE subscriptions (
    subscription_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    feed_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (feed_id) REFERENCES feeds(feed_id),
    UNIQUE (user_id, feed_id)
);

CREATE TABLE followings (
    following_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    follower_user_id INTEGER,
    followed_user_id INTEGER,
    FOREIGN KEY (follower_user_id) REFERENCES users(user_id),
    FOREIGN KEY (followed_user_id) REFERENCES users(user_id),
    UNIQUE (follower_user_id, followed_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_on_username ON users(username);
