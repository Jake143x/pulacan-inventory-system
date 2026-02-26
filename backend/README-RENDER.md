# Backend – Pulacan Inventory System

## Deploying on Render

- **Root Directory:** `backend`
- **Build Command:** `npm install && rm -rf node_modules/.prisma && node node_modules/prisma/build/index.js generate && npm run build`
- **Start Command:** `sh start.sh` ← must be exactly this so Prisma engine is set correctly

Do not use `npm start` or `node dist/index.js` as the Start Command; use `sh start.sh`.
