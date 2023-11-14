DROP TABLE IF EXISTS Feeds;
CREATE TABLE IF NOT EXISTS Feeds (FeedId INTEGER PRIMARY KEY, Title TEXT, Url TEXT);
INSERT INTO Feeds (FeedId, Title, Url) VALUES (1, 'Rakhims blog', 'https://rakhim.org/');

