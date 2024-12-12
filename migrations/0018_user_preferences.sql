-- Migration number: 0018 	 2024-12-10T17:39:32.566Z

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prefers_full_blog_post BOOLEAN DEFAULT TRUE,
    default_homepage_subsection TEXT DEFAULT 'all',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);