import { storage } from './storage';

(async () => {
  try {
    const d = await storage.createDesign({
      slogan: 'Test DB Save',
      color: '#000000',
      textSize: 24,
      textRotation: 0,
      textPosition: { x: 150, y: 135 },
      image: null,
      imageScale: 100,
      imageRotation: 0,
      imagePosition: { x: 150, y: 150 },
    } as any);
    console.log('created: id=', (d && (d as any).id) || null);
  } catch (e) {
    console.error('error creating design', e);
    (process as any).exitCode = 1;
    return;
  }
})();