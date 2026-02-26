#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Generate Prisma client (ensures Linux engine is present)
node node_modules/prisma/build/index.js generate

# Point Prisma to the engine we just generated (avoids wrong paths from other environments)
ENGINE=$(find "$(pwd)/node_modules/.prisma/client" -maxdepth 1 -name 'libquery_engine*.so.node' 2>/dev/null | head -1)
if [ -n "$ENGINE" ] && [ -f "$ENGINE" ]; then
  export PRISMA_QUERY_ENGINE_LIBRARY="$ENGINE"
fi

exec node dist/index.js
