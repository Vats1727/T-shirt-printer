import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

interface DesignCanvasProps {
  slogan: string;
  color: string;
  textSize?: number;
  textRotation?: number;
  textPosition?: { x: number; y: number };
  onTextMove?: (pos: { x: number; y: number }) => void;
  image?: string | null;
  imageScale?: number;
  imageRotation?: number;
  imagePosition?: { x: number; y: number };
  onImageMove?: (pos: { x: number; y: number }) => void;
  width?: number;
  height?: number;
  readonly?: boolean;
}

export function DesignCanvas({
  slogan,
  color,
  textSize = 24,
  textRotation = 0,
  textPosition = { x: 150, y: 135 },
  onTextMove,
  image,
  imageScale = 100,
  imageRotation = 0,
  imagePosition = { x: 150, y: 150 },
  onImageMove,
  width = 300,
  height = 300,
  readonly = false,
}: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tshirtRef = useRef<HTMLImageElement | null>(null);
  const userImageRef = useRef<HTMLImageElement | null>(null);
  
  const [isDragging, setIsDragging] = useState<'text' | 'image' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load T-shirt template
  useEffect(() => {
    const img = new Image();
    img.src = "/templates/tshirt.png";
    img.onload = () => {
      tshirtRef.current = img;
      render();
    };
  }, []);

  // Load user image
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        userImageRef.current = img;
        render();
      };
    } else {
      userImageRef.current = null;
      render();
    }
  }, [image]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !tshirtRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = width / 400;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tshirtRef.current, 0, 0, width, height);

    // Draw Image first (behind text)
    if (userImageRef.current && image) {
      const imgScale = (imageScale / 100) * scale;
      const imgWidth = userImageRef.current.width * imgScale;
      const imgHeight = userImageRef.current.height * imgScale;
      
      ctx.save();
      ctx.translate(imagePosition.x * scale, imagePosition.y * scale);
      ctx.rotate((imageRotation * Math.PI) / 180);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(
        userImageRef.current, 
        -imgWidth / 2, 
        -imgHeight / 2, 
        imgWidth, 
        imgHeight
      );
      ctx.restore();
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
  }, [slogan, color, textSize, textRotation, textPosition, image, imageScale, imageRotation, imagePosition, width, height]);

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
