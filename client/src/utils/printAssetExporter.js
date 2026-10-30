/**
 * Utility to export isolated transparent artwork at 300 DPI for industrial RIP software.
 * Ensures NO garment background (t-shirt template silhouette) is included in the output.
 */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function exportTransparentPrintAsset(item, side = 'front', orderNumber = 'order') {
  const isBack = side === 'back';
  const layers = isBack ? (item.back_layers || []) : (item.front_layers || []);
  const details = item.design_details || {};
  const slogan = isBack ? details.backSlogan : details.slogan;

  // 300 DPI industrial canvas size (e.g. 2400 x 2400 px, 6x standard 400x400 canvas)
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 2400;
  const scale = CANVAS_WIDTH / 400;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Pure transparent background (NO garment/t-shirt template)
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  let hasDrawnAnything = false;

  // 1. Draw structured layers if present
  if (layers && layers.length > 0) {
    for (const layer of layers) {
      if (layer.type === 'text' && layer.text) {
        ctx.save();
        const posX = (layer.position?.x ?? 200) * scale;
        const posY = (layer.position?.y ?? 200) * scale;
        const rotation = (layer.rotation || 0) * Math.PI / 180;
        const fontSize = Math.round((layer.size || 24) * scale);

        ctx.translate(posX, posY);
        ctx.rotate(rotation);
        ctx.font = `bold ${fontSize}px 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.fillStyle = layer.color || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(layer.text, 0, 0);
        ctx.restore();
        hasDrawnAnything = true;
      } else if (layer.type === 'image') {
        const imgSrc = layer.asset?.url || layer.asset?.dataUrl || layer.url || layer.image;
        if (imgSrc) {
          try {
            const img = await loadImage(imgSrc);
            const targetW = (layer.scale || 1) * 400 * scale;
            const aspect = (img.naturalHeight || img.height) / (img.naturalWidth || img.width);
            const targetH = targetW * aspect;
            const posX = (layer.position?.x ?? 200) * scale;
            const posY = (layer.position?.y ?? 200) * scale;
            const rotation = (layer.rotation || 0) * Math.PI / 180;

            ctx.save();
            ctx.translate(posX, posY);
            ctx.rotate(rotation);
            ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
            ctx.restore();
            hasDrawnAnything = true;
          } catch (e) {
            console.warn('Could not load layer image for print export:', e);
          }
        }
      }
    }
  }

  // 2. Draw fallback slogan if layers array was empty
  if (!hasDrawnAnything && slogan) {
    const textPos = (isBack ? details.backTextPosition : details.textPosition) || { x: 200, y: 150 };
    const textRot = (isBack ? details.backTextRotation : details.textRotation) || 0;
    const textSize = (isBack ? details.backTextSize : details.textSize) || 28;
    const textColor = (isBack ? details.backColor : details.color) || '#000000';

    ctx.save();
    ctx.translate(textPos.x * scale, textPos.y * scale);
    ctx.rotate((textRot * Math.PI) / 180);
    ctx.font = `bold ${Math.round(textSize * scale)}px 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slogan, 0, 0);
    ctx.restore();
    hasDrawnAnything = true;
  }

  // 3. Fallback: Check if isolated print_file_url exists (must NOT be a garment mockup/farmo)
  const candidateUrl = isBack ? item.back_print_file_url : item.print_file_url;
  const isMockupUrl = !candidateUrl ||
    candidateUrl === item.preview_url ||
    candidateUrl === item.mockup_url ||
    candidateUrl === item.back_preview_url ||
    candidateUrl.includes('/templates/') ||
    /design-\d+-(front|back)\.png/i.test(candidateUrl);

  if (!hasDrawnAnything && candidateUrl && !isMockupUrl) {
    try {
      const img = await loadImage(candidateUrl);
      const targetW = 300 * scale;
      const aspect = (img.naturalHeight || img.height) / (img.naturalWidth || img.width);
      const targetH = targetW * aspect;
      const posX = 200 * scale;
      const posY = 180 * scale;

      ctx.save();
      ctx.translate(posX, posY);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();
      hasDrawnAnything = true;
    } catch (e) {
      console.warn('Could not load candidate print file into canvas:', e);
    }
  }

  if (!hasDrawnAnything) {
    throw new Error(`No isolated artwork detected for ${side} side. Use "Proof Mockup" to view the garment mockup proof.`);
  }

  // 4. Trigger download of the high-res transparent PNG
  canvas.toBlob((blob) => {
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${orderNumber}_${side}_transparent_300dpi.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }, 'image/png');
}

