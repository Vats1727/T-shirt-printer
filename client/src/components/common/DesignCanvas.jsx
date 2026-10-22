import { useEffect, useRef, useState } from "react";
export function DesignCanvas({
  side = "front",
  slogan,
  color,
  templateColor,
  templateColors,
  template = "tshirt",
  textSize = 24,
  textRotation = 0,
  textPosition = { x: 150, y: 135 },
  onTextMove,
  image,
  imageScale = 100,
  imageRotation = 0,
  imagePosition = { x: 150, y: 150 },
  onImageMove,
  templateImage = void 0,
  imageTintColor = void 0,
  /** whether to tint user-uploaded images using the `imageTintColor` or `color` prop */
  tintImage = false,
  /** When true, skip drawing user/admin images and only fill template color (supplier preview use-case) */
  forceTemplateFill = false,
  width = 300,
  height = 300,
  readonly = false,
  backgroundImage = void 0,
  showTemplate = false,
  exportCanvasRef
}) {
  const canvasRef = useRef(null);
  const tshirtRef = useRef(null);
  const maskRef = useRef(null);
  const userImageRef = useRef(null);
  const backgroundRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!showTemplate) {
      tshirtRef.current = null;
      maskRef.current = null;
      scheduleRender();
      return;
    }
    maskRef.current = null;
    const loadInto = (src, target, debugName) => {
      if (!src) {
        target.current = null;
        scheduleRender();
        return () => {
        };
      }
      ;
      const img = new Image();
      img.src = src;
      img.onload = () => {
        target.current = img;
        try {
          console.debug(`DesignCanvas: loaded ${debugName}`, src, img.width, img.height);
        } catch (e) {
        }
        scheduleRender();
      };
      img.onerror = () => {
        target.current = null;
        scheduleRender();
      };
      return () => {
        img.onload = null;
        img.onerror = null;
      };
    };
    const tryAutoMaskFromTshirt = () => {
      if (maskRef.current || !tshirtRef.current) return;
      try {
        const img = tshirtRef.current;
        const off = document.createElement("canvas");
        off.width = img.naturalWidth || img.width;
        off.height = img.naturalHeight || img.height;
        const octx = off.getContext("2d");
        if (!octx) return;
        octx.drawImage(img, 0, 0, off.width, off.height);
        const data = octx.getImageData(0, 0, off.width, off.height).data;
        const sampleBlock = (sx, sy, sw2, sh2) => {
          const s = octx.getImageData(sx, sy, sw2, sh2).data;
          let r = 0, g = 0, b = 0, c = 0;
          for (let i = 0; i < s.length; i += 4) {
            r += s[i];
            g += s[i + 1];
            b += s[i + 2];
            c++;
          }
          return [r / c, g / c, b / c];
        };
        const sw = Math.min(6, off.width), sh = Math.min(6, off.height);
        const tl = sampleBlock(0, 0, sw, sh);
        const tr = sampleBlock(off.width - sw, 0, sw, sh);
        const bl = sampleBlock(0, off.height - sh, sw, sh);
        const br = sampleBlock(off.width - sw, off.height - sh, sw, sh);
        const bgR = Math.round((tl[0] + tr[0] + bl[0] + br[0]) / 4);
        const bgG = Math.round((tl[1] + tr[1] + bl[1] + br[1]) / 4);
        const bgB = Math.round((tl[2] + tr[2] + bl[2] + br[2]) / 4);
        const mask = document.createElement("canvas");
        mask.width = off.width;
        mask.height = off.height;
        const mctx = mask.getContext("2d");
        if (!mctx) return;
        const mdata = mctx.createImageData(off.width, off.height);
        const THRESH = 60;
        for (let y = 0, di = 0; y < off.height; y++) {
          for (let x = 0; x < off.width; x++, di += 4) {
            const r = data[di], g = data[di + 1], b = data[di + 2], a = data[di + 3];
            const dr = r - bgR, dg = g - bgG, db = b - bgB;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (a > 10 && dist > THRESH) {
              mdata.data[di] = 255;
              mdata.data[di + 1] = 255;
              mdata.data[di + 2] = 255;
              mdata.data[di + 3] = 255;
            } else {
              mdata.data[di] = 0;
              mdata.data[di + 1] = 0;
              mdata.data[di + 2] = 0;
              mdata.data[di + 3] = 0;
            }
          }
        }
        mctx.putImageData(mdata, 0, 0);
        const generated = new Image();
        generated.src = mask.toDataURL("image/png");
        generated.onload = () => {
          maskRef.current = generated;
          scheduleRender();
        };
      } catch (e) {
      }
    };
    if (templateImage) {
      const cleanupImg = loadInto(templateImage, tshirtRef, "admin template image");
      const maskPath = `/templates/${template}-mask.png`;
      const cleanupMask = loadInto(maskPath, maskRef, "template mask");
      setTimeout(tryAutoMaskFromTshirt, 80);
      return () => {
        cleanupImg();
        cleanupMask();
      };
    }
    const defaultSrc = `/templates/${template}.png`;
    const defaultMask = `/templates/${template}-mask.png`;
    const cleanupDefault = loadInto(defaultSrc, tshirtRef, "default template image");
    const cleanupDefaultMask = loadInto(defaultMask, maskRef, "default template mask");
    setTimeout(tryAutoMaskFromTshirt, 120);
    return () => {
      cleanupDefault();
      cleanupDefaultMask();
    };
  }, [template, side, showTemplate, templateImage]);
  useEffect(() => {
    scheduleRender();
  }, [slogan, color, template, templateColor, imageTintColor, textSize, textRotation, textPosition, image, imageScale, imageRotation, imagePosition, width, height, backgroundImage]);
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        userImageRef.current = img;
        try {
          console.debug("DesignCanvas: loaded user image", img.src, img.width, img.height);
        } catch (e) {
        }
        scheduleRender();
      };
    } else {
      userImageRef.current = null;
      scheduleRender();
    }
  }, [image]);
  useEffect(() => {
    if (!backgroundImage) {
      backgroundRef.current = null;
      scheduleRender();
      return;
    }
    if (image && backgroundImage === image) {
      try {
        console.debug("DesignCanvas: skipping background load because it matches user image", backgroundImage);
      } catch (e) {
      }
      backgroundRef.current = null;
      scheduleRender();
      return;
    }
    const img = new Image();
    img.src = backgroundImage;
    img.onload = () => {
      backgroundRef.current = img;
      try {
        console.debug("DesignCanvas: loaded background image", img.src, img.width, img.height);
      } catch (e) {
      }
      scheduleRender();
    };
  }, [backgroundImage, image]);
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = width / 400;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(209, 213, 219, 0.5)";
    ctx.lineWidth = 1;
    for (let i = 20; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 20; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }
    if (backgroundRef.current) {
      const bg = backgroundRef.current;
      const ratio = Math.max(width / bg.width, height / bg.height);
      const bgW = bg.width * ratio;
      const bgH = bg.height * ratio;
      const bgX = (width - bgW) / 2;
      const bgY = (height - bgH) / 2;
      ctx.drawImage(bg, bgX, bgY, bgW, bgH);
    }
    if (showTemplate) {
      const fillWithTemplate = () => {
        ctx.save();
        if (templateColors && Array.isArray(templateColors) && templateColors.length > 0) {
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          const n = templateColors.length;
          for (let i = 0; i < n; i++) {
            const stop = i / Math.max(1, n - 1);
            grad.addColorStop(stop, templateColors[i] || "#ffffff");
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
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(mask, 0, 0, width, height);
          ctx.globalCompositeOperation = "source-over";
        }
        if (tshirtRef.current) {
          ctx.save();
          ctx.globalCompositeOperation = "multiply";
          ctx.drawImage(tshirtRef.current, 0, 0, width, height);
          ctx.restore();
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
      const targetWidth = imageScale * 400;
      const imgW = targetWidth * scale;
      const imgH = targetWidth * aspectRatio * scale;
      ctx.save();
      const drawX = imagePosition.x * scale;
      const drawY = imagePosition.y * scale;
      ctx.translate(drawX, drawY);
      ctx.rotate(imageRotation * Math.PI / 180);
      ctx.globalAlpha = 0.95;
      if (tintImage) {
        const off = document.createElement("canvas");
        off.width = imgW;
        off.height = imgH;
        const octx = off.getContext("2d");
        if (octx) {
          octx.drawImage(src, 0, 0, imgW, imgH);
          octx.globalCompositeOperation = "source-in";
          octx.fillStyle = imageTintColor || color;
          octx.fillRect(0, 0, imgW, imgH);
          ctx.drawImage(off, -imgW / 2, -imgH / 2, imgW, imgH);
        } else {
          ctx.drawImage(src, -imgW / 2, -imgH / 2, imgW, imgH);
        }
      } else {
        ctx.drawImage(src, -imgW / 2, -imgH / 2, imgW, imgH);
      }
      ctx.restore();
    }
    if (slogan) {
      ctx.save();
      ctx.translate(textPosition.x * scale, textPosition.y * scale);
      ctx.rotate(textRotation * Math.PI / 180);
      ctx.font = `bold ${textSize * scale}px 'Outfit', sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapText(ctx, slogan, 0, 0, width * 0.6, (textSize + 6) * scale);
      ctx.restore();
    }
  };
  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
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
    let currentY = y - totalHeight / 2 + lineHeight / 2;
    for (const l of lines) {
      ctx.fillText(l.trim(), x, currentY);
      currentY += lineHeight;
    }
  };
  useEffect(() => {
    scheduleRender();
  }, [slogan, color, template, templateColor, imageTintColor, textSize, textRotation, textPosition, image, imageScale, imageRotation, imagePosition, width, height, backgroundImage]);
  const handleMouseDown = (e) => {
    if (readonly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (400 / rect.width);
    const y = (clientY - rect.top) * (400 / rect.height);
    const textDist = Math.sqrt(Math.pow(x - textPosition.x, 2) + Math.pow(y - textPosition.y, 2));
    if (slogan && textDist < 50) {
      setIsDragging("text");
      setDragOffset({ x: x - textPosition.x, y: y - textPosition.y });
      return;
    }
    const imageDist = Math.sqrt(Math.pow(x - imagePosition.x, 2) + Math.pow(y - imagePosition.y, 2));
    if (image && imageDist < 60) {
      setIsDragging("image");
      setDragOffset({ x: x - imagePosition.x, y: y - imagePosition.y });
    }
  };
  const handleMouseMove = (e) => {
    if (!isDragging || readonly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (400 / rect.width);
    const y = (clientY - rect.top) * (400 / rect.height);
    const newX = Math.max(0, Math.min(400, x - dragOffset.x));
    const newY = Math.max(0, Math.min(400, y - dragOffset.y));
    if (isDragging === "text" && onTextMove) {
      onTextMove({ x: newX, y: newY });
    } else if (isDragging === "image" && onImageMove) {
      onImageMove({ x: newX, y: newY });
    }
  };
  const handleMouseUp = () => {
    setIsDragging(null);
  };
  return <div
    className={`overflow-hidden border-2 border-border/50 shadow-xl shadow-black/5 bg-white rounded-lg flex-shrink-0 ${readonly ? "" : "cursor-move"}`}
    style={{ width: "100%", maxWidth: width, aspectRatio: `${width}/${height}` }}
  >
      <canvas
    ref={(el) => {
      canvasRef.current = el;
      if (exportCanvasRef) {
        if (typeof exportCanvasRef === "function") {
          exportCanvasRef(el);
        } else if (typeof exportCanvasRef === "object" && exportCanvasRef !== null && "current" in exportCanvasRef) {
          try {
            exportCanvasRef.current = el;
          } catch (e) {
          }
        }
      }
    }}
    width={width}
    height={height}
    className="block touch-none w-full h-full"
    style={{ width: "100%", height: "100%" }}
    onMouseDown={handleMouseDown}
    onMouseMove={handleMouseMove}
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
    onTouchStart={handleMouseDown}
    onTouchMove={handleMouseMove}
    onTouchEnd={handleMouseUp}
  />
    </div>;
}
