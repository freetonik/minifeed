DROP TABLE IF EXISTS Users;
CREATE TABLE IF NOT EXISTS Users (UserId INTEGER PRIMARY KEY, Token TEXT, Username TEXT);
INSERT INTO Users (UserId, Token, Username) VALUES (1, '8ca444e4-c26a-4f03-bfce-73139b128f1b', 'rakhim');
