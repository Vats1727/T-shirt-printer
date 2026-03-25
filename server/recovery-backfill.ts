
import { db } from "./db";
import { designs, assets } from "./src/shared/schema";
import { isNull, eq } from "drizzle-orm";

async function backfill() {
  const targetUserId = 7;
  console.log(`Backfilling NULL owner_id in designs to ${targetUserId}...`);
  const dRes = await db.update(designs)
    .set({ owner_id: targetUserId })
    .where(isNull(designs.owner_id))
    .returning();
  console.log(`Updated ${dRes.length} designs.`);

  console.log(`Backfilling NULL uploader_id in assets to ${targetUserId}...`);
  const aRes = await db.update(assets)
    .set({ uploader_id: targetUserId })
    .where(isNull(assets.uploader_id))
    .returning();
  console.log(`Updated ${aRes.length} assets.`);

  process.exit(0);
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
