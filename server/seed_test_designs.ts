
import { db } from './db';
import { designs } from './shared/schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding mock designs for verification...');
  
  // Clear existing mock data if needed, or just insert
  // For safety in this test environment, we'll just insert
  
  const mockDesigns = [
    { slogan: 'Design 1', color: 'red', group_id: 'd1', design_code: 'dd1' },
    { slogan: 'Design 2', color: 'blue', group_id: 'd1', design_code: 'dd2' },
    { slogan: 'Design 3', color: 'green', group_id: 'd1', design_code: 'dd3' },
    { slogan: 'Design 4', color: 'yellow', group_id: 'd1', design_code: 'dd4' },
    { slogan: 'Design 5', color: 'black', group_id: 'd1', design_code: 'dd5' },
    { slogan: 'Design 6', color: 'white', group_id: 'd1', design_code: 'dd6' },
    { slogan: 'Design 7', color: 'purple', group_id: 'd2', design_code: 'dd7' },
    { slogan: 'Design 8', color: 'orange', group_id: 'd2', design_code: 'dd8' },
  ];

  for (const d of mockDesigns) {
    await db.insert(designs).values({
      ...d,
      textPosition: { x: 0, y: 0 },
      imagePosition: { x: 0, y: 0 },
      back_text_position: { x: 0, y: 0 },
      back_image_position: { x: 0, y: 0 },
    });
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
