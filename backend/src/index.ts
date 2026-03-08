import './setupPrismaEngine.js';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { productsRouter } from './routes/products.js';
import { inventoryRouter } from './routes/inventory.js';
import { posRouter } from './routes/pos.js';
import { ordersRouter } from './routes/orders.js';
import { reportsRouter } from './routes/reports.js';
import { analyticsRouter } from './routes/analytics.js';
import { aiRouter } from './routes/ai.js';
import { configRouter } from './routes/config.js';
import { notificationsRouter } from './routes/notifications.js';
import { inventoryAiRouter } from './routes/inventoryAi.js';
import { chatRouter } from './routes/chat.js';
import { uploadRouter } from './routes/upload.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startScheduledAI } from './services/scheduler.js';
import { getImageBaseUrl } from './lib/imageUrl.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(rateLimiter);

app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/upload', uploadRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/pos', posRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/config', configRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/inventory-ai', inventoryAiRouter);
app.use('/api/chat', chatRouter);

app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    imageBaseUrl: getImageBaseUrl() || null,
  })
);

app.get('/', (_req, res) => {
  res.json({
    name: 'Pulacan Inventory API',
    status: 'running',
    docs: 'Use /api/* endpoints. Health check: /api/health',
  });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Inventory API running at http://localhost:${PORT}`);
  startScheduledAI();
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Either:\n  1. Stop the other process using port ${PORT}\n  2. Or set PORT to another number (e.g. set PORT=3002)\n`);
  }
  process.exit(1);
});
