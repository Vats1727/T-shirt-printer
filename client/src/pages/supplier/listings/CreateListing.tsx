import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { encodeId } from '@shared/obfuscate';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Check, 
  CheckCircle2, 
  Sparkles, 
  Globe, 
  Lock, 
  Eye, 
  IndianRupee, 
  TrendingUp, 
  ShoppingBag, 
  Tag, 
  ExternalLink, 
  Layers, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function CreateListing() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDesign, setSelectedDesign] = useState<any | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [retailPrice, setRetailPrice] = useState<number>(29.99);
  const baseCost = 16.50; // Estimated supplier blank & print cost

  const [saving, setSaving] = useState(false);
  const [createdListing, setCreatedListing] = useState<any | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch('/api/supplier/saved-designs', { headers });
        if (!res.ok) {
          setDesigns([]);
          return;
        }
        const js = await res.json();
        const rawDesigns = js.designs || [];
        // Strictly filter to designs with valid preview image URLs
        const validDesigns = rawDesigns.filter((d: any) => {
          const frontUrl = d.front?.url;
          const backUrl = d.back?.url;
          const anyUrl = d.any?.url;
          return Boolean(frontUrl || backUrl || anyUrl);
        });

        setDesigns(validDesigns);
        if (validDesigns.length > 0 && !selectedDesign) {
          setSelectedDesign(validDesigns[0]);
        }
      } catch (e) {
        setDesigns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Calculate profit margin
  const profit = Math.max(0, retailPrice - baseCost);
  const marginPercent = retailPrice > 0 ? Math.round((profit / retailPrice) * 100) : 0;

  async function handleCreate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title Required", description: "Please enter a compelling title for your listing." });
      return;
    }
    if (!selectedDesign) {
      toast({ variant: "destructive", title: "Design Required", description: "Please select one of your saved designs to list." });
      return;
    }

    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        design_key: selectedDesign.key,
        visibility,
        price: retailPrice
      };

      const res = await fetch('/api/supplier/listings', {
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
      toast({ title: "🎉 Listing Published!", description: "Your custom apparel is now live in your storefront." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error Creating Listing", description: err?.message || 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  }

  const supplierId = user?.id || (user as any)?.sub || '';
  const storeUrl = `${window.location.origin}/store/${encodeId(supplierId)}`;
  const singleListingUrl = createdListing?.slug ? `${window.location.origin}/listing/${encodeURIComponent(createdListing.slug)}` : storeUrl;

  const getPreviewImage = (d: any, side: 'front' | 'back') => {
    if (!d) return '/templates/tshirt.png';
    if (side === 'front') {
      return d.front?.url || d.any?.url || d.back?.url || '/templates/tshirt.png';
    }
    return d.back?.url || d.front?.url || d.any?.url || '/templates/tshirt.png';
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button 
              onClick={() => setLocation('/supplier/dashboard')} 
              className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="size-4" />
              Dashboard
            </button>
            <span>/</span>
            <span className="text-foreground font-semibold">Create Store Listing</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Publish New Apparel</h1>
            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1 text-xs py-0.5">
              <Sparkles className="size-3" />
              Storefront Studio
            </Badge>
          </div>
          <p className="text-slate-500 text-sm">
            Configure title, pricing, and visibility to showcase your custom designs to shoppers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/supplier/dashboard')}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={saving || !selectedDesign}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 text-white font-semibold gap-2 min-w-36"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <ShoppingBag className="size-4" />
                Launch to Store
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Details (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Listing Information */}
          <Card className="shadow-sm border-slate-200/80 bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                <Tag className="size-4" />
                <span>Product Information</span>
              </div>
              <CardTitle className="text-xl">Listing Details</CardTitle>
              <CardDescription>Enter a catchy title and description to entice buyers on your storefront.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-800">
                    Product Title <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs text-slate-400 font-mono">{title.length}/100</span>
                </div>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  maxLength={100} 
                  placeholder="e.g. Vintage Oversized Graphic Crewneck" 
                  className="h-11 text-base border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-800">Product Description</label>
                  <span className="text-xs text-slate-400 font-mono">{description.length}/250</span>
                </div>
                <Textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  maxLength={250} 
                  rows={4} 
                  placeholder="Describe your design inspiration, fabric feel, or styling suggestions..." 
                  className="resize-none text-sm border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Pricing & Profit Calculator */}
          <Card className="shadow-sm border-slate-200/80 bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <IndianRupee className="size-4" />
                <span>Pricing & Margins</span>
              </div>
              <CardTitle className="text-xl">Set Your Retail Price</CardTitle>
              <CardDescription>Calculate your profits per item sold after manufacturing costs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Retail Price (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                    <Input 
                      type="number"
                      step="0.50"
                      min={baseCost}
                      value={retailPrice}
                      onChange={(e) => setRetailPrice(parseFloat(e.target.value) || 0)}
                      className="pl-8 h-11 text-lg font-bold border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Base Production Cost</label>
                  <div className="h-11 flex items-center px-4 rounded-md bg-slate-100/80 border border-slate-200 text-slate-600 font-mono font-medium">
                    ₹{baseCost.toFixed(2)} (Print + Garment)
                  </div>
                </div>
              </div>

              {/* Profit preview banner */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Your Estimated Profit</span>
                    <p className="text-sm text-emerald-600 font-medium">Earned on every verified order</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-700">
                    +₹{profit.toFixed(2)}
                  </span>
                  <Badge variant="outline" className="ml-2 bg-emerald-100/50 border-emerald-200 text-emerald-800 text-xs font-bold">
                    {marginPercent}% margin
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Visibility Status */}
          <Card className="shadow-sm border-slate-200/80 bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                <Globe className="size-4 text-indigo-600" />
                <span>Storefront Visibility</span>
              </div>
              <CardTitle className="text-lg">Publishing Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                    visibility === 'public'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${visibility === 'public' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Globe className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      Public Storefront
                      {visibility === 'public' && <Check className="size-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Immediately active & visible to shoppers.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                    visibility === 'private'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${visibility === 'private' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      Private Draft
                      {visibility === 'private' && <Check className="size-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Saved in your catalog, hidden from store.</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Design Selection & Live Mockup (5 Cols) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
          {/* Card: Design Selector */}
          <Card className="shadow-sm border-slate-200/80 bg-white overflow-hidden">
            <CardHeader className="pb-3 border-b bg-slate-50/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                  <Layers className="size-4" />
                  <span>Your Saved Designs</span>
                </div>
                <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-semibold text-xs">
                  {designs.length} Active {designs.length === 1 ? 'Design' : 'Designs'}
                </Badge>
              </div>
              <CardTitle className="text-lg">Select Garment Graphic</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="size-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-medium">Loading saved designs...</span>
                </div>
              ) : designs.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                  <AlertCircle className="size-8 text-amber-500 mx-auto" />
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">No Active Designs Found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Create and save a custom apparel mockup first before publishing a listing.
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setLocation('/supplier/dashboard')}
                    className="bg-indigo-600 text-white"
                  >
                    Go to Designer Studio
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {designs.map((d: any) => {
                    const isSelected = selectedDesign?.key === d.key;
                    const previewImg = getPreviewImage(d, 'front');

                    return (
                      <div
                        key={d.key}
                        onClick={() => setSelectedDesign(d)}
                        className={`group relative rounded-xl border-2 p-2 cursor-pointer transition-all duration-200 bg-white hover:border-indigo-400 hover:shadow-md flex flex-col items-center ${
                          isSelected 
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="aspect-square w-full rounded-lg bg-slate-50 flex items-center justify-center p-2 overflow-hidden relative">
                          <img 
                            src={previewImg} 
                            alt={d.key} 
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300" 
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                              <Check className="size-3" />
                            </div>
                          )}
                        </div>
                        <div className="w-full mt-2 flex items-center justify-between px-1">
                          <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">{d.key}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Mockup</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Live Mockup Card */}
          {selectedDesign && (
            <Card className="shadow-md border-indigo-100 bg-gradient-to-b from-white to-slate-50/80 overflow-hidden">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Live Customer Preview</span>
                  <CardTitle className="text-base text-slate-800">{selectedDesign.key}</CardTitle>
                </div>
                {/* Side switcher tabs */}
                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPreviewSide('front')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      previewSide === 'front' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSide('back')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      previewSide === 'back' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Back
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center justify-center">
                <div className="aspect-[4/5] w-full max-w-[280px] bg-white rounded-2xl border border-slate-200/80 shadow-inner flex items-center justify-center p-6 relative overflow-hidden group">
                  <img 
                    src={getPreviewImage(selectedDesign, previewSide)} 
                    alt="Active design preview"
                    className="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {previewSide} view
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <h4 className="font-bold text-slate-900 text-sm">{title || 'Untitled Product'}</h4>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-lg font-extrabold text-indigo-600">₹{retailPrice.toFixed(2)}</span>
                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                      {visibility === 'public' ? 'Live on Store' : 'Draft Only'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Success Launch Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md text-center p-6">
          <div className="mx-auto size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-inner">
            <CheckCircle2 className="size-9" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-slate-900 text-center">
              Listing Published!
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500 pt-1">
              Your custom apparel is now live in your designer storefront and ready for customer orders.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 my-2 rounded-xl bg-slate-50 border border-slate-200/80 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Product:</span>
              <span className="font-semibold text-slate-800">{title}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Design Key:</span>
              <span className="font-mono text-indigo-600 font-bold">{selectedDesign?.key}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Retail Price:</span>
              <span className="font-bold text-emerald-600">₹{retailPrice.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSuccessDialogOpen(false);
                setLocation('/supplier/dashboard');
              }}
              className="w-full sm:w-auto"
            >
              Dashboard
            </Button>
            <Button
              onClick={() => {
                window.open(storeUrl, '_blank');
              }}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
            >
              <Store className="size-4" />
              View Storefront
              <ExternalLink className="size-3.5 opacity-70" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Store({ className }: { className?: string }) {
  return <ShoppingBag className={className} />;
}
