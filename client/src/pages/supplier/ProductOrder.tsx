import React, { useEffect, useState, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SupplierProductOrder() {
  const [match, params] = useRoute('/supplier/product/:id');
  const id = params?.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();

  const { token } = useAuth();
  const [catalog, setCatalog] = useState<any | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  // per-size quantities for multi-size orders: { [sizeId]: quantity }
  const [sizeQuantities, setSizeQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedDesignId, setSavedDesignId] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[] | null>(null);
  const frontExportRef = useRef<HTMLCanvasElement | null>(null);
  const backExportRef = useRef<HTMLCanvasElement | null>(null);

  // design state (per-side similar to Home)
  const [side, setSide] = useState<'front'|'back'>('front');
  const [activeTab, setActiveTab] = useState<'colors'|'slogan'|'logo'|'price'>('colors');

  const baseState = {
    slogan: '',
    color: '#7c3aed',
    templateColor: '#ffffff',
    imageTintColor: null as string | null,
    textSize: 24,
    textRotation: 0,
    textPosition: { x: 180, y: 180 },
    image: null as string | null,
    imageScale: 10,
    imageRotation: 0,
    imagePosition: { x: 180, y: 180 },
    template: product?.template || 'tshirt',
    templateImage: null as string | null,
  };

  const [frontState, setFrontState] = useState(() => ({ ...baseState }));
  const [backState, setBackState] = useState(() => ({ ...baseState }));

  const activeState = side === 'front' ? frontState : backState;
  const setActiveState = (patch: Partial<typeof baseState>) => {
    if (side === 'front') setFrontState(prev => ({ ...prev, ...patch }));
    else setBackState(prev => ({ ...prev, ...patch }));
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

        setFrontState(prev => ({
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
        setFrontState(prev => ({ ...prev, image: null }));
      }

      if (backDesign) {
        // only use admin-provided design image (strict)
        let img = pickDesignImage(backDesign);
        setBackState(prev => ({
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
        setBackState(prev => ({ ...prev, image: null }));
      }

      // if no designs provided, set template (from product) and apply admin default as template color and image tint so both sides match
      if (!frontDesign && !backDesign) {
        // No admin side-specific designs: do NOT show product-level image in the preview; leave image blank
        setFrontState(prev => ({ ...prev, template: prod.template || prev.template, templateColor: firstColorHex || prev.templateColor, imageTintColor: firstColorHex || prev.imageTintColor, image: null, templateImage: null }));
        setBackState(prev => ({ ...prev, template: prod.template || prev.template, templateColor: firstColorHex || prev.templateColor, imageTintColor: firstColorHex || prev.imageTintColor, image: null, templateImage: null }));
      }

      // Ensure both sides use the product template if available (covers cases where only one side has a design)
      setFrontState(prev => ({ ...prev, template: prod.template || prev.template }));
      setBackState(prev => ({ ...prev, template: prod.template || prev.template }));

      // If only one side had a design, do NOT use product-level images for the other side; leave image null
      if (!frontDesign) {
        setFrontState(prev => ({ ...prev, image: null }));
      }
      if (!backDesign) {
        setBackState(prev => ({ ...prev, image: null }));
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
            const res = await fetch(`/api/designs/${savedDesignId}/versions`);
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
          preview_front: frontPreview,
          preview_back: backPreview,
        }
      },
    };

    try {
      const res = await fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
    } catch (e:any) {
      setError('Failed to save design');
    }
  }



  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order: {product.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Place an order for this product — choose size, color and quantity.</p>
        </div>
      </div>
      <Banner />
      {versions && (
        <div className="my-4 p-4 border rounded bg-white">
          <h3 className="font-semibold mb-2">Design Versions (JSON)</h3>
          <pre style={{ maxHeight: 400, overflow: 'auto' }} className="text-xs">{JSON.stringify(versions, null, 2)}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Design</CardTitle>
              <CardDescription>Customize slogan or image for your order (optional)</CardDescription>
              <div className="text-xs text-muted-foreground mt-1">Note: these edits affect only the preview and are not persisted to the product.</div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <button type="button" onClick={() => setSide('front')} className={`px-3 py-1 rounded ${side==='front' ? 'bg-primary text-white' : 'bg-gray-100'}`}>Front Side</button>
                <button type="button" onClick={() => setSide('back')} className={`px-3 py-1 rounded ${side==='back' ? 'bg-primary text-white' : 'bg-gray-100'}`}>Back Side</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Tabs & Controls */}
                <div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <button type="button" onClick={()=>setActiveTab('colors')} className={`px-3 py-1 rounded ${activeTab==='colors' ? 'bg-primary text-white' : 'bg-gray-100'}`}>Colors</button>
                      <button type="button" onClick={()=>setActiveTab('slogan')} disabled={!selectedColor} className={`px-3 py-1 rounded ${activeTab==='slogan' ? 'bg-primary text-white' : 'bg-gray-100'} ${!selectedColor ? 'opacity-50 cursor-not-allowed' : ''}`}>Slogan</button>
                      <button type="button" onClick={()=>setActiveTab('logo')} disabled={!selectedColor} className={`px-3 py-1 rounded ${activeTab==='logo' ? 'bg-primary text-white' : 'bg-gray-100'} ${!selectedColor ? 'opacity-50 cursor-not-allowed' : ''}`}>Logo / Image</button>
                      <button type="button" onClick={()=>setActiveTab('price')} disabled={!selectedColor} className={`px-3 py-1 rounded ${activeTab==='price' ? 'bg-primary text-white' : 'bg-gray-100'} ${!selectedColor ? 'opacity-50 cursor-not-allowed' : ''}`}>Price</button>
                    </div>

                    {activeTab === 'colors' && (
                      <div className="p-4 rounded-lg bg-white shadow-sm border">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium">Available colors</label>
                          <div className="text-xs text-muted-foreground">Pick a base color first</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.colors?.map((cid:number)=>{
                            const c = getColorObj(Number(cid));
                            return (
                              <button key={cid} onClick={()=>{ 
                                setSelectedColor(Number(cid));
                                setFrontState(prev=>({...prev, templateColor: c.hex || prev.templateColor, imageTintColor: c.hex || prev.imageTintColor }));
                                setBackState(prev=>({...prev, templateColor: c.hex || prev.templateColor, imageTintColor: c.hex || prev.imageTintColor }));
                                setActiveTab('slogan');
                              }} className={`p-2 rounded border ${selectedColor===Number(cid)?'ring-2 ring-indigo-400':''}`} title={c.name}>
                                <span className="w-6 h-6 rounded-full block" style={{background:c.hex}} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeTab === 'slogan' && (
                      <div className="p-4 rounded-lg bg-white shadow-sm border">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">Slogan</h3>
                          <div className="text-xs text-muted-foreground">Design text settings</div>
                        </div>

                        <div className="space-y-3">
                          <input
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Add optional slogan"
                            value={slogan}
                            onChange={e => setActiveState({ slogan: e.target.value })}
                          />

                          <div className="flex items-center gap-3">
                            <label className="text-sm font-medium">Color</label>
                            <input type="color" value={color} onChange={e=>setActiveState({ color: e.target.value })} className="w-9 h-9 p-0 rounded border" aria-label="Slogan color" />
                            <div className="text-sm text-muted-foreground">{color}</div>
                            <div className="ml-auto flex items-center gap-2">
                              <button type="button" onClick={()=>setActiveState({ slogan: '' })} className="px-2 py-1 text-xs rounded border hover:bg-gray-50">Clear</button>
                            </div>
                          </div>

                          {slogan && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-medium">Font size</div>
                                  <div className="text-xs font-medium">{textSize}px</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={()=>setActiveState({ textSize: Math.max(8, textSize - 1) })} className="px-2 py-1 rounded border">-</button>
                                  <input type="number" min={8} max={200} value={textSize} onChange={e=>setActiveState({ textSize: Number(e.target.value) || 8 })} className="w-20 text-center border rounded p-1" />
                                  <button type="button" onClick={()=>setActiveState({ textSize: Math.min(200, textSize + 1) })} className="px-2 py-1 rounded border">+</button>
                                  <input type="range" min={8} max={200} value={textSize} onChange={e=>setActiveState({ textSize: Number(e.target.value) })} className="flex-1" />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-medium">Rotation</div>
                                  <div className="text-xs font-medium">{textRotation}°</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={()=>setActiveState({ textRotation: (textRotation - 1 + 360) % 360 })} className="px-2 py-1 rounded border">-</button>
                                  <input type="number" min={0} max={360} value={textRotation} onChange={e=>setActiveState({ textRotation: Number(e.target.value) || 0 })} className="w-20 text-center border rounded p-1" />
                                  <button type="button" onClick={()=>setActiveState({ textRotation: (textRotation + 1) % 360 })} className="px-2 py-1 rounded border">+</button>
                                  <input type="range" min={0} max={360} value={textRotation} onChange={e=>setActiveState({ textRotation: Number(e.target.value) })} className="flex-1" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'logo' && (
                      <div className="p-4 rounded-lg bg-white shadow-sm border">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">Logo / Image</h3>
                          <div className="text-xs text-muted-foreground">Front and back independent</div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <label className="cursor-pointer inline-flex items-center justify-center w-24 h-24 rounded border bg-gray-50 hover:bg-gray-100">
                              <input type="file" accept="image/*" onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  const reader = new FileReader();
                                  reader.onload = async () => {
                                    const result = reader.result as string | null;
                                    if (!result) return;
                                    try {
                                      const res = await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: result, filename: f.name }) });
                                      if (res.ok) {
                                        const js = await res.json();
                                        const url = js?.url || `/attached_assets/${js?.filename}`;
                                        setActiveState({ image: url });
                                        return;
                                      }
                                    } catch (err) {
                                      // ignore and fallback
                                    }
                                    setActiveState({ image: result });
                                  };
                                  reader.readAsDataURL(f);
                                }} className="hidden" />
                              <div className="text-sm text-muted-foreground">Choose Image</div>
                            </label>
                          </div>

                          <div className="flex-1">
                            {image ? (
                              <div className="flex items-start gap-4">
                                <img src={image} alt="logo preview" className="w-24 h-24 object-contain border rounded" />
                                <div className="w-full">
                                  <div className="grid grid-cols-1 gap-3">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="text-sm font-medium">Scale</div>
                                        <div className="text-xs text-muted-foreground">{imageScale}%</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button type="button" onClick={()=>setActiveState({ imageScale: Math.max(1, imageScale - 1) })} className="px-2 py-1 rounded border">-</button>
                                        <input type="number" min={1} max={20} value={imageScale} onChange={e=>setActiveState({ imageScale: Math.max(1, Number(e.target.value) || 1) })} className="w-20 text-center border rounded p-1" />
                                        <button type="button" onClick={()=>setActiveState({ imageScale: Math.min(20, imageScale + 1) })} className="px-2 py-1 rounded border">+</button>
                                        <input type="range" min={1} max={20} step={1} value={imageScale} onChange={e=>setActiveState({ imageScale: Number(e.target.value) })} className="flex-1" />
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="text-sm font-medium">Rotation</div>
                                        <div className="text-xs text-muted-foreground">{imageRotation}°</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button type="button" onClick={()=>setActiveState({ imageRotation: (imageRotation - 1 + 360) % 360 })} className="px-2 py-1 rounded border">-</button>
                                        <input type="number" min={-360} max={360} value={imageRotation} onChange={e=>setActiveState({ imageRotation: Number(e.target.value) || 0 })} className="w-20 text-center border rounded p-1" />
                                        <button type="button" onClick={()=>setActiveState({ imageRotation: (imageRotation + 1) % 360 })} className="px-2 py-1 rounded border">+</button>
                                        <input type="range" min={-360} max={360} value={imageRotation} onChange={e=>setActiveState({ imageRotation: Number(e.target.value) })} className="flex-1" />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button type="button" onClick={()=>setActiveState({ image: null })} className="px-3 py-1 rounded border text-sm">Remove image</button>
                                      <button type="button" onClick={()=>{ setActiveState({ imageScale: 10, imageRotation: 0, imagePosition: { x: 180, y: 180 } }); }} className="px-3 py-1 rounded border text-sm">Reset</button>
                                      <div className="text-xs text-muted-foreground ml-auto">Tip: drag image on preview to reposition</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">No image selected</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'price' && (
                      <div className="p-4 rounded-lg bg-white shadow-sm border">
                        <label className="block text-sm font-medium mb-2">Set price (for this design)</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" step="0.01" value={priceInput} onChange={e=>setPriceInput(Number(e.target.value) || 0)} className="flex-1 border rounded p-1" />
                          <button onClick={saveDesign} className="px-4 py-2 bg-blue-600 text-white rounded">Save Design</button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">Saved price is stored locally for now. Saving stores the design to your account.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Preview */}
                <div className="flex items-center justify-center">
                  <div className="w-[520px] h-[520px] bg-gray-50 rounded p-4 flex items-center justify-center">
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
                      onTextMove={(pos)=>setActiveState({ textPosition: pos })}
                      image={image}
                      imageScale={imageScale}
                      imageRotation={imageRotation}
                      imagePosition={imagePosition}
                      onImageMove={(pos)=>setActiveState({ imagePosition: pos })}
                      width={520}
                      height={520}
                    />
                  </div>
                </div>
                {/* Hidden canvases for exporting front/back previews */}
                <div aria-hidden style={{ height: 0, width: 0, overflow: 'hidden', position: 'absolute' }}>
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
                    imageScale={frontState.imageScale}
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
                    imageScale={backState.imageScale}
                    imageRotation={backState.imageRotation}
                    imagePosition={backState.imagePosition}
                    width={520}
                    height={520}
                    exportCanvasRef={backExportRef}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order panel hidden for suppliers while ordering is disabled. */}
      </div>
    </div>
  );
}