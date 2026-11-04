import { pool } from '../config/database.js';

/**
 * Liveness Probe: Checks if the HTTP server process is running and accepting traffic.
 * Standard response: HTTP 200 with service status, uptime, and timestamp.
 */
export async function getHealth(_req, res) {
  return res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
}

/**
 * Readiness Probe: Verifies critical application dependencies, specifically PostgreSQL connectivity.
 * Returns:
 *   - HTTP 200 with dependency statuses if database is operational.
 *   - HTTP 503 Service Unavailable if database is unreachable (without exposing credentials).
 */
export async function getReadiness(_req, res) {
  const timestamp = new Date().toISOString();

  // If pool is not configured (e.g. running in JSON fallback mode)
  if (!pool) {
    return res.status(200).json({
      ready: true,
      status: 'ready',
      database: 'not_configured',
      timestamp
    });
  }

  try {
    // Ping database with a lightweight query and a short timeout
    await pool.query('SELECT 1');
    return res.status(200).json({
      ready: true,
      status: 'ready',
      database: 'connected',
      timestamp
    });
  } catch (_err) {
    // Return 503 Service Unavailable without exposing credentials or internal errors
    return res.status(503).json({
      ready: false,
      status: 'unavailable',
      database: 'disconnected',
      timestamp
    });
  }
}

export default {
  getHealth,
  getReadiness
};

