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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 2. Draw Background (Product representation)
    // Add a slight gradient for depth
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#f0f0f5");
    ctx.fillStyle = gradient;
    
    // Draw rounded rect equivalent (simplified as fillRect for canvas)
    ctx.fillRect(0, 0, width, height);

    // Add a border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    // 3. Draw Product Name
    ctx.font = "500 16px 'DM Sans', sans-serif";
    ctx.fillStyle = "#94a3b8"; // Muted text
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(product.toUpperCase(), width / 2, 20);

    // 4. Draw Slogan
    // We need to handle basic text wrapping if it's too long
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = slogan || "Your Slogan Here";
    const maxWidth = width - 40;
    const lineHeight = 40;
    const x = width / 2;
    let y = height / 2;

    wrapText(ctx, text, x, y, maxWidth, lineHeight);

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
