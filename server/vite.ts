import { type Express } from "express";

import { type Server } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  // Build a minimal client config for the embedded Vite server instead of importing the client's config file
  const clientRoot = path.resolve(__dirname, "..", "client");
  const aliases = {
    '@': path.resolve(clientRoot, 'src'),
    '@shared': path.resolve(__dirname, 'shared'),
    '@assets': path.resolve(clientRoot, 'attached_assets'),
  };

  const viteModule = await import('vite');
  // Some distributions export different shapes; cast to any to access fallbacks safely
  let vmAny = viteModule as any;

  // If import('vite') accidentally resolved to this file (e.g., due to name collision), detect and re-resolve from node_modules
  // (some loaders can resolve bare specifiers to local files in odd setups)
  if (vmAny && typeof vmAny.setupVite === 'function') {
    // eslint-disable-next-line no-console
    console.warn('DEBUG: import("vite") resolved to local module; re-resolving from node_modules');
    try {
      // Use createRequire to resolve the installed vite package entrypoint and import via file:// URL
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const vitePkgPath = require.resolve('vite');
      const { pathToFileURL } = await import('url');
      const vitePkgUrl = pathToFileURL(vitePkgPath).href;
      vmAny = (await import(vitePkgUrl)) as any;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DEBUG: failed to re-resolve vite from node_modules', err);
    }
  }

  // Debugging: log available exports when createServer is missing
  const createServerFn = vmAny.createServer ?? vmAny.createViteServer ?? vmAny.default?.createServer ?? vmAny.default;
  if (typeof createServerFn !== 'function') {
    // eslint-disable-next-line no-console
    console.error('DEBUG: vite module keys:', Object.keys(vmAny || {}));
    // eslint-disable-next-line no-console
    if (vmAny && vmAny.default) console.error('DEBUG: vite.default keys:', Object.keys(vmAny.default));
    throw new Error('vite.createServer is not available');
  }
  const reactPlugin = (await import('@vitejs/plugin-react')).default;

  const vite = await createServerFn({
    root: clientRoot,
    configFile: false,
    plugins: [reactPlugin()],
    resolve: {
      alias: aliases,
    },
    build: {
      outDir: path.resolve(clientRoot, 'dist/public'),
      emptyOutDir: true,
    },
    server: serverOptions,
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
