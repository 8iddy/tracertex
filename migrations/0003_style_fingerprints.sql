ALTER TABLE sessions ADD COLUMN final_document TEXT;
ALTER TABLE sessions ADD COLUMN style_eligible INTEGER NOT NULL DEFAULT 1;

CREATE TABLE style_fingerprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  writer_profile_id TEXT REFERENCES writer_profiles(id),
  version INTEGER NOT NULL,
  fingerprint_json TEXT NOT NULL CHECK (json_valid(fingerprint_json)),
  source_session_count INTEGER NOT NULL DEFAULT 0,
  source_word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, version)
);
CREATE INDEX idx_style_fingerprints_user_updated_at ON style_fingerprints(user_id, updated_at DESC);
