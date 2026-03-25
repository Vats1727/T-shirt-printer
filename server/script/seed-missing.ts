import { db } from '../db';
import { colors, sizes } from '../src/shared/schema';

async function main() {
  console.log('Seeding colors...');
  await db.insert(colors).values([
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Black', hex: '#000000' },
    { name: 'Red', hex: '#FF0000' },
    { name: 'Blue', hex: '#0000FF' },
    { name: 'Green', hex: '#00FF00' },
    { name: 'Yellow', hex: '#FFFF00' },
    { name: 'Orange', hex: '#FFA500' },
    { name: 'Purple', hex: '#800080' },
    { name: 'Gray', hex: '#808080' },
    { name: 'Pink', hex: '#FFC0CB' },
  ]).onConflictDoNothing();

  console.log('Seeding sizes...');
  await db.insert(sizes).values([
    { label: 'S' },
    { label: 'M' },
    { label: 'L' },
    { label: 'XL' },
    { label: 'XXL' },
    { label: 'XXXL' },
  ]).onConflictDoNothing();

  console.log('Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
