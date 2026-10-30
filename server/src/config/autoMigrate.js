import { syncModelsToDb } from './syncModels.js';

/**
 * Legacy autoMigrate shim.
 * Forwards all migration requests directly to the Model-Driven synchronizer (syncModelsToDb).
 * Strictly guarantees that tables are created and managed by Models, never by historical SQL migration files.
 */
export async function runAutoMigrate() {
  console.log('[AutoMigrate] Redirecting to Model-Driven synchronizer (syncModelsToDb)...');
  return syncModelsToDb();
}

export default { runAutoMigrate };
