PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  onboarding_status TEXT NOT NULL CHECK (onboarding_status IN ('NEW', 'CALIBRATION_IN_PROGRESS', 'INITIAL_PROFILE_READY', 'COMPLETE')),
  onboarding_step INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_step BETWEEN 0 AND 4),
  onboarding_completed_at TEXT,
  active_profile_id TEXT
);

CREATE INDEX idx_users_email ON users(email);

ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE session_metrics ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE transformations ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE settings ADD COLUMN user_id TEXT REFERENCES users(id);

CREATE INDEX idx_sessions_user_completed_at ON sessions(user_id, completed_at DESC);
CREATE INDEX idx_session_metrics_user_id ON session_metrics(user_id);
CREATE INDEX idx_transformations_user_id ON transformations(user_id);
CREATE INDEX idx_settings_user_id ON settings(user_id);

-- Preserve pre-authentication summaries without mixing them into authenticated
-- ownership. New profiles use an internal UUID and are unique per user/version.
ALTER TABLE writer_profiles RENAME TO writer_profiles_legacy;

CREATE TABLE writer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL,
  profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
  sample_sessions INTEGER NOT NULL DEFAULT 0,
  sample_words INTEGER NOT NULL DEFAULT 0,
  sample_events INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, version)
);

CREATE INDEX idx_writer_profiles_user_updated_at ON writer_profiles(user_id, updated_at DESC);
