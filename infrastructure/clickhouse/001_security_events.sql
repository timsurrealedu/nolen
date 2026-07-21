CREATE TABLE IF NOT EXISTS security_events (
  event_id String,
  event_timestamp DateTime64(3, 'UTC'),
  ingested_at DateTime64(3, 'UTC') DEFAULT now64(3),
  agent_id Nullable(String),
  nef_version LowCardinality(String),
  host_id String,
  host_name Nullable(String),
  category LowCardinality(String),
  action LowCardinality(String),
  result Nullable(String),
  user_name Nullable(String),
  source_ip Nullable(String),
  service_name Nullable(String),
  process_name Nullable(String),
  process_pid Nullable(UInt32),
  process_privilege Nullable(String),
  file_path Nullable(String),
  raw_nef String
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY event_id;
