import { pool } from '../server/src/config/database.js';
import fs from 'fs';

async function main() {
  const sql = fs.readFileSync('server/migrations/0023_create_platform_financial_settings.sql', 'utf8');
  await pool.query(sql);
  console.log('Migration 0023 applied successfully.');
  const r = await pool.query('SELECT * FROM platform_financial_settings');
  console.log('Current settings row:', r.rows[0]);
  process.exit(0);
}
main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

