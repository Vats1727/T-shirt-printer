import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
let sharp: any;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.warn('maskGenerator: sharp not available, server-side masks disabled');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../public/attached_assets/masks');

async function ensureDir() {
  try {
    await fs.mkdir(ASSETS_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

export async function generateMaskFromBase64(base64: string, namePrefix = 'mask') {
  if (!sharp) return null;
  try {
    await ensureDir();
    const matches = base64.match(/^data:(image\/(png|jpeg|jpg));base64,(.*)$/);
    const b64 = matches ? matches[3] : base64.split(',').pop() || base64;
    const buffer = Buffer.from(b64, 'base64');

    const img = sharp(buffer);
    const meta = await img.metadata();

    // If has alpha, extract alpha as mask; otherwise convert to greyscale and threshold to generate mask
    let maskBuffer: Buffer;
    if (meta.hasAlpha) {
      maskBuffer = await img
        .ensureAlpha()
        .extractChannel('alpha')
        .toFormat('png')
        .toBuffer();
    } else {
      maskBuffer = await img
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .threshold(200)
        .toFormat('png')
        .toBuffer();
    }

    const filename = `${namePrefix}-${Date.now()}.png`;
    const outPath = path.join(ASSETS_DIR, filename);
    await fs.writeFile(outPath, maskBuffer);

    // Also write a white-composited version of the original image (helps consistent rendering)
    try {
      const compositesDir = path.join(__dirname, '../../public/attached_assets/uploads');
      await fs.mkdir(compositesDir, { recursive: true });
      const compFilename = `${namePrefix}-white-${Date.now()}.png`;
      const compPath = path.join(compositesDir, compFilename);
      await img.flatten({ background: { r: 255, g: 255, b: 255 } }).toFile(compPath);
      return { mask: `/attached_assets/masks/${filename}`, composite: `/attached_assets/uploads/${compFilename}` };
    } catch (e) {
      return { mask: `/attached_assets/masks/${filename}`, composite: null };
    }
  } catch (e) {
    console.error('generateMaskFromBase64 error:', e);
    return null;
  }
}
