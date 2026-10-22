import path from "path";
import dotenv from "dotenv";
const dir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
dotenv.config({ path: path.resolve(__dirname, ".env") });
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const dbname = process.env.DB_NAME || "";
  if (user && pass && dbname) {
    const u = encodeURIComponent(user);
    const p = encodeURIComponent(pass);
    dbUrl = `postgres://${u}:${p}@${host}:${port}/${dbname}`;
  } else {
    throw new Error("DATABASE_URL or DB_* vars not set. Ensure the database is provisioned");
  }
}
export default {
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl
  }
};
