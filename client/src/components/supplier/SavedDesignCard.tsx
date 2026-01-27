import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import { Button } from '@/components/ui/button';

interface Props {
  sd: any;
  onView?: (sd:any)=>void;
  onUse?: (sd:any)=>void;
}

export default function SavedDesignCard({ sd, onView, onUse }: Props) {
  const payload = sd?.version?.payload || sd?.version || {};

  const getPreview = () => {
    try {
      const front = Array.isArray(payload.sides) ? payload.sides.find((s:any)=>s.name==='front') || payload.sides[0] : null;
      const template = payload.template || payload.product || undefined;
      // If version metadata contains a featured color, use it for tinting the preview image
      const featured = payload?.version?.metadata?.featured_color || (sd?.design?.templateColor ? { hex: sd.design.templateColor } : null);
      const templateColor = payload.templateColor || payload.template_color || payload.color || undefined;
      let slogan = '';
      let imageUrl: string | null = null;
      let imageScale = 100;
      let imageRotation = 0;
      let imagePosition = { x: 200, y: 180 };
      let textSize = 28;
      let textRotation = 0;

      if (front && Array.isArray(front.layers)) {
        const imgLayer = front.layers.find((l:any)=>l.type==='image' && (l.asset?.asset_id || l.asset?.id || l.asset_id));
        if (imgLayer) {
          const aid = imgLayer.asset?.asset_id || imgLayer.asset?.id || imgLayer.asset_id;
          if (aid) imageUrl = `/api/assets/${aid}`;
          imageScale = imgLayer.scale || imgLayer.imageScale || imgLayer.size || imageScale;
          imageRotation = imgLayer.rotation || imgLayer.imageRotation || imageRotation;
          imagePosition = imgLayer.position || imgLayer.imagePosition || imagePosition;
        }
        const textLayer = front.layers.find((l:any)=>l.type==='text' && (l.text || l.slogan));
        if (textLayer) {
          slogan = textLayer.text || textLayer.slogan || '';
          textSize = textLayer.size || textLayer.fontSize || textSize;
          textRotation = textLayer.rotation || textLayer.textRotation || textRotation;
        }
      }

      // If top-level legacy image fields exist (normalized v2 payload), prefer them for preview
      if (!imageUrl && payload.image) {
        imageUrl = (typeof payload.image === 'string' && payload.image.startsWith('/api/assets/')) ? payload.image : (typeof payload.image === 'string' && payload.image.startsWith('/attached_assets/')) ? payload.image : payload.image;
      }
      // Render a small DesignCanvas to show the composed design
      return (
        <div className="w-full h-full">
          <DesignCanvas
            readonly
            width={240}
            height={200}
            showTemplate={true}
            template={template}
            templateColor={templateColor}
            slogan={slogan}
            color={templateColor || '#000'}
            image={(() => {
              if (!imageUrl) return null;
              if (typeof imageUrl === 'string' && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                return `/attached_assets/${imageUrl}`;
              }
              return imageUrl;
            })()}
            imageScale={Number(imageScale) || 100}
            imageRotation={Number(imageRotation) || 0}
            imagePosition={imagePosition}
            // If there is a featured color, tint the image only (do not change template color)
            imageTintColor={featured?.hex || null}
            tintImage={!!featured}
          />
        </div>
      );
    } catch (e) {
      return <div className="text-sm text-muted-foreground">No preview</div>;
    }
  };

  const formatPrice = (v:any) => {
    if (v === undefined || v === null) return '—';
    const n = Number(v);
    if (isNaN(n)) return String(v);
    return new Intl.NumberFormat(undefined, {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(n);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="h-40 flex items-center justify-center bg-gray-50 rounded mb-3 overflow-hidden">
          {getPreview()}
        </div>
        <div className="mb-2"><div className="font-semibold text-lg">Design #{sd?.design?.id}</div>
        <div className="text-sm text-muted-foreground">Created: {new Date(sd?.version?.created_at || sd?.design?.createdAt || Date.now()).toLocaleString()}</div></div>
        <div className="text-sm mb-3">Price: <strong>{formatPrice(sd?.version?.price_cents)}</strong></div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => onUse?.(sd)} className="px-3 py-1 text-sm">Use / Edit</Button>
          <Button variant="secondary" onClick={() => onView?.(sd)} className="px-3 py-1 text-sm">View details</Button>
        </div>
      </CardContent>
    </Card>
  );
}
