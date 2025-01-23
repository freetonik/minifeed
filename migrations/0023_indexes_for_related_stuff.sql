-- Migration number: 0023 	 2025-01-23T18:36:35.580Z

CREATE INDEX IF NOT EXISTS idx_items_feed_date_id ON items(feed_id, pub_date DESC, item_id);
CREATE INDEX IF NOT EXISTS idx_related_items_item ON related_items(item_id);