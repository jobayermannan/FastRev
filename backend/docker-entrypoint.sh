#!/bin/sh
set -e

# When the database is already awake (normal local Compose or warm managed DB), finish
# migrations and admin bootstrap synchronously before the server accepts traffic.
# When a managed free-tier database is asleep, blocking here prevents $PORT from binding
# so the host proxy hangs incoming requests instead of letting Express answer /health (200)
# and /api/* (503 "The database is waking up"). Fall back to background retries in that case.
MAX_RETRIES=40
RETRY_DELAY=15

echo "Running database migrations..."
if npx prisma migrate deploy; then
  echo "Migrations completed successfully"
  echo "Bootstrapping administrator if configured..."
  node dist/bootstrap-admin.js || echo "Warning: initial admin bootstrap failed"
else
  echo "Database is still waking up; continuing migrations in the background so HTTP can bind..."
  (
    attempt=2
    while [ $attempt -le $MAX_RETRIES ]; do
      sleep $RETRY_DELAY
      if npx prisma migrate deploy; then
        echo "Background migrations completed on attempt $attempt"
        node dist/bootstrap-admin.js || echo "Warning: background admin bootstrap failed"
        exit 0
      fi
      echo "Background migration attempt $attempt/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s..."
      attempt=$((attempt + 1))
    done
    echo "Warning: Background migrations did not succeed after $MAX_RETRIES attempts"
  ) &
fi

echo "Starting application..."
exec node dist/server.js
