import { storage } from './storage';

(async () => {
  try {
    const list = await storage.getDesigns();
    console.log('designs: count=', Array.isArray(list) ? list.length : 0);
    process.exit(0);
  } catch (e) {
    console.error('error listing designs', e);
    process.exit(1);
  }
})();