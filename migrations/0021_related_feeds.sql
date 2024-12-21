-- Migration number: 0021 	 2024-12-20T06:10:31.201Z

CREATE TABLE IF NOT EXISTS related_feeds (
    id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	feed_id INTEGER,
    related_feed_id INTEGER,
	FOREIGN KEY(feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE,
    FOREIGN KEY(related_feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE
);
