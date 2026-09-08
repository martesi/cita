CREATE TABLE IF NOT EXISTS refs (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  bytes INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS refs_expires_at_idx ON refs (expires_at);
