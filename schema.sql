DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS feeds;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS followings;

CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, token TEXT, username TEXT);
INSERT INTO users (user_id, token, username) VALUES (1, '8ca444e4-c26a-4f03-bfce-73139b128f1b', 'rakhim');

CREATE TABLE IF NOT EXISTS feeds (feed_id INTEGER PRIMARY KEY, title TEXT, url TEXT UNIQUE NOT NULL, rss_url Text UNIQUE NOT NULL);
INSERT INTO feeds (feed_id, title, url, rss_url) VALUES (1, 'Rakhims blog', 'https://rakhim.org/', 'https://rakhim.org/index.xml');


CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY,
	feed_id INTEGER, 
	title TEXT, 
	url TEXT, 
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id)
);

CREATE TABLE subscriptions (
    subscription_id INTEGER PRIMARY KEY,
    user_id INTEGER,
    feed_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (feed_id) REFERENCES feeds(feed_id)
);

CREATE TABLE followings (
    following_id INTEGER PRIMARY KEY,
    follower_user_id INTEGER,
    followed_user_id INTEGER,
    FOREIGN KEY (follower_user_id) REFERENCES users(user_id),
    FOREIGN KEY (followed_user_id) REFERENCES users(user_id)
);
