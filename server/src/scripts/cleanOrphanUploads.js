import storageService from '../services/storage.service.js';
import { pool } from '../config/database.js';

async function main() {
  console.log('[Orphan Cleaner] Starting scan of server/uploads directory...');
  try {
    const result = await storageService.purgeOrphanUploads();
    console.log(`[Orphan Cleaner] Scan complete. Total files evaluated: ${result.totalDiskFiles}`);
    console.log(`[Orphan Cleaner] Purged ${result.deleted.length} orphaned file(s):`);
    for (const f of result.deleted) {
      console.log(` - ${f}`);
    }
  } catch (err) {
    console.error('[Orphan Cleaner] Error running cleanup:', err);
  } finally {
    if (pool) {
      await pool.end();
    }
    process.exit(0);
  }
}

main();

