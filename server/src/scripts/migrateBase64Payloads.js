import storageService from '../services/storage.service.js';
import { pool } from '../config/database.js';

async function main() {
  console.log('[Migration] Checking for existing Base64 images stored in design_versions...');

  if (!pool) {
    console.log('[Migration] No PostgreSQL pool available. Exiting.');
    process.exit(0);
  }

  try {
    const res = await pool.query(
      "SELECT id, design_id, payload FROM design_versions WHERE payload::text LIKE '%data:image%'"
    );

    console.log(`[Migration] Found ${res.rows.length} design_versions row(s) with Base64 images.`);

    for (const row of res.rows) {
      const vId = row.id;
      const dId = row.design_id;
      console.log(`[Migration] Converting Base64 in version ${vId} (Design ${dId})...`);

      const cleanedPayload = await storageService.convertPayloadBase64Images(row.payload, dId, null);

      await pool.query(
        'UPDATE design_versions SET payload = $1 WHERE id = $2',
        [typeof cleanedPayload === 'string' ? cleanedPayload : JSON.stringify(cleanedPayload), vId]
      );
      console.log(`[Migration] ✓ Version ${vId} updated with physical image URLs.`);
    }

    const verify = await pool.query(
      "SELECT count(*) FROM design_versions WHERE payload::text LIKE '%data:image%'"
    );
    console.log(`[Migration] Done! Remaining design_versions with Base64: ${verify.rows[0].count}`);
  } catch (err) {
    console.error('[Migration] Error during migration:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();

