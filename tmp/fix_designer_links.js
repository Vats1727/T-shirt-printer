const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME}`
});

async function fixLinks() {
  try {
    // 1. Find the first print provider
    const providerRes = await pool.query("SELECT id, email FROM users WHERE role = 'print_provider' LIMIT 1");
    if (providerRes.rows.length === 0) {
      console.log('No print provider found');
      return;
    }
    const providerId = providerRes.rows[0].id;
    console.log(`Found print provider: ${providerRes.rows[0].email} (ID: ${providerId})`);
    
    // 2. Update designers with null associated_provider_id
    const updateRes = await pool.query(
      "UPDATE users SET associated_provider_id = $1 WHERE role = 'designer' AND associated_provider_id IS NULL",
      [providerId]
    );
    console.log(`Linked ${updateRes.rowCount} designers to provider ID ${providerId}`);
  } catch (err) {
    console.error('Error fixing links:', err);
  } finally {
    await pool.end();
  }
}

fixLinks();
