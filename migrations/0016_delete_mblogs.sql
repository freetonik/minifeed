-- Migration number: 0016 	 2024-11-25T19:21:41.978Z

DROP TABLE IF EXISTS mblogs;
DROP TABLE IF EXISTS mblog_items;
DROP INDEX IF EXISTS idx_mblogs_on_slug;
DROP INDEX IF EXISTS idx_mblogs_on_feed_id;