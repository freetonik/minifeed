-- Migration number: 0024 	 2025-02-09T11:21:07.429Z

CREATE INDEX IF NOT EXISTS idx_items_url ON items(url);