import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface DesignCanvasProps {
  side?: 'front' | 'back';
  slogan: string;
  color: string;
  template?: string;
  templateColor?: string;
  textSize?: number;
  textRotation?: number;
  textPosition?: { x: number; y: number };
  onTextMove?: (pos: { x: number; y: number }) => void;
  image?: string | null;
  imageMask?: string | null;
  imageScale?: number;
  imageRotation?: number;
  imagePosition?: { x: number; y: number };
  onImageMove?: (pos: { x: number; y: number }) => void;
  /** optional background image for the canvas (data URL or URL) */
  backgroundImage?: string | null;
  width?: number;
  height?: number;
  readonly?: boolean;
  /** Whether to tint images by the `color` prop (useful for logos) */
  tintImage?: boolean;
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
  imageMask = undefined,
  imageScale = 100,
  imageRotation = 0,
  imagePosition = { x: 150, y: 150 },
  onImageMove,
  /** whether to tint user-uploaded images using the `color` prop */
  tintImage = false,
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
  const maskRef = useRef<HTMLImageElement | null>(null);
  
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

    // Try to load an override template in public/attached_assets (e.g. /attached_assets/white-bg.jpg) first,
    // then fall back to the product template in /templates.
    const img = new Image();

    const tryUrls: string[] = [];

    // common override names (user-provided). We try jpg/png/jpeg variants
    tryUrls.push('/attached_assets/white-bg.jpg', '/attached_assets/white-bg.png', '/attached_assets/white-bg.jpeg');

    // Support back side images when side === 'back'
    const tmpl = (side === 'back')
      ? (template === 'tshirt' ? 't-shirt-back' : template === 'women_tshirt' ? 'women-teshirt-back' : template === 'unisex-hoodie' ? 'hoodie-back' : `${template}-back`)
      : template;

    // Default template path
    tryUrls.push(`/templates/${tmpl}.png`, '/templates/tshirt.png');

    let idx = 0;
    const tryLoadNext = () => {
      if (idx >= tryUrls.length) {
        // all attempts failed
        return;
      }
      const url = tryUrls[idx++];
      img.src = url;
    };

    img.onload = () => {
      tshirtRef.current = img;
      try { console.debug('DesignCanvas: loaded template', img.src, img.width, img.height); } catch (e) {}
      render();
    };

    img.onerror = () => {
      // try next URL in the list
      tryLoadNext();
    };

    // start attempts
    tryLoadNext();

    // cleanup
    return () => {
      img.onload = null as any;
      img.onerror = null as any;
    };
  }, [template, side, showTemplate]);

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

  // Load provided mask image (if any)
  useEffect(() => {
    if (imageMask) {
      const img = new Image();
      img.src = imageMask;
      img.onload = () => { maskRef.current = img; try { console.debug('DesignCanvas: loaded mask', img.src); } catch (e) {} ; render(); };
      img.onerror = () => { maskRef.current = null; render(); };
    } else {
      maskRef.current = null;
      render();
    }
  }, [imageMask]);

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
          // sample center pixel (approx center of the shirt) to decide mask polarity
          const center = maskCtx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
          const alphaCenter = center[3];

          // Fill with chosen color
          offCtx.fillStyle = templateColor;
          offCtx.fillRect(0, 0, width, height);

          // If template is opaque at the shirt center, template image marks the shirt area -> keep color where template is opaque
          // Otherwise, template is opaque in background and transparent for shirt -> remove template pixels from color (destination-out)
          if (alphaCenter > 128) {
            offCtx.globalCompositeOperation = 'destination-in';
            offCtx.drawImage(tshirtRef.current, 0, 0, width, height);
            offCtx.globalCompositeOperation = 'source-over';
          } else {
            offCtx.globalCompositeOperation = 'destination-out';
            offCtx.drawImage(tshirtRef.current, 0, 0, width, height);
            offCtx.globalCompositeOperation = 'source-over';
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
    } // else skip drawing template entirely


    // Draw Image first (behind text). If tintImage is true, fill the image's alpha with `color` so logos follow selected color.
    if (userImageRef.current && image) {
      const imgScale = (imageScale / 100) * scale;
      const imgWidth = Math.max(1, Math.floor(userImageRef.current.width * imgScale));
      const imgHeight = Math.max(1, Math.floor(userImageRef.current.height * imgScale));

      // prepare an offscreen canvas to draw a colorized image when requested
      const coversMostOfCanvas = imgWidth >= (width * 0.9) && imgHeight >= (height * 0.9);
      if (tintImage && color) {
        const off = document.createElement('canvas');
        off.width = imgWidth;
        off.height = imgHeight;
        const offCtx = off.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(userImageRef.current, 0, 0, imgWidth, imgHeight);

          try {
            const srcData = offCtx.getImageData(0, 0, imgWidth, imgHeight);

            // If a server-provided mask image exists, prefer it (fast and deterministic)
            if (maskRef.current) {
              const w = imgWidth, h = imgHeight;
              const mCanvas = document.createElement('canvas'); mCanvas.width = w; mCanvas.height = h;
              const mctx = mCanvas.getContext('2d');
              let mask = new Uint8ClampedArray(w*h*4);
              let foregroundCount = 0;
              if (mctx) {
                mctx.drawImage(maskRef.current, 0, 0, w, h);
                const maskData = mctx.getImageData(0,0,w,h);
                for (let i=0;i<w*h;i++) {
                  const idx = i*4;
                  const a = maskData.data[idx+3];
                  const r = maskData.data[idx], g = maskData.data[idx+1], b = maskData.data[idx+2];
                  const lum = (r*0.299 + g*0.587 + b*0.114);
                  if (a > 10 || lum > 128) { mask[idx]=mask[idx+1]=mask[idx+2]=255; mask[idx+3]=255; foregroundCount++; }
                  else { mask[idx]=mask[idx+1]=mask[idx+2]=0; mask[idx+3]=0; }
                }

                // simple smoothing
                const toBinary = (m: Uint8ClampedArray) => { const b = new Uint8Array(w*h); for (let i=0;i<w*h;i++) b[i] = m[i*4+3] ? 1 : 0; return b; };
                const fromBinary = (b: Uint8Array) => { const m = new Uint8ClampedArray(w*h*4); for (let i=0;i<w*h;i++) { const v=b[i]?255:0; const idx=i*4; m[idx]=m[idx+1]=m[idx+2]=v; m[idx+3]= b[i]?255:0; } return m; };
                const dilate = (b: Uint8Array) => { const out = new Uint8Array(w*h); for (let y=0;y<h;y++) for (let x=0;x<w;x++) { let any=0; for (let yy=Math.max(0,y-1); yy<=Math.min(h-1,y+1); yy++) for (let xx=Math.max(0,x-1); xx<=Math.min(w-1,x+1); xx++) { if (b[yy*w+xx]) { any=1; break; } } out[y*w+x]=any; } return out; };
                const erode = (b: Uint8Array) => { const out = new Uint8Array(w*h); for (let y=0;y<h;y++) for (let x=0;x<w;x++) { let all=1; for (let yy=Math.max(0,y-1); yy<=Math.min(h-1,y+1); yy++) for (let xx=Math.max(0,x-1); xx<=Math.min(w-1,x+1); xx++) { if (!b[yy*w+xx]) { all=0; break; } } out[y*w+x]=all; } return out; };

                let binary = toBinary(mask);
                binary = dilate(binary);
                binary = dilate(binary);
                binary = erode(binary);

                mask = fromBinary(binary);
                foregroundCount = binary.reduce((s,v)=>s+v,0);
              }

              const designFraction = foregroundCount / (w*h);
              try { console.debug('DesignCanvas: design mask fraction (server)', designFraction); } catch(e) {}

              if (designFraction < 0.005 || designFraction > 0.90) {
                // fallback to drawing original
                try { console.debug('DesignCanvas: skipping server mask tint, designFraction=', designFraction); } catch(e) {}
                ctx.save();
                ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
                ctx.rotate((imageRotation * Math.PI) / 180);
                ctx.globalAlpha = 0.95;
                ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                ctx.restore();
              } else {
                const colorCanvas = document.createElement('canvas'); colorCanvas.width = imgWidth; colorCanvas.height = imgHeight;
                const cctx = colorCanvas.getContext('2d');
                if (cctx) {
                  cctx.fillStyle = color; cctx.fillRect(0,0,imgWidth,imgHeight);
                  const maskImg = new ImageData(mask, imgWidth, imgHeight);
                  const maskCanvas = document.createElement('canvas'); maskCanvas.width = imgWidth; maskCanvas.height = imgHeight;
                  const mctx2 = maskCanvas.getContext('2d');
                  if (mctx2) { mctx2.putImageData(maskImg,0,0); cctx.globalCompositeOperation = 'destination-in'; cctx.drawImage(maskCanvas,0,0); cctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.translate(imagePosition.x * scale, imagePosition.y * scale); ctx.rotate((imageRotation * Math.PI) / 180); ctx.globalAlpha = 0.95; ctx.drawImage(colorCanvas, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight); ctx.restore(); } else { ctx.save(); ctx.translate(imagePosition.x * scale, imagePosition.y * scale); ctx.rotate((imageRotation * Math.PI) / 180); ctx.globalAlpha = 0.95; ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight); ctx.restore(); }
                }
              }

            } else {
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

              // Robust background detection using flood-fill from corners.
              // Mark background pixels by growing from corners while color distance is within threshold.
              const visited = new Uint8Array(imgWidth * imgHeight);
              const threshold = 60; // more tolerant threshold for photos/shading
              const queue: Array<[number,number,number,number]> = []; // x,y, baseR, baseG packed? we'll store base sample per corner separately

              const pushIfValid = (sx:number, sy:number) => {
                if (sx < 0 || sx >= imgWidth || sy < 0 || sy >= imgHeight) return;
                const idx = (sy * imgWidth + sx) * 4;
                const a = srcData.data[idx + 3];
                if (a < 10) return; // transparent pixels are not good seeds
                if (visited[sy * imgWidth + sx]) return;
                visited[sy * imgWidth + sx] = 1;
                queue.push([sx, sy, srcData.data[idx], srcData.data[idx+1]]);
              };

              // Start flood fill from each corner
              pushIfValid(0,0);
              pushIfValid(imgWidth - 1, 0);
              pushIfValid(0, imgHeight - 1);
              pushIfValid(imgWidth - 1, imgHeight - 1);

              // If image contains alpha channel, use alpha directly as mask (fast and accurate for PNG logos)
              let mask = new Uint8ClampedArray(imgWidth * imgHeight * 4);
              let foregroundCount = 0;
              let hasAlpha = false;
              for (let i = 3; i < srcData.data.length; i += 4) { if (srcData.data[i] < 255) { hasAlpha = true; break; } }

              if (hasAlpha) {
                for (let i = 0; i < imgWidth * imgHeight; i++) {
                  const idx = i * 4;
                  const a = srcData.data[idx + 3];
                  if (a > 10) {
                    mask[idx] = mask[idx+1] = mask[idx+2] = 255; mask[idx+3] = 255; foregroundCount++;
                  } else {
                    mask[idx] = mask[idx+1] = mask[idx+2] = 0; mask[idx+3] = 0;
                  }
                }
              } else {
                // We'll perform BFS, comparing to the pixel at the neighbor and the corner reference via color distance to the neighbor
                const dir = [[1,0],[-1,0],[0,1],[0,-1]];
                while (queue.length) {
                  const [x,y] = queue.shift()!;
                  const baseIdx = (y * imgWidth + x) * 4;
                  const br = srcData.data[baseIdx], bgc = srcData.data[baseIdx+1], bb = srcData.data[baseIdx+2];
                  for (const dxy of dir) {
                    const nx = x + dxy[0]; const ny = y + dxy[1];
                    if (nx < 0 || nx >= imgWidth || ny < 0 || ny >= imgHeight) continue;
                    const nIdx = (ny * imgWidth + nx) * 4;
                    if (visited[ny * imgWidth + nx]) continue;
                    const na = srcData.data[nIdx+3];
                    if (na < 10) { visited[ny * imgWidth + nx] = 1; continue; }
                    const nr = srcData.data[nIdx], ng = srcData.data[nIdx+1], nb = srcData.data[nIdx+2];
                    const dist = colorDist(nr,ng,nb, br, bgc, bb);
                    if (dist <= threshold) {
                      visited[ny * imgWidth + nx] = 1;
                      queue.push([nx, ny, nr, ng]);
                    }
                  }
                }

                for (let i = 0; i < imgWidth * imgHeight; i++) {
                  const idx = i * 4;
                  const a = srcData.data[idx+3];
                  if (a < 10) {
                    mask[idx] = mask[idx+1] = mask[idx+2] = 0; mask[idx+3] = 0;
                    continue;
                  }
                  if (visited[i]) {
                    // background
                    mask[idx] = mask[idx+1] = mask[idx+2] = 0; mask[idx+3] = 0;
                  } else {
                    // foreground/design
                    mask[idx] = mask[idx+1] = mask[idx+2] = 255; mask[idx+3] = 255;
                    foregroundCount++;
                  }
                }
              }
              // perform simple morphological closing (dilate then erode) to reduce speckles
              const w = imgWidth, h = imgHeight;
              const toBinary = (m: Uint8ClampedArray) => {
                const b = new Uint8Array(w*h);
                for (let i=0;i<w*h;i++) b[i] = m[i*4+3] ? 1 : 0;
                return b;
              };
              const fromBinary = (b: Uint8Array) => {
                const m = new Uint8ClampedArray(w*h*4);
                for (let i=0;i<w*h;i++) {
                  const v = b[i] ? 255 : 0;
                  const idx = i*4; m[idx]=m[idx+1]=m[idx+2]=v; m[idx+3]= b[i] ? 255 : 0;
                }
                return m;
              };
              const dilate = (b: Uint8Array) => {
                const out = new Uint8Array(w*h);
                for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
                  let any = 0;
                  for (let yy=Math.max(0,y-1); yy<=Math.min(h-1,y+1); yy++) for (let xx=Math.max(0,x-1); xx<=Math.min(w-1,x+1); xx++) {
                    if (b[yy*w+xx]) { any = 1; break; }
                  }
                  out[y*w+x] = any;
                }
                return out;
              };
              const erode = (b: Uint8Array) => {
                const out = new Uint8Array(w*h);
                for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
                  let all = 1;
                  for (let yy=Math.max(0,y-1); yy<=Math.min(h-1,y+1); yy++) for (let xx=Math.max(0,x-1); xx<=Math.min(w-1,x+1); xx++) {
                    if (!b[yy*w+xx]) { all = 0; break; }
                  }
                  out[y*w+x] = all;
                }
                return out;
              };
              let binary = toBinary(mask);
              binary = dilate(binary);
              binary = dilate(binary);
              binary = erode(binary);

              mask = fromBinary(binary);

              foregroundCount = binary.reduce((s,v)=>s+v,0);
              const designFraction = foregroundCount / (w*h);
              try { console.debug('DesignCanvas: design mask fraction (smoothed)', designFraction); } catch(e) {}

              // If the detected design area is extremely noisy/small or almost the whole image, skip tinting
              // (a very large fraction usually means background or full-bleed image)
              if (designFraction < 0.005 || designFraction > 0.90) {
                // fallback: draw original image and skip tint
                try { console.debug('DesignCanvas: skipping tint, designFraction=', designFraction); } catch(e) {}
                ctx.save();
                ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
                ctx.rotate((imageRotation * Math.PI) / 180);
                ctx.globalAlpha = 0.95;
                ctx.drawImage(userImageRef.current, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                ctx.restore();
              } else {
                // create color canvas filled with selected color and mask it
                if (designFraction >= 0.005) {
                  const colorCanvas = document.createElement('canvas');
                  colorCanvas.width = imgWidth;
                  colorCanvas.height = imgHeight;
                  const cctx = colorCanvas.getContext('2d');
                  if (cctx) {
                    cctx.fillStyle = color;
                    cctx.fillRect(0,0,imgWidth,imgHeight);

                    const maskImg = new ImageData(mask, imgWidth, imgHeight);
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
                }
              }
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
  }, [slogan, color, template, templateColor, textSize, textRotation, textPosition, image, imageMask, imageScale, imageRotation, imagePosition, width, height, backgroundImage]);

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
