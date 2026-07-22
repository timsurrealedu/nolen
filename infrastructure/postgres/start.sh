#!/bin/sh
set -eu
mkdir -p /run/nolen-secrets
for source in /run/secrets/postgres_*_password; do
  target="/run/nolen-secrets/$(basename "$source")"
  cp "$source" "$target"
  chown postgres:postgres "$target"
  chmod 0400 "$target"
done
exec docker-entrypoint.sh postgres
