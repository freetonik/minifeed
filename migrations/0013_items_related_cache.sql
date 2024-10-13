-- Migration number: 0013 	 2024-10-13T15:05:09.317Z

CREATE TABLE IF NOT EXISTS items_related_cache (
	item_cache_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	item_id INTEGER UNIQUE NOT NULL,
    content TEXT,
	FOREIGN KEY(item_id) REFERENCES items(item_id) ON DELETE CASCADE
);
