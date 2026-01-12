import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

interface DesignCanvasProps {
  slogan: string;
  product: string;
  color: string;
  width?: number;
  height?: number;
}

export function DesignCanvas({
  slogan,
  product,
  color,
  width = 300,
  height = 300,
}: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = "/templates/tshirt.png";
    img.onload = () => {
      imageRef.current = img;
      render();
    };
  }, []);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 2. Draw T-shirt Template
    ctx.drawImage(imageRef.current, 0, 0, width, height);

    // 3. Draw Slogan
    ctx.font = "bold 24px 'Outfit', sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = slogan || "Your Slogan Here";
    const maxWidth = width * 0.5; // Constrain to chest area
    const lineHeight = 30;
    const x = width / 2;
    const y = height * 0.45; // Position on chest

    wrapText(ctx, text, x, y, maxWidth, lineHeight);
  };

  useEffect(() => {
    render();
  }, [slogan, product, color, width, height]);

  // Helper for wrapping text
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(" ");
    let line = "";
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Center vertically based on number of lines
    const totalHeight = lines.length * lineHeight;
    let currentY = y - (totalHeight / 2) + (lineHeight / 2);

    for (const l of lines) {
      ctx.fillText(l.trim(), x, currentY);
      currentY += lineHeight;
    }
  }

  return (
    <Card className="overflow-hidden border-2 border-border/50 shadow-xl shadow-black/5 bg-white">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto block"
      />
    </Card>
  );
}
