import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Save } from 'lucide-react';
import { DesignCanvas } from '@/components/design/DesignCanvas';

export default function AdminClothes() {
  const { token } = useAuth();
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#000000');
  const [sizeLabel, setSizeLabel] = useState('');
  const [product, setProduct] = useState<'tshirt'|'hoodie'|'women_tshirt'>('tshirt');
  const [message, setMessage] = useState('');
  const [sizeChart, setSizeChart] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  // if editing, productId from query
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Product & local design state for the linear flow
  const [productName, setProductName] = useState('');
  const [productSaved, setProductSaved] = useState(false);

  // Sections enabled when product is saved OR a product name is present (allows continuing without saving immediately)
  const sectionsEnabled = productSaved || productName.trim() !== '';

  const [designSide, setDesignSide] = useState<'front'|'back'>('front');
  const [designs, setDesigns] = useState<any>({
    front: { image: null as string | null, imageScale: 100, imageRotation: 0, imagePosition: { x: 180, y: 180 }, slogan: '', color: '#000000', template: 'tshirt' },
    back: { image: null as string | null, imageScale: 100, imageRotation: 0, imagePosition: { x: 180, y: 180 }, slogan: '', color: '#000000', template: 'tshirt' }
  });
  const [frontFilename, setFrontFilename] = useState<string | null>(null);
  const [backFilename, setBackFilename] = useState<string | null>(null);

  // Selections for sizes and colors for this product (local only) 
  const [selectedSizes, setSelectedSizes] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);

  // Pricing (local only)
  const [singlePrice, setSinglePrice] = useState<number | ''>('');
  const [bulkMin, setBulkMin] = useState<number>(100);
  const [bulkPrice, setBulkPrice] = useState<number | ''>('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); loadEditingProduct(); }, [token, product]);
  async function fetchData() {
    setError(null);
    try {
      // colors and sizes are global
      const c = await fetch('/api/admin/colors', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (c.ok) setColors(await c.json()); else throw new Error('Failed to load colors');

      const s = await fetch('/api/admin/sizes', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (s.ok) setSizes(await s.json()); else throw new Error('Failed to load sizes');

      // fetch size chart for selected product
      const sc = await fetch(`/api/admin/size-chart?product=${encodeURIComponent(product)}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (sc.ok) setSizeChart(await sc.json()); else setSizeChart([]);

      const inv = await fetch('/api/admin/inventory', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (inv.ok) {
        const data = await inv.json();
        setInventory(data.inventory || []);
      } else {
        setInventory([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin data');
    }
  }

  // load product for editing if productId query param present
  async function loadEditingProduct() {
    try {
      const params = new URLSearchParams(window.location.search);
      const idStr = params.get('productId');
      if (!idStr) return;
      const id = Number(idStr);
      if (!id) return;
      setEditingProductId(id);

      const res = await fetch(`/api/admin/products/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) return;
      const p = await res.json();

      // populate form fields
      setProductName(p.name || '');
      setSinglePrice(p.single_price ?? 0);
      setBulkMin(p.bulk_min ?? 100);
      setBulkPrice(p.bulk_price ?? 0);
      setSelectedSizes(p.sizes || []);
      setSelectedColors(p.colors || []);

      // size chart
      setSizeChart(p.sizeChart || []);

      // populate designs: map returned designs (ordered) into front/back
      const designsMap: any = { front: { image: null, imageScale: 100, imageRotation: 0, imagePosition: { x: 180, y: 180 }, slogan: '', color: '#000000', template: 'tshirt' }, back: { image: null, imageScale: 100, imageRotation: 0, imagePosition: { x: 180, y: 180 }, slogan: '', color: '#000000', template: 'tshirt' } };
      if (Array.isArray(p.designs) && p.designs.length) {
        // assume first is front, second is back
        const normalizeImage = (raw: any) => {
          if (!raw) return null;
          let img = raw.image || raw.image_data || raw.file_name || raw.filename || raw.image_url || raw.image_src || raw.back_image || null;
          if (!img && typeof raw === 'string') img = raw;
          if (!img) return null;
          img = String(img);
          // If just a filename like 'white-bg.jpg', prefix attached_assets
          if (!img.startsWith('data:') && !img.startsWith('http') && !img.startsWith('/')) {
            img = `/attached_assets/${img}`;
          }
          return img;
        };

        if (p.designs[0]) {
          const row = p.designs[0];
          designsMap.front = {
            image: normalizeImage(row),
            imageScale: Number(row.image_scale || row.imageScale || 100),
            imageRotation: Number(row.image_rotation || row.imageRotation || 0),
            imagePosition: row.image_position || row.imagePosition || { x: 180, y: 180 },
            slogan: row.slogan || '',
            color: row.color || '#000000',
            template: row.template || 'tshirt'
          };
        }
        if (p.designs[1]) {
          const row = p.designs[1];
          designsMap.back = {
            image: normalizeImage(row),
            imageScale: Number(row.image_scale || row.imageScale || 100),
            imageRotation: Number(row.image_rotation || row.imageRotation || 0),
            imagePosition: row.image_position || row.imagePosition || { x: 180, y: 180 },
            slogan: row.slogan || '',
            color: row.color || '#000000',
            template: row.template || 'tshirt'
          };
        }
      }
      setDesigns(designsMap);
      setFrontFilename(designsMap.front.image ? 'front-image' : null);
      setBackFilename(designsMap.back.image ? 'back-image' : null);
      // ensure preview shows front when loading
      setDesignSide('front');
      setProductSaved(true);
    } catch (e) {
      // ignore load errors silently
    }
  }

  async function addColor(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/colors', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ name: colorName, hex: colorHex }) });
    if (!res.ok) setMessage((await res.json()).message || 'Error');
    else { setColorName(''); setColorHex('#000000'); await fetchData(); setMessage('Added color'); }
  }

  async function addSize(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError(null);
    const res = await fetch('/api/admin/sizes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ label: sizeLabel }) });
    if (!res.ok) {
      const js = await res.json().catch(() => ({}));
      setError(js.message || 'Error adding size');
    } else { setSizeLabel(''); await fetchData(); setMessage('Added size'); }
  }

  async function saveSizeChart(size_id: number, chest: string, length: string, shoulder: string) {
    setMessage('');
    setError(null);
    const res = await fetch('/api/admin/size-chart', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ product, size_id, chest, length, shoulder }) });
    if (!res.ok) {
      const js = await res.json().catch(() => ({}));
      setError(js.message || 'Error saving size chart');
    } else { setMessage('Saved size chart'); await fetchData(); }
  }

  async function deleteSize(size_id: number) {
    if (!confirm('Delete size? This will remove it from all products.')) return;
    const res = await fetch('/api/admin/sizes/' + size_id, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (!res.ok) setError('Failed to delete size'); else { setMessage('Size deleted'); await fetchData(); }
  }

  async function deleteSizeChartRow(size_id: number) {
    if (!confirm('Remove size chart entry for this product?')) return;
    const res = await fetch(`/api/admin/size-chart?product=${encodeURIComponent(product)}&size_id=${size_id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (!res.ok) setError('Failed to delete size chart'); else { setMessage('Size chart removed for product'); await fetchData(); }
  }

  async function upsertInventoryRow(color_id: number, size_id: number, quantity: number, price: number, product: string = 'tshirt') {
    setMessage('');
    const res = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ product, color_id, size_id, quantity, price }) });
    if (!res.ok) setMessage('Error updating inventory');
    else { setMessage('Inventory updated'); await fetchData(); }
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Set product name first');
      return;
    }

    setError(null);

    // Collect size chart values from inputs
    const sizeChartPayload = sizes.map(s => {
      const chest = (document.getElementById(`chest-${s.id}`) as HTMLInputElement)?.value || '';
      const length = (document.getElementById(`length-${s.id}`) as HTMLInputElement)?.value || '';
      const shoulder = (document.getElementById(`shoulder-${s.id}`) as HTMLInputElement)?.value || '';
      return { size_id: s.id, chest: chest === '' ? null : Number(chest), length: length === '' ? null : Number(length), shoulder: shoulder === '' ? null : Number(shoulder) };
    }).filter(sc => sc.chest !== null || sc.length !== null || sc.shoulder !== null);

    const payload = {
      name: productName,
      single_price: singlePrice === '' ? 0 : Number(singlePrice),
      bulk_min: bulkMin,
      bulk_price: bulkPrice === '' ? 0 : Number(bulkPrice),
      sizes: selectedSizes,
      colors: selectedColors,
      designs: designs,
      sizeChart: sizeChartPayload,
    };

    try {
      let res;
      if (editingProductId) {
        res = await fetch(`/api/admin/products/${editingProductId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) });
      }

      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        setError(js.message || 'Failed to save product');
      } else {
        const data = await res.json();
        setMessage('Product saved to DB');
        setProductSaved(true);
        // optionally refresh size chart
        const scRes = await fetch(`/api/admin/size-chart?product=${encodeURIComponent(data.slug)}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (scRes.ok) setSizeChart(await scRes.json());
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Product</h1>
        <p className="text-sm text-muted-foreground mt-1">Follow the steps to create a product, design front/back, assign sizes & colors, and define pricing.</p>
      </div>

      <form onSubmit={handleSaveAll}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Product Configuration</CardTitle>
            <CardDescription>Define the product, design front/back, select sizes & colors, and set pricing — then save in one step.</CardDescription>
          </CardHeader>

          <CardContent>
            <section className="mb-6">
              <h3 className="font-semibold mb-2">1. Product</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Product name" className="col-span-1 sm:col-span-3 border px-3 py-2 rounded" />
                <div className="sm:col-span-3">
                  {!productSaved && <div className="text-sm text-muted-foreground mt-2">Later sections are disabled until product is saved (use the Save Product Configuration button below).</div>}
                  {productSaved && <div className="text-sm text-green-600 mt-2">Product saved: <strong>{productName}</strong></div>}
                </div>
              </div>
            </section> 

            <section className="mb-6">
              <h3 className="font-semibold mb-2">2. Design</h3>
              <div className={`${sectionsEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <button type="button" onClick={() => setDesignSide('front')} className={`px-3 py-1 rounded ${designSide==='front' ? 'bg-slate-100' : ''}`}>Front</button>
                  <button type="button" onClick={() => setDesignSide('back')} className={`px-3 py-1 rounded ${designSide==='back' ? 'bg-slate-100' : ''}`}>Back</button>
                  <div className="ml-auto text-sm text-muted-foreground">Design side: {designSide}</div>
                </div> 

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Front image</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setFrontFilename(f.name);
                  // make sure preview shows front side
                  setDesignSide('front');
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                      const maxDim = 360 * 0.7;
                      const scalePct = Math.max(10, Math.min(200, Math.round((maxDim / Math.max(img.width, img.height)) * 100)));
                      setDesigns((d: any) => ({ ...d, front: { ...d.front, image: dataUrl, imageScale: scalePct, imagePosition: { x: 180, y: 180 } } }));
                    };
                    img.src = dataUrl;
                  };
                  reader.readAsDataURL(f);
                }} />
                {frontFilename && <div className="text-sm text-muted-foreground mt-2">{frontFilename}</div>}

                <label className="block text-sm font-medium mt-4 mb-1">Back image</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBackFilename(f.name);
                  // make sure preview shows back side
                  setDesignSide('back');
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                      const maxDim = 360 * 0.7;
                      const scalePct = Math.max(10, Math.min(200, Math.round((maxDim / Math.max(img.width, img.height)) * 100)));
                      setDesigns((d: any) => ({ ...d, back: { ...d.back, image: dataUrl, imageScale: scalePct, imagePosition: { x: 180, y: 180 } } }));
                    };
                    img.src = dataUrl;
                  };
                  reader.readAsDataURL(f);
                }} />
                {backFilename && <div className="text-sm text-muted-foreground mt-2">{backFilename}</div>}

                <div className="text-sm text-muted-foreground mt-3">Canvas background: <strong>Default plain white</strong></div>


              </div>

              <div>
                <div className="border rounded-lg p-3 bg-white">
                  <DesignCanvas
                    side={designSide}
                    slogan={designs[designSide].slogan}
                    color={designs[designSide].color}
                    template={designs[designSide].template}
                    image={designs[designSide].image}
                    imageScale={designs[designSide].imageScale}
                    imageRotation={designs[designSide].imageRotation}
                    imagePosition={designs[designSide].imagePosition}
                    width={360}
                    height={360}
                  />
                </div>
              </div>
            </div>
          </div>
            </section>

            {/* 3. Sizes / Colors / Size Chart */} 
            <section className="mb-6">
              <h3 className="font-semibold mb-2">3. Sizes & Colors</h3>
              <div className={`${sectionsEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
              <div>
                <h4 className="font-medium mb-2">Sizes</h4>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(s => (
                    <label key={s.id} className={`border rounded px-3 py-1 ${selectedSizes.includes(s.id) ? 'bg-slate-100' : ''}`}>
                      <input type="checkbox" className="mr-2" checked={selectedSizes.includes(s.id)} onChange={() => {
                        setSelectedSizes(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]);
                      }} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Colors</h4>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <label key={c.id} className={`border rounded px-3 py-1 flex items-center gap-2 ${selectedColors.includes(c.id) ? 'bg-slate-100' : ''}`}>
                      <input type="checkbox" className="mr-2" checked={selectedColors.includes(c.id)} onChange={() => {
                        setSelectedColors(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]);
                      }} />
                      <span className="w-3 h-3 rounded" style={{ background: c.hex }} /> {c.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-medium mb-2">Size Chart ({product.replace('_', ' ')})</h4>
              {/* Reuse existing size-chart table unchanged for logic */}
              {sizes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No sizes configured yet. Add sizes above to edit the size chart.</div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="table-auto w-full text-left">
                    <thead>
                      <tr className="bg-gray-50"><th className="px-3 py-2">Size</th><th className="px-3 py-2">Chest</th><th className="px-3 py-2">Length</th><th className="px-3 py-2">Shoulder</th></tr>
                    </thead>
                    <tbody>
                      {sizes.map(s => {
                        const sc = sizeChart.find(x => x.size_id === s.id) || {};
                        return (
                          <tr key={s.id} className="border-b">
                            <td className="px-3 py-2">{s.label}</td>
                            <td className="px-3 py-2"><input className="w-36 border px-2 py-1 rounded" defaultValue={sc.chest || ''} id={`chest-${s.id}`} /></td>
                            <td className="px-3 py-2"><input className="w-36 border px-2 py-1 rounded" defaultValue={sc.length || ''} id={`length-${s.id}`} /></td>
                            <td className="px-3 py-2"><input className="w-36 border px-2 py-1 rounded" defaultValue={sc.shoulder || ''} id={`shoulder-${s.id}`} /></td>
                            {/* Actions removed: size chart entries are saved when 'Save Product Configuration' is clicked */}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="text-sm text-muted-foreground mt-3">Note: size chart edits are saved when you click "Save Product Configuration".</div>
                </>
              )}
            </div>
          </div>
            </section>

            {/* 4. Pricing */} 
            <section className="mb-6">
              <h3 className="font-semibold mb-2">4. Pricing</h3>
              <div className={`${sectionsEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">Single unit price</label>
                    <input type="number" value={singlePrice as any} onChange={e => setSinglePrice(e.target.value === '' ? '' : Number(e.target.value))} className="border px-3 py-2 rounded w-full" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bulk minimum qty</label>
                    <input type="number" value={bulkMin} onChange={e => setBulkMin(Number(e.target.value))} className="border px-3 py-2 rounded w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bulk price</label>
                    <input type="number" value={bulkPrice as any} onChange={e => setBulkPrice(e.target.value === '' ? '' : Number(e.target.value))} className="border px-3 py-2 rounded w-full" placeholder="0.00" />
                  </div>
                </div>

              </div>
            </section>
          </CardContent>

            <CardFooter>
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded"><Save className="h-4 w-4" /> Save Product Configuration</button>
            </CardFooter>
          </Card>
        </form>

      {message && <div className="text-sm text-green-600 mt-4">{message}</div>}
      {error && <div className="text-sm text-red-600 mt-4">{error}</div>}
    </div>
  );
}