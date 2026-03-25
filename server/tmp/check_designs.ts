import { db } from '../db';
import { designs, design_versions } from '@shared/schema';
import { desc } from 'drizzle-orm';

async function checkDesigns() {
  const latestDesigns = await db.select()
    .from(designs)
    .orderBy(desc(designs.id))
    .limit(5);
    
  console.log('--- LATEST DESIGNS IN DB ---');
  for (const d of latestDesigns) {
    console.log(`Design ID: ${d.id}`);
    console.log(`Product: ${(d as any).product}`);
    console.log(`Created At: ${(d as any).created_at || (d as any).createdAt}`);
    console.log(`Owner ID: ${d.owner_id}`);
    
    // fetch versions
    const versions = await db.select()
      .from(design_versions)
      .where(
        (design_versions.design_id as any).equals ? (design_versions.design_id as any).equals(d.id) : undefined
      )
      .limit(1);
    
    // fallback if equals doesn't work this way
    const allVersions = await db.select().from(design_versions);
    const relatedV = allVersions.filter(v => v.design_id === d.id);
    
    if (relatedV.length > 0) {
      console.log(`Version Output: ${JSON.stringify(relatedV[0].payload).substring(0, 100)}...`);
    } else {
      console.log('No versions found for this design.');
    }
    console.log('---------------------------');
  }
  process.exit(0);
}

checkDesigns().catch(console.error);
