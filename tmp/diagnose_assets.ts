
import { db } from "./server/db";
import { assets, designs } from "./server/src/shared/schema";
import { eq, and } from "drizzle-orm";

async function diagnose() {
  const userId = 7;
  console.log(`Diagnosing assets for user ${userId}...`);

  const userAssets = await db.select().from(assets).where(eq(assets.uploader_id, userId));
  console.log(`Found ${userAssets.length} assets for user ${userId}`);

  for (const asset of userAssets) {
    let meta = asset.metadata as any;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch(e) {}
    }
    const designId = meta?.designId || meta?.design_id || meta?.design;
    const side = meta?.side || meta?.side_name;
    const isPreview = meta?.preview === true || meta?.preview === 'true';

    console.log(`Asset ${asset.id}: filename=${asset.filename}, designId=${designId}, side=${side}, isPreview=${isPreview}, meta=${JSON.stringify(meta)}`);
  }

  const userDesigns = await db.select().from(designs).where(eq(designs.owner_id, userId));
  console.log(`Found ${userDesigns.length} designs for user ${userId}`);
  for (const d of userDesigns) {
      console.log(`Design ${d.id}: slogan=${d.slogan}, product=${d.product}`);
  }
}

diagnose().catch(console.error);
