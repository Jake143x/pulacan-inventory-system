#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Generate Prisma client (ensures Linux engine is present)
node node_modules/prisma/build/index.js generate

# Force Prisma to use the engine we just generated (bypasses path search that can pick up wrong paths)
ENGINE=$(find "$(pwd)/node_modules/.prisma/client" -maxdepth 1 -type f -name 'libquery_engine*.so.node' 2>/dev/null | head -1)
if [ -z "$ENGINE" ]; then
  ENGINE=$(find "$(pwd)/node_modules/.prisma/client" -maxdepth 1 -type f -name '*.so.node' 2>/dev/null | head -1)
fi
if [ -n "$ENGINE" ] && [ -f "$ENGINE" ]; then
  # Copy to a known path Prisma searches, then point env to it
  mkdir -p /tmp/prisma-engines
  cp "$ENGINE" /tmp/prisma-engines/
  LIBNAME=$(basename "$ENGINE")
  exec env PRISMA_QUERY_ENGINE_LIBRARY="/tmp/prisma-engines/$LIBNAME" node dist/index.js
fi

exec node dist/index.js
