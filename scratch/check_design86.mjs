import { pool } from '../server/src/config/database.js';

async function main() {
  const d = await pool.query("SELECT id, product_id, color, template_color, image, back_image FROM designs WHERE id = 86");
  console.log('Design 86:', d.rows);

  const dv = await pool.query("SELECT id, design_id, payload->'metadata' as meta, payload->'preview_by_color' as pbc, payload->'colors' as colors FROM design_versions WHERE design_id = 86");
  console.log('Design versions meta:', JSON.stringify(dv.rows, null, 2));

  const prod = await pool.query("SELECT id, name, colors, designs FROM products_full WHERE id = (SELECT product_id FROM designs WHERE id = 86)");
  console.log('Product for design 86:', prod.rows);

  process.exit(0);
}
main().catch(console.error);

