DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Items;
DROP TABLE IF EXISTS Feeds;


CREATE TABLE IF NOT EXISTS Users (UserId INTEGER PRIMARY KEY, Token TEXT, Username TEXT);
INSERT INTO Users (UserId, Token, Username) VALUES (1, '8ca444e4-c26a-4f03-bfce-73139b128f1b', 'rakhim');

CREATE TABLE IF NOT EXISTS Feeds (FeedId INTEGER PRIMARY KEY, Title TEXT, Url TEXT, RSSUrl Text);
INSERT INTO Feeds (FeedId, Title, Url, RSSUrl) VALUES (1, 'Rakhims blog', 'https://rakhim.org/', 'https://rakhim.org/index.xml');


CREATE TABLE IF NOT EXISTS Items (ItemId INTEGER PRIMARY KEY, FeedId INTEGER, Title TEXT, Url TEXT, FOREIGN KEY(FeedId) REFERENCES Feeds(FeedId));
