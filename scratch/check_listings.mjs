import { pool } from '../server/src/config/database.js';

async function main() {
  const l = await pool.query("SELECT * FROM listings");
  console.log('Listings:', JSON.stringify(l.rows, null, 2));

  const d = await pool.query("SELECT * FROM designs");
  console.log('Designs:', JSON.stringify(d.rows, null, 2));

  const dv = await pool.query("SELECT * FROM design_versions");
  console.log('Design versions:', JSON.stringify(dv.rows, null, 2));

  process.exit(0);
}
main().catch(console.error);

