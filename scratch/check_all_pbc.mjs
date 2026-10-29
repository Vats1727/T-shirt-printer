import { pool } from '../server/src/config/database.js';

async function main() {
  const l = await pool.query("SELECT id, title, design_key FROM listings");
  console.log('Listings:', l.rows);
  const dv = await pool.query("SELECT id, design_id, payload->'metadata'->'preview_by_color' as pbc, payload->'metadata'->'selected_colors' as sc FROM design_versions");
  console.log('Design versions:', dv.rows);
  process.exit(0);
}
main().catch(console.error);

