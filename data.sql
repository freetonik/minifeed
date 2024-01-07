INSERT INTO users (user_id, username, password_hash, password_salt) VALUES 
    (1, 'rakhim',  '94b7eb783a13ec4b0e0399951c78b94f5bc38917c714442aa22c87e12e0f629f', 'cf76f03fd6603ecd62b1380e0775cc48'),
    (2, 'rakhim2', '58a3a9d3c4e5dd3cfe1304086f2485975acb65118551f5c23c296b0e33f33f44', 'd5f911d9fe8fb5278fa77a1370e77b14');

INSERT INTO feeds (feed_id, title, url, rss_url) VALUES 
    (1, 'Rakhim blog', 'https://rakhim.org', 'https://rakhim.org/index.xml'),
    (2, 'Kevin Quirk', 'https://kevquirk.com', 'https://kevquirk.com/feed');

INSERT INTO items (feed_id, title, description, content_html, url) VALUES 
    (1, "Test 1", "Very test 1", "<strong>Very</strong> test 1", 'https://rakhim.org/test1'),
    (1, "Test 2", "Very test 2", "<strong>Very</strong> test 2", 'https://rakhim.org/test2'),
    (2, "KevQuirk 3", "Very KevQuirk 3", "Very <strong>QQQ</strong> 3", 'https://kevquirk.com/KevQuirk3'),
    (2, "KevQuirk 4", "Very KevQuirk 4", "Very <strong>QQQ</strong> 3", 'https://kevquirk.com/KevQuirk4');

INSERT INTO favorites (user_id, item_id) VALUES (1, 1);

INSERT INTO followings (follower_user_id, followed_user_id) VALUES (1, 2);

