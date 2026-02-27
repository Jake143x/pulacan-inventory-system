#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Generate Prisma client (downloads Linux engine for debian-openssl-3.0.x)
node node_modules/prisma/build/index.js generate

# Prefer engine copied during build (prisma-engines/), then node_modules/.prisma/client
CLIENT_DIR="$(pwd)/node_modules/.prisma/client"
ENGINE=""

if [ -f "$(pwd)/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node" ]; then
  ENGINE="$(pwd)/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node"
elif [ -f "$(pwd)/prisma-engines/libquery_engine-rhel-openssl-3.0.x.so.node" ]; then
  ENGINE="$(pwd)/prisma-engines/libquery_engine-rhel-openssl-3.0.x.so.node"
elif [ -f "$CLIENT_DIR/libquery_engine-debian-openssl-3.0.x.so.node" ]; then
  ENGINE="$CLIENT_DIR/libquery_engine-debian-openssl-3.0.x.so.node"
elif [ -f "$CLIENT_DIR/libquery_engine-rhel-openssl-3.0.x.so.node" ]; then
  ENGINE="$CLIENT_DIR/libquery_engine-rhel-openssl-3.0.x.so.node"
else
  ENGINE=$(find "$CLIENT_DIR" -maxdepth 1 -type f -name 'libquery_engine*.so.node' 2>/dev/null | head -1)
fi
if [ -z "$ENGINE" ]; then
  ENGINE=$(find "$CLIENT_DIR" -maxdepth 1 -type f -name '*.so.node' 2>/dev/null | head -1)
fi

if [ -n "$ENGINE" ] && [ -f "$ENGINE" ]; then
  mkdir -p /tmp/prisma-engines
  LIBNAME=$(basename "$ENGINE")
  cp "$ENGINE" "/tmp/prisma-engines/$LIBNAME"
  exec env PRISMA_QUERY_ENGINE_LIBRARY="/tmp/prisma-engines/$LIBNAME" node dist/index.js
fi

echo "Prisma engine not found. Checked prisma-engines/ and $CLIENT_DIR"
ls -la "$(pwd)/prisma-engines" 2>/dev/null || true
ls -la "$CLIENT_DIR" 2>/dev/null || true
exit 1
