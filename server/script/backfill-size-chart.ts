import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { pool } from '../db';

async function main() {
  if (!pool) {
    console.error('DB pool not available. Ensure DB env vars are set and run migrations.');
    (process as any).exitCode = 1;
    return;
  }

  // Insert a default size_chart row for any size that doesn't have one yet
  const res = await pool.query(`
    INSERT INTO size_chart (size_id, chest, length, shoulder)
    SELECT s.id, 0, 0, 0 FROM sizes s
    WHERE NOT EXISTS (SELECT 1 FROM size_chart sc WHERE sc.size_id = s.id)
    RETURNING id, size_id
  `);

  console.log('Inserted rows:', res.rowCount);
  (process as any).exitCode = 0;
  return;
}

main().catch((err) => {
  console.error(err);
  (process as any).exitCode = 1;
  return;
});