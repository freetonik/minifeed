-- Migration number: 0007 	 2024-09-27T16:42:44.069Z

CREATE TABLE IF NOT EXISTS mblog_items (
    mblog_item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mblog_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    FOREIGN KEY(mblog_id) REFERENCES mblogs(mblog_id) ON DELETE CASCADE
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mblog_items_on_slug ON mblog_items(slug);
CREATE INDEX IF NOT EXISTS idx_mblog_items_on_item_id ON mblog_items(item_id);
