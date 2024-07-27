-- Migration number: 0002 	 2024-05-03T08:57:42.610Z

-- free, trial, paid
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'free';
