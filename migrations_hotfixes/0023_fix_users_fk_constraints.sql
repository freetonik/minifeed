-- THIS IS A HOTFIX FOR MIGRATIONS WHICH HAD MISSING: REFERENCES users (user_id) ON DELETE CASCADE
-- the original migrations are now fixed, but this hotfix is left here for reference

CREATE TABLE IF NOT EXISTS email_verifications_2 (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    verification_code TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

INSERT INTO email_verifications_2 SELECT * FROM email_verifications;
ALTER TABLE email_verifications RENAME TO email_verifications_old;
ALTER TABLE email_verifications_2 RENAME TO email_verifications;



CREATE TABLE IF NOT EXISTS password_resets_2 (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    reset_code TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

INSERT INTO password_resets_2 SELECT * FROM password_resets;
ALTER TABLE password_resets RENAME TO password_resets_old;
ALTER TABLE password_resets_2 RENAME TO password_resets;

-- DON'T FORGET TO DROP THE OLD TABLES
-- DROP TABLE email_verifications_old;
-- DROP TABLE password_resets_old;