import { storage } from './storage.js';
(async () => {
  try {
    const d = await storage.createDesign({
      slogan: "Test DB Save",
      color: "#000000",
      textSize: 24,
      textRotation: 0,
      textPosition: { x: 150, y: 135 },
      image: null,
      imageScale: 100,
      imageRotation: 0,
      imagePosition: { x: 150, y: 150 }
    });
    console.log("created: id=", d && d.id || null);
  } catch (e) {
    console.error("error creating design", e);
    process.exit(1);
  }
})();
