-- Migration number: 0019 	 2024-12-15T16:50:02.924Z

CREATE TABLE IF NOT EXISTS related_items (
    id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	item_id INTEGER,
    related_item_id INTEGER,
	FOREIGN KEY(item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    FOREIGN KEY(related_item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    UNIQUE(item_id, related_item_id)
);

