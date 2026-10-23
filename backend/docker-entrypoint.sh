#!/bin/sh
set -e

MAX_RETRIES=5
RETRY_DELAY=2

echo "Running database migrations..."
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
  if npx prisma migrate deploy; then
    echo "Migrations completed successfully"
    break
  fi
  if [ $attempt -eq $MAX_RETRIES ]; then
    echo "Error: Migration failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Migration attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
  attempt=$((attempt + 1))
done

echo "Bootstrapping administrator if configured..."
node dist/bootstrap-admin.js

echo "Starting application..."
exec node dist/server.js
