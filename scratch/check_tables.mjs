import { pool } from '../server/src/config/database.js';

async function main() {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('Tables:', r.rows.map(x => x.table_name));

  const p = await pool.query("SELECT id, name, colors, designs, owner_id FROM products_full LIMIT 3");
  console.log('Products:', JSON.stringify(p.rows, null, 2));

  if (r.rows.some(t => t.table_name === 'designer_designs')) {
    const d = await pool.query("SELECT * FROM designer_designs LIMIT 3");
    console.log('Designer designs:', JSON.stringify(d.rows, null, 2));
  }
  process.exit(0);
}
main().catch(console.error);

