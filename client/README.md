# Client — Tshirt-printer

Run locally (PowerShell):

1. cd client
2. npm install
3. npm run dev

The client dev server runs at http://localhost:5173 and proxies requests starting with `/api/` to `http://localhost:5000` per `vite.config.ts`.

Build (production):

1. npm run build
2. Serve the `dist/public` folder from the server in production (server builds expect `dist/public`).