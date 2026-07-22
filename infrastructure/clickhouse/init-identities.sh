#!/bin/sh
set -eu

create_user() {
  password="$(cat "/run/secrets/clickhouse_${1}_password")"
  clickhouse-client --user default --password "$CLICKHOUSE_PASSWORD" --query "CREATE USER IF NOT EXISTS ${1} IDENTIFIED WITH sha256_password BY '${password}'"
}

create_user event_store
create_user api
clickhouse-client --user default --password "$CLICKHOUSE_PASSWORD" --multiquery <<'SQL'
GRANT INSERT ON default.security_events TO event_store;
GRANT SELECT ON default.security_events TO api;
SQL
