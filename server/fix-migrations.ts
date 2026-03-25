import { pool } from './db';
import fs from 'fs';
import path from 'path';

async function runSql(filename: string) {
  const migrationPath = path.resolve(process.cwd(), 'migrations', filename);
  if (!fs.existsSync(migrationPath)) {
    console.log(`Migration file ${filename} not found, skipping.`);
    return;
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Applying migration ${filename}...`);
  try {
    await pool.query(sql);
    console.log(`Migration ${filename} applied successfully.`);
  } catch (err: any) {
    if (err.message && err.message.includes('already exists')) {
      console.log(`Some parts of ${filename} already exist, continuing.`);
    } else {
      console.error(`Error applying ${filename}:`, err.message);
    }
  }
}

async function main() {
  if (!pool) {
    console.error('No database connection pool');
    process.exit(1);
  }
  try {
    await runSql('0007_add_product_to_inventory.sql');
    await runSql('0019_add_owner_id_to_catalog.sql');
  } finally {
    await pool.end();
  }
}

main();
