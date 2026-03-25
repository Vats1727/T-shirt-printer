const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function linkDesigners() {
  try {
    // Let's link all designers to provider ID 7 for this demo context
    const res = await pool.query("UPDATE users SET associated_provider_id = 7 WHERE role = 'designer'");
    console.log(`Updated ${res.rowCount} designers to be associated with provider ID 7.`);
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    process.exit();
  }
}

linkDesigners();
