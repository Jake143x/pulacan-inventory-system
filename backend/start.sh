#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Generate Prisma client (ensures Linux engine is present)
node node_modules/prisma/build/index.js generate

# Copy engine to fixed path and set env so Prisma finds it (avoids path search / wrong paths)
ENGINE=$(find "$(pwd)/node_modules/.prisma/client" -maxdepth 1 -type f -name 'libquery_engine*.so.node' 2>/dev/null | head -1)
if [ -z "$ENGINE" ]; then
  ENGINE=$(find "$(pwd)/node_modules/.prisma/client" -maxdepth 1 -type f -name '*.so.node' 2>/dev/null | head -1)
fi
if [ -n "$ENGINE" ] && [ -f "$ENGINE" ]; then
  mkdir -p /tmp/prisma-engines
  cp "$ENGINE" /tmp/prisma-engines/
  LIBNAME=$(basename "$ENGINE")
  exec env PRISMA_QUERY_ENGINE_LIBRARY="/tmp/prisma-engines/$LIBNAME" node dist/index.js
fi

# Fallback: preload tries to set engine from node_modules (no shell export)
exec node -r ./set-prisma-engine.cjs dist/index.js
