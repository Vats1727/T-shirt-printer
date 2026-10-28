import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { encodeId, decodeId } from '@/utils/idEncoder';
import {
  Tag,
  Shirt,
  ShoppingBag,
  Layers,
  Loader2,
  Eye,
  IndianRupee,
  CheckCircle2,
  Check,
  Search,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

export default function AdminCreateListing() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [designSearch, setDesignSearch] = useState('');
  const [previewSide, setPreviewSide] = useState('front');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [retailPrice, setRetailPrice] = useState(699);
  const [saving, setSaving] = useState(false);

  // Success dialog
  const [createdListing, setCreatedListing] = useState(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  const providerId = user?.id || user?.sub;

  const normalizeImage = (img) => {
    if (!img) return null;
    img = String(img);
    if (img.startsWith('http') || img.startsWith('/') || img.startsWith('data:')) return img;
    return `/uploads/${img}`;
  };

  // Fetch designs created by associated designers
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/designer-designs', {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (!res.ok) throw new Error('Failed to load designer creations');
        const rawList = await res.json();
        const list = Array.isArray(rawList) ? rawList : [];

        const formatted = list.map((d) => {
          let meta = {};
          if (d.version?.metadata) {
            meta = typeof d.version.metadata === 'string'
              ? JSON.parse(d.version.metadata)
              : d.version.metadata;
          }
          const fUrl = normalizeImage(meta.preview_front || d.image);
          const bUrl = normalizeImage(meta.preview_back || d.back_image);
          const aUrl = normalizeImage(meta.preview_any) || fUrl || bUrl;

          return {
            id: d.id,
            key: `design-${d.id}`,
            name: d.product_name || d.product || `Creation #${d.id}`,
            designer_name: d.designer_name || 'Associated Designer',
            designer_email: d.designer_email || '',
            front: fUrl ? { url: fUrl } : null,
            back: bUrl ? { url: bUrl } : null,
            any: aUrl ? { url: aUrl } : null,
            raw: d
          };
        });

        setDesigns(formatted);

        // Check URL query parameters for pre-selected design
        const params = new URLSearchParams(window.location.search);
        const queryDesignId = params.get('designId');
        if (queryDesignId) {
          const resolvedId = decodeId(queryDesignId) || queryDesignId;
          const preSelected = formatted.find(
            (d) => String(d.id) === String(resolvedId) || d.key === `design-${resolvedId}`
          );
          if (preSelected) {
            handleSelectDesign(preSelected);
          } else if (formatted.length > 0) {
            handleSelectDesign(formatted[0]);
          }
        } else if (formatted.length > 0) {
          handleSelectDesign(formatted[0]);
        }
      } catch (err) {
        console.error('Error fetching designer designs:', err);
        toast({
          variant: 'destructive',
          title: 'Error Loading Creations',
          description: err?.message || 'Could not fetch designs from associated designers.'
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSelectDesign = (d) => {
    setSelectedDesign(d);
    if (!title.trim() || title.includes('Custom Apparel')) {
      setTitle(`${d.name} Custom Apparel`);
    }
    if (!description.trim() || description.includes('Original creation designed by')) {
      setDescription(
        `Original creation designed by ${d.designer_name}. Premium direct-to-garment (DTG) print on ultra-soft combed cotton blank.`
      );
    }
  };

  const getPreviewImage = (d, side) => {
    if (!d) return '/templates/tshirt.png';
    if (side === 'front') {
      return d.front?.url || d.any?.url || d.back?.url || '/templates/tshirt.png';
    }
    return d.back?.url || d.front?.url || d.any?.url || '/templates/tshirt.png';
  };

  const handleCreateListing = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title Required', description: 'Please provide a title for your product listing.' });
      return;
    }
    if (!selectedDesign) {
      toast({ variant: 'destructive', title: 'Design Required', description: 'Please select one of the designer creations.' });
      return;
    }

    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        design_key: selectedDesign.key,
        visibility: 'public',
        price: Number(retailPrice) || 29.99
      };

      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || '');
        throw new Error(txt || 'Failed to create listing');
      }

      const js = await res.json();
      setCreatedListing(js || null);
      setSuccessDialogOpen(true);
      toast({
        title: '🎉 Product Published to Store!',
        description: 'The designer product is now live on your official store.'
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Publish Failed',
        description: err?.message || 'Failed to create store listing.'
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredDesigns = designs.filter((d) => {
    if (!designSearch.trim()) return true;
    const q = designSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.designer_name.toLowerCase().includes(q) ||
      d.designer_email.toLowerCase().includes(q)
    );
  });

  const storeUrl = providerId ? `/store/${encodeId(providerId)}` : '/store';
  const singleProductUrl = createdListing?.id
    ? `/listing/id/${encodeId(createdListing.id)}?supplier=${encodeId(providerId)}`
    : storeUrl;

  const quickPricePresets = [499, 699, 899, 999, 1299, 1499];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-12 pt-1">
      <form onSubmit={handleCreateListing} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Row 1 Left: Product Information (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="h-full rounded-2xl border border-slate-200/90 bg-white shadow-xs p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                      <Tag className="size-3.5" />
                      <span>Product Information</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pt-1">
                      Listing Details
                    </h3>
                    <p className="text-xs text-slate-500">
                      Title and description visible to shoppers on your official facility store.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Product Title <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${title.length > 85 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {title.length}/100
                      </span>
                    </div>
                    <div className="relative rounded-xl border border-slate-200/90 focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all bg-slate-50/40">
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        placeholder="e.g. Vintage Oversized Graphic Crewneck"
                        className="border-0 bg-transparent text-sm font-medium h-11 focus-visible:ring-0 placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Storefront Description
                      </label>
                      <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${description.length > 220 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {description.length}/250
                      </span>
                    </div>
                    <div className="relative rounded-xl border border-slate-200/90 focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all bg-slate-50/40">
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={250}
                        rows={3}
                        placeholder="Describe the apparel fabric feel, sizing suggestions, or creator inspiration..."
                        className="border-0 bg-transparent text-xs leading-relaxed focus-visible:ring-0 placeholder:text-slate-400 resize-none p-3"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100/80 mt-4">
                Tip: Highlighting fabric specs and fit will improve customer conversion on your storefront.
              </p>
            </div>
          </div>

          {/* Row 1 Right: Select a Designer Creation to Sell (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="h-full rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                    <Layers className="size-3.5" />
                    <span>Associated Creations</span>
                  </div>
                  <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-0.5 shadow-2xs">
                    {designs.length} {designs.length === 1 ? 'Design' : 'Designs'}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Select a Designer Creation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose from apparel graphics submitted by partnered designers.
                  </p>
                </div>

                {/* Compact Search Bar */}
                <div className="relative">
                  <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={designSearch}
                    onChange={(e) => setDesignSearch(e.target.value)}
                    placeholder="Search designer or garment..."
                    className="pl-8 h-8 text-xs rounded-xl bg-white border-slate-200 focus:bg-white"
                  />
                </div>
              </div>

              {/* Scrollable Creations Container */}
              <div className="p-4 flex-1 overflow-y-auto max-h-[220px]">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="size-6 animate-spin text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-500">Loading designer creations...</span>
                  </div>
                ) : filteredDesigns.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 space-y-1">
                    <Shirt className="size-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">No creations found</p>
                    <p className="text-[10px] text-slate-400">Save designs in designer portal to populate here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {filteredDesigns.map((d) => {
                      const isSelected = selectedDesign?.id === d.id;
                      const thumb = d.front?.url || d.any?.url || d.back?.url || '/templates/tshirt.png';

                      return (
                        <div
                          key={d.id}
                          onClick={() => handleSelectDesign(d)}
                          className={`group cursor-pointer rounded-xl border p-2 transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600 shadow-xs'
                              : 'border-slate-200/90 hover:border-indigo-300 hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="aspect-square bg-slate-50/80 rounded-lg p-1.5 flex items-center justify-center relative overflow-hidden border border-slate-100">
                            <img
                              src={thumb}
                              alt={d.name}
                              className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.src = '/templates/tshirt.png';
                              }}
                            />
                            {isSelected && (
                              <div className="absolute top-1 right-1 size-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                <Check className="size-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div className="pt-1.5 space-y-0.5">
                            <div className="text-[9px] font-bold text-violet-700 truncate">
                              by {d.designer_name}
                            </div>
                            <h4 className="font-extrabold text-[11px] text-slate-900 truncate">
                              {d.name}
                            </h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2 Left: Retail Pricing & Actions (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="h-full rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/80">
                      <IndianRupee className="size-3.5" />
                      <span>Pricing Strategy</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pt-1">
                      Set Retail Selling Price
                    </h3>
                    <p className="text-xs text-slate-500">
                      Specify the customer-facing retail price listed in your public shop catalog.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Customer Retail Price <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                        Indian Rupee (₹)
                      </span>
                    </div>

                    <div className="relative rounded-xl border-2 border-slate-200 focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/10 bg-white transition-all overflow-hidden max-w-sm">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={retailPrice}
                        onChange={(e) => setRetailPrice(parseFloat(e.target.value) || 0)}
                        className="border-0 bg-transparent pl-10 h-12 text-2xl font-black text-slate-900 focus-visible:ring-0 tracking-tight"
                        required
                      />
                    </div>

                    {/* Quick Price Suggestions */}
                    <div className="pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                        Quick Suggestions
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {quickPricePresets.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setRetailPrice(amt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              retailPrice === amt
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 scale-105'
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integrated Action Footer */}
              <div className="border-t border-slate-100 bg-slate-50/70 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/admin/listings')}
                    className="w-full sm:w-auto h-12 px-6 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition-all"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || !selectedDesign}
                    className="w-full sm:flex-1 h-12 px-8 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Publishing to Storefront...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="size-4" />
                        <span>Publish Product to Facility Store</span>
                        <Sparkles className="size-4 ml-1 opacity-80" />
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
                  <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Instant storefront live sync
                  </span>
                  <span className="font-medium text-slate-500 truncate max-w-[200px]">
                    {selectedDesign ? `Selected: ${selectedDesign.name}` : 'Select a design to publish'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 Right: Live Customer Preview (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="h-full rounded-2xl border border-indigo-100/90 bg-white shadow-lg shadow-indigo-500/5 overflow-hidden flex flex-col justify-between">
              <div className="p-4 pb-3 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white via-indigo-50/20 to-white shrink-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Live Customer Preview
                  </span>
                </div>
                {/* Front / Back Switcher */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setPreviewSide('front')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      previewSide === 'front'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSide('back')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      previewSide === 'back'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Back
                  </button>
                </div>
              </div>

              {selectedDesign ? (
                <div className="p-5 flex-1 flex flex-col items-center justify-between gap-4">
                  {/* Garment Staging Mockup View */}
                  <div className="relative w-full flex-1 min-h-[220px] max-h-[280px] rounded-2xl bg-gradient-to-b from-slate-50 via-white to-slate-100/60 border border-slate-200/80 shadow-inner flex items-center justify-center p-4 group overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_70%)] pointer-events-none" />
                    <img
                      src={getPreviewImage(selectedDesign, previewSide)}
                      alt="Active design preview"
                      className="max-h-full max-w-full object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-300 relative z-10"
                    />
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-20 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400"></span>
                      {previewSide} view
                    </div>
                  </div>

                  {/* Storefront Mini Product Card Preview */}
                  <div className="w-full p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      <span>Storefront View</span>
                      <span className="text-emerald-600 font-bold">In Stock</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="block text-xs font-bold text-slate-900 truncate">
                          {title || selectedDesign.name}
                        </span>
                        <span className="block text-[10px] text-violet-700 font-bold truncate">
                          by {selectedDesign.designer_name}
                        </span>
                      </div>
                      <span className="text-base font-black text-slate-900 shrink-0">
                        ₹{Number(retailPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
                  <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-inner">
                    <Shirt className="size-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">No Design Selected</p>
                    <p className="text-[11px] text-slate-400">Choose a designer creation above to preview mockup.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </form>

      {/* Success Modal */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 text-center">
          <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs border border-emerald-100">
            <CheckCircle2 className="size-9 stroke-[2.2]" />
          </div>

          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900">
              Product Published Successfully!
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Your custom apparel is now live on your official Print Provider store and ready for customer purchases.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 my-3 text-left space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Name</div>
            <div className="text-sm font-extrabold text-slate-900 truncate">{title}</div>
            <div className="text-xs text-emerald-700 font-bold">₹{Number(retailPrice).toFixed(2)} retail</div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSuccessDialogOpen(false);
                setLocation('/admin/listings');
              }}
              className="flex-1 h-10 rounded-xl text-xs font-bold"
            >
              Go to Store Listings
            </Button>
            <Button
              onClick={() => window.open(singleProductUrl, '_blank')}
              className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 shadow-sm shadow-indigo-600/20"
            >
              <Eye className="size-3.5" />
              <span>View in Store</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
