import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Save, ArrowLeft, Upload, CheckCircle, Package, Ruler, Palette, DollarSign } from 'lucide-react';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import { useToast } from '@/hooks/use-toast';

export default function AdminClothes() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#000000');
  const [sizeLabel, setSizeLabel] = useState('');
  const [product, setProduct] = useState<'tshirt'|'hoodie'|'women_tshirt'>('tshirt');
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
  const [activeTab, setActiveTab] = useState<'product'|'design'|'sizes'|'pricing'>('product');
  const [designs, setDesigns] = useState<any>({
    front: { image: null as string | null, imageScale: 100, imageRotation: 0, imagePosition: { x: 200, y: 200 }, slogan: '', color: '#000000', template: 'tshirt' },
    back: { image: null as string | null, imageScale: 100, imageRotation: 0, imagePosition: { x: 200, y: 200 }, slogan: '', color: '#000000', template: 'tshirt' }
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
      // populate designs: map returned designs (ordered) into front/back
      const designsMap: any = { 
        front: { image: null, imageScale: 100, imageRotation: 0, imagePosition: { x: 200, y: 200 }, slogan: '', color: '#000000', template: 'tshirt' }, 
        back: { image: null, imageScale: 100, imageRotation: 0, imagePosition: { x: 200, y: 200 }, slogan: '', color: '#000000', template: 'tshirt' } 
      };
      
      const rawDesigns = p.designs;
      if (rawDesigns) {
        const normalizeImage = (raw: any) => {
          if (!raw) return null;
          let img = raw.image || raw.image_data || raw.file_name || raw.filename || raw.image_url || raw.image_src || raw.back_image || null;
          if (!img && typeof raw === 'string') img = raw;
          if (!img) return null;
          img = String(img);
          if (!img.startsWith('data:') && !img.startsWith('http') && !img.startsWith('/')) {
            img = `/attached_assets/${img}`;
          }
          return img;
        };

        const mapRow = (row: any) => ({
          image: normalizeImage(row),
          imageScale: Number(row.image_scale || row.imageScale || 100),
          imageRotation: Number(row.image_rotation || row.imageRotation || 0),
          imagePosition: row.image_position || row.imagePosition || { x: 200, y: 200 },
          slogan: row.slogan || '',
          color: row.color || '#000000',
          template: row.template || 'tshirt'
        });

        if (Array.isArray(rawDesigns)) {
          // Handle array format
          const front = rawDesigns.find((d: any) => d && d.side === 'front');
          const back = rawDesigns.find((d: any) => d && d.side === 'back');
          if (front) designsMap.front = mapRow(front);
          if (back) designsMap.back = mapRow(back);
          
          // Fallback if sides aren't labeled
          if (!front && rawDesigns[0]) designsMap.front = mapRow(rawDesigns[0]);
          if (!back && rawDesigns[1]) designsMap.back = mapRow(rawDesigns[1]);
        } else if (typeof rawDesigns === 'object') {
          // Handle object format
          if (rawDesigns.front) designsMap.front = mapRow(rawDesigns.front);
          if (rawDesigns.back) designsMap.back = mapRow(rawDesigns.back);
        }
        
        // If we loaded multipliers (0-1), convert to percentages (0-100+) for UI sliders
        if (designsMap.front.image && designsMap.front.imageScale <= 1.5) designsMap.front.imageScale *= 100;
        else if (!designsMap.front.image && designsMap.front.imageScale <= 1.5) designsMap.front.imageScale = 100;
        if (designsMap.back.image && designsMap.back.imageScale <= 1.5) designsMap.back.imageScale *= 100;
        else if (!designsMap.back.image && designsMap.back.imageScale <= 1.5) designsMap.back.imageScale = 100;
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
    const res = await fetch('/api/admin/colors', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ name: colorName, hex: colorHex }) });
    if (!res.ok) {
      const js = await res.json().catch(() => ({}));
      setError(js.message || 'Error adding color');
    }
    else { 
      setColorName(''); 
      setColorHex('#000000'); 
      await fetchData(); 
      toast({ title: 'Success', description: 'New color added successfully.' });
    }
  }

  async function addSize(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/sizes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ label: sizeLabel }) });
    if (!res.ok) {
      const js = await res.json().catch(() => ({}));
      setError(js.message || 'Error adding size');
    } else { 
      setSizeLabel(''); 
      await fetchData(); 
      toast({ title: 'Success', description: 'New size added successfully.' });
    }
  }

  async function saveSizeChart(size_id: number, chest: string, length: string, shoulder: string) {
    setError(null);
    const res = await fetch('/api/admin/size-chart', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ product, size_id, chest, length, shoulder }) });
    if (!res.ok) {
      const js = await res.json().catch(() => ({}));
      setError(js.message || 'Error saving size chart');
    } else { 
      toast({ title: 'Success', description: 'Size chart updated successfully.' });
      await fetchData(); 
    }
  }

  async function deleteSize(size_id: number) {
    if (!confirm('Delete size? This will remove it from all products.')) return;
    const res = await fetch('/api/admin/sizes/' + size_id, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (!res.ok) setError('Failed to delete size'); 
    else { 
      toast({ title: 'Deleted', description: 'Size has been removed.' });
      await fetchData(); 
    }
  }

  async function deleteSizeChartRow(size_id: number) {
    if (!confirm('Remove size chart entry for this product?')) return;
    const res = await fetch(`/api/admin/size-chart?product=${encodeURIComponent(product)}&size_id=${size_id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (!res.ok) setError('Failed to delete size chart'); 
    else { 
      toast({ title: 'Removed', description: 'Size chart entry for this product removed.' });
      await fetchData(); 
    }
  }

  async function upsertInventoryRow(color_id: number, size_id: number, quantity: number, price: number, product: string = 'tshirt') {
    const res = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ product, color_id, size_id, quantity, price }) });
    if (!res.ok) setError('Error updating inventory');
    else { 
      toast({ title: 'Updated', description: 'Inventory stock levels saved.' });
      await fetchData(); 
    }
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Set product name first');
      return;
    }

    setError(null);

    // Collect size chart values from inputs
    const sizeChartPayload = sizes.map((s: any) => {
      const chest = (document.getElementById(`chest-${s.id}`) as HTMLInputElement)?.value || '';
      const length = (document.getElementById(`length-${s.id}`) as HTMLInputElement)?.value || '';
      const shoulder = (document.getElementById(`shoulder-${s.id}`) as HTMLInputElement)?.value || '';
      return { size_id: s.id, chest: chest === '' ? null : Number(chest), length: length === '' ? null : Number(length), shoulder: shoulder === '' ? null : Number(shoulder) };
    }).filter((sc: any) => sc.chest !== null || sc.length !== null || sc.shoulder !== null);

    const payload = {
      name: productName,
      single_price: singlePrice === '' ? 0 : Number(singlePrice),
      bulk_min: bulkMin,
      bulk_price: bulkPrice === '' ? 0 : Number(bulkPrice),
      sizes: selectedSizes,
      colors: selectedColors,
      designs: {
        front: { ...designs.front, imageScale: designs.front.imageScale / 100 },
        back: { ...designs.back, imageScale: designs.back.imageScale / 100 }
      },
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
        setProductSaved(true);
        setSizeChart(data.sizeChart || data.size_chart || []);
        
        toast({ 
          title: editingProductId ? 'Product Updated' : 'Product Created', 
          description: editingProductId ? 'Changes saved successfully.' : 'New product added to catalog.' 
        });

        // Redirect to dashboard after saving
        setTimeout(() => {
          setLocation('/admin/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create Product</h1>
          <p className="text-sm text-muted-foreground mt-1">Follow the steps to create a product, design front/back, assign sizes & colors, and define pricing.</p>
        </div>
        <div>
          <button type="button" onClick={() => setLocation('/admin/dashboard')} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAll}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: main form (wider) */}
          <div className="lg:col-span-2">
            <Card className="mb-6 shadow-lg border overflow-hidden">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  Create / Edit Product
                </CardTitle>
                <CardDescription>
                  Complete product details, upload front/back designs, select sizes & colors, and set pricing.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                {/* Tabs */}
                <div className="mb-8 border-b">
                  <nav className="flex gap-1">
                    <button type="button" onClick={() => setActiveTab('product')} className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab==='product' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Product</button>
                    <button type="button" onClick={() => setActiveTab('design')} className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab==='design' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Design</button>
                    <button type="button" onClick={() => setActiveTab('sizes')} className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab==='sizes' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Sizes</button>
                    <button type="button" onClick={() => setActiveTab('pricing')} className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${activeTab==='pricing' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Pricing</button>
                  </nav>
                </div>

                {/* Product tab */}
                <div hidden={activeTab !== 'product'}>
                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-600" />
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Product Name</label>
                        <input 
                          value={productName} 
                          onChange={e => setProductName(e.target.value)} 
                          placeholder="e.g. Classic Oversized Hoodie" 
                          className="w-full border px-4 py-3 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                        />
                      </div>
                      <div className="sm:col-span-3">
                        {!productSaved && <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md font-medium inline-block">Later sections will be enabled once you save or provide a name.</div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Design tab */}
                <div hidden={activeTab !== 'design'}>
                  <section className="mb-6">
                    <h3 className="font-semibold mb-2">Design uploads</h3>
                    <div className={`${sectionsEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
                      <div className="grid grid-cols-1 gap-6 mt-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700">Front Design</label>
                          <div className="flex items-center gap-4">
                            <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md text-sm">
                              <Upload className="h-4 w-4" />
                              Upload Front Image
                              <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setDesignSide('front');
                                const reader = new FileReader();
                                  reader.onload = async () => {
                                    const dataUrl = reader.result as string;
                                    try {
                                      const res = await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ dataUrl, filename: f.name }) });
                                      if (res.ok) {
                                        const js = await res.json();
                                        const url = js?.url || `/attached_assets/${js?.filename}`;
                                        const img = new Image();
                                        img.onload = () => {
                                          const aspectRatio = img.height / img.width;
                                          // Fits the image within a 400x400 coordinate space (90% coverage)
                                          const fitScale = Math.min(0.9, 0.9 / aspectRatio);
                                          const scalePct = Math.round(fitScale * 100);
                                          setDesigns((d: any) => ({ ...d, front: { ...d.front, image: url, imageScale: scalePct, imagePosition: { x: 200, y: 200 } } }));
                                        };
                                        img.onerror = () => {
                                          const fimg = new Image();
                                          fimg.onload = () => {
                                            const aspectRatio = fimg.height / fimg.width;
                                            const fitScale = Math.min(0.9, 0.9 / aspectRatio);
                                            const scalePct = Math.round(fitScale * 100);
                                            setDesigns((d: any) => ({ ...d, front: { ...d.front, image: dataUrl, imageScale: scalePct, imagePosition: { x: 200, y: 200 } } }));
                                          };
                                          fimg.src = dataUrl;
                                        };
                                        img.src = url;
                                        return;
                                      }
                                    } catch (err) {}
                                    const img = new Image(); img.onload = () => { const aspectRatio = img.height / img.width; const fitScale = Math.min(0.9, 0.9 / aspectRatio); const scalePct = Math.round(fitScale * 100); setDesigns((d: any) => ({ ...d, front: { ...d.front, image: dataUrl, imageScale: scalePct, imagePosition: { x: 200, y: 200 } } })); }; img.src = dataUrl;
                                  };
                                reader.readAsDataURL(f);
                              }} />
                            </label>
                            {designs.front.image && <div className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Uploaded</div>}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-slate-700">Back Design</label>
                          <div className="flex items-center gap-4">
                            <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-all hover:shadow-md text-sm">
                              <Upload className="h-4 w-4" />
                              Upload Back Image
                              <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setDesignSide('back');
                                const reader = new FileReader();
                                  reader.onload = async () => {
                                    const dataUrl = reader.result as string;
                                    try {
                                      const res = await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ dataUrl, filename: f.name }) });
                                      if (res.ok) {
                                        const js = await res.json();
                                        const url = js?.url || `/attached_assets/${js?.filename}`;
                                        const img = new Image();
                                        img.onload = () => {
                                          const aspectRatio = img.height / img.width;
                                          const fitScale = Math.min(0.9, 0.9 / aspectRatio);
                                          const scalePct = Math.round(fitScale * 100);
                                          setDesigns((d: any) => ({ ...d, back: { ...d.back, image: url, imageScale: scalePct, imagePosition: { x: 200, y: 200 } } }));
                                        };
                                        img.onerror = () => {
                                          const fimg = new Image();
                                          fimg.onload = () => {
                                            const aspectRatio = fimg.height / fimg.width;
                                            const fitScale = Math.min(0.9, 0.9 / aspectRatio);
                                            const scalePct = Math.round(fitScale * 100);
                                            setDesigns((d: any) => ({ ...d, back: { ...d.back, image: dataUrl, imageScale: scalePct, imagePosition: { x: 200, y: 200 } } }));
                                          };
                                          fimg.src = dataUrl;
                                        };
                                        img.src = url;
                                        return;
                                      }
                                    } catch (err) {}
                                    const img = new Image(); img.onload = () => { const aspectRatio = img.height / img.width; const fitScale = Math.min(0.9, 0.9 / aspectRatio); const scalePct = Math.round(fitScale * 100); setDesigns((d: any) => ({ ...d, back: { ...d.back, image: dataUrl, imageScale: scalePct, imagePosition: { x: 200, y: 200 } } })); }; img.src = dataUrl;
                                  };
                                reader.readAsDataURL(f);
                              }} />
                            </label>
                            {designs.back.image && <div className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Uploaded</div>}
                          </div>
                        </div>
                      </div>

                    </div>
                  </section>
                </div>

                {/* Sizes tab */}
                <div hidden={activeTab !== 'sizes'}>
                  <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className={`${sectionsEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8"> 
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 shadow-sm">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Ruler className="h-5 w-5 text-indigo-600" />
                            Available Sizes
                          </h4>
                          <div className="mb-4">
                            <button 
                              type="button" 
                              onClick={() => setSelectedSizes(sizes.map(s => s.id))}
                              className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 font-medium"
                            >
                              Select All Sizes
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setSelectedSizes([])}
                              className="ml-2 text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded hover:bg-slate-100 font-medium"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {sizes.map(s => (
                              <label key={s.id} className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${selectedSizes.includes(s.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'}`}>
                                <input type="checkbox" className="hidden" checked={selectedSizes.includes(s.id)} onChange={() => {
                                  setSelectedSizes(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]);
                                }} />
                                <span className={`w-4 h-4 rounded-sm border flex items-center justify-center ${selectedSizes.includes(s.id) ? 'bg-white border-white' : 'bg-slate-50 border-slate-300'}`}>
                                  {selectedSizes.includes(s.id) && <CheckCircle className="w-3 h-3 text-indigo-600" />}
                                </span>
                                <span className="font-semibold">{s.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 shadow-sm">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Palette className="h-5 w-5 text-indigo-600" />
                            Selected Colors
                          </h4>
                          <div className="mb-4">
                            <button 
                              type="button" 
                              onClick={() => setSelectedColors(colors.map(c => c.id))}
                              className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 font-medium"
                            >
                              Select All Colors
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setSelectedColors([])}
                              className="ml-2 text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded hover:bg-slate-100 font-medium"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {colors.map(c => (
                              <label key={c.id} className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${selectedColors.includes(c.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'}`}>
                                <input type="checkbox" className="hidden" checked={selectedColors.includes(c.id)} onChange={() => {
                                  setSelectedColors(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]);
                                }} />
                                <span className="w-4 h-4 rounded-full border border-slate-300 shadow-inner" style={{ background: c.hex }} />
                                <span className="font-medium">{c.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <Ruler className="h-5 w-5 text-indigo-600" />
                            Size Chart ({product.replace('_', ' ').toUpperCase()})
                          </h4>
                        </div>
                        {sizes.length === 0 ? (
                          <div className="bg-slate-50 rounded-lg p-8 text-center border-2 border-dashed">
                            <p className="text-slate-500 font-medium">No sizes configured yet. Add system sizes to manage your chart.</p>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b">
                                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Size</th>
                                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Chest (in)</th>
                                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Length (in)</th>
                                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Shoulder (in)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sizes.map(s => {
                                  const sc = sizeChart.find(x => x.size_id === s.id) || {};
                                  const isSelected = selectedSizes.includes(s.id);
                                  return (
                                    <tr key={s.id} className={`transition-colors group ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                                          <span className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{s.label}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <input 
                                          className={`w-full max-w-[120px] mx-auto block border-slate-200 border px-3 py-2 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm ${!isSelected ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`} 
                                          defaultValue={sc.chest || ''} 
                                          id={`chest-${s.id}`} 
                                          placeholder="0.0" 
                                          readOnly={!isSelected}
                                        />
                                      </td>
                                      <td className="px-6 py-4">
                                        <input 
                                          className={`w-full max-w-[120px] mx-auto block border-slate-200 border px-3 py-2 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm ${!isSelected ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`} 
                                          defaultValue={sc.length || ''} 
                                          id={`length-${s.id}`} 
                                          placeholder="0.0" 
                                          readOnly={!isSelected}
                                        />
                                      </td>
                                      <td className="px-6 py-4">
                                        <input 
                                          className={`w-full max-w-[120px] mx-auto block border-slate-200 border px-3 py-2 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm ${!isSelected ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`} 
                                          defaultValue={sc.shoulder || ''} 
                                          id={`shoulder-${s.id}`} 
                                          placeholder="0.0" 
                                          readOnly={!isSelected}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>

                {/* Pricing tab */}
                <div hidden={activeTab !== 'pricing'}>
                  <section className="mb-6">
                    <h3 className="font-semibold mb-2">Pricing</h3>
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: preview & actions */}
          <aside className="lg:col-span-1 lg:sticky lg:top-24">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Live Preview</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">Preview your design and submit when ready.</CardDescription>
              </CardHeader>
              <CardContent>
            <div className="p-4 flex items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden w-full max-w-[420px] mx-auto aspect-square">
              <DesignCanvas
                    side={designSide}
                    slogan={designs[designSide].slogan}
                    color={designs[designSide].color}
                    template={designs[designSide].template}
                    templateColor={designs[designSide].color}
                    image={designs[designSide].image}
                    imageScale={designs[designSide].imageScale / 100}
                    imageRotation={designs[designSide].imageRotation}
                    imagePosition={designs[designSide].imagePosition}
                    width={400}
                    height={400}
                    showTemplate={false}
                  />
                </div>

                <div className="mt-4 flex gap-2 items-center">
                  <button type="button" onClick={() => setDesignSide('front')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${designSide==='front' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Front</button>
                  <button type="button" onClick={() => setDesignSide('back')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${designSide==='back' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Back</button>
                </div>
              </CardContent>

              <CardFooter>
                <div className="w-full flex flex-col sm:flex-row gap-3">
                  <button 
                    id="save-product-btn" 
                    type="submit" 
                    className={`w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded shadow-md ${(!editingProductId && !productName.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!editingProductId && !productName.trim()}
                  >
                    <Save className="h-4 w-4" /> Save product
                  </button>
                  {editingProductId && <button type="button" onClick={async () => {
                    if (!confirm('Delete this product? This is a soft delete and will hide it from lists.')) return;
                    try {
                      const res = await fetch(`/api/admin/products/${editingProductId}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
                      if (!res.ok) {
                        const js = await res.json().catch(() => ({}));
                        setError(js.message || 'Failed to delete product');
                      } else {
                        toast({ title: 'Deleted', description: 'Product has been removed.' });
                        setEditingProductId(null);
                        setProductName(''); setProductSaved(false);
                        setSelectedSizes([]); setSelectedColors([]);
                      }
                    } catch (err: any) {
                      setError(err?.message || 'Failed to delete');
                    }
                  }} className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded shadow-md">Delete product</button>}
                </div>
              </CardFooter>
            </Card>

            {error && <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 mt-4 animate-in fade-in zoom-in-95"><Trash2 className="h-4 w-4" /> {error}</div>}
          </aside>
        </div>
      </form>

      {/* Mobile sticky save bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-lg px-4 sm:hidden">
        <div className="bg-white border shadow-lg rounded-lg p-3 flex gap-3">
          <button onClick={() => (document.getElementById('save-product-btn') as HTMLButtonElement | null)?.click()} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded shadow-md">Save</button>
          {editingProductId && <button onClick={async () => { if (!confirm('Delete this product?')) return; const res = await fetch(`/api/admin/products/${editingProductId}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } }); if (res.ok) { toast({ title: 'Deleted', description: 'Product has been removed.' }); setEditingProductId(null); setProductName(''); setProductSaved(false); setSelectedSizes([]); setSelectedColors([]); } else { setError('Failed to delete'); } }} className="px-4 py-3 bg-red-600 text-white rounded">Delete</button>}
        </div>
      </div>

    </div>
  );
}