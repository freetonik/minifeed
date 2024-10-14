-- Migration number: 0014 	 2024-10-14T15:54:46.870Z

CREATE TABLE IF NOT EXISTS items_vector_relation (
	item_id INTEGER PRIMARY KEY,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vectorized INTEGER,
	FOREIGN KEY(item_id) REFERENCES items(item_id) ON DELETE CASCADE
);
