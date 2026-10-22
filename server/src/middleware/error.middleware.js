import env from '../config/env.js';

export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error('SERVER ERROR:', { status, message, stack: err.stack });

  try {
    if (!res.headersSent) {
      try {
        res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      } catch (e) {
        // ignore
      }
      res.status(status).json({ message });
    }
  } catch (e) {
    // ignore
  }
}

export default errorHandler;
