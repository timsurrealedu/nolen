#!/bin/sh
set -eu
export CLICKHOUSE_PASSWORD="$(cat /run/secrets/clickhouse_admin_password)"
exec /entrypoint.sh
