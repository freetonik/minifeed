-- Migration number: 0010 	 2024-10-03T12:27:51.502Z

ALTER TABLE mblog_items ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';