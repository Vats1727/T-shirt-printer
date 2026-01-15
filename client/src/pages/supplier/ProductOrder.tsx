import React, { useEffect, useState } from 'react';
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
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // design state (per-side similar to Home)
  const [side, setSide] = useState<'front'|'back'>('front');

  const baseState = {
    slogan: '',
    color: '#7c3aed',
    templateColor: '#ffffff',
    textSize: 24,
    textRotation: 0,
    textPosition: { x: 180, y: 180 },
    image: null as string | null,
    imageMask: null as string | null,
    imageScale: 50,
    imageRotation: 0,
    imagePosition: { x: 180, y: 180 },
    template: product?.template || 'tshirt',
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
  const textSize = activeState.textSize;
  const textRotation = activeState.textRotation;
  const textPosition = activeState.textPosition;
  const image = activeState.image;
  const imageScale = activeState.imageScale;
  const imageRotation = activeState.imageRotation;
  const imagePosition = activeState.imagePosition;
  const template = activeState.template;

  const [orderType, setOrderType] = useState<'single'|'bulk'>('single');

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
      setProduct(prod || null);
      // DEBUG: log product to console to inspect image/image_mask presence
      try { console.debug('SupplierProductOrder: loaded product', prod); } catch (e) {}
      if (!prod) return;

      // default select first available color/size
      if (prod.colors && prod.colors.length) setSelectedColor(Number(prod.colors[0]));
      if (prod.sizes && prod.sizes.length) setSelectedSize(Number(prod.sizes[0]));

      // initialize per-side states from admin designs (front/back)
      // Prefer normalized server-provided front/back fields, then fall back to array-based designs
      let frontDesign: any = null;
      let backDesign: any = null;

      if (prod.designs && !Array.isArray(prod.designs)) {
        frontDesign = prod.designs.front || null;
        backDesign = prod.designs.back || null;
      } else {
        const designsArr = Array.isArray(prod.designs) ? prod.designs : [];
        frontDesign = designsArr.find((d:any)=> (d.side||'').toLowerCase()==='front') || designsArr[0] || null;
        backDesign = designsArr.find((d:any)=> (d.side||'').toLowerCase()==='back') || null;
      }

      // If still missing, use top-level product fields exported by server
      if (!frontDesign && prod.front_image) {
        frontDesign = { image: prod.front_image, image_mask: prod.front_image_mask || null };
      }
      if (!backDesign && prod.back_image) {
        backDesign = { image: prod.back_image, image_mask: prod.back_image_mask || null };
      }

      const firstColorHex = (prod.colors && prod.colors.length && data && data.colors) ? (data.colors.find((c:any)=> Number(c.id)===Number(prod.colors[0]))?.hex) : undefined;

      if (frontDesign) {
        // prefer admin-provided images, but skip loading template/background assets (they will be shown as templateColor instead)
        let img = normalizeImage(frontDesign);
        const isTemplateAsset = img && (img === '/attached_assets/white-bg.jpg' || img.includes('/templates/'));
        if (isTemplateAsset) img = null;

        setFrontState(prev => ({
          ...prev,
          slogan: frontDesign.slogan || prev.slogan,
          image: img || prev.image,
          imageMask: (frontDesign.image_mask || frontDesign.mask || null) || prev.imageMask,
          imageScale: frontDesign.image_scale ? Number(frontDesign.image_scale) : prev.imageScale,
          imageRotation: frontDesign.image_rotation ? Number(frontDesign.image_rotation) : prev.imageRotation,
          imagePosition: frontDesign.image_position || prev.imagePosition,
          textSize: frontDesign.text_size ? Number(frontDesign.text_size) : prev.textSize,
          textRotation: frontDesign.text_rotation ? Number(frontDesign.text_rotation) : prev.textRotation,
          textPosition: frontDesign.text_position || prev.textPosition,
          template: prod.template || prev.template,
          templateColor: frontDesign.template_color || frontDesign.templateColor || firstColorHex || prev.templateColor,
          color: frontDesign.color || firstColorHex || prev.color,
        }));
      }

      if (backDesign) {
        let img = normalizeImage(backDesign);
        const isTemplateAsset = img && (img === '/attached_assets/white-bg.jpg' || img.includes('/templates/'));
        if (isTemplateAsset) img = null;
        setBackState(prev => ({
          ...prev,
          slogan: backDesign.slogan || prev.slogan,
          image: img || prev.image,          imageMask: (backDesign.back_image_mask || backDesign.image_mask || backDesign.mask || null) || prev.imageMask,          imageScale: backDesign.image_scale ? Number(backDesign.image_scale) : prev.imageScale,
          imageRotation: backDesign.image_rotation ? Number(backDesign.image_rotation) : prev.imageRotation,
          imagePosition: backDesign.image_position || prev.imagePosition,
          textSize: backDesign.text_size ? Number(backDesign.text_size) : prev.textSize,
          textRotation: backDesign.text_rotation ? Number(backDesign.text_rotation) : prev.textRotation,
          textPosition: backDesign.text_position || prev.textPosition,
          template: prod.template || prev.template,
          templateColor: backDesign.template_color || backDesign.templateColor || firstColorHex || prev.templateColor,
          color: backDesign.color || firstColorHex || prev.color,
        }));
      }

      // if no designs provided, set template + color defaults
      if (!frontDesign && !backDesign) {
        setFrontState(prev => ({ ...prev, template: prod.template || prev.template, templateColor: firstColorHex || prev.templateColor }));
        setBackState(prev => ({ ...prev, template: prod.template || prev.template, templateColor: firstColorHex || prev.templateColor }));
      }
    };

    load();
  }, [id, token]);

  if (!product) return <div className="p-6">Product not found</div>;

  const getSizeLabel = (sid: number) => catalog.sizes.find((s:any)=>s.id===sid)?.label || sid;
  const getColorObj = (cid: number) => (catalog && catalog.colors ? catalog.colors.find((c:any)=> Number(c.id) === Number(cid)) : null) || {name: 'Unknown', hex: '#ccc'};

  async function placeOrder() {
    if (!selectedColor || !selectedSize || quantity <= 0) return alert('Choose color, size and quantity');
    const items = [{ product: product.slug || product.name || 'tshirt', color_id: selectedColor, size_id: selectedSize, quantity, price: Number(product.single_price || 0) }];
    const res = await fetch('/api/supplier/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ items }) });
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



  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order: {product.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Place an order for this product — choose size, color and quantity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
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
                <div>
                  <label className="block text-sm font-medium mb-2">Slogan</label>
                  <Input value={slogan} onChange={e=>{ setActiveState({ slogan: e.target.value }); }} placeholder="Add optional slogan" />

                  {slogan && (
                    <div className="space-y-3 pl-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Font size</span>
                        <span className="text-xs font-bold text-primary">{textSize}px</span>
                      </div>
                      <input type="range" min={12} max={64} value={textSize} onChange={e=>setActiveState({ textSize: Number(e.target.value) })} />

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-sm font-medium text-muted-foreground">Rotation</span>
                        <span className="text-xs font-bold text-primary">{textRotation}°</span>
                      </div>
                      <input type="range" min={0} max={360} value={textRotation} onChange={e=>setActiveState({ textRotation: Number(e.target.value) })} />
                    </div>
                  )}

                  {/* Image upload and image controls are disabled for supplier preview (design-only). */}

                  <label className="block text-sm font-medium mt-4 mb-2">Color (admin options)</label>
                  <div className="flex flex-wrap gap-2">
                    {product.colors?.map((cid:number)=>{
                      const c = getColorObj(Number(cid));
                      return <button key={cid} onClick={()=>{ setSelectedColor(Number(cid)); setFrontState(prev=>({...prev, color:c.hex || prev.color})); setBackState(prev=>({...prev, color:c.hex || prev.color})); }} className={`p-2 rounded border ${selectedColor===Number(cid)?'ring-2 ring-indigo-400':''}`} title={c.name}><span className="w-6 h-6 rounded-full block" style={{background:c.hex}} /></button>
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-80 h-80 bg-gray-50 rounded p-4 flex items-center justify-center">
                    <DesignCanvas
                      side={side}
                      slogan={slogan}
                      color={color}
                      template={template || product.template || 'tshirt'}
                      showTemplate={false}
                      tintImage={true}
                      textSize={textSize}
                      textRotation={textRotation}
                      textPosition={textPosition}
                      onTextMove={(pos)=>setActiveState({ textPosition: pos })}
                      image={image}                      imageMask={activeState.imageMask}                      imageScale={imageScale}
                      imageRotation={imageRotation}
                      imagePosition={imagePosition}
                      onImageMove={(pos)=>setActiveState({ imagePosition: pos })}
                      width={320}
                      height={320}
                    />
                  </div>
                </div>

                {/* DEBUG: show fetched product JSON for quick inspection */}
                {product && (
                  <div className="mt-4 p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium text-sm mb-2">DEBUG: product JSON</div>
                    <pre className="overflow-auto max-h-40 text-[11px]">{JSON.stringify(product, null, 2)}</pre>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle>Order</CardTitle>
              <CardDescription>Choose size, color and quantity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="text-sm mb-1">Single unit</div>
                <div className="text-lg font-semibold">${Number(product.single_price || 0).toFixed(2)}</div>
                <div className="text-sm text-muted-foreground mt-2">Bulk minimum qty: <strong>{product.bulk_min || 0}</strong></div>
                <div className="text-sm text-muted-foreground">Bulk price: <strong>${Number(product.bulk_price || 0).toFixed(2)}</strong></div>
              </div>

              <div className="mb-3">
                <div className="text-sm mb-1">Available colors</div>
                <div className="flex flex-wrap gap-2">
                  {product.colors?.map((cid:number)=>{
                    const c = getColorObj(Number(cid));
                    return <button key={cid} onClick={()=>{ setSelectedColor(Number(cid)); setFrontState(prev=>({...prev, color: c.hex || prev.color})); setBackState(prev=>({...prev, color: c.hex || prev.color})); }} className={`p-2 rounded border ${selectedColor===Number(cid)?'ring-2 ring-indigo-400':''}`} title={c.name}><span className="w-6 h-6 rounded-full block" style={{background:c.hex}} /></button>
                  })}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-sm mb-1">Sizes</div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes?.map((sid:number)=>{
                    return <button key={sid} onClick={()=>setSelectedSize(Number(sid))} className={`px-3 py-1 rounded border ${selectedSize===Number(sid)?'bg-indigo-50':''}`}>{getSizeLabel(Number(sid))}</button>
                  })}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-sm mb-1">Size chart</div>
                <div className="text-sm text-muted-foreground">
                  {product.sizeChart?.length ? (
                    product.sizeChart.map((sc:any)=> (<div key={sc.size_id} className="border-b py-1">{(catalog.sizes.find((s:any)=>s.id===sc.size_id)?.label) || sc.size_id}: chest {sc.chest}, length {sc.length}, shoulder {sc.shoulder}</div>))
                  ) : 'No size chart available'}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-sm mb-1">Order type</div>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setOrderType('single')} className={`px-3 py-1 rounded border ${orderType==='single' ? 'bg-indigo-50' : ''}`}>Single unit</button>
                  <button type="button" onClick={() => setOrderType('bulk')} className={`px-3 py-1 rounded border ${orderType==='bulk' ? 'bg-indigo-50' : ''}`}>Bulk (min {product.bulk_min || 1})</button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full flex gap-2">
                <button onClick={placeOrder} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded">Place Order</button>
              </div>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </div>
  );
}