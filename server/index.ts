import express, { type Request, Response, NextFunction } from "express";

// We'll attach controlled shutdown handlers after server startup to avoid double handling. See graceful shutdown helpers lower in the file.
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// readiness flag — set to true when server has finished startup tasks
let isReady = false;

// track open connections so we can destroy them on shutdown
const connections = new Set<any>();
httpServer.on('connection', (socket) => {
  connections.add(socket);
  socket.on('close', () => connections.delete(socket));
});

// simple health and readiness endpoints for orchestrators
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/ready', (_req, res) => {
  return res.status(isReady ? 200 : 503).json({ ready: isReady });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Configure conservative body limits to avoid huge request bodies causing OOM or high memory usage.
// Accept larger uploads via dedicated upload endpoints or pre-signed S3 uploads instead.
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ limit: '10mb', extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// expose for tests
export const _internal = {
  // will be set during startup
  isReady: () => false,
};

// per-request timeout middleware to avoid stuck handlers consuming resources
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    function sanitizeForLog(p: string, body: any) {
      try {
        if (!body) return body;
        // If it's the designs list, don't log the full payload — just its length
        if (p.startsWith('/api/designs') && Array.isArray(body)) {
          return { _type: 'designs_list', length: body.length };
        }

        if (Array.isArray(body)) {
          return body.map(item => {
            if (item && typeof item === 'object') {
              const c: any = { ...item };
              if ('image' in c) c.image = '[redacted]';
              // truncate long strings
              for (const k of Object.keys(c)) {
                if (typeof c[k] === 'string' && c[k].length > 200) c[k] = c[k].slice(0, 200) + '...[truncated]';
              }
              return c;
            }
            return item;
          });
        }

        if (typeof body === 'object' && body !== null) {
          const c: any = { ...body };
          if ('image' in c) c.image = '[redacted]';
          for (const k of Object.keys(c)) {
            if (typeof c[k] === 'string' && c[k].length > 200) c[k] = c[k].slice(0, 200) + '...[truncated]';
          }
          return c;
        }

        return body;
      } catch (e) {
        return '[unserializable]';
      }
    }

    // request timeout: 15 seconds
    const timeoutMs = 15_000;
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        try {
          res.status(503).json({ message: 'Request timed out' });
        } catch (e) {
          // ignore
        }
      }
    }, timeoutMs);

    res.on("finish", () => {
      clearTimeout(timeout);
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

        if (capturedJsonResponse) {
          const sanitized = sanitizeForLog(path, capturedJsonResponse);

          // For designs list responses, log a short summary instead of the full payload
          if (path === '/api/designs' && req.method === 'GET') {
            logLine += ` :: ${JSON.stringify(sanitized)}`;
          } else {
            logLine += ` :: ${JSON.stringify(sanitized)}`;
          }
        }

        log(logLine);
      }
    });

    next();
  });

  // shutdown guard to prevent re-entrance/crash loops
  let isShuttingDown = false;

  // replace error middleware to log and respond but not rethrow — rethrowing led to uncaught exceptions and restarts
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log detailed error for debugging (stack included)
    console.error('ERROR-MW:', { status, message, stack: err.stack });

    try {
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    } catch (e) {
      // ignore errors while sending error response
    }

    // Do not rethrow the error to avoid triggering uncaughtException handlers and crash/restart loops.
});

(async () => {
  console.log('DEBUG: ensuring server JSON files exist');
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // ensure designs.json and components.json exist
  async function ensureFile(name: string) {
    const filePath = path.resolve(__dirname, name);
    try {
      await fs.access(filePath as any);
    } catch (err) {
      await fs.writeFile(filePath as any, '[]');
      console.log(`Created missing file: ${filePath}`);
    }
  }
  await ensureFile('designs.json');
  await ensureFile('components.json');

  console.log('DEBUG: before registerRoutes');
  // Enable gzip compression when available to reduce response sizes
  try {
    const compressionMod = await import('compression');
    app.use((compressionMod as any).default());
    console.log('DEBUG: compression middleware enabled');
  } catch (e) {
    console.log('DEBUG: compression not available');
  }

  await registerRoutes(httpServer, app);
  console.log('DEBUG: after registerRoutes');

  // Log which storage implementation is active (helpful for local setup)
  try {
    const { getStorageType } = await import('./storage');
    console.log('Storage type:', getStorageType());
  } catch (e) {
    console.log('Storage type: json (default)');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    try {
      if (!res.headersSent) res.status(status).json({ message });
    } catch (e) {
      // ignore errors while trying to send the error response
    }

    // Log for diagnostics — do not rethrow to avoid uncaughtException and crash/restart loops
    console.log('DEBUG: error middleware invoked:', err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    console.log('DEBUG: production mode, serving static');
    serveStatic(app);
  } else if (process.env.SKIP_VITE === "1") {
    console.log('DEBUG: SKIP_VITE is set; not starting Vite middleware');
  } else {
    console.log('DEBUG: development mode, setting up Vite');
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    console.log('DEBUG: Vite setup completed');
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  console.log('DEBUG: listening on port', port);
  const listenOptions: any = { port, host: "0.0.0.0" };
  // reusePort is not supported on Windows. Only set it on other platforms.
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  // mark readiness once the server is configured and about to accept traffic
  isReady = true;
  // allow tests and health checks to query the internal readiness
  try {
    // update exported accessor
    (_internal as any).isReady = () => isReady;
  } catch (e) {
    // ignore in environments where module state is read-only
  }

  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });

  // graceful shutdown helpers
  function startForcedCloseTimer() {
    // after 10s, forcefully destroy remaining connections
    setTimeout(() => {
      log('Forcing close of remaining connections');
      for (const socket of connections) {
        try {
          (socket as any).destroy();
        } catch (e) {
          // ignore
        }
      }
    }, 10000);
  }

  async function shutdown(signal = 'SIGTERM') {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log(`Received ${signal}, starting graceful shutdown...`);
    // mark not ready so load balancers stop sending traffic
    isReady = false;

    // stop accepting new connections
    httpServer.close((err) => {
      if (err) {
        console.error('Error during server close', err);
      }
    });

    // politely end keep-alive connections then force close
    for (const socket of connections) {
      try {
        (socket as any).end();
      } catch (e) {
        // ignore
      }
    }

    startForcedCloseTimer();

    // final safety exit if shutdown takes too long
    setTimeout(() => {
      log('Shutdown complete, exiting');
      process.exit(0);
    }, 15000);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Basic guard to detect repeated crashes and avoid tight crash/restart loops.
  const recentFatalErrors: number[] = [];
  function registerFatalError() {
    const now = Date.now();
    recentFatalErrors.push(now);
    // keep only last 60 seconds
    while (recentFatalErrors.length && recentFatalErrors[0] < now - 60_000) recentFatalErrors.shift();
    return recentFatalErrors.length;
  }

  process.on('uncaughtException', (err) => {
    console.error('UNCaught Exception:', err);
    const count = registerFatalError();
    if (count > 3) {
      console.error('Too many fatal errors in short period, exiting to avoid crash loop');
      // give logger a moment to flush then exit with non-zero
      setTimeout(() => process.exit(1), 1000);
      return;
    }
    // If an uncaught exception occurs, attempt a graceful shutdown and exit.
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
    const count = registerFatalError();
    if (count > 3) {
      console.error('Too many fatal errors in short period, exiting to avoid crash loop');
      setTimeout(() => process.exit(1), 1000);
      return;
    }
    // Attempt graceful shutdown but don't rethrow synchronously.
    shutdown('unhandledRejection');
  });
})();
