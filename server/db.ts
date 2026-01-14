import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load env file located at server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Ensure we load the server/.env (same directory as this file)
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Build a connection string from DATABASE_URL if present, otherwise from DB_* vars
let conn = process.env.DATABASE_URL;
if (!conn) {
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const dbname = process.env.DB_NAME || '';

  if (user && pass && dbname) {
    // URL-encode components to handle special characters in passwords
    const u = encodeURIComponent(user);
    const p = encodeURIComponent(pass);
    conn = `postgres://${u}:${p}@${host}:${port}/${dbname}`;
  }
}

if (!conn) {
  console.warn('Postgres connection not configured via DATABASE_URL or DB_* env vars; DB features disabled (using JSON storage)');
}

export const pool = conn ? new Pool({ connectionString: conn }) : (null as unknown as Pool);
export const db = conn ? drizzle(pool) : (null as any);