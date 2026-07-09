#!/bin/sh
# Container entrypoint: apply DB migrations, then start the Next.js server.
set -e

cd /app/apps/web

echo "[entrypoint] running migrations…"
../../node_modules/.bin/tsx lib/db/migrate.ts

echo "[entrypoint] starting server…"
exec node server.js
