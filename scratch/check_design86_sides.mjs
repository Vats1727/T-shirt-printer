import { pool } from '../server/src/config/database.js';

async function main() {
  const dv = await pool.query("SELECT payload FROM design_versions WHERE design_id = 86");
  const p = dv.rows[0].payload;
  console.log('sides:', JSON.stringify(p.sides, null, 2));
  console.log('metadata:', JSON.stringify(p.metadata, null, 2));
  process.exit(0);
}
main().catch(console.error);

