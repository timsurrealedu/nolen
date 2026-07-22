#!/bin/sh
set -eu

role() {
  password="$(cat "/run/secrets/postgres_${1}_password")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set="role_name=nolen_$1" --set="role_password=$password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role_name')\gexec
SQL
}

for name in event_store detection incident_store api; do role "$name"; done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
GRANT CONNECT ON DATABASE nolen TO nolen_event_store, nolen_detection, nolen_incident_store, nolen_api;
GRANT USAGE ON SCHEMA public TO nolen_event_store, nolen_detection, nolen_incident_store, nolen_api;
GRANT SELECT, INSERT, DELETE ON ingested_event_ids TO nolen_event_store;
GRANT SELECT, INSERT, UPDATE ON detection_sequence_state TO nolen_detection;
GRANT SELECT, INSERT ON incidents TO nolen_incident_store;
GRANT SELECT ON incidents TO nolen_api;
SQL
