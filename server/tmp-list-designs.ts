import { storage } from './storage';

(async () => {
  try {
    const list = await storage.getDesigns();
    console.log('designs:', list);
    process.exit(0);
  } catch (e) {
    console.error('error listing designs', e);
    process.exit(1);
  }
})();