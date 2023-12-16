DROP TABLE IF EXISTS followings;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS feeds;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, token TEXT, username TEXT);
INSERT INTO users (user_id, token, username) VALUES (1, '8ca444e4-c26a-4f03-bfce-73139b128f1b', 'rakhim');
INSERT INTO users (user_id, token, username) VALUES (2, '8ca444e4-c26a-4f03-bfce-73139b128f1c', 'rakhim2');
INSERT INTO users (user_id, token, username) VALUES (3, '8ca444e4-c26a-4f03-bfce-73139b128f1d', 'rakhim3');
INSERT INTO users (user_id, token, username) VALUES (4, '8ca444e4-c26a-4f03-bfce-73139b128f1e', 'rakhim4');
INSERT INTO users (user_id, token, username) VALUES (5, '8ca444e4-c26a-4f03-bfce-73139b128f1f', 'rakhim5');
INSERT INTO users (user_id, token, username) VALUES (6, '8ca444e4-c26a-4f03-bfce-73139b128f1g', 'rakhim6');
INSERT INTO users (user_id, token, username) VALUES (7, '8ca444e4-c26a-4f03-bfce-73139b128f1h', 'rakhim7');

CREATE TABLE IF NOT EXISTS feeds (
    feed_id INTEGER PRIMARY KEY, 
    title TEXT NOT NULL, 
    url TEXT UNIQUE NOT NULL, 
    rss_url Text UNIQUE NOT NULL
);
INSERT INTO feeds (feed_id, title, url, rss_url) VALUES (1, 'Rakhim blog', 'https://rakhim.org', 'https://rakhim.org/index.xml');

CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY,
	feed_id INTEGER NOT NULL, 
	title TEXT NOT NULL, 
    content TEXT,
	url TEXT UNIQUE NOT NULL, 
    pub_date TIMESTAMP,
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id)
);
INSERT INTO items (feed_id, title, content, url) VALUES (1, "Test", "Very test", 'https://rakhim.org/test');

CREATE TABLE subscriptions (
    subscription_id INTEGER PRIMARY KEY,
    user_id INTEGER,
    feed_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (feed_id) REFERENCES feeds(feed_id),
    UNIQUE (user_id, feed_id)
);


CREATE TABLE followings (
    following_id INTEGER PRIMARY KEY,
    follower_user_id INTEGER,
    followed_user_id INTEGER,
    FOREIGN KEY (follower_user_id) REFERENCES users(user_id),
    FOREIGN KEY (followed_user_id) REFERENCES users(user_id),
    UNIQUE (follower_user_id, followed_user_id)
);

INSERT INTO followings (follower_user_id, followed_user_id) VALUES (1, 2);


CREATE INDEX IF NOT EXISTS idx_users_on_username ON users(username);
