#!/bin/sh
# Container entrypoint: migrate, first-run bootstrap, then the custom server
# (Next + Socket.IO + Square sync worker).
set -e

cd /app/apps/web

echo "[entrypoint] running migrations…"
./node_modules/.bin/tsx lib/db/migrate.ts

echo "[entrypoint] bootstrap (store + admin, only if missing)…"
./node_modules/.bin/tsx scripts/bootstrap.ts

echo "[entrypoint] starting server…"
exec ./node_modules/.bin/tsx server.ts
