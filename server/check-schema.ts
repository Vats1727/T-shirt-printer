import { pool } from './db';

async function checkSchema() {
  if (!pool) {
    console.error('No database connection pool');
    process.exit(1);
  }
  try {
    const tables = ['sizes', 'colors', 'products', 'products_full', 'cloth_inventory', 'size_chart'];
    for (const table of tables) {
      console.log(`--- Schema for ${table} ---`);
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Error querying schema:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
