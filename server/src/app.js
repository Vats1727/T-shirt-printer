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
      reqPath.startsWith('/t-shirt-printer') ||
      (API_PREFIX && reqPath.startsWith(API_PREFIX)) ||
      reqPath.includes('/healthz') ||
      reqPath.includes('/ready')
    ) {
      log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Static uploads serving (both root and reverse-proxy prefix)
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/t-shirt-printer/uploads', express.static(UPLOAD_DIR));
app.use('/attached_assets', express.static(UPLOAD_DIR));
app.use('/t-shirt-printer/attached_assets', express.static(UPLOAD_DIR));

// Root and reverse-proxy health & readiness endpoints
app.get(['/healthz', '/t-shirt-printer/healthz'], getHealth);
app.get(['/ready', '/t-shirt-printer/ready'], getReadiness);

// Mount API routes:
// 1. Production reverse proxy full prefix (/t-shirt-printer/api/v1)
app.use(API_PREFIX, apiRoutes);

// 2. Reverse proxy with /api (without /v1) (/t-shirt-printer/api)
app.use('/t-shirt-printer/api', apiRoutes);

// 3. Reverse proxy direct base mount (/t-shirt-printer)
app.use('/t-shirt-printer', apiRoutes);

// 4. Local dev / standard test mounts
app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes);

// Error and 404 middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
