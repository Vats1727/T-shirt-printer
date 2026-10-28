import http from 'http';
import app from './app.js';
import env from './config/env.js';
import { pool } from './config/database.js';
import { log } from './utils/logger.js';

const httpServer = http.createServer(app);
const connections = new Set();

httpServer.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => connections.delete(socket));
});

const port = env.PORT || 5000;
const listenOptions = { port, host: '0.0.0.0' };
if (process.platform !== 'win32') {
  listenOptions.reusePort = true;
}

httpServer.listen(listenOptions, async () => {
  log(`Tshirt-printer Server running on http://localhost:${port}`);
  log(`Storage driver: ${pool ? 'PostgreSQL database' : 'JSON file fallback'}`);
});

let isShuttingDown = false;
async function shutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log(`Received ${signal}, gracefully shutting down...`);

  httpServer.close((err) => {
    if (err) console.error('Error during HTTP server close:', err);
  });

  // Allow in-flight requests a grace period to finish responding
  setTimeout(async () => {
    for (const socket of connections) {
      try { socket.destroy(); } catch (e) {}
    }

    if (pool) {
      try { await pool.end(); } catch (e) {}
    }

    log('Shutdown complete.');
    process.exit(0);
  }, 1500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (Server kept alive):', err?.stack || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (Server kept alive):', reason?.stack || reason);
});

export default httpServer;
