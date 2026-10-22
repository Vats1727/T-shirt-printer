import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
let conn = process.env.DATABASE_URL;
if (!conn) {
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const dbname = process.env.DB_NAME || "";
  if (user && pass && dbname) {
    const u = encodeURIComponent(user);
    const p = encodeURIComponent(pass);
    conn = `postgres://${u}:${p}@${host}:${port}/${dbname}`;
  }
}
if (!conn) {
  console.warn("Postgres connection not configured via DATABASE_URL or DB_* env vars; DB features disabled (using JSON storage)");
}
export const pool = conn ? new Pool({ connectionString: conn }) : null;
if (pool) {
  try {
    pool.on && pool.on("error", (err) => {
      console.error("Postgres pool error:", err);
    });
  } catch (e) {
  }
}
export const db = conn ? drizzle(pool) : null;
