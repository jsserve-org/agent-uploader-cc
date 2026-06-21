#!/bin/sh
set -e

# Apply any pending database migrations before the server accepts traffic.
echo "[entrypoint] applying migrations"
node scripts/migrate.mjs

echo "[entrypoint] starting: $*"
exec "$@"
