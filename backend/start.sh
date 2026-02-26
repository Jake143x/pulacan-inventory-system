#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Generate Prisma client (ensures Linux engine is present)
node node_modules/prisma/build/index.js generate

# Start app with preload so Prisma engine path is set from Node (avoids wrong paths from Prisma's search)
exec node -r ./set-prisma-engine.cjs dist/index.js
