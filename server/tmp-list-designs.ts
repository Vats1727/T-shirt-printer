import { storage } from './storage';

(async () => {
  try {
    const list = await storage.getDesigns();
    console.log('designs: count=', Array.isArray(list) ? list.length : 0);
    (process as any).exitCode = 0;
    return;
  } catch (e) {
    console.error('error listing designs', e);
    (process as any).exitCode = 1;
    return;
  }
})();