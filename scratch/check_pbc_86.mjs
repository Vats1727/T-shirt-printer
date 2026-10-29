import { pool } from '../server/src/config/database.js';

async function main() {
  const r = await pool.query("SELECT payload->'metadata'->'preview_by_color' as pbc FROM design_versions WHERE design_id = 86");
  const pbc = r.rows[0].pbc;
  for (const item of pbc) {
    console.log({
      id: item.id,
      hex: item.hex,
      name: item.name,
      has_front: Boolean(item.preview_front || item.front),
      front_len: (item.preview_front || item.front || '').length,
      has_back: Boolean(item.preview_back || item.back),
      back_len: (item.preview_back || item.back || '').length
    });
  }
  process.exit(0);
}
main().catch(console.error);

