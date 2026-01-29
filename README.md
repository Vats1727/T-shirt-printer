# T-shirt-printer

Quick start

- Start server (development):
  - `pnpm start` (runs server with SKIP_VITE=1 in development)
- Start full dev environment (server then client):
  - `npm run dev` (starts server, waits for http://localhost:5000, then starts Vite client)
- Start client only: 
  - `pnpm run dev`

Project structure

- `client/` – React + Vite frontend (source in `client/src`).
- `server/` – Express + TypeScript backend (source in `server/*.ts` and `server/src/*`).


## Build & Production
1. cd client && pnpm run build
2. cd server && pnpm run build
3. Serve server (`npm run start` in server) — production server serves client build assets

## Notes & troubleshooting
- If Vite reports missing PostCSS plugins, install them in the `client/` package (e.g. `@tailwindcss/typography`, `tailwindcss-animate`).
- Use `SKIP_VITE=1` (set automatically by `npm run server:dev`) to prevent the server from embedding Vite (useful when running the client separately).
- If ports are in use, change `PORT` env var: e.g. `$env:PORT = "3000"` in PowerShell before starting server.

