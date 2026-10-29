import { pool } from '../server/src/config/database.js';

async function main() {
  const r = await pool.query("SELECT payload->'metadata'->'preview_by_color' as pbc FROM design_versions WHERE design_id = 86");
  const pbc = r.rows[0].pbc;
  for (const c of pbc) {
    console.log('Color:', c.id, c.name, c.hex);
    console.log('Front start:', c.preview_front ? c.preview_front.slice(0, 50) : null);
    console.log('Front length:', c.preview_front ? c.preview_front.length : 0);
  }
  process.exit(0);
}
main().catch(console.error);

