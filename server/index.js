import express from "express";
import { registerRoutes } from './routes.js';
import { serveStatic } from './static.js';
import { createServer } from "http";
const app = express();
const httpServer = createServer(app);
let isReady = false;
const connections = /* @__PURE__ */ new Set();
httpServer.on("connection", (socket) => {
  connections.add(socket);
  socket.on("close", () => connections.delete(socket));
});
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/ready", (_req, res) => {
  return res.status(isReady ? 200 : 503).json({ ready: isReady });
});
app.use(
  express.json({
    // Increase JSON body limit to allow uploading preview images via /api/assets (data URLs)
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ limit: "50mb", extended: false }));
export function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
export const _internal = {
  // will be set during startup
  isReady: () => false
};
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    if (res.headersSent) {
      return res;
    }
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  const timeoutMs = 6e4;
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      try {
        res.status(503).json({ message: "Request timed out" });
      } catch (e) {
      }
    }
  }, timeoutMs);
  const cleanup = () => clearTimeout(timeout);
  res.on("finish", () => {
    cleanup();
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  res.on("close", cleanup);
  next();
});
let isShuttingDown = false;
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("ERROR-MW:", { status, message, stack: err.stack });
  try {
    if (!res.headersSent) {
      try {
        const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      } catch (e) {
      }
      res.status(status).json({ message });
    }
  } catch (e) {
  }
});
(async () => {
  console.log("DEBUG: ensuring server JSON files exist");
  const fs = await import("fs/promises");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  async function ensureFile(name) {
    const filePath = path.resolve(__dirname, name);
    try {
      await fs.access(filePath);
    } catch (err) {
      await fs.writeFile(filePath, "[]");
      console.log(`Created missing file: ${filePath}`);
    }
  }
  await ensureFile("components.json");
  console.log("DEBUG: before registerRoutes");
  try {
    const compressionMod = await import("compression");
    app.use(compressionMod.default());
    console.log("DEBUG: compression middleware enabled");
  } catch (e) {
    console.log("DEBUG: compression not available");
  }
  try {
    const corsMod = await import("cors");
    app.use(corsMod({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
    console.log("DEBUG: CORS middleware enabled");
  } catch (e) {
    console.log("DEBUG: cors module not available, skipping CORS middleware");
  }
  app.use((req, res, next) => {
    try {
      const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      if (req.method === "OPTIONS") return res.sendStatus(204);
    } catch (e) {
    }
    next();
  });
  try {
    const path2 = await import("path");
    const fs2 = await import("fs/promises");
    const uploadsDir = path2.resolve(__dirname, "uploads");
    try {
      await fs2.access(uploadsDir);
      const expressStatic = (await import("express")).static;
      app.use("/uploads", expressStatic(uploadsDir));
      app.use("/attached_assets", expressStatic(uploadsDir));
      console.log("DEBUG: serving /uploads and /attached_assets from", uploadsDir);
    } catch (e) {
    }
  } catch (e) {
  }
  await registerRoutes(httpServer, app);
  console.log("DEBUG: after registerRoutes");
  try {
    const { getStorageType } = await import('./storage.js');
    console.log("Storage type:", getStorageType());
  } catch (e) {
    console.log("Storage type: json (default)");
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    try {
      if (!res.headersSent) res.status(status).json({ message });
    } catch (e) {
    }
    console.log("DEBUG: error middleware invoked:", err);
  });
  if (process.env.NODE_ENV === "production") {
    console.log("DEBUG: production mode, serving static");
    serveStatic(app);
  } else if (process.env.SKIP_VITE === "1") {
    console.log("DEBUG: SKIP_VITE is set; not starting Vite middleware");
  } else {
    console.log("DEBUG: development mode, setting up Vite");
    const { setupVite } = await import('./vite.js');
    await setupVite(httpServer, app);
    console.log("DEBUG: Vite setup completed");
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  console.log("DEBUG: listening on port", port);
  const listenOptions = { port, host: "0.0.0.0" };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }
  isReady = true;
  try {
    _internal.isReady = () => isReady;
  } catch (e) {
  }
  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
  function startForcedCloseTimer() {
    setTimeout(() => {
      log("Forcing close of remaining connections");
      for (const socket of connections) {
        try {
          socket.destroy();
        } catch (e) {
        }
      }
    }, 1e4);
  }
  async function shutdown(signal = "SIGTERM") {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log(`Received ${signal}, starting graceful shutdown...`);
    isReady = false;
    httpServer.close((err) => {
      if (err) {
        console.error("Error during server close", err);
      }
    });
    for (const socket of connections) {
      try {
        socket.end();
      } catch (e) {
      }
    }
    startForcedCloseTimer();
    setTimeout(() => {
      log("Shutdown complete, exiting");
      process.exit(0);
    }, 15e3);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION (Server kept alive):", err?.stack || err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION (Server kept alive):", reason?.stack || reason);
  });
})();
