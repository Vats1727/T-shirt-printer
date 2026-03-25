const { DbStorage } = require('./server/storage-db');
const storage = new DbStorage();

async function testPrivacy() {
  console.log('--- Privacy Verification Test ---');
  
  // Assuming Designer A (ID 7) and Designer B (ID 9999)
  const designsA = await storage.getDesigns(100, 7);
  const designsB = await storage.getDesigns(100, 9999);
  
  const leakA = designsA.filter(d => d.owner_id !== 7);
  const leakB = designsB.filter(d => d.owner_id !== 9999);
  
  console.log(`Designer 7 has ${designsA.length} designs. Leaks: ${leakA.length}`);
  console.log(`Designer 9999 has ${designsB.length} designs. Leaks: ${leakB.length}`);
  
  if (leakA.length === 0 && leakB.length === 0) {
    console.log('SUCCESS: Privacy isolation confirmed at storage level.');
  } else {
    console.error('FAILURE: Privacy leak detected!');
  }
  
  // Test null/undefined handling
  const designsNull = await storage.getDesigns(100, null);
  console.log(`Null userId returns ${designsNull.length} designs (Expected: 0)`);
  
  process.exit();
}

testPrivacy().catch(console.error);
