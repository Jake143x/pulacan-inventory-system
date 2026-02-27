# Backend – Pulacan Inventory System

## Deploying on Render

- **Root Directory:** must be `backend`.

### Option A (works with your current dashboard settings)

- **Build Command:** `npm install && npm run build`  
  → `postinstall` runs `npx prisma generate` during install, so the Linux engine is in `node_modules/.prisma/client`.
- **Start Command:** `npm start`  
  → Preload sets `PRISMA_QUERY_ENGINE_LIBRARY` so Prisma finds the engine.

### Option B (explicit control)

- **Build Command:** `npm install && rm -rf node_modules/.prisma && node node_modules/prisma/build/index.js generate && npm run build`
- **Start Command:** `sh start.sh`
