# Tshirt-printer (client/server)

This repository is organized into two top-level folders:
- `server/` — Express backend
- `client/` — Vite + React frontend

Goal: run client and server independently (Option B).

## Quick start (Windows PowerShell)

1. Server (one terminal)
   - cd server
   - npm install
   - npm run server:dev
   - The server listens on http://localhost:5000

2. Client (another terminal)
   - cd client
   - npm install
   - npm run dev
   - The client dev server runs at http://localhost:5173 and proxies `/api/*` → `http://localhost:5000`

## Build & Production
1. cd client && npm run build
2. cd server && npm run build
3. Serve server (`npm run start` in server) — production server serves client build assets

## Notes & troubleshooting
- If Vite reports missing PostCSS plugins, install them in the `client/` package (e.g. `@tailwindcss/typography`, `tailwindcss-animate`).
- Use `SKIP_VITE=1` (set automatically by `npm run server:dev`) to prevent the server from embedding Vite (useful when running the client separately).
- If ports are in use, change `PORT` env var: e.g. `$env:PORT = "3000"` in PowerShell before starting server.

If you'd like, I can try to start both servers in this environment and show logs, but long-running processes may exit in this environment — the configuration and scripts above are configured for local development on your machine.