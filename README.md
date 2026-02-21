# T-shirt-printer

Quick start

- Start server (cd server):
  - `pnpm i`
  - `pnpm start`
- Start client (cd client):
  - `pnpm i`
- Start client only: 
  - `pnpm run dev`

Project structure

- `client/` – React + Vite frontend (source in `client/src`).
- `server/` – Express + TypeScript backend (source in `server/*.ts` and `server/src/*`).

## Current project FLow
1. Register as admin and supplier.
2. Login into admin Create a product for supplier which is visible to where  supplier creates its design. Available color option and sizes are given by admin to the supplier .
3. Login as supplier -> you can see Product created by admin go to  its design section , design it based on your choice  and save it .
4. Your created design will be visible in Saved design section.
5. GO to Create Listing from here supplier can add its created design  to its Ecommerce page.
6. after Listing go to VIew Store you can see Supplier Ecommerce page where listed product are showing .
   


## Build & Production
1. cd client && pnpm run build
2. cd server && pnpm run build
3. Serve server (`npm run start` in server) — production server serves client build assets

## Notes & troubleshooting
- If Vite reports missing PostCSS plugins, install them in the `client/` package (e.g. `@tailwindcss/typography`, `tailwindcss-animate`).
- Use `SKIP_VITE=1` (set automatically by `npm run server:dev`) to prevent the server from embedding Vite (useful when running the client separately).
- If ports are in use, change `PORT` env var: e.g. `$env:PORT = "3000"` in PowerShell before starting server.

