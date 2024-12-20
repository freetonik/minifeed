-- Migration number: 0021 	 2024-12-20T06:10:31.201Z

CREATE TABLE IF NOT EXISTS related_blogs (
    id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	blog_id INTEGER,
    related_blog_id INTEGER,
	FOREIGN KEY(blog_id) REFERENCES blogs(blog_id) ON DELETE CASCADE,
    FOREIGN KEY(related_blog_id) REFERENCES blogs(blog_id) ON DELETE CASCADE
);
