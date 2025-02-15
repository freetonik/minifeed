-- Migration number: 0025 	 2025-02-15T11:34:31.619Z

CREATE INDEX IF NOT EXISTS idx_items_sqid ON items(item_sqid);