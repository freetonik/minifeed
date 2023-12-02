DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS feeds;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS followings;

CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, token TEXT, username TEXT);
INSERT INTO users (user_id, token, username) VALUES (1, '8ca444e4-c26a-4f03-bfce-73139b128f1b', 'rakhim');

CREATE TABLE IF NOT EXISTS feeds (
    feed_id INTEGER PRIMARY KEY, 
    title TEXT NOT NULL, 
    url TEXT UNIQUE NOT NULL, 
    rss_url Text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY,
	feed_id INTEGER NOT NULL, 
	title TEXT NOT NULL, 
    content TEXT,
	url TEXT UNIQUE NOT NULL, 
    pub_date TIMESTAMP,
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id)
);

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
