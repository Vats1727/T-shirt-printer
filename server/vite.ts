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
  const vmAny = viteModule as any;
  const createServerFn = vmAny.createServer ?? vmAny.createViteServer ?? vmAny.default?.createServer ?? vmAny.default;
  if (typeof createServerFn !== 'function') {
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
