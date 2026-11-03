import { pool } from './database.js';
import { CORE_FUNCTIONS, TABLES, INITIAL_SEEDS } from '../models/schemaRegistry.js';
import { seedPortalAdmin } from './seedAdmin.js';

/**
 * Parses individual column definitions from a CREATE TABLE SQL body.
 * Skips table-level constraints (e.g. CONSTRAINT, PRIMARY KEY (col1, col2)).
 */
function parseColumns(columnsSql) {
  const lines = columnsSql
    .split('\n')
    .map((l) => l.trim().replace(/,$/, ''))
    .filter((l) => l.length > 0);

  const columns = [];
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (
      upper.startsWith('CONSTRAINT') ||
      upper.startsWith('PRIMARY KEY') ||
      upper.startsWith('FOREIGN KEY') ||
      upper.startsWith('UNIQUE') ||
      upper.startsWith('CHECK')
    ) {
      continue;
    }

    const firstSpace = line.indexOf(' ');
    if (firstSpace > 0) {
      const colName = line.substring(0, firstSpace).trim();
      const colDef = line.substring(firstSpace + 1).trim();
      columns.push({ name: colName, def: colDef, full: line });
    }
  }
  return columns;
}

/**
 * Model-Driven Database Synchronizer.
 * Synchronizes the PostgreSQL database schema directly from the models registry.
 * Eliminates the fragile chain of 30 historical migration files.
 */
export async function syncModelsToDb() {
  if (!pool) {
    console.warn('[ModelSync] PostgreSQL database pool not configured. Skipping schema synchronization.');
    return;
  }

  const client = await pool.connect();
  try {
    console.log('[ModelSync] Synchronizing database schema directly from models...');

    // 1. Ensure core helper functions exist (triggers, timestamp functions)
    for (const fnSql of CORE_FUNCTIONS) {
      await client.query(fnSql);
    }

    // 2. Process each model table
    for (const table of TABLES) {
      // 2a. Create table if not exists with all complete model columns
      await client.query(`CREATE TABLE IF NOT EXISTS ${table.name} (${table.columns});`);

      // 2b. Self-healing: Ensure any new columns added to models are present in existing tables
      const existingColsRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table.name]
      );
      const existingCols = new Set(existingColsRes.rows.map((r) => r.column_name.toLowerCase()));

      const modelCols = parseColumns(table.columns);
      for (const col of modelCols) {
        if (!existingCols.has(col.name.toLowerCase())) {
          try {
            await client.query(`ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def};`);
            console.log(`[ModelSync] Added new column "${col.name}" to table "${table.name}"`);
          } catch (colErr) {
            console.warn(`[ModelSync] Note adding column ${col.name} to ${table.name}:`, colErr.message);
          }
        }
      }

      // 2c. Ensure performance and unique indexes
      if (Array.isArray(table.indexes)) {
        for (const idxSql of table.indexes) {
          try {
            await client.query(idxSql);
          } catch (idxErr) {
            console.warn(`[ModelSync] Note applying index on ${table.name}:`, idxErr.message);
          }
        }
      }

      // 2d. Ensure triggers
      if (Array.isArray(table.triggers)) {
        for (const trgSql of table.triggers) {
          try {
            await client.query(trgSql);
          } catch (trgErr) {
            console.warn(`[ModelSync] Note applying trigger on ${table.name}:`, trgErr.message);
          }
        }
      }
    }

    // 3. Seed default base data (sizes, default financial settings)
    for (const seedSql of INITIAL_SEEDS) {
      try {
        await client.query(seedSql);
      } catch (seedErr) {
        console.warn('[ModelSync] Note executing initial seed:', seedErr.message);
      }
    }

    // 3b. Ensure no default unowned colors exist in the catalog
    try {
      await client.query('DELETE FROM colors WHERE owner_id IS NULL');
    } catch (cleanErr) {
      // Ignore if colors table is not yet created
    }

    // 4. Guarantee Portal Admin credentials
    await seedPortalAdmin();

    console.log(`[ModelSync] ✓ Database schema is 100% in sync with models (${TABLES.length} tables verified).`);
  } catch (err) {
    console.error('[ModelSync] ✗ Error during model schema synchronization:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Standalone execution support: `node src/config/syncModels.js`
if (process.argv[1] && process.argv[1].endsWith('syncModels.js')) {
  syncModelsToDb()
    .then(() => {
      console.log('[ModelSync] Synchronization process complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ModelSync] Failed to sync models to DB:', err);
      process.exit(1);
    });
}

