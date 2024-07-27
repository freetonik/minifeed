INSERT INTO users (user_id, username, password_hash, password_salt) VALUES
    (1, 'rakhim', '26188a8a89fc51d6ecb7cfb09f5dae5f9c0f0fb5bdeb817e117df69243744269', '6ae24390a20de2848692925231963f7c'),
    (2, 'rakhim2', 'c1df58b9eb6047cece51fea3c948115b39eabcbc31f582851e7b09bf3118e911', '16960f4003c9d4743c498d4b2a04c5c2');

INSERT INTO feeds (feed_id, feed_sqid, type, title, url, rss_url, verified) VALUES
    (1, 'ENivT', 'blog', 'Rakhim blog', 'https://rakhim.org', 'https://rakhim.org/index.xml', 1),
    (2, 'BJCNM', 'blog', 'Kevin Quirk', 'https://kevquirk.com', 'https://kevquirk.com/feed', 0);

INSERT INTO items (feed_id, item_sqid, title, description, content_html, url) VALUES
    (1, "ENivTmpSxl", "Test 1", "Very test 1", "<strong>Very</strong> test 1", 'https://rakhim.org/test1'),
    (1, "BJCNMuE5Rd", "Test 2", "Very test 2", "<strong>Very</strong> test 2", 'https://rakhim.org/test2'),
    (2, "QoD3S0OVaH", "KevQuirk 3", "Very KevQuirk 3", "Very <strong>QQQ</strong> 3", 'https://kevquirk.com/KevQuirk3'),
    (2, "6jNbYWjvso", "KevQuirk 4", "Very KevQuirk 4", "Very <strong>QQQ</strong> 3", 'https://kevquirk.com/KevQuirk4');

INSERT INTO favorites (user_id, item_id) VALUES (1, 1);

INSERT INTO followings (follower_user_id, followed_user_id) VALUES (1, 2);
INSERT INTO followings (follower_user_id, followed_user_id) VALUES (2, 1);
