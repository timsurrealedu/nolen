#!/bin/sh
set -eu
for name in admin ingestion event_store detection incident_store api; do
  upper="$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')"
  eval "export NATS_${upper}_PASSWORD=\$(cat /run/secrets/nats_${name}_password)"
done
exec nats-server -c /etc/nats/nats.conf
