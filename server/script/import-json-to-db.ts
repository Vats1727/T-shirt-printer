import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ensure env loaded
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { pool } from '../db';
import { designs as designsTable } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

async function main() {
  if (!process.env.DB_NAME && !process.env.DATABASE_URL) {
    throw new Error('DB not configured in env');
  }

  if (!pool) {
    throw new Error('Pool not available');
  }
  const db = drizzle(pool);

  const filePath = path.resolve(__dirname, '..', 'designs.json');
  let dataRaw: string;
  try {
    dataRaw = await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    console.error('designs.json not found');
    process.exit(1);
  }

  const designs = JSON.parse(dataRaw) as any[];
  console.log('Found', designs.length, 'designs in JSON');

  for (const d of designs) {
    const id = d.id;
    const existing = await db.select().from(designsTable).where(eq(designsTable.id, id));
    if (existing && existing.length) {
      console.log('Skipping existing id', id);
      continue;
    }

    const toInsert: any = {
      id: d.id,
      slogan: d.slogan || null,
      color: d.color,
      text_size: d.textSize,
      text_rotation: d.textRotation,
      text_position: d.textPosition,
      image: d.image || null,
      image_scale: d.imageScale,
      image_rotation: d.imageRotation,
      image_position: d.imagePosition,
      product: d.product || 'T-shirt',
      template: d.template || (d.product && d.product.toLowerCase().includes('hoodie') ? 'hoodie' : 'tshirt'),
      template_color: d.templateColor || '#ffffff',
      created_at: d.createdAt ? new Date(d.createdAt) : undefined,
    };

    await db.insert(designsTable).values(toInsert);
    console.log('Inserted id', id);
  }

  console.log('Import complete');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});