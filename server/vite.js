import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export async function setupVite(server, app) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true
  };
  const clientRoot = path.resolve(__dirname, "..", "client");
  const aliases = {
    "@": path.resolve(clientRoot, "src"),
    "@shared": path.resolve(__dirname, "shared"),
    "@assets": path.resolve(clientRoot, "attached_assets")
  };
  const viteModule = await import("vite");
  let vmAny = viteModule;
  if (vmAny && typeof vmAny.setupVite === "function") {
    console.warn('DEBUG: import("vite") resolved to local module; re-resolving from node_modules');
    try {
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const vitePkgPath = require.resolve("vite");
      const { pathToFileURL } = await import("url");
      const vitePkgUrl = pathToFileURL(vitePkgPath).href;
      vmAny = await import(vitePkgUrl);
    } catch (err) {
      console.error("DEBUG: failed to re-resolve vite from node_modules", err);
    }
  }
  const createServerFn = vmAny.createServer ?? vmAny.createViteServer ?? vmAny.default?.createServer ?? vmAny.default;
  if (typeof createServerFn !== "function") {
    console.error("DEBUG: vite module keys:", Object.keys(vmAny || {}));
    if (vmAny && vmAny.default) console.error("DEBUG: vite.default keys:", Object.keys(vmAny.default));
    throw new Error("vite.createServer is not available");
  }
  const reactPlugin = (await import("@vitejs/plugin-react")).default;
  const vite = await createServerFn({
    root: clientRoot,
    configFile: false,
    plugins: [reactPlugin()],
    resolve: {
      alias: aliases
    },
    build: {
      outDir: path.resolve(clientRoot, "dist/public"),
      emptyOutDir: true
    },
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
