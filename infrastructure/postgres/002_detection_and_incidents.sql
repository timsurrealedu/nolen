CREATE TABLE IF NOT EXISTS detection_sequence_state (
  state_key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
