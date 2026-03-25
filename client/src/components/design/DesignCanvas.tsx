import React, { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface DesignCanvasProps {
  side?: 'front' | 'back';
  slogan: string;
  color: string;
  template?: string;
  templateColor?: string;
  /** When provided, draw a horizontal gradient using these colors instead of a single `templateColor` */
  templateColors?: string[];
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
  templateColor, templateColors, template = 'tshirt',  textSize = 24,
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
  exportCanvasRef,
}: DesignCanvasProps & { showTemplate?: boolean, exportCanvasRef?: React.RefObject<HTMLCanvasElement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tshirtRef = useRef<HTMLImageElement | null>(null);
  // Optional separate mask image (silhouette only) used to clip templateColor so card/background art isn't colored
  const maskRef = useRef<HTMLImageElement | null>(null);
  const userImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  
  const [isDragging, setIsDragging] = useState<'text' | 'image' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load template image (tshirt, hoodie, etc.) and an optional separate mask
  useEffect(() => {
    // If template drawing is disabled, skip loading any template asset and clear refs
    if (!showTemplate) {
      tshirtRef.current = null;
      maskRef.current = null;
      scheduleRender();
      return;
    }

    // Clear any previous mask when template changes so we don't reuse an old silhouette
    maskRef.current = null;

    // Helper to load a single image src into a ref with safe onload/onerror handling
    const loadInto = (src: string | null, target: React.MutableRefObject<HTMLImageElement | null>, debugName: string) => {
      if (!src) { target.current = null; scheduleRender(); return () => {} };
      const img = new Image(); img.src = src;
      img.onload = () => { target.current = img; try { console.debug(`DesignCanvas: loaded ${debugName}`, src, img.width, img.height); } catch(e) {} scheduleRender(); };
      img.onerror = () => { target.current = null; scheduleRender(); };
      return () => { img.onload = null as any; img.onerror = null as any; };
    };

    // Auto-generate a mask by sampling all four corners for background color and thresholding
    const tryAutoMaskFromTshirt = () => {
      if (maskRef.current || !tshirtRef.current) return;
      try {
        const img = tshirtRef.current as HTMLImageElement;
        const off = document.createElement('canvas');
        off.width = img.naturalWidth || img.width;
        off.height = img.naturalHeight || img.height;
        const octx = off.getContext('2d');
        if (!octx) return;
        octx.drawImage(img, 0, 0, off.width, off.height);
        const data = octx.getImageData(0,0,off.width,off.height).data;

        // sample small blocks in each corner (top-left, top-right, bottom-left, bottom-right)
        const sampleBlock = (sx:number, sy:number, sw:number, sh:number) => {
          const s = octx.getImageData(sx, sy, sw, sh).data; let r=0,g=0,b=0,c=0;
          for (let i=0;i<s.length;i+=4){ r+=s[i]; g+=s[i+1]; b+=s[i+2]; c++; }
          return [r/c, g/c, b/c];
        };

        const sw = Math.min(6, off.width), sh = Math.min(6, off.height);
        const tl = sampleBlock(0,0,sw,sh);
        const tr = sampleBlock(off.width-sw,0,sw,sh);
        const bl = sampleBlock(0,off.height-sh,sw,sh);
        const br = sampleBlock(off.width-sw,off.height-sh,sw,sh);
        const bgR = Math.round((tl[0]+tr[0]+bl[0]+br[0]) / 4);
        const bgG = Math.round((tl[1]+tr[1]+bl[1]+br[1]) / 4);
        const bgB = Math.round((tl[2]+tr[2]+bl[2]+br[2]) / 4);

        const mask = document.createElement('canvas'); mask.width = off.width; mask.height = off.height;
        const mctx = mask.getContext('2d'); if (!mctx) return;
        const mdata = mctx.createImageData(off.width, off.height);

        const THRESH = 60;
        for (let y=0, di=0; y<off.height; y++){
          for (let x=0; x<off.width; x++, di+=4){
            const r = data[di], g = data[di+1], b = data[di+2], a = data[di+3];
            const dr = r - bgR, dg = g - bgG, db = b - bgB;
            const dist = Math.sqrt(dr*dr + dg*dg + db*db);
            if (a > 10 && dist > THRESH) {
              mdata.data[di] = 255; mdata.data[di+1] = 255; mdata.data[di+2] = 255; mdata.data[di+3] = 255;
            } else {
              mdata.data[di] = 0; mdata.data[di+1] = 0; mdata.data[di+2] = 0; mdata.data[di+3] = 0;
            }
          }
        }

        mctx.putImageData(mdata, 0, 0);
        const generated = new Image(); generated.src = mask.toDataURL('image/png');
        generated.onload = () => { maskRef.current = generated; scheduleRender(); };
      } catch (e) {
        // silent
      }
    };

    // If an admin-provided template image is supplied, use it directly and also try to load a dedicated mask asset
    if (templateImage) {
      const cleanupImg = loadInto(templateImage, tshirtRef, 'admin template image');
      // try mask asset based on provided template name (non-critical; fail silently)
      const maskPath = `/templates/${template}-mask.png`;
      const cleanupMask = loadInto(maskPath, maskRef, 'template mask');
      // schedule auto-mask generation if no mask asset exists after load
      setTimeout(tryAutoMaskFromTshirt, 80);
      return () => { cleanupImg(); cleanupMask(); };
    }

    // No explicit image provided — try to use a product template asset and optional mask
    const defaultSrc = `/templates/${template}.png`;
    const defaultMask = `/templates/${template}-mask.png`;
    const cleanupDefault = loadInto(defaultSrc, tshirtRef, 'default template image');
    const cleanupDefaultMask = loadInto(defaultMask, maskRef, 'default template mask');
    // attempt auto-mask when using default template as well
    setTimeout(tryAutoMaskFromTshirt, 120);
    return () => { cleanupDefault(); cleanupDefaultMask(); };
  }, [template, side, showTemplate, templateImage]);

  // debounced render trigger to avoid excessive synchronous work
  useEffect(() => {
    scheduleRender();
  }, [slogan, color, template, templateColor, imageTintColor, textSize, textRotation, textPosition, image, imageScale, imageRotation, imagePosition, width, height, backgroundImage]);

  // Load user image
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        userImageRef.current = img;
        try { console.debug('DesignCanvas: loaded user image', img.src, img.width, img.height); } catch(e) {}
        scheduleRender();
      };
    } else {
      userImageRef.current = null;
      scheduleRender();
    }
  }, [image]);

  // Load background image
  useEffect(() => {
    if (!backgroundImage) {
      backgroundRef.current = null;
      scheduleRender();
      return;
    }

    // If the supplied background image is the same as the active user image, skip loading it to avoid duplicates
    if (image && backgroundImage === image) {
      try { console.debug('DesignCanvas: skipping background load because it matches user image', backgroundImage); } catch (e) {}
      backgroundRef.current = null;
      scheduleRender();
      return;
    }

    const img = new Image();
    img.src = backgroundImage;
    img.onload = () => {
      backgroundRef.current = img;
      try { console.debug('DesignCanvas: loaded background image', img.src, img.width, img.height); } catch(e) {}
      scheduleRender();
    };
  }, [backgroundImage, image]);

  // Use requestAnimationFrame to batch frequent render calls and avoid blocking the main thread
  let renderScheduled = false;
  const scheduleRender = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    window.requestAnimationFrame(() => {
      renderScheduled = false;
      doRender();
    });
  };

  const doRender = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const scale = width / 400;

    ctx.clearRect(0, 0, width, height);
    // User requested blank background (white)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);

    // subtle grid pattern for better contrast - only draw inside to avoid edge bleeding
    ctx.strokeStyle = 'rgba(209, 213, 219, 0.5)'; // #d1d5db with alpha
    ctx.lineWidth = 1;
    for (let i = 20; i < width; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 20; i < height; i += 20) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    if (backgroundRef.current) {
      const bg = backgroundRef.current; const ratio = Math.max(width / bg.width, height / bg.height);
      const bgW = bg.width * ratio; const bgH = bg.height * ratio; const bgX = (width - bgW) / 2; const bgY = (height - bgH) / 2;
      ctx.drawImage(bg, bgX, bgY, bgW, bgH);
    }

    if (showTemplate) {
      // Prefer a dedicated mask if available to clip templateColor(s) only to the garment silhouette
      const fillWithTemplate = () => {
        ctx.save();

        // If multiple template colors provided, create a horizontal gradient
        if (templateColors && Array.isArray(templateColors) && templateColors.length > 0) {
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          const n = templateColors.length;
          for (let i = 0; i < n; i++) {
            const stop = i / Math.max(1, n - 1);
            grad.addColorStop(stop, templateColors[i] || '#ffffff');
          }
          ctx.fillStyle = grad;
        } else if (templateColor) {
          ctx.fillStyle = templateColor;
        } else {
          ctx.restore();
          return;
        }

        ctx.fillRect(0, 0, width, height);

        const mask = maskRef.current || tshirtRef.current;
        if (mask) {
          // Use mask to keep only garment pixels
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(mask, 0, 0, width, height);
          ctx.globalCompositeOperation = 'source-over';
        }

        // Draw the visual template on top with multiply (adds shading/texture)
        if (tshirtRef.current) {
          ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tshirtRef.current, 0, 0, width, height); ctx.restore();
        }
        ctx.restore();
      };

      fillWithTemplate();
    }

    if (userImageRef.current && image && !forceTemplateFill) {
      const src = userImageRef.current; 
      const intrinsicW = src.naturalWidth || src.width; 
      const intrinsicH = src.naturalHeight || src.height;
      const aspectRatio = intrinsicH / intrinsicW;

      // Make scale relative to canvas width (400) instead of raw pixels
      // 1.0 scale = 400 units wide
      const targetWidth = imageScale * 400; // imageScale is now a multiplier (e.g., 1.0 for 100%)
      const imgW = targetWidth * scale;
      const imgH = (targetWidth * aspectRatio) * scale;

      ctx.save();
      const drawX = imagePosition.x * scale;
      const drawY = imagePosition.y * scale;
      ctx.translate(drawX, drawY); 
      ctx.rotate((imageRotation * Math.PI) / 180); ctx.globalAlpha = 0.95;
      if (tintImage) {
        const off = document.createElement('canvas'); off.width = imgW; off.height = imgH; const octx = off.getContext('2d');
        if (octx) { octx.drawImage(src, 0, 0, imgW, imgH); octx.globalCompositeOperation = 'source-in'; octx.fillStyle = imageTintColor || color; octx.fillRect(0,0,imgW,imgH); ctx.drawImage(off, -imgW/2, -imgH/2, imgW, imgH); }
        else { ctx.drawImage(src, -imgW/2, -imgH/2, imgW, imgH); }
      } else {
        ctx.drawImage(src, -imgW/2, -imgH/2, imgW, imgH);
      }
      ctx.restore();
    }

    if (slogan) {
      ctx.save(); ctx.translate(textPosition.x * scale, textPosition.y * scale); ctx.rotate((textRotation * Math.PI) / 180);
      ctx.font = `bold ${textSize * scale}px 'Outfit', sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, slogan, 0, 0, width * 0.6, (textSize + 6) * scale);
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
    scheduleRender();
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
    <div 
      className={`overflow-hidden border-2 border-border/50 shadow-xl shadow-black/5 bg-white rounded-lg flex-shrink-0 ${readonly ? '' : 'cursor-move'}`}
      style={{ width: '100%', maxWidth: width, aspectRatio: `${width}/${height}` }}
    >
      <canvas
        ref={(el) => { canvasRef.current = el; if (exportCanvasRef && typeof exportCanvasRef === 'object') { try { (exportCanvasRef as any).current = el; } catch(e) {} } }}
        width={width}
        height={height}
        className="block touch-none w-full h-full"
        style={{ width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
    </div>
  );
}
