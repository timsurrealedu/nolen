CREATE TABLE IF NOT EXISTS ingested_event_ids (
  event_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  first_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
