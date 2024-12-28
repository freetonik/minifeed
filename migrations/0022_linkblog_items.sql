-- Migration number: 0022 	 2024-12-22T15:27:13.594Z

CREATE TABLE IF NOT EXISTS linkblog_items (
    linkblog_item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS linkblog_user_items (
    linkblog_user_item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    linkblog_item_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT,
    FOREIGN KEY (linkblog_item_id) REFERENCES linkblog_items(linkblog_item_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS linkblog_items_on_url ON linkblog_items(url);