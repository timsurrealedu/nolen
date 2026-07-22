CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  body JSONB NOT NULL,
  first_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);

CREATE TABLE IF NOT EXISTS incident_status_audit (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
