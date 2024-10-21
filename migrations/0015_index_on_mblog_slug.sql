-- Migration number: 0015 	 2024-10-21T05:18:07.523Z

CREATE INDEX IF NOT EXISTS idx_mblogs_on_slug ON mblogs(slug);
CREATE INDEX IF NOT EXISTS idx_mblogs_on_feed_id ON mblogs(feed_id);