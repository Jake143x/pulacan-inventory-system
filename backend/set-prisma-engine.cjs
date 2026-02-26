/**
 * Preload script: set PRISMA_QUERY_ENGINE_LIBRARY before any Prisma code runs.
 * Run with: node -r ./set-prisma-engine.cjs dist/index.js
 * Uses __dirname so path is correct even when cwd is not the backend folder.
 */
const path = require('path');
const fs = require('fs');

const clientDir = path.join(__dirname, 'node_modules', '.prisma', 'client');

try {
  if (fs.existsSync(clientDir)) {
    const files = fs.readdirSync(clientDir);
    const engine = files.find(
      (f) => f.startsWith('libquery_engine') && f.endsWith('.so.node')
    ) || files.find((f) => f.endsWith('.so.node'));
    if (engine) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.resolve(clientDir, engine);
    }
  }
} catch (_) {}
