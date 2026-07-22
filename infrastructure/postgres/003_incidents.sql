CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  body JSONB NOT NULL,
  first_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);
