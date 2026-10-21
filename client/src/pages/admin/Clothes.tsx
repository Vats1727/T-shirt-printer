import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Save, ArrowLeft, Upload, CheckCircle, Package, Ruler, Palette, IndianRupee } from 'lucide-react';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import { useToast } from '@/hooks/use-toast';
import { decodeId } from '@shared/obfuscate';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [category, setCategory] = useState<'men' | 'women'>('men');

  // Confirmation modal dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Sections enabled when product is saved OR a product name is present
  const sectionsEnabled = productSaved || productName.trim() !== '';

  const FARMO_PRESETS = [
    { category: 'men', label: "Classic Crewneck", name: "Men's Classic Crewneck T-Shirt", template: 'tshirt' as const, frontImage: "/uploads/farmo_men_crewneck_front.png", backImage: "/uploads/farmo_men_crewneck_back.png", singlePrice: 15, bulkMin: 50, bulkPrice: 9.5 },
    { category: 'men', label: "Oversized Boxy Tee", name: "Men's Oversized Boxy T-Shirt", template: 'tshirt' as const, frontImage: "/uploads/farmo_men_oversized_front.png", backImage: "/uploads/farmo_men_oversized_back.png", singlePrice: 18, bulkMin: 50, bulkPrice: 11.5 },
    { category: 'men', label: "Piqué Polo Shirt", name: "Men's Classic Piqué Polo", template: 'tshirt' as const, frontImage: "/uploads/farmo_men_polo_front.png", backImage: "/uploads/farmo_men_polo_back.png", singlePrice: 22, bulkMin: 50, bulkPrice: 14 },
    { category: 'men', label: "Pullover Hoodie", name: "Men's Pullover Fleece Hoodie", template: 'hoodie' as const, frontImage: "/uploads/farmo_men_hoodie_front.png", backImage: "/uploads/farmo_men_hoodie_back.png", singlePrice: 32, bulkMin: 50, bulkPrice: 22 },
    { category: 'men', label: "Crewneck Sweatshirt", name: "Men's Crewneck Fleece Sweatshirt", template: 'tshirt' as const, frontImage: "/uploads/farmo_men_sweatshirt_front.png", backImage: "/uploads/farmo_men_sweatshirt_back.png", singlePrice: 28, bulkMin: 50, bulkPrice: 18.5 },
    { category: 'men', label: "Athletic Tank Top", name: "Men's Athletic Tank Top", template: 'tshirt' as const, frontImage: "/uploads/farmo_men_tank_front.png", backImage: "/uploads/farmo_men_tank_back.png", singlePrice: 14, bulkMin: 50, bulkPrice: 8.5 },
    { category: 'women', label: "Fitted Crewneck", name: "Women's Fitted Crewneck T-Shirt", template: 'women_tshirt' as const, frontImage: "/uploads/farmo_women_fitted_front.png", backImage: "/uploads/farmo_women_fitted_back.png", singlePrice: 15, bulkMin: 50, bulkPrice: 9.5 },
    { category: 'women', label: "Boxy Crop Top", name: "Women's Boxy Crop Top T-Shirt", template: 'women_tshirt' as const, frontImage: "/uploads/farmo_women_crop_front.png", backImage: "/uploads/farmo_women_crop_back.png", singlePrice: 16, bulkMin: 50, bulkPrice: 10 },
    { category: 'women', label: "Boyfriend Oversized", name: "Women's Oversized Boyfriend T-Shirt", template: 'women_tshirt' as const, frontImage: "/uploads/farmo_women_boyfriend_front.png", backImage: "/uploads/farmo_women_boyfriend_back.png", singlePrice: 18, bulkMin: 50, bulkPrice: 11.5 },
    { category: 'women', label: "Cropped Hoodie", name: "Women's Cropped Pullover Hoodie", template: 'hoodie' as const, frontImage: "/uploads/farmo_women_crophoodie_front.png", backImage: "/uploads/farmo_women_crophoodie_back.png", singlePrice: 30, bulkMin: 50, bulkPrice: 20 },
    { category: 'women', label: "Relaxed Hoodie", name: "Women's Relaxed Pullover Hoodie", template: 'hoodie' as const, frontImage: "/uploads/farmo_women_hoodie_front.png", backImage: "/uploads/farmo_women_hoodie_back.png", singlePrice: 32, bulkMin: 50, bulkPrice: 22 },
    { category: 'women', label: "Racerback Tank", name: "Women's Racerback Tank Top", template: 'women_tshirt' as const, frontImage: "/uploads/farmo_women_tank_front.png", backImage: "/uploads/farmo_women_tank_back.png", singlePrice: 14, bulkMin: 50, bulkPrice: 8.5 },
  ];

  function applyPreset(preset: typeof FARMO_PRESETS[0]) {
    setProductName(preset.name);
    setCategory(preset.category as 'men' | 'women');
    setProduct(preset.template);
    setSinglePrice(preset.singlePrice);
    setBulkMin(preset.bulkMin);
    setBulkPrice(preset.bulkPrice);
    setDesigns({
      front: { image: preset.frontImage, imageScale: 85, imageRotation: 0, imagePosition: { x: 200, y: 200 }, slogan: '', color: '#000000', template: preset.template },
      back: { image: preset.backImage, imageScale: 85, imageRotation: 0, imagePosition: { x: 200, y: 200 }, slogan: '', color: '#000000', template: preset.template }
    });
    setFrontFilename(preset.frontImage);
    setBackFilename(preset.backImage);
    setSelectedSizes(sizes.map((s: any) => s.id));
    setSelectedColors([1, 2, 3, 4, 9]);
    toast({ title: "Farmo Preset Loaded", description: `Loaded blank template: ${preset.name}` });
  }

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

  useEffect(() => { fetchData(); loadEditingProduct(); }, [token, product]);

  async function fetchData() {
    try {
      const c = await fetch('/api/admin/colors', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (c.ok) {
        setColors(await c.json());
      } else {
        throw new Error('Failed to load colors');
      }

      const s = await fetch('/api/admin/sizes', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (s.ok) setSizes(await s.json()); else throw new Error('Failed to load sizes');

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
      toast({
        title: 'Error Loading Catalog',
        description: err?.message || 'Failed to load catalog data.',
        variant: 'destructive',
      });
    }
  }

  // load product for editing if productId query param present
  async function loadEditingProduct() {
    try {
      const params = new URLSearchParams(window.location.search);
      const idStr = params.get('productId');
      if (!idStr) return;
      const id = decodeId(idStr);
      if (!id) return;
      setEditingProductId(id);

      const res = await fetch(`/api/admin/products/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) return;
      const p = await res.json();

      setProductName(p.name || '');
      if (p.category) setCategory(p.category);
      setSinglePrice(p.single_price ?? 0);
      setBulkMin(p.bulk_min ?? 100);
      setBulkPrice(p.bulk_price ?? 0);
      setSelectedSizes(p.sizes || []);
      setSelectedColors(p.colors || []);

      setSizeChart(p.sizeChart || []);

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
          const front = rawDesigns.find((d: any) => d && d.side === 'front');
          const back = rawDesigns.find((d: any) => d && d.side === 'back');
          if (front) designsMap.front = mapRow(front);
          if (back) designsMap.back = mapRow(back);
          if (!front && rawDesigns[0]) designsMap.front = mapRow(rawDesigns[0]);
          if (!back && rawDesigns[1]) designsMap.back = mapRow(rawDesigns[1]);
        } else if (typeof rawDesigns === 'object') {
          if (rawDesigns.front) designsMap.front = mapRow(rawDesigns.front);
          if (rawDesigns.back) designsMap.back = mapRow(rawDesigns.back);
        }
        
        if (designsMap.front.image && designsMap.front.imageScale <= 1.5) designsMap.front.imageScale *= 100;
        else if (!designsMap.front.image && designsMap.front.imageScale <= 1.5) designsMap.front.imageScale = 100;
        if (designsMap.back.image && designsMap.back.imageScale <= 1.5) designsMap.back.imageScale *= 100;
        else if (!designsMap.back.image && designsMap.back.imageScale <= 1.5) designsMap.back.imageScale = 100;
      }
      setDesigns(designsMap);
      setFrontFilename(designsMap.front.image ? 'front-image' : null);
      setBackFilename(designsMap.back.image ? 'back-image' : null);
      setDesignSide('front');
      setProductSaved(true);
    } catch (e) {
      // ignore load errors
    }
  }

  function promptDeleteProduct() {
    if (!editingProductId) return;
    setConfirmDialog({
      open: true,
      title: 'Delete Product',
      description: 'Are you sure you want to remove this product from your catalog? This will soft delete the product.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/products/${editingProductId}`, {
            method: 'DELETE',
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          });
          if (res.ok) {
            toast({ title: 'Product Deleted', description: 'Product has been removed from catalog.' });
            setEditingProductId(null);
            setProductName('');
            setProductSaved(false);
            setSelectedSizes([]);
            setSelectedColors([]);
            setTimeout(() => setLocation('/admin/dashboard'), 800);
          } else {
            toast({ title: 'Delete Failed', description: 'Could not delete product.', variant: 'destructive' });
          }
        } catch (err: any) {
          toast({ title: 'Error', description: err?.message || 'Failed to delete product', variant: 'destructive' });
        }
      }
    });
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      toast({
        title: 'Product Name Required',
        description: 'Please set a product name before saving.',
        variant: 'destructive',
      });
      return;
    }

    // Collect size chart values from inputs
    const sizeChartPayload = sizes.map((s: any) => {
      const chest = (document.getElementById(`chest-${s.id}`) as HTMLInputElement)?.value || '';
      const length = (document.getElementById(`length-${s.id}`) as HTMLInputElement)?.value || '';
      const shoulder = (document.getElementById(`shoulder-${s.id}`) as HTMLInputElement)?.value || '';
      return { size_id: s.id, chest: chest === '' ? null : Number(chest), length: length === '' ? null : Number(length), shoulder: shoulder === '' ? null : Number(shoulder) };
    }).filter((sc: any) => sc.chest !== null || sc.length !== null || sc.shoulder !== null);

    const payload = {
      name: productName,
      category: category,
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
        toast({
          title: 'Failed to Save Product',
          description: js.message || 'Error occurred while saving.',
          variant: 'destructive',
        });
      } else {
        const data = await res.json();
        setProductSaved(true);
        setSizeChart(data.sizeChart || data.size_chart || []);
        
        toast({ 
          title: editingProductId ? 'Product Updated' : 'Product Created', 
          description: editingProductId ? 'Changes saved successfully.' : 'New product added to catalog.' 
        });

        setTimeout(() => {
          setLocation('/admin/dashboard');
        }, 1200);
      }
    } catch (err: any) {
      toast({
        title: 'Save Failed',
        description: err?.message || 'Could not complete save.',
        variant: 'destructive',
      });
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
          <button type="button" onClick={() => setLocation('/admin/dashboard')} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm transition">
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
                  <div className="mb-2 space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-600" />
                      Basic Information & Farmo Presets
                    </h3>

                    {/* Category Selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Category</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setCategory('men')}
                          className={`flex-1 py-2.5 px-4 rounded-lg border font-medium text-sm flex items-center justify-center gap-2 transition-all ${category === 'men' ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                          <span className="text-lg">👨</span> Men's Apparel
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategory('women')}
                          className={`flex-1 py-2.5 px-4 rounded-lg border font-medium text-sm flex items-center justify-center gap-2 transition-all ${category === 'women' ? 'bg-pink-50 border-pink-600 text-pink-700 shadow-xs font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                          <span className="text-lg">👩</span> Women's Apparel
                        </button>
                      </div>
                    </div>

                    {/* Quick Farmo Presets */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Load {category === 'men' ? "Men's" : "Women's"} Farmo Silhouette Blank
                        </span>
                        <span className="text-xs text-muted-foreground">Click to auto-fill</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {FARMO_PRESETS.filter(p => p.category === category).map(preset => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="text-left p-2.5 rounded-lg border bg-white hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-xs font-medium shadow-2xs group"
                          >
                            <div className="font-semibold text-slate-800 group-hover:text-indigo-700">{preset.label}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">₹{preset.singlePrice.toFixed(2)} unit</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Product / Silhouette Name</label>
                        <input 
                          value={productName} 
                          onChange={e => setProductName(e.target.value)} 
                          placeholder="e.g. Men's Oversized Boxy T-Shirt" 
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
                          <label className="block text-sm font-medium mb-1">Single unit price (₹)</label>
                          <input type="number" step="0.01" value={singlePrice as any} onChange={e => setSinglePrice(e.target.value === '' ? '' : Number(e.target.value))} className="border px-3 py-2 rounded w-full" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Bulk minimum qty</label>
                          <input type="number" value={bulkMin} onChange={e => setBulkMin(Number(e.target.value))} className="border px-3 py-2 rounded w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Bulk price (₹)</label>
                          <input type="number" step="0.01" value={bulkPrice as any} onChange={e => setBulkPrice(e.target.value === '' ? '' : Number(e.target.value))} className="border px-3 py-2 rounded w-full" placeholder="0.00" />
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
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={promptDeleteProduct}
                      className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded shadow-md"
                    >
                      Delete product
                    </button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </aside>
        </div>
      </form>

      {/* Mobile sticky save bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-lg px-4 sm:hidden">
        <div className="bg-white border shadow-lg rounded-lg p-3 flex gap-3">
          <button onClick={() => (document.getElementById('save-product-btn') as HTMLButtonElement | null)?.click()} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded shadow-md">Save</button>
          {editingProductId && (
            <button onClick={promptDeleteProduct} className="px-4 py-3 bg-red-600 text-white rounded">Delete</button>
          )}
        </div>
      </div>

      {/* Styled Project Alert Dialog (Replaces native browser confirm()) */}
      <AlertDialog open={confirmDialog.open} onOpenChange={open => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="rounded-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600 mt-2">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}