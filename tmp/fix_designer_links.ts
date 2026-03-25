import { pool } from '../server/db';

async function fixLinks() {
  if (!pool) {
    console.log('No pool available');
    return;
  }
  
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
