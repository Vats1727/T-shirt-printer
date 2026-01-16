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

3. (Optional) Import existing data from JSON files into the database:
   - Import designs: cd server && npm run db:import-json
   - Import users: cd server && npm run db:import-users
   - Or run migrations + imports in one step: `npm run db:setup` (this will also run the user import)

4. Start the server with the DB enabled:
   - cd server && npm run server:dev

You can verify the active storage type by hitting `GET /api/storage-type` which will return `{ type: "db" }` when DB is in use.

To verify the users table and test registration end-to-end:

1. Apply migrations and imports:
   - cd server && npm run db:setup
2. Start the server and register a user via the frontend `POST /register`.
3. Check the DB (psql):
   - psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT id, name, email, role, created_at FROM users ORDER BY id DESC LIMIT 10;"


New features added:
- Back side design support: Toggle "Front Side" / "Back Side" in the designer; each side preserves its own image, slogan, position, rotation, and scale. Back side uses template-specific back images (place `hoodie-back.png`, `t-shirt-back.png`, `women-teshirt-back.png` into `client/public/templates`).
- Role-based authentication: JWT auth with `POST /api/auth/register` and `POST /api/auth/login`. Use roles `admin` and `supplier`.
- Admin panel & APIs: `/api/admin/*` endpoints to manage colors, sizes, and inventory. Admin pages at `/admin/dashboard` and `/admin/clothes`.
- Supplier panel & APIs: `/api/supplier/*` endpoints to fetch catalog and place orders. Supplier pages at `/supplier/dashboard` and `/supplier/order`.
- DB schema & migrations: Added migrations to create catalog and orders, and to add back-side columns to `designs`.

API summary:
- POST /api/auth/register { name, email, password, role }
- POST /api/auth/login { email, password } -> { token }
- Admin (protected): GET/POST /api/admin/colors, GET/POST /api/admin/sizes, POST /api/admin/inventory
- Supplier (protected): GET /api/supplier/catalog, POST /api/supplier/order
- Supplier Orders: GET /api/supplier/orders, GET /api/supplier/orders/:id (returns supplier-scoped orders and order details)

See `server/migrations/0004_create_catalog.sql` and `server/migrations/0005_add_back_side.sql` for the SQL schema changes.
