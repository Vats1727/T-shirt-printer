// Basic drizzle-kit config (avoid typed helper to stop compile errors in this environment)
// Load env file located at server/.env so drizzle-kit picks up DB_* values when running from npm scripts
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load server/.env so drizzle-kit picks up DB_* values when running via npm scripts
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Construct DATABASE_URL from DB_* env vars if not explicitly set so `npm run db:push` works with either form.
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const dbname = process.env.DB_NAME || '';

  if (user && pass && dbname) {
    // URL-encode components to handle special characters in passwords
    const u = encodeURIComponent(user);
    const p = encodeURIComponent(pass);
    dbUrl = `postgres://${u}:${p}@${host}:${port}/${dbname}`;
  } else {
    throw new Error('DATABASE_URL or DB_* vars not set. Ensure the database is provisioned');
  }
}

export default {
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
};
