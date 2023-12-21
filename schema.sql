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
INSERT INTO users (user_id, username, password_hash, password_salt) VALUES 
    (1, 'rakhim',  '94b7eb783a13ec4b0e0399951c78b94f5bc38917c714442aa22c87e12e0f629f', 'cf76f03fd6603ecd62b1380e0775cc48'),
    (2, 'rakhim2', '58a3a9d3c4e5dd3cfe1304086f2485975acb65118551f5c23c296b0e33f33f44', 'd5f911d9fe8fb5278fa77a1370e77b14');

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
INSERT INTO feeds (feed_id, title, url, rss_url) VALUES 
    (1, 'Rakhim blog', 'https://rakhim.org', 'https://rakhim.org/index.xml'),
    (2, 'Kevin Quirk', 'https://kevquirk.com', 'https://kevquirk.com/feed');

CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	feed_id INTEGER NOT NULL, 
	title TEXT NOT NULL, 
    content TEXT,
	url TEXT UNIQUE NOT NULL, 
    pub_date TIMESTAMP,
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id)
);
INSERT INTO items (feed_id, title, content, url) VALUES 
    (1, "Test 1", "Very test 1", 'https://rakhim.org/test1'),
    (1, "Test 2", "Very test 2", 'https://rakhim.org/test2'),
    (2, "KevQuirk 3", "Very KevQuirk 3", 'https://kevquirk.com/KevQuirk3'),
    (2, "KevQuirk 4", "Very KevQuirk 4", 'https://kevquirk.com/KevQuirk4');

CREATE TABLE IF NOT EXISTS favorites (
    favorite_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    item_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    UNIQUE (user_id, item_id)
);
INSERT INTO favorites (user_id, item_id) VALUES (1, 1);

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

INSERT INTO followings (follower_user_id, followed_user_id) VALUES (1, 2);


CREATE INDEX IF NOT EXISTS idx_users_on_username ON users(username);
