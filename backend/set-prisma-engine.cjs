/**
 * Preload script: set PRISMA_QUERY_ENGINE_LIBRARY before any Prisma code runs.
 * Run with: node -r ./set-prisma-engine.cjs dist/index.js
 * This bypasses Prisma's path resolution which can pick up wrong (e.g. Windows) paths.
 */
const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const clientDir = path.join(cwd, 'node_modules', '.prisma', 'client');

try {
  if (fs.existsSync(clientDir)) {
    const files = fs.readdirSync(clientDir);
    const engine = files.find(
      (f) => f.startsWith('libquery_engine') && f.endsWith('.so.node')
    ) || files.find((f) => f.endsWith('.so.node'));
    if (engine) {
      const fullPath = path.join(clientDir, engine);
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = fullPath;
    }
  }
} catch (_) {}
