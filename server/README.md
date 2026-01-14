# Tshirt-printer — Local dev

This repo has two top-level folders: `server/` and `client/`.

Quick start (Windows PowerShell):

1. Install server deps (one-time):
   - cd server
   - npm install

2. Start the backend:
   - npm run server:dev
   - Server runs on http://localhost:5000

4. Run smoke tests (in a separate terminal):
   - npm run smoke
   - Tests will create, update, and delete a design and validate that `designs.json` is unchanged afterwards

5. Health & readiness checks
   - `GET /healthz` — liveness probe (returns 200 when the process is alive)
   - `GET /ready` — readiness probe (returns 200 only after server startup completes; returns 503 while the server is warming up or shutting down)

These endpoints are useful to configure load balancer or container health checks in production.

3. In a separate terminal, start the frontend (uses server's node_modules):
   - cd client
   - npm run dev
   - Open http://localhost:5173

Notes:
- The client dev server proxies `/api` requests to `http://localhost:5000` (see `client/vite.config.ts`).
- If you need to change the backend port, set `PORT` env var before running the server.

If you want me to install and start these here, say 'Start them here' and I'll run them and report results.


## Using Postgres instead of JSON file (optional)

To use Postgres for storage (recommended for persistence across restarts):

1. Create a `.env` file in the `server/` directory (you can copy the example):
   - `cp .env.example .env` and fill in `DATABASE_URL` (or set `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`).

2. Apply the DB migrations:
   - cd server && npm run db:push

3. (Optional) Import existing designs from `designs.json` into the database:
   - cd server && npm run db:import-json
   - Or run both migrations + import in one step: `npm run db:setup`

4. Start the server with the DB enabled:
   - cd server && npm run server:dev

You can verify the active storage type by hitting `GET /api/storage-type` which will return `{ type: "db" }` when DB is in use.
