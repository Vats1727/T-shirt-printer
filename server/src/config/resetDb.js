import { pool } from './database.js';
import { syncModelsToDb } from './syncModels.js';

/**
 * Drops all tables in the public schema and recreates them directly from models.
 * CAUTION: Destructive operation for development/testing environments.
 */
export async function resetDatabase() {
  if (!pool) {
    console.error('[ResetDB] No database pool configured.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('[ResetDB] Wiping all public schema tables & sequences...');
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO CURRENT_USER;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('[ResetDB] Schema cleaned. All tables dropped.');
  } finally {
    client.release();
  }

  // Re-create all tables directly from models
  console.log('[ResetDB] Rebuilding all tables directly from models via syncModelsToDb...');
  await syncModelsToDb();

  console.log('[ResetDB] Database successfully wiped, recreated directly from models, and seeded!');
}

if (process.argv[1] && process.argv[1].endsWith('resetDb.js')) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ResetDB] Error resetting database:', err);
      process.exit(1);
    });
}

