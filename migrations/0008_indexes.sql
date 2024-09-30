-- Migration number: 0008 	 2024-09-29T17:48:00.519Z

CREATE INDEX IF NOT EXISTS idx_items_pub_date ON items(pub_date);

CREATE INDEX IF NOT EXISTS idx_feeds_type ON feeds(type);
