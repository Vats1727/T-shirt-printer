import React, { useEffect, useState, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, Save, Palette, Type, Image as ImageIcon, DollarSign, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SupplierProductOrder() {
  const [match, params] = useRoute('/supplier/product/:id');
  const id = params?.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();

  const { token } = useAuth();
  const [catalog, setCatalog] = useState<any | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [featuredColor, setFeaturedColor] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [sizeQuantities, setSizeQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedDesignId, setSavedDesignId] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[] | null>(null);
  const frontExportRef = useRef<HTMLCanvasElement | null>(null);
  const backExportRef = useRef<HTMLCanvasElement | null>(null);

  const [side, setSide] = useState<'front'|'back'>('front');
  const [activeTab, setActiveTab] = useState<string>('colors');

  const baseState = {
    slogan: '',
    color: '#7c3aed',
    templateColor: '#ffffff',
    imageTintColor: null as string | null,
    textSize: 24,
    textRotation: 0,
    textPosition: { x: 180, y: 180 },
    image: null as string | null,
    imageScale: 25,
    imageRotation: 0,
    imagePosition: { x: 180, y: 180 },
    template: product?.template || 'tshirt',
    templateImage: null as string | null,
  };

  const [frontState, setFrontState] = useState(() => ({ ...baseState }));
  const [backState, setBackState] = useState(() => ({ ...baseState }));

  const activeState = side === 'front' ? frontState : backState;
  const setActiveState = (patch: Partial<typeof baseState>) => {
    if (side === 'front') setFrontState((prev: typeof baseState) => ({ ...prev, ...patch }));
    else setBackState((prev: typeof baseState) => ({ ...prev, ...patch }));
  };

  // helpers to access current values
  const slogan = activeState.slogan;
  const color = activeState.color; // text color
  const templateColor = activeState.templateColor; // shirt/template color
  const templateImage = activeState.templateImage; // admin-provided template image for this side
  const imageTintColor = activeState.imageTintColor; // admin default color applied only to image tint
  const textSize = activeState.textSize;
  const textRotation = activeState.textRotation;
  const textPosition = activeState.textPosition;
  const image = activeState.image;
  const imageScale = activeState.imageScale;
  const imageRotation = activeState.imageRotation;
  const imagePosition = activeState.imagePosition;
  const template = activeState.template;

  const [orderType, setOrderType] = useState<'single'|'bulk'>('single');
  const [priceInput, setPriceInput] = useState<number>(0);

  useEffect(()=>{
    // log resolved template and image for debugging when product / active side changes
    console.debug('SupplierProductOrder: product/template/image', { product: product ? { id: product.id, slug: product.slug, template: product.template } : null, side, template, image, imageTintColor, templateImage });
  }, [product, side, template, image, imageTintColor, templateImage]);

  useEffect(()=>{
    // log both sides' templateColor for debugging when swatch changes
    try { console.debug('SupplierProductOrder: side template colors', { front: frontState.templateColor, back: backState.templateColor, frontTemplateImage: frontState.templateImage, backTemplateImage: backState.templateImage }); } catch(e) {}
  }, [frontState.templateColor, backState.templateColor, frontState.templateImage, backState.templateImage]);

  // helper to normalize images similar to admin
  function normalizeImage(raw: any) {
    if (!raw) return null;
    let img = raw.image || raw.image_data || raw.file_name || raw.filename || raw.image_url || raw.image_src || raw.back_image || null;
    if (!img && typeof raw === 'string') img = raw;
    if (!img) return null;
    img = String(img);
    if (!img.startsWith('data:') && !img.startsWith('http') && !img.startsWith('/')) img = `/attached_assets/${img}`;
    return img;
  }

  useEffect(() => {
    const load = async () => {
      setError(null);
      const res = await fetch('/api/supplier/catalog', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) {
        if (res.status === 401) setError('Please sign in as a supplier to place orders.');
        return;
      }

      const data = await res.json();
      setCatalog(data);
      const prod = data.products?.find((p:any) => Number(p.id) === Number(id));
      console.debug('SupplierProductOrder: loaded product from catalog', prod);
      setProduct(prod || null);
      setLoading(false);
      // initialize price input from product if available
      try { setPriceInput(Number(prod?.single_price || 0)); } catch(e) { setPriceInput(0); }
      if (!prod) return;

      // Do NOT auto-select a color — supplier must choose a base color first
      if (prod.sizes && prod.sizes.length) {
        setSelectedSize(Number(prod.sizes[0]));
        // initialize per-size quantities to zero
        const init: Record<number, number> = {};
        for (const s of prod.sizes) init[Number(s)] = 0;
        // set first size default quantity to 1 for convenience
        init[Number(prod.sizes[0])] = 1;
        setSizeQuantities(init);
      }

      // initialize per-side states from admin designs (front/back)
      const designsArr = Array.isArray(prod.designs) ? prod.designs : [];
      const frontDesign = designsArr.find((d:any)=> (d.side||'').toLowerCase()==='front') || designsArr[0] || null;
      const backDesign = designsArr.find((d:any)=> (d.side||'').toLowerCase()==='back') || null;

      const firstColorHex = (prod.colors && prod.colors.length && data && data.colors) ? (data.colors.find((c:any)=> Number(c.id)===Number(prod.colors[0]))?.hex) : undefined;

      // helper: choose image only from the provided design object (strict: do NOT fallback to product-level images)
      const pickDesignImage = (design: any) => {
        if (!design) return null;
        const candidates = [design?.image, design?.image_url, design?.image_src, design?.file_name, design?.filename, design?.image_data, design?.back_image];
        for (const c of candidates) {
          const img = normalizeImage(c);
          if (img) return img;
        }
        return null;
      };


      // resolve template precedence: design template overrides product-level template
      const resolvedTemplate = (frontDesign && (frontDesign.template || frontDesign.template_name)) || (backDesign && (backDesign.template || backDesign.template_name)) || prod.template || undefined;

      // compute resolved images for logging — only design-level images are considered for the preview
      const resolvedFrontImage = pickDesignImage(frontDesign);
      const resolvedBackImage = pickDesignImage(backDesign);
      try { console.debug('SupplierProductOrder: resolved images/templates (design-only)', { resolvedTemplate, resolvedFrontImage, resolvedBackImage, prodTemplate: prod.template, prodDesigns: prod.designs }); } catch(e) {}

      // EXTRA DEBUG: log raw front/back design objects and normalized templateImage candidates
      try {
        const frontRaw = frontDesign;
        const backRaw = backDesign;
        const frontTemplateCandidate = frontDesign ? (frontDesign.template || frontDesign.image || frontDesign.image_src || frontDesign.image_url || frontDesign.file_name || frontDesign.filename) : undefined;
        const backTemplateCandidate = backDesign ? (backDesign.template || backDesign.image || backDesign.image_src || backDesign.image_url || backDesign.file_name || backDesign.filename) : undefined;
        console.debug('SupplierProductOrder: raw designs', { frontRaw, backRaw, frontTemplateCandidate, backTemplateCandidate, normalizedFront: normalizeImage(frontTemplateCandidate), normalizedBack: normalizeImage(backTemplateCandidate) });
      } catch(e) {}

      if (frontDesign) {
        // only use admin-provided design image (strict)
        let img = pickDesignImage(frontDesign);

        setFrontState((prev: typeof baseState) => ({
          ...prev,
          slogan: frontDesign.slogan || prev.slogan,
            image: null,
          // prefer actual image data/url fields first, use 'template' name only as a fallback
          templateImage: normalizeImage(frontDesign.image || frontDesign.image_data || frontDesign.image_src || frontDesign.image_url || frontDesign.file_name || frontDesign.filename || frontDesign.template) || null,
          imageScale: frontDesign.image_scale ? Number(frontDesign.image_scale) : prev.imageScale,
          imageRotation: frontDesign.image_rotation ? Number(frontDesign.image_rotation) : prev.imageRotation,
          imagePosition: frontDesign.image_position || prev.imagePosition,
          textSize: frontDesign.text_size ? Number(frontDesign.text_size) : prev.textSize,
          textRotation: frontDesign.text_rotation ? Number(frontDesign.text_rotation) : prev.textRotation,
          textPosition: frontDesign.text_position || prev.textPosition,
          template: resolvedTemplate || prod.template || prev.template,
          // Do NOT apply admin default color to template/text here. Use admin default only for image tinting.
          templateColor: frontDesign.template_color || frontDesign.templateColor || prev.templateColor,
          color: frontDesign.color || prev.color,
          imageTintColor: frontDesign.color || firstColorHex || prev.imageTintColor,
        }));
        try { console.debug('SupplierProductOrder: front side resolved', { resolvedTemplate, frontDesign, templateImage: normalizeImage(frontDesign.template || frontDesign.image || frontDesign.image_src || frontDesign.image_url) || null }); } catch (e) {}
      } else {
        // no admin front design image — ensure we clear any preview image
        setFrontState((prev: typeof baseState) => ({ ...prev, image: null }));
      }

      if (backDesign) {
        // only use admin-provided design image (strict)
        let img = pickDesignImage(backDesign);
        setBackState((prev: typeof baseState) => ({
          ...prev,
          slogan: backDesign.slogan || prev.slogan,
            image: null,
          // prefer actual image data/url fields first, use 'template' name only as a fallback
          templateImage: normalizeImage(backDesign.image || backDesign.image_data || backDesign.image_src || backDesign.image_url || backDesign.file_name || backDesign.filename || backDesign.template) || null,
          imageScale: backDesign.image_scale ? Number(backDesign.image_scale) : prev.imageScale,
          imageRotation: backDesign.image_rotation ? Number(backDesign.image_rotation) : prev.imageRotation,
          imagePosition: backDesign.image_position || prev.imagePosition,
          textSize: backDesign.text_size ? Number(backDesign.text_size) : prev.textSize,
          textRotation: backDesign.text_rotation ? Number(backDesign.text_rotation) : prev.textRotation,
          textPosition: backDesign.text_position || prev.textPosition,
          template: resolvedTemplate || prod.template || prev.template,
          // Use admin default as a fallback for template and color on back side as well (so back preview matches front)
          templateColor: backDesign.template_color || backDesign.templateColor || firstColorHex || prev.templateColor,
          color: backDesign.color || firstColorHex || prev.color,
          imageTintColor: backDesign.color || firstColorHex || prev.imageTintColor,
        }));
        try { console.debug('SupplierProductOrder: back side resolved', { resolvedTemplate, backDesign, templateImage: normalizeImage(backDesign.template || backDesign.image || backDesign.image_src || backDesign.image_url) || null }); } catch (e) {}
      } else {
        // no admin back design image — ensure we clear any preview image
        setBackState((prev: typeof baseState) => ({ ...prev, image: null }));
      }

      // if no designs provided, set template (from product) and apply admin default as template color and image tint so both sides match
      if (!frontDesign && !backDesign) {
        // No admin side-specific designs: do NOT show product-level image in the preview; leave image blank
        setFrontState((prev: typeof baseState) => ({ ...prev, template: prod.template || prev.template, templateColor: firstColorHex || prev.templateColor, imageTintColor: firstColorHex || prev.imageTintColor, image: null, templateImage: null }));
        setBackState((prev: typeof baseState) => ({ ...prev, template: prod.template || prev.template, templateColor: firstColorHex || prev.templateColor, imageTintColor: firstColorHex || prev.imageTintColor, image: null, templateImage: null }));
      }

      // Ensure both sides use the product template if available (covers cases where only one side has a design)
      setFrontState((prev: typeof baseState) => ({ ...prev, template: prod.template || prev.template }));
      setBackState((prev: typeof baseState) => ({ ...prev, template: prod.template || prev.template }));

      // If only one side had a design, do NOT use product-level images for the other side; leave image null
      if (!frontDesign) {
        setFrontState((prev: typeof baseState) => ({ ...prev, image: null }));
      }
      if (!backDesign) {
        setBackState((prev: typeof baseState) => ({ ...prev, image: null }));
      }
    };

    load();
  }, [id, token]);

  if (!product) return <div className="p-6">Product not found</div>;

  // show any error or success messages to the user
  const Banner = () => (
    <div className="mb-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded">{error}</div>}
      {message && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded">{message} {savedDesignId && (
        <button className="underline ml-2 text-primary" onClick={async ()=>{
          try {
            setError(null);
            setMessage('Fetching versions...');
            const res = await fetch(`/api/designs/${savedDesignId}/versions`, {
              headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            if (!res.ok) {
              const txt = await res.text().catch(()=>res.statusText);
              setError('Failed to fetch versions: ' + (txt || res.status));
              setMessage(null);
              return;
            }
            const js = await res.json();
            setVersions(js);
            setMessage('Versions loaded.');
          } catch (e:any) {
            setError('Failed to fetch versions: ' + (e?.message || e));
            setMessage(null);
          }
        }}>View versions</button>
      )}</div>}
    </div>
  );

  const totalQty = Object.values(sizeQuantities || {}).reduce((s, v) => s + Number(v || 0), 0);
  const unitPriceForDisplay = (orderType === 'bulk' && product.bulk_min && totalQty >= Number(product.bulk_min) && product.bulk_price) ? Number(product.bulk_price) : Number(product.single_price || 0);
  const totalPrice = totalQty > 0 ? unitPriceForDisplay * totalQty : 0;

  const getSizeLabel = (sid: any) => {
    if (!catalog || !Array.isArray(catalog.sizes)) return sid;
    // Try to find by numeric id
    const byId = catalog.sizes.find((s:any) => Number(s.id) === Number(sid));
    if (byId && (byId.label || byId.value)) return byId.label || byId.value;
    // Maybe the product stores size as a label/value string — try to match that
    const byLabel = catalog.sizes.find((s:any) => String(s.label) === String(sid) || String(s.value) === String(sid));
    if (byLabel) return byLabel.label || byLabel.value;
    return sid;
  };
  const getColorObj = (cid: number) => (catalog && catalog.colors ? catalog.colors.find((c:any)=> Number(c.id) === Number(cid)) : null) || {name: 'Unknown', hex: '#ccc'};

  // Placing orders is disabled for now. The implementation below is commented
  // out so it can be re-enabled later.
  /*
  async function placeOrder() {
    if (!selectedColor) return alert('Choose a color');
    // gather items from sizeQuantities
    const items: Array<any> = [];
    let totalQty = 0;
    for (const [sidStr, q] of Object.entries(sizeQuantities || {})) {
      const qn = Number(q || 0);
      if (qn > 0) {
        totalQty += qn;
      }
    }
    if (totalQty <= 0) return alert('Choose at least one size and quantity');

    // pricing: if bulk order and meets bulk_min, prefer bulk_price, else single_price
    const unitPrice = (orderType === 'bulk' && product.bulk_min && totalQty >= Number(product.bulk_min) && product.bulk_price) ? Number(product.bulk_price) : Number(product.single_price || 0);

    // build design snapshot from front/back state (serialize minimal values)
    const designSnapshot = {
      product_id: product.id,
      product_slug: product.slug,
      front: {
        slogan: frontState.slogan,
        color: frontState.color,
        template: frontState.template,
        templateColor: frontState.templateColor,
        image: frontState.image,
        imageScale: frontState.imageScale,
        imageRotation: frontState.imageRotation,
        imagePosition: frontState.imagePosition,
        textSize: frontState.textSize,
        textRotation: frontState.textRotation,
        textPosition: frontState.textPosition,
      },
      back: {
        slogan: backState.slogan,
        color: backState.color,
        template: backState.template,
        templateColor: backState.templateColor,
        image: backState.image,
        imageScale: backState.imageScale,
        imageRotation: backState.imageRotation,
        imagePosition: backState.imagePosition,
        textSize: backState.textSize,
        textRotation: backState.textRotation,
        textPosition: backState.textPosition,
      }
    };

    // create line items per-size with snapshot attached
    for (const [sidStr, q] of Object.entries(sizeQuantities || {})) {
      const qn = Number(q || 0);
      if (qn > 0) {
        items.push({ product: product.slug || product.name || 'tshirt', color_id: selectedColor, size_id: Number(sidStr), quantity: qn, price: unitPrice, design_snapshot: designSnapshot });
      }
    }

    const res = await fetch('/api/supplier/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ items, shipping: {} }) });
    if (!res.ok) {
      if (res.status === 401) {
        setError('Not authorized — please log in as a supplier');
        return;
      }
      const txt = await res.text().catch(()=>'');
      setError('Order failed: ' + (txt || res.status));
      return;
    }
    const js = await res.json();
    setMessage('Order placed: ' + js.id);
    setTimeout(()=> setLocation('/supplier/dashboard'), 1200);
  }
  */

  // Save design for later. This posts to the existing /api/designs endpoint and
  // stores the supplier-entered price locally (localStorage) until a server-side
  // supplier-price API is available.
  async function saveDesign() {
    setSaving(true);
    setError(null);
    const buildSide = (state: typeof baseState, name: 'front'|'back') => ({
      name,
      layers: [
        ...(state.slogan ? [{ type: 'text', text: state.slogan, size: state.textSize, rotation: state.textRotation, position: state.textPosition, color: state.color }] : []),
        ...(state.image ? [{ type: 'image', asset: { dataUrl: state.image }, scale: state.imageScale / 100, rotation: state.imageRotation, position: state.imagePosition }] : []),
      ],
    });

      // capture front/back preview images from hidden canvases (if available)
      const frontPreview = frontExportRef.current?.toDataURL?.('image/png') || null;
      const backPreview = backExportRef.current?.toDataURL?.('image/png') || null;

      const payload: any = {
      product: product?.slug || String(product?.id || 'tshirt'),
      template: frontState.template || product?.template || 'tshirt',
      templateColor: frontState.templateColor || '#ffffff',
      // convert dollars to integer cents
      price_cents: Math.round(Number(priceInput || 0) * 100),
      currency: 'USD',
      version: {
        versionName: 'supplier-save',
        sides: [buildSide(frontState, 'front'), buildSide(backState, 'back')],
        metadata: {
          canvasDimensions: { width: 400, height: 400 },
          dpiAware: true,
          preview_front: frontPreview,
          preview_back: backPreview,
          selected_colors: selectedColors.map((cid)=>{
            const c = getColorObj(Number(cid));
            return { id: Number(cid), hex: c?.hex || null, name: c?.name || null };
          }),
          featured_color: (featuredColor ? ((): any => { const c = getColorObj(Number(featuredColor)); if (!c) return null; return { id: Number(featuredColor), hex: c.hex, name: c.name }; })() : (selectedColors && selectedColors.length ? ((): any => { const c = getColorObj(Number(selectedColors[0])); if (!c) return null; return { id: Number(selectedColors[0]), hex: c.hex, name: c.name }; })() : null))
        }
      },
    };

    try {
      // If multiple colors were selected, create a separate design record per color.
      const createdIds: number[] = [];
      const originalFrontColor = frontState.templateColor;
      const originalBackColor = backState.templateColor;

      const capturePreviewsFor = async (hex: string | null) => {
        // apply temp colors
        if (hex) {
          setFrontState(prev => ({ ...prev, templateColor: hex }));
          setBackState(prev => ({ ...prev, templateColor: hex }));
        }
        // wait a frame for canvas to re-render
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 60)));
        const f = frontExportRef.current?.toDataURL?.('image/png') || null;
        const b = backExportRef.current?.toDataURL?.('image/png') || null;
        return { front: f, back: b };
      };

      // Helper to post a design payload (cloned with single selected color)
      const postDesign = async (payloadToSend:any) => {
        const res = await fetch('/api/designs', { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }, 
          body: JSON.stringify(payloadToSend) 
        });
        if (!res.ok) {
          const txt = await res.text().catch(()=>'');
          throw new Error('Failed to save design: ' + (txt || res.status));
        }
        return await res.json();
      };

      // If multiple selected colors, create a single design with metadata for all colors
      if (selectedColors && Array.isArray(selectedColors) && selectedColors.length > 1) {
        // choose featured color (explicit or first selected)
        const featuredCid = featuredColor ? Number(featuredColor) : Number(selectedColors[0]);
        const featuredObj = getColorObj(featuredCid) || null;
        const previewByColor: Array<any> = [];
        for (const cid of selectedColors) {
          const cobj = getColorObj(Number(cid));
          const hex = cobj?.hex || null;
          const previews = await capturePreviewsFor(hex);
          previewByColor.push({ id: Number(cid), hex, name: cobj?.name || null, preview_front: previews.front, preview_back: previews.back });
        }

        // Also ensure preview_front/preview_back for featured color is attached (used for card preview asset)
        const featuredPreview = previewByColor.find(p => Number(p.id) === Number(featuredCid)) || previewByColor[0];

        const multiPayload = {
          ...payload,
          version: {
            ...payload.version,
            metadata: {
              ...(payload.version?.metadata || {}),
              preview_front: featuredPreview?.preview_front || null,
              preview_back: featuredPreview?.preview_back || null,
              selected_colors: previewByColor.map(p => ({ id: p.id, hex: p.hex, name: p.name })),
              featured_color: featuredObj ? { id: Number(featuredObj.id), hex: featuredObj.hex, name: featuredObj.name } : null,
              preview_by_color: previewByColor,
            }
          }
        };

        const js = await postDesign(multiPayload);
        const did = Number(js.id || js.designId || js.design?.id || null) || null;
        if (did) createdIds.push(did);

        // restore original template colors
        setFrontState((prev: typeof baseState) => ({ ...prev, templateColor: originalFrontColor }));
        setBackState((prev: typeof baseState) => ({ ...prev, templateColor: originalBackColor }));

        // persist price locally for now
        try { localStorage.setItem(`supplier:product:${product?.id}:price`, String(priceInput || 0)); } catch(e) {}

        setMessage('Design saved for ' + createdIds.length + ' colors. IDs: ' + createdIds.join(', '));
        if (createdIds.length) setSavedDesignId(createdIds[0]);
        return;
      }

      // single save (fallback)
      const res = await fetch('/api/designs', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }, 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=>'');
        setError('Failed to save design: ' + (txt || res.status));
        return;
      }
      const js = await res.json();
      // persist price locally for now
      try { localStorage.setItem(`supplier:product:${product?.id}:price`, String(priceInput || 0)); } catch(e) {}
      // If server returned design object or version list, use them immediately
      const did = Number(js.id || js.designId || js.design?.id || null) || null;
      setSavedDesignId(did);
      if (js.versions && Array.isArray(js.versions)) {
        setVersions(js.versions);
      } else if (js.design && js.design.version) {
        setVersions([js.design.version]);
      }
      setMessage('Design saved (id: ' + (did || 'unknown') + '). Price stored locally.');
      // Redirect after success as requested
      setTimeout(() => setLocation('/supplier/dashboard'), 1500);
    } catch (e:any) {
      setError(e?.message || 'Failed to save design');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse text-sm font-medium">Preparing design environment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation('/supplier/dashboard')}
            className="rounded-full hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-sm text-muted-foreground">Customize and save your design for {product.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={saveDesign} 
            disabled={saving || selectedColors.length === 0}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 min-w-[140px]"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Saving...' : 'Save Design'}
          </Button>
        </div>
      </div>

      <Banner />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
        {/* Left column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Design Customization</CardTitle>
                  <CardDescription>Configure colors, text, and logos</CardDescription>
                </div>
                <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-lg border shadow-sm">
                  <button 
                    onClick={() => setSide('front')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${side === 'front' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Front
                  </button>
                  <button 
                    onClick={() => setSide('back')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${side === 'back' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Back
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-4 gap-1 bg-muted/50 p-1">
                  <TabsTrigger value="colors" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                    <Palette className="size-4" />
                    <span className="hidden sm:inline">Colors</span>
                  </TabsTrigger>
                  <TabsTrigger value="slogan" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm" disabled={selectedColors.length === 0}>
                    <Type className="size-4" />
                    <span className="hidden sm:inline">Text</span>
                  </TabsTrigger>
                  <TabsTrigger value="logo" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm" disabled={selectedColors.length === 0}>
                    <ImageIcon className="size-4" />
                    <span className="hidden sm:inline">Logo</span>
                  </TabsTrigger>
                  <TabsTrigger value="price" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm" disabled={selectedColors.length === 0}>
                    <DollarSign className="size-4" />
                    <span className="hidden sm:inline">Price</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="colors" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground italic">Available Print Colors</label>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-slate-50">Select at least one</Badge>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {product.colors?.map((cid: number) => {
                        const c = getColorObj(Number(cid));
                        const selected = selectedColors.includes(Number(cid));
                        const isFeatured = featuredColor === Number(cid);
                        return (
                          <div key={cid} className="relative group/color">
                            <button 
                              onClick={() => { 
                                setSelectedColors(prev => {
                                  if (prev.includes(Number(cid))) {
                                    const filtered = prev.filter(x => x !== Number(cid));
                                    if (featuredColor === Number(cid)) setFeaturedColor(filtered.length ? filtered[0] : null);
                                    return filtered;
                                  }
                                  const next = [...prev, Number(cid)];
                                  if (!featuredColor) setFeaturedColor(Number(cid));
                                  return next;
                                });
                                  setFrontState((prev: typeof baseState) => ({ ...prev, templateColor: c.hex || prev.templateColor, imageTintColor: c.hex || prev.imageTintColor }));
                                  setBackState((prev: typeof baseState) => ({ ...prev, templateColor: c.hex || prev.templateColor, imageTintColor: c.hex || prev.imageTintColor }));
                              }} 
                              className={`w-full aspect-square rounded-full border-4 transition-all ${selected ? 'border-indigo-500 shadow-md scale-105' : 'border-white hover:border-gray-200'}`}
                              style={{ background: c.hex }}
                              title={c.name}
                            />
                            {selected && (
                              <button 
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setFeaturedColor(Number(cid)); }} 
                                className={`absolute -top-1 -right-1 size-5 rounded-full border flex items-center justify-center text-[10px] shadow-sm transition-transform active:scale-90 ${isFeatured ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-muted-foreground border-gray-200 hover:bg-gray-50'}`}
                                title={isFeatured ? 'Featured color' : 'Mark as featured'}
                              >
                                ★
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="slogan" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold italic">Design Slogan</label>
                      <Input
                        placeholder="Type your slogan here..."
                        value={slogan}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveState({ slogan: e.target.value })}
                        className="bg-muted/30 focus-visible:ring-indigo-500 h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold italic">Text Color</label>
                        <div className="flex items-center gap-3">
                          <input type="color" value={color} onChange={e => setActiveState({ color: e.target.value })} className="size-10 p-0.5 rounded-lg border cursor-pointer overflow-hidden bg-white" />
                          <span className="text-xs font-mono text-muted-foreground uppercase">{color}</span>
                        </div>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button variant="outline" size="sm" onClick={() => setActiveState({ slogan: '' })} className="text-xs">Clear Text</Button>
                      </div>
                    </div>

                    {slogan && (
                      <div className="space-y-6 pt-4 border-t">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Font Size</span>
                            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{textSize}px</span>
                          </div>
                          <input type="range" min={8} max={200} value={textSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveState({ textSize: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rotation</span>
                            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{textRotation}°</span>
                          </div>
                          <input type="range" min={0} max={360} value={textRotation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveState({ textRotation: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="logo" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold italic">Upload Art or Logo</label>
                      <div className="flex items-center justify-center border-2 border-dashed border-border/60 rounded-xl p-8 bg-muted/20 hover:bg-muted/30 transition-colors group">
                        <label className="cursor-pointer flex flex-col items-center gap-3 w-full h-full">
                          <input type="file" accept="image/*" onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = async () => {
                                const result = reader.result as string | null;
                                if (!result) return;
                                try {
                                  const res = await fetch('/api/assets', { 
                                    method: 'POST', 
                                    headers: { 
                                      'Content-Type': 'application/json',
                                      'Authorization': token ? `Bearer ${token}` : ''
                                    }, 
                                    body: JSON.stringify({ dataUrl: result, filename: f.name }) 
                                  });
                      if (res.ok) {
                        const js = await res.json();
                        const url = js?.url || `/attached_assets/${js?.filename}`;
                        setActiveState({ image: url });
                        toast({ title: "Image Uploaded", description: `${f.name} has been added successfully.` });
                        return;
                      }
                    } catch (err: any) {}
                    setActiveState({ image: result });
                  };
                              reader.readAsDataURL(f);
                            }} className="hidden" />
                          <div className="size-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border">
                            <ImageIcon className="size-6 text-indigo-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">Click to browse</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG or SVG up to 5MB</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {image && (
                      <div className="space-y-6 pt-4 border-t">
                        <div className="flex gap-4">
                          <div className="size-24 rounded-lg border bg-white p-2 flex items-center justify-center shadow-sm flex-shrink-0">
                            <img src={image} alt="logo preview" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div className="flex-grow space-y-4">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Size Scale</span>
                                <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{imageScale}%</span>
                              </div>
                              <input type="range" min={1} max={100} value={imageScale} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveState({ imageScale: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rotation</span>
                                <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{imageRotation}°</span>
                              </div>
                              <input type="range" min={0} max={360} value={imageRotation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActiveState({ imageRotation: Number(e.target.value) })} className="w-full accent-indigo-600 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={() => setActiveState({ image: null })} className="text-xs flex-grow text-red-600 hover:text-red-700 hover:bg-red-50">Remove</Button>
                              <Button variant="ghost" size="sm" onClick={() => setActiveState({ imageScale: 100, imageRotation: 0, imagePosition: { x: 180, y: 180 } })} className="text-xs">Reset</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="price" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/50 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold italic text-indigo-900">Retail Price (for your Listing)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-indigo-600/60" />
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={priceInput} 
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPriceInput(Number(e.target.value) || 0)} 
                          className="pl-9 bg-white border-indigo-200 focus-visible:ring-indigo-500 h-12 text-lg font-semibold"
                        />
                      </div>
                      <p className="text-[10px] text-indigo-600/80 italic font-medium">This is the price your customers will see on your storefront.</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right column: 3D Preview */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative aspect-square w-full max-w-2xl mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100 border-8 border-white bg-slate-100 flex items-center justify-center">
            <DesignCanvas
              side={side}
              slogan={slogan}
              color={color}
              template={template || product.template || 'tshirt'}
              templateImage={templateImage}
              showTemplate={true}
              templateColor={templateColor}
              imageTintColor={imageTintColor}
              tintImage={false}
              forceTemplateFill={false}
              textSize={textSize}
              textRotation={textRotation}
              textPosition={textPosition}
              onTextMove={(pos) => setActiveState({ textPosition: pos })}
              image={image}
              imageScale={imageScale / 100}
              imageRotation={imageRotation}
              imagePosition={imagePosition}
              onImageMove={(pos) => setActiveState({ imagePosition: pos })}
              width={640}
              height={640}
            />
            
            {/* Design tools Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-xl border border-white/20 p-2 rounded-full shadow-lg">
              <Badge variant="secondary" className="bg-indigo-600 text-white border-none py-1.5 px-4 shadow-sm select-none">
                Interactive Preview
              </Badge>
              <div className="flex items-center gap-1.5 pr-2">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-600 select-none">Live Sync</span>
              </div>
            </div>
            
            {/* Zoom / Hint indicator */}
            <div className="absolute top-6 right-6 p-3 rounded-2xl bg-white/80 backdrop-blur-md shadow-sm border border-white flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-600">Hint</span>
              <p className="text-[8px] italic text-slate-500 max-w-[60px] text-center leading-tight">Drag items to reposition</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-indigo-400" />
              <span>Base Template: <span className="font-semibold text-slate-700 capitalize">{product.template || 'Default'}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-indigo-400" />
              <span>Active Side: <span className="font-semibold text-slate-700 capitalize">{side}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvases for exporting front/back previews */}
      <div aria-hidden className="invisible pointer-events-none fixed top-[-1000px] left-[-1000px]">
        <DesignCanvas
          side={'front'}
          slogan={frontState.slogan}
          color={frontState.color}
          template={frontState.template || product.template}
          templateImage={frontState.templateImage}
          showTemplate={true}
          templateColor={frontState.templateColor}
          imageTintColor={frontState.imageTintColor}
          tintImage={false}
          forceTemplateFill={false}
          textSize={frontState.textSize}
          textRotation={frontState.textRotation}
          textPosition={frontState.textPosition}
          image={frontState.image}
          imageScale={frontState.imageScale / 100}
          imageRotation={frontState.imageRotation}
          imagePosition={frontState.imagePosition}
          width={520}
          height={520}
          exportCanvasRef={frontExportRef}
        />
        <DesignCanvas
          side={'back'}
          slogan={backState.slogan}
          color={backState.color}
          template={backState.template || product.template}
          templateImage={backState.templateImage}
          showTemplate={true}
          templateColor={backState.templateColor}
          imageTintColor={backState.imageTintColor}
          tintImage={false}
          forceTemplateFill={false}
          textSize={backState.textSize}
          textRotation={backState.textRotation}
          textPosition={backState.textPosition}
          image={backState.image}
          imageScale={backState.imageScale / 100}
          imageRotation={backState.imageRotation}
          imagePosition={backState.imagePosition}
          width={520}
          height={520}
          exportCanvasRef={backExportRef}
        />
      </div>

      {versions && (
        <Card className="mt-8 border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Debug: Design Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-[10px] font-mono bg-white p-4 rounded-lg overflow-auto max-h-[300px] shadow-inner border leading-relaxed">
              {JSON.stringify(versions, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}