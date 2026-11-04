import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import env from './config/env.js';
import apiRoutes, { API_PREFIX } from './routes/index.js';
import { getHealth, getReadiness } from './controllers/health.controller.js';
import errorHandler from './middleware/error.middleware.js';
import notFoundHandler from './middleware/not-found.middleware.js';
import { log } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../uploads');

const app = express();

// Body parsers with large limits for preview images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

// CORS headers - allow local network & configured origins
app.use((req, res, next) => {
  const reqOrigin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', reqOrigin || env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (
      reqPath.startsWith('/api') ||
      (API_PREFIX && reqPath.startsWith(API_PREFIX)) ||
      reqPath === '/healthz' ||
      reqPath === '/ready'
    ) {
      log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Static uploads serving
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/attached_assets', express.static(UPLOAD_DIR));

// Root-level health endpoints (for container / host liveness checks)
app.get('/healthz', getHealth);
app.get('/ready', getReadiness);

// Mount API routes at production reverse proxy prefix (/t-shirt-printer/api/v1)
app.use(API_PREFIX, apiRoutes);

// Compatibility alias for standard /api calls (preserves automated tests and local dev)
app.use('/api', apiRoutes);

// Error and 404 middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
