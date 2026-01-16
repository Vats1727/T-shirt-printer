import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface DesignCanvasProps {
  side?: 'front' | 'back';
  slogan: string;
  color: string;
  template?: string;
  templateColor?: string;
  /** Optional override image to use as the shirt/template for this canvas (admin-provided full-shirt image) */
  templateImage?: string;
  /** An optional tint color to apply only to user images; if unset `color` is used instead */
  imageTintColor?: string;
  textSize?: number;
  textRotation?: number;
  textPosition?: { x: number; y: number };
  onTextMove?: (pos: { x: number; y: number }) => void;
  image?: string | null;
  imageScale?: number;
  imageRotation?: number;
  imagePosition?: { x: number; y: number };
  onImageMove?: (pos: { x: number; y: number }) => void;
  /** optional background image for the canvas (data URL or URL) */
  backgroundImage?: string | null;
  width?: number;
  height?: number;
  readonly?: boolean;
  /** Whether to tint images by the `imageTintColor` or `color` prop (useful for logos) */
  tintImage?: boolean;
  /** When true, always fill shirt with `templateColor` and skip drawing user/admin images. Useful for supplier previews. */
  forceTemplateFill?: boolean;
} 

export function DesignCanvas({
  side = 'front',
  slogan,
  color,
  templateColor,  template = 'tshirt',  textSize = 24,
  textRotation = 0,
  textPosition = { x: 150, y: 135 },
  onTextMove,
  image,
  imageScale = 100,
  imageRotation = 0,
  imagePosition = { x: 150, y: 150 },
  onImageMove,
  templateImage = undefined,
  imageTintColor = undefined,
  /** whether to tint user-uploaded images using the `imageTintColor` or `color` prop */
  tintImage = false,
  /** When true, skip drawing user/admin images and only fill template color (supplier preview use-case) */
  forceTemplateFill = false,
  width = 300,
  height = 300,
  readonly = false,
  backgroundImage = undefined,
  showTemplate = false,
}: DesignCanvasProps & { showTemplate?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tshirtRef = useRef<HTMLImageElement | null>(null);
  const userImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  
  const [isDragging, setIsDragging] = useState<'text' | 'image' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load template image (tshirt, hoodie, etc.)
  useEffect(() => {
    // If template drawing is disabled, skip loading any template asset and clear ref
    if (!showTemplate) {
      tshirtRef.current = null;
      render();
      return;
    }

    const img = new Image();

    // If an admin-provided template image is supplied, use it directly and skip the default templates
    if (templateImage) {
      img.src = templateImage;
      img.onload = () => {
        tshirtRef.current = img;
        try { console.debug('DesignCanvas: loaded admin template image', img.src, img.width, img.height); } catch (e) {}
        render();
      };
      img.onerror = () => {
        tshirtRef.current = null;
        render();
      };

      return () => { img.onload = null as any; img.onerror = null as any; };
    }

    // If no admin template image is provided, don't load built-in templates — leave shirt blank
    tshirtRef.current = null;
    render();
    return; 
  }, [template, side, showTemplate, templateImage]);

  // Load user image
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        userImageRef.current = img;
        try { console.debug('DesignCanvas: loaded user image', img.src, img.width, img.height); } catch(e) {}
        render();
      };
    } else {
      userImageRef.current = null;
      render();
    }
  }, [image]);

  // Load background image
  useEffect(() => {
    if (!backgroundImage) {
      backgroundRef.current = null;
      render();
      return;
    }

    // If the supplied background image is the same as the active user image, skip loading it to avoid duplicates
    if (image && backgroundImage === image) {
      try { console.debug('DesignCanvas: skipping background load because it matches user image', backgroundImage); } catch (e) {}
      backgroundRef.current = null;
      render();
      return;
    }

    const img = new Image();
    img.src = backgroundImage;
    img.onload = () => {
      backgroundRef.current = img;
      try { console.debug('DesignCanvas: loaded background image', img.src, img.width, img.height); } catch(e) {}
      render();
    };
  }, [backgroundImage, image]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = width / 400;

    ctx.clearRect(0, 0, width, height);

    // Default to plain white background to avoid texture images showing through
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw background image (cover) if provided (kept for compatibility, but UI removed by admin)
    if (backgroundRef.current) {
      const bg = backgroundRef.current;
      const canvasW = width;
      const canvasH = height;
      // cover-fit the image similar to CSS background-size: cover
      const ratio = Math.max(canvasW / bg.width, canvasH / bg.height);
      const bgW = bg.width * ratio;
      const bgH = bg.height * ratio;
      const bgX = (canvasW - bgW) / 2;
      const bgY = (canvasH - bgH) / 2;
      ctx.drawImage(bg, bgX, bgY, bgW, bgH);
    }

    // Draw template only if showTemplate is true AND template image has been loaded
    if (showTemplate && tshirtRef.current) {
      // Fill T-shirt template color with robust masking and preserve shading
      if (templateColor) {
        const off = document.createElement('canvas');
        off.width = width;
        off.height = height;
        const offCtx = off.getContext('2d');

        // Draw template into a mask canvas to inspect alpha at the shirt center
        const mask = document.createElement('canvas');
        mask.width = width;
        mask.height = height;
        const maskCtx = mask.getContext('2d');

        if (offCtx && maskCtx) {
          maskCtx.drawImage(tshirtRef.current, 0, 0, width, height);
          // sample a small area around the center to decide mask polarity (more robust for back-side templates)
          const sampleSize = 11; // 11x11 center sample
          const sx = Math.max(0, Math.floor(width / 2 - sampleSize / 2));
          const sy = Math.max(0, Math.floor(height / 2 - sampleSize / 2));
          const sample = maskCtx.getImageData(sx, sy, Math.min(sampleSize, width - sx), Math.min(sampleSize, height - sy)).data;
          let centerAlphaSum = 0;
          for (let i = 0; i < sample.length; i += 4) centerAlphaSum += sample[i + 3];
          const centerAlphaAvg = centerAlphaSum / (sample.length / 4);

          // also sample corners to determine background opacity
          const cornerBox = 5;
          const cornerSamples = [];
          const addCorner = (cx: number, cy: number) => {
            const w = Math.min(cornerBox, width - cx);
            const h = Math.min(cornerBox, height - cy);
            const data = maskCtx.getImageData(cx, cy, w, h).data;
            let s = 0;
            for (let i = 0; i < data.length; i += 4) s += data[i + 3];
            cornerSamples.push(s / (data.length / 4));
          };
          addCorner(0, 0);
          addCorner(Math.max(0, width - cornerBox), 0);
          addCorner(0, Math.max(0, height - cornerBox));
          addCorner(Math.max(0, width - cornerBox), Math.max(0, height - cornerBox));
          const cornerAlphaAvg = cornerSamples.reduce((a, b) => a + b, 0) / cornerSamples.length;

          // Fill with chosen color
          offCtx.fillStyle = templateColor;
          offCtx.fillRect(0, 0, width, height);

          // Decide polarity by comparing center vs corners: if center more opaque than corners, template likely marks shirt -> keep where opaque
          // otherwise template is background-opaque and transparent at shirt -> remove template pixels from color (destination-out)
          const useDestinationIn = centerAlphaAvg > cornerAlphaAvg;
          const ambiguous = Math.abs(centerAlphaAvg - cornerAlphaAvg) < 10; // close values -> alpha ambiguous
          try { console.debug('DesignCanvas: mask polarity', { side, centerAlphaAvg, cornerAlphaAvg, useDestinationIn, ambiguous, templateColor }); } catch(e) {}

          if (!ambiguous) {
            if (useDestinationIn) {
              offCtx.globalCompositeOperation = 'destination-in';
              offCtx.drawImage(tshirtRef.current, 0, 0, width, height);
              offCtx.globalCompositeOperation = 'source-over';
            } else {
              offCtx.globalCompositeOperation = 'destination-out';
              offCtx.drawImage(tshirtRef.current, 0, 0, width, height);
              offCtx.globalCompositeOperation = 'source-over';
            }
          } else {
            // Ambiguous alpha: build a color-based mask from the template image to isolate the hoodie area
            try {
              const tmplData = maskCtx.getImageData(0, 0, width, height);
              // compute average corner color
              const sampleBox = 5;
              const cornerCoords = [
                { x: 0, y: 0 },
                { x: Math.max(0, width - sampleBox), y: 0 },
                { x: 0, y: Math.max(0, height - sampleBox) },
                { x: Math.max(0, width - sampleBox), y: Math.max(0, height - sampleBox) },
              ];
              let cr = 0, cg = 0, cb = 0, ca = 0, ccount = 0;
              for (const c of cornerCoords) {
                const w = Math.min(sampleBox, width - c.x);
                const h = Math.min(sampleBox, height - c.y);
                for (let yy = 0; yy < h; yy++) {
                  for (let xx = 0; xx < w; xx++) {
                    const idx = ((c.y + yy) * width + (c.x + xx)) * 4;
                    cr += tmplData.data[idx];
                    cg += tmplData.data[idx + 1];
                    cb += tmplData.data[idx + 2];
                    ca += tmplData.data[idx + 3];
                    ccount++;
                  }
                }
              }
              if (ccount === 0) ccount = 1;
              const bcR = Math.round(cr / ccount);
              const bcG = Math.round(cg / ccount);
              const bcB = Math.round(cb / ccount);
              const bcA = Math.round(ca / ccount);

              const colorDist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));

              const maskArr = new Uint8ClampedArray(width * height * 4);
              const threshold = 30;
              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  const idx = (y * width + x) * 4;
                  const r = tmplData.data[idx];
                  const g = tmplData.data[idx + 1];
                  const b = tmplData.data[idx + 2];
                  const a = tmplData.data[idx + 3];
                  // require some visibility
                  if (a < 8) {
                    maskArr[idx] = maskArr[idx + 1] = maskArr[idx + 2] = 0;
                    maskArr[idx + 3] = 0;
                    continue;
                  }

                  const d = colorDist(r, g, b, bcR, bcG, bcB);
                  if (d > threshold) {
                    maskArr[idx] = maskArr[idx + 1] = maskArr[idx + 2] = 255;
                    maskArr[idx + 3] = 255;
                  } else {
                    maskArr[idx] = maskArr[idx + 1] = maskArr[idx + 2] = 0;
                    maskArr[idx + 3] = 0;
                  }
                }
              }

              // Put mask into a canvas and use destination-in with it to apply the color only where mask exists
              const maskImg = new ImageData(maskArr, width, height);
              const maskCanvas2 = document.createElement('canvas');
              maskCanvas2.width = width; maskCanvas2.height = height;
              const mctx = maskCanvas2.getContext('2d');
              if (mctx) {
                mctx.putImageData(maskImg, 0, 0);
                // Smooth the mask by downscaling then upscaling (imageSmoothing) to anti-alias edges
                try {
                  // Prefer using canvas filter blur if available (smoother, non-pixelated)
                  const tmp = document.createElement('canvas');
                  tmp.width = width; tmp.height = height;
                  const tctx = tmp.getContext('2d');
                  if (tctx) {
                    tctx.putImageData(maskImg, 0, 0);
                    // apply blur on draw if supported
                    if ('filter' in mctx) {
                      mctx.clearRect(0, 0, width, height);
                      (mctx as any).filter = 'blur(1.5px)';
                      mctx.drawImage(tmp, 0, 0);
                      (mctx as any).filter = 'none';
                    } else {
                      // fallback: gentle downscale/upscale (less aggressive than before)
                      const small = document.createElement('canvas');
                      small.width = Math.max(2, Math.floor(width / 4));
                      small.height = Math.max(2, Math.floor(height / 4));
                      const sctx = small.getContext('2d');
                      if (sctx) {
                        sctx.imageSmoothingEnabled = true;
                        sctx.imageSmoothingQuality = 'high';
                        sctx.drawImage(tmp, 0, 0, small.width, small.height);
                        mctx.clearRect(0, 0, width, height);
                        mctx.imageSmoothingEnabled = true;
                        mctx.imageSmoothingQuality = 'high';
                        mctx.drawImage(small, 0, 0, width, height);
                      } else {
                        mctx.putImageData(maskImg, 0, 0);
                      }
                    }
                  } else {
                    mctx.putImageData(maskImg, 0, 0);
                  }
                } catch (e) {
                  // ignore smoothing failures and continue
                }

                offCtx.globalCompositeOperation = 'destination-in';
                offCtx.drawImage(maskCanvas2, 0, 0);
                offCtx.globalCompositeOperation = 'source-over';
              } else {
                // fallback to drawing template directly
                offCtx.globalCompositeOperation = 'destination-in';
                offCtx.drawImage(tshirtRef.current, 0, 0, width, height);
                offCtx.globalCompositeOperation = 'source-over';
              }
            } catch (err) {
              // on any error, fallback to previous alpha-based approach
              offCtx.globalCompositeOperation = 'destination-in';
              offCtx.drawImage(tshirtRef.current, 0, 0, width, height);
              offCtx.globalCompositeOperation = 'source-over';
            }
          }

          // Draw the colored masked result onto the main canvas
          ctx.drawImage(off, 0, 0);

          // Now draw the template image on top in 'multiply' mode to apply shading/highlights
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(tshirtRef.current, 0, 0, width, height);
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        } else {
          // Fallback: just draw the template image if offscreen context not available
          ctx.drawImage(tshirtRef.current, 0, 0, width, height);
        }
      } else {
        // Default behavior: draw template image
        ctx.drawImage(tshirtRef.current, 0, 0, width, height);
      }
    } else if (showTemplate && !tshirtRef.current) {
      // No admin template assigned -> draw a subtle placeholder to indicate missing admin image
      ctx.save();
      ctx.fillStyle = '#f3f4f6';
      const pad = 20 * (width / 400);
      ctx.fillRect(pad, pad, width - pad*2, height - pad*2);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${14 * (width/400)}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No admin image assigned', width/2, height/2);
      ctx.restore();
    } // else skip drawing template entirely


    // Draw Image first (behind text). Only draw if image is explicitly provided (admin-assigned). If tintImage is true, fill the image's alpha with `imageTintColor` (or `color`) so logos follow selected color.
    if (userImageRef.current && image && !forceTemplateFill) {
      const imgScale = (imageScale / 100) * scale;
      const imgWidth = Math.max(1, Math.floor(userImageRef.current.width * imgScale));
      const imgHeight = Math.max(1, Math.floor(userImageRef.current.height * imgScale));

      // prepare an offscreen canvas to draw a colorized image when requested
      const coversMostOfCanvas = imgWidth >= (width * 0.9) && imgHeight >= (height * 0.9);
      const tintColor = imageTintColor || color;
      if (tintImage && tintColor) {
        const off = document.createElement('canvas');
        off.width = imgWidth;
        off.height = imgHeight;
        const offCtx = off.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(userImageRef.current, 0, 0, imgWidth, imgHeight);

          try {
            const srcData = offCtx.getImageData(0, 0, imgWidth, imgHeight);

            // Quick alpha coverage test: if a large portion of the image has alpha > 10, treat as full-shirt photo and use template mask instead
            let alphaCount = 0;
            for (let i = 0; i < imgWidth * imgHeight; i++) { if (srcData.data[i*4 + 3] > 10) alphaCount++; }
            const alphaRatio = alphaCount / (imgWidth * imgHeight);
            if (alphaRatio > 0.6 && tshirtRef.current) {
              // template-based fill for full-shirt photo
              const fillCanvas = document.createElement('canvas');
              fillCanvas.width = width; fillCanvas.height = height;
              const fctx = fillCanvas.getContext('2d');
              if (fctx) {
                fctx.fillStyle = tintColor;
                fctx.fillRect(0,0,width,height);
                fctx.globalCompositeOperation = 'destination-in';
                fctx.drawImage(tshirtRef.current, 0, 0, width, height);
                fctx.globalCompositeOperation = 'source-over';

                ctx.save(); ctx.globalAlpha = 0.95; ctx.drawImage(fillCanvas, 0, 0); ctx.restore();
                ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tshirtRef.current, 0, 0, width, height); ctx.globalCompositeOperation='source-over'; ctx.restore();
                return;
              }
            }

            // detect background color by sampling the four corners (5x5 area) and averaging
            const sampleBox = 5;
            const cornerSamples: number[][] = [];
            const addCorner = (sx: number, sy: number) => {
              let r = 0, g = 0, b = 0, a = 0, count = 0;
              for (let y = sy; y < Math.min(imgHeight, sy + sampleBox); y++) {
                for (let x = sx; x < Math.min(imgWidth, sx + sampleBox); x++) {
                  const idx = (y * imgWidth + x) * 4;
                  r += srcData.data[idx];
                  g += srcData.data[idx + 1];
                  b += srcData.data[idx + 2];
                  a += srcData.data[idx + 3];
                  count++;
                }
              }
              if (count === 0) return [0,0,0,0];
              return [Math.round(r/count), Math.round(g/count), Math.round(b/count), Math.round(a/count)];
            };

            cornerSamples.push(addCorner(0,0));
            cornerSamples.push(addCorner(imgWidth - sampleBox, 0));
            cornerSamples.push(addCorner(0, imgHeight - sampleBox));
            cornerSamples.push(addCorner(imgWidth - sampleBox, imgHeight - sampleBox));

            // average corners
            let br = 0, bg = 0, bb = 0, ba = 0;
            for (const c of cornerSamples) { br += c[0]; bg += c[1]; bb += c[2]; ba += c[3]; }
            const bcR = Math.round(br / cornerSamples.length);
            const bcG = Math.round(bg / cornerSamples.length);
            const bcB = Math.round(bb / cornerSamples.length);
            const bcA = Math.round(ba / cornerSamples.length);

            const colorDist = (r1:number,g1:number,b1:number, r2:number,g2:number,b2:number) => Math.sqrt(Math.pow(r1-r2,2)+Math.pow(g1-g2,2)+Math.pow(b1-b2,2));

            // build mask where pixels are considered 'design' if they are not close to background color and not transparent
            const mask = new Uint8ClampedArray(imgWidth * imgHeight * 4);
            const threshold = 40; // color distance threshold to treat as background
            for (let i = 0; i < imgWidth * imgHeight; i++) {
              const idx = i * 4;
              const r = srcData.data[idx];
              const g = srcData.data[idx + 1];
              const b = srcData.data[idx + 2];
              const a = srcData.data[idx + 3];

              if (a < 10) {
                mask[idx] = mask[idx+1] = mask[idx+2] = 0; mask[idx+3] = 0; // transparent
                continue;
              }

              const d = colorDist(r,g,b, bcR, bcG, bcB);
              if (d < threshold) {
                // pixel similar to corner background -> treat as background (mask alpha 0)
                mask[idx] = mask[idx+1] = mask[idx+2] = 0; mask[idx+3] = 0;
              } else {
                // keep pixel
                mask[idx] = mask[idx+1] = mask[idx+2] = 255; mask[idx+3] = 255;
              }
            }

            // create color canvas filled with selected color and mask it
            const colorCanvas = document.createElement('canvas');
            colorCanvas.width = imgWidth;
            colorCanvas.height = imgHeight;
            const cctx = colorCanvas.getContext('2d');
            if (cctx) {
              cctx.fillStyle = tintColor;
              cctx.fillRect(0,0,imgWidth,imgHeight);

              // Improve mask quality: perform a closing (dilate then erode) to fill holes and smooth edges
              const processMask = (m: Uint8ClampedArray, w: number, h: number) => {
                const copy = new Uint8ClampedArray(m);
                const dilate = (src: Uint8ClampedArray) => {
                  const out = new Uint8ClampedArray(src.length);
                  for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                      let any = false;
                      for (let yy = Math.max(0, y-1); yy <= Math.min(h-1, y+1); yy++) {
                        for (let xx = Math.max(0, x-1); xx <= Math.min(w-1, x+1); xx++) {
                          const idx = (yy * w + xx) * 4 + 3;
                          if (src[idx] > 0) { any = true; break; }
                        }
                        if (any) break;
                      }
                      const idx0 = (y * w + x) * 4;
                      out[idx0] = out[idx0+1] = out[idx0+2] = any ? 255 : 0;
                      out[idx0+3] = any ? 255 : 0;
                    }
                  }
                  return out;
                };
                const erode = (src: Uint8ClampedArray) => {
                  const out = new Uint8ClampedArray(src.length);
                  for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                      let all = true;
                      for (let yy = Math.max(0, y-1); yy <= Math.min(h-1, y+1); yy++) {
                        for (let xx = Math.max(0, x-1); xx <= Math.min(w-1, x+1); xx++) {
                          const idx = (yy * w + xx) * 4 + 3;
                          if (src[idx] === 0) { all = false; break; }
                        }
                        if (!all) break;
                      }
                      const idx0 = (y * w + x) * 4;
                      out[idx0] = out[idx0+1] = out[idx0+2] = all ? 255 : 0;
                      out[idx0+3] = all ? 255 : 0;
                    }
                  }
                  return out;
                };
                // closing: dilate twice, then erode twice
                let tmp = dilate(copy);
                tmp = dilate(tmp);
                tmp = erode(tmp);
                tmp = erode(tmp);
                return tmp;
              };

              const processed = processMask(mask, imgWidth, imgHeight);

              // if processed mask covers almost entire image, fallback to drawing original image (avoid full recolor)
              let nonZero = 0;
              for (let i = 0; i < imgWidth * imgHeight; i++) { if (processed[i*4+3] > 0) nonZero++; }
              const areaRatio = nonZero / (imgWidth * imgHeight);
              if (areaRatio > 0.95) {
                // too much of image considered design — likely full-photo; draw original
                ctx.save();
                ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
                ctx.rotate((imageRotation * Math.PI) / 180);
                ctx.globalAlpha = 0.95;
                ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                ctx.restore();
              } else {
                const maskImg = new ImageData(processed, imgWidth, imgHeight);
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = imgWidth;
                maskCanvas.height = imgHeight;
                const mctx = maskCanvas.getContext('2d');
                if (mctx) {
                  mctx.putImageData(maskImg, 0, 0);
                  cctx.globalCompositeOperation = 'destination-in';
                  cctx.drawImage(maskCanvas, 0, 0);
                  cctx.globalCompositeOperation = 'source-over';

                  ctx.save();
                  ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
                  ctx.rotate((imageRotation * Math.PI) / 180);
                  ctx.globalAlpha = 0.95;
                  ctx.drawImage(colorCanvas, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                  ctx.restore();
                } else {
                  // fallback: draw original image
                  ctx.save();
                  ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
                  ctx.rotate((imageRotation * Math.PI) / 180);
                  ctx.globalAlpha = 0.95;
                  ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                  ctx.restore();
                }
              }
            } else {
              ctx.save();
              ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
              ctx.rotate((imageRotation * Math.PI) / 180);
              ctx.globalAlpha = 0.95;
              ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
              ctx.restore();
            }
          } catch (e) {
            // security error or failure; fallback to original draw
            ctx.save();
            ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
            ctx.rotate((imageRotation * Math.PI) / 180);
            ctx.globalAlpha = 0.95;
            ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
          ctx.rotate((imageRotation * Math.PI) / 180);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
          ctx.restore();
        }
      } else {
        // either tinting disabled or the image is effectively a full-canvas asset (background/template)
        // in which case draw the image normally without tinting
        ctx.save();
        ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
        ctx.rotate((imageRotation * Math.PI) / 180);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        ctx.restore();
      }
    }

    // Draw Slogan
    if (slogan) {
      ctx.save();
      ctx.translate(textPosition.x * scale, textPosition.y * scale);
      ctx.rotate((textRotation * Math.PI) / 180);
      
      ctx.font = `bold ${textSize * scale}px 'Outfit', sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxWidth = width * 0.6;
      const lineHeight = (textSize + 6) * scale;
      
      wrapText(
        ctx, 
        slogan, 
        0, 
        0, 
        maxWidth, 
        lineHeight
      );
      ctx.restore();
    }
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(" ");
    let line = "";
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const totalHeight = lines.length * lineHeight;
    let currentY = y - (totalHeight / 2) + (lineHeight / 2);

    for (const l of lines) {
      ctx.fillText(l.trim(), x, currentY);
      currentY += lineHeight;
    }
  };

  useEffect(() => {
    render();
  }, [slogan, color, template, templateColor, imageTintColor, textSize, textRotation, textPosition, image, imageScale, imageRotation, imagePosition, width, height, backgroundImage]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (readonly) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = (clientX - rect.left) * (400 / rect.width);
    const y = (clientY - rect.top) * (400 / rect.height);

    // Check if clicking text area (simplified bounding box)
    const textDist = Math.sqrt(Math.pow(x - textPosition.x, 2) + Math.pow(y - textPosition.y, 2));
    if (slogan && textDist < 50) {
      setIsDragging('text');
      setDragOffset({ x: x - textPosition.x, y: y - textPosition.y });
      return;
    }

    // Check if clicking image area
    const imageDist = Math.sqrt(Math.pow(x - imagePosition.x, 2) + Math.pow(y - imagePosition.y, 2));
    if (image && imageDist < 60) {
      setIsDragging('image');
      setDragOffset({ x: x - imagePosition.x, y: y - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || readonly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (400 / rect.width);
    const y = (clientY - rect.top) * (400 / rect.height);

    const newX = Math.max(0, Math.min(400, x - dragOffset.x));
    const newY = Math.max(0, Math.min(400, y - dragOffset.y));

    if (isDragging === 'text' && onTextMove) {
      onTextMove({ x: newX, y: newY });
    } else if (isDragging === 'image' && onImageMove) {
      onImageMove({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  return (
    <Card className={`overflow-hidden border-2 border-border/50 shadow-xl shadow-black/5 bg-white ${readonly ? '' : 'cursor-move'}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto block touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
    </Card>
  );
}
