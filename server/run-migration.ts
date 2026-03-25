import { pool } from './db';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  if (!pool) {
    console.error('No database connection pool');
    process.exit(1);
  }
  try {
    const migrationPath = path.resolve(process.cwd(), 'migrations/0019_add_owner_id_to_catalog.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Applying migration 0019...');
    await pool.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await pool.end();
  }
}

applyMigration();
