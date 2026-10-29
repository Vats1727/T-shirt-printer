import { pool } from '../server/src/config/database.js';
import fs from 'fs';

async function main() {
  const r = await pool.query("SELECT payload->'metadata'->'preview_by_color' as pbc FROM design_versions WHERE design_id = 86");
  const pbc = r.rows[0].pbc;
  const magenta = pbc.find(c => c.id === 33);
  
  const base64Data32 = pbc.find(c => c.id === 32).preview_front.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync('scratch/preview_32_front.png', base64Data32, 'base64');
  
  const base64Data33 = magenta.preview_front.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync('scratch/preview_33_front.png', base64Data33, 'base64');
  console.log('Saved scratch/preview_32_front.png and scratch/preview_33_front.png');
  process.exit(0);
}
main().catch(console.error);

