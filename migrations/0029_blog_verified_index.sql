-- Migration number: 0029 	 2025-05-08T09:09:52.503Z

CREATE INDEX IF NOT EXISTS idx_feeds_verified ON feeds(verified);