-- Migration number: 0028 	 2025-04-20T10:58:11.891Z

DROP TABLE IF EXISTS linkblog_user_items;
DROP TABLE IF EXISTS linkblog_items;

DROP INDEX IF EXISTS linkblog_items_on_url;