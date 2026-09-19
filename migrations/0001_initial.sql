PRAGMA foreign_keys = ON;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('personal', 'explanation', 'argument', 'revision')),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  final_word_count INTEGER NOT NULL DEFAULT 0,
  final_character_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_completed_at ON sessions(completed_at DESC);
CREATE INDEX idx_sessions_task_type ON sessions(task_type);

CREATE TABLE session_metrics (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  metrics_json TEXT NOT NULL CHECK (json_valid(metrics_json)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE writer_profiles (
  version INTEGER PRIMARY KEY,
  profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
  sample_sessions INTEGER NOT NULL DEFAULT 0,
  sample_words INTEGER NOT NULL DEFAULT 0,
  sample_events INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_writer_profiles_updated_at ON writer_profiles(updated_at DESC);

CREATE TABLE transformations (
  id TEXT PRIMARY KEY,
  profile_version INTEGER REFERENCES writer_profiles(version),
  source_hash TEXT NOT NULL,
  validation_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
