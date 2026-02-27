/**
 * Set PRISMA_QUERY_ENGINE_LIBRARY before any Prisma code loads.
 * Import this first in index.ts so the engine is found on Render (and any env) regardless of start command.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');

if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY && fs.existsSync(clientDir)) {
  try {
    const files = fs.readdirSync(clientDir);
    const engine =
      files.find((f) => f.startsWith('libquery_engine') && f.endsWith('.so.node')) ||
      files.find((f) => f.endsWith('.so.node'));
    if (engine) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(clientDir, engine);
    }
  } catch {
    // ignore
  }
}
