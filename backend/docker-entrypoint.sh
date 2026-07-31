#!/bin/sh
set -eu

echo "Running PostgreSQL migrations and seeds..."
node dist/database/migrate.js all

echo "Starting THPT-PCT-PT backend..."
exec node dist/server.js
