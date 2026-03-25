import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, LayoutTemplate, Store, Copy, ExternalLink, Package, Check, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SupplierDashboard() {
  const { token, user, updateUser } = useAuth();
  const CLIENT_ORIGIN = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin.replace(/\/$/, '') : '';
  const [, setLocation] = useLocation();
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);

  useEffect(() => {
    fetch('/api/public/providers')
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (user?.associated_provider_id) {
      (async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/supplier/catalog', {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          });
          if (res.ok) {
            setCatalog(await res.json());
          }
        } catch (err) {
          console.error('Failed to load catalog', err);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [token, user?.associated_provider_id]);

  const handleSaveProvider = async () => {
    if (!selectedProvider) return;
    setSavingProvider(true);
    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ associated_provider_id: selectedProvider })
      });
      if (res.ok) {
        updateUser({ associated_provider_id: selectedProvider });
        setProviderDialogOpen(false);
        toast({ title: "Provider Selected", description: "Your preferred print provider has been set." });
      } else {
        throw new Error('Failed to save provider');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSavingProvider(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse text-sm font-medium">Loading catalog...</p>
        </div>
      </div>
    );
  }

  // Provide Selection Modal logic is now inside the main return

  const getPreviewUrl = (d: any) => {
    if (!d) return '/templates/tshirt.png';
    let img = d.image || d.image_data || d.image_url || d.image_src || d.filename || d.file_name || null;
    if (!img && typeof d === 'string') img = d;
    if (!img) return '/templates/tshirt.png';
    img = String(img);
    if (img.startsWith('data:') || img.startsWith('http') || img.startsWith('/')) return img;
    return `/attached_assets/${img}`;
  };

  const copyToClipboard = (slug: string) => {
    const url = `${window.location.origin}/product/${slug}`;
    navigator.clipboard?.writeText(url);
    toast({
      title: "Link Copied",
      description: "Product URL has been copied to clipboard.",
    });
  };

  const openStore = () => {
    const sid = (user && (user.id || (user as any).sub)) ? (user.id || (user as any).sub) : '';
    const url = sid ? `${CLIENT_ORIGIN}/store/${encodeURIComponent(String(sid))}` : `${CLIENT_ORIGIN}/store`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Designer Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your designs and explored the print provider catalog.</p>
          {user?.associated_provider_id && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Store className="size-4 text-primary" />
              Current Provider: <span className="font-semibold text-slate-900">{providers.find((p: any) => p.id === user.associated_provider_id)?.name || 'Loading...'}</span>
              <Button variant="link" size="sm" onClick={() => setProviderDialogOpen(true)} className="h-auto p-0 ml-2 text-indigo-600">Change</Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!user?.associated_provider_id && (
            <Button onClick={() => setProviderDialogOpen(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 shadow-md text-white">
              <Store className="size-4" />
              Choose Print Provider
            </Button>
          )}
          <Button variant="outline" onClick={() => setLocation(`/supplier/saved-designs/${user?.id || (user as any)?.sub || ''}`)} className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
            <LayoutTemplate className="size-4" />
            Saved Designs
          </Button>
          <Button onClick={openStore} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200">
            <Store className="size-4" />
            View My Store
            <ExternalLink className="size-3 opacity-70" />
          </Button>
          <Button onClick={() => setLocation('/supplier/listings/create')} className="gap-2 bg-primary shadow-md shadow-primary/20">
            <Plus className="size-4" />
            Create Listing
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-foreground">Available Products</h2>
        </div>

        {(!user?.associated_provider_id) ? (
          <Card className="border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Store className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No Print Provider Selected</h3>
              <p className="text-muted-foreground max-w-xs mb-6">Please select a print provider to view their product catalog and start designing.</p>
              <Button onClick={() => setProviderDialogOpen(true)} className="gap-2 bg-primary shadow-md shadow-primary/20">
                <Store className="size-4" />
                Choose Print Provider
              </Button>
            </CardContent>
          </Card>
        ) : (!catalog?.products || catalog.products.length === 0) ? (
          <Card className="border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No products available</h3>
              <p className="text-muted-foreground max-w-xs">Your print provider hasn't added any products to the catalog yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {catalog.products?.map((p: any) => (
              <Card key={p.id} className="group overflow-hidden border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 flex flex-col h-full bg-card/50 backdrop-blur-sm">
                <div className="aspect-[4/5] relative overflow-hidden bg-muted/30 p-6 flex items-center justify-center">
                  <img
                    src={getPreviewUrl(p.designs?.[0])}
                    className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500 ease-out"
                    alt={p.name}
                  />
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="bg-white/80 backdrop-blur-md shadow-sm border-none font-bold text-indigo-600">
                      ${Number(p.single_price || 0).toFixed(2)}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">{p.name}</CardTitle>
                    <button 
                      onClick={() => copyToClipboard(p.slug)}
                      className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Copy URL"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                  <CardDescription className="text-xs font-mono uppercase tracking-wider">{p.slug}</CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-4 flex-grow">
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sizes</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(p.sizes && p.sizes.length) ? p.sizes.map((id: number) => {
                          const sizeObj = catalog.sizes.find((s: any) => (s.id === Number(id) || String(s.id) === String(id)));
                          if (!sizeObj) return null;
                          return (
                            <Badge key={id} variant="outline" className="text-[10px] px-2 py-0 min-w-8 justify-center bg-slate-50/50">
                              {sizeObj.label}
                            </Badge>
                          );
                        }) : <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Colors</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(p.colors && p.colors.length) ? p.colors.map((id: number) => {
                          const c = catalog.colors.find((col: any) => (col.id === Number(id) || String(col.id) === String(id)));
                          if (!c) return null;
                          return (
                            <div key={id} className="group/color relative">
                              <span 
                                className="w-5 h-5 rounded-full block border-2 border-white shadow-sm ring-1 ring-border shadow-inner" 
                                style={{ background: c.hex || '#ccc' }}
                                title={c.name}
                              />
                              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] bg-black text-white px-1.5 py-0.5 rounded opacity-0 group-hover/color:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {c.name}
                              </span>
                            </div>
                          );
                        }) : <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0 mt-auto">
                  <Button 
                    onClick={() => setLocation('/supplier/product/' + p.id)} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 group/btn transition-all active:scale-[0.98]"
                  >
                    Start Designing
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Store className="size-8 text-primary" />
            </div>
            <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              Choose Your Print Partner
            </DialogTitle>
            <DialogDescription className="text-base text-center">
              Select a Print Provider to view their product catalog and start designing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4 pb-4">
            <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    selectedProvider === p.id 
                    ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20' 
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg transition-colors ${selectedProvider === p.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Store className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{p.name}</h4>
                      <p className="text-sm text-slate-500">Official Print Provider</p>
                    </div>
                  </div>
                  <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedProvider === p.id 
                    ? 'border-primary bg-primary text-white scale-110' 
                    : 'border-slate-200'
                  }`}>
                    {selectedProvider === p.id && <Check className="size-4" />}
                  </div>
                </button>
              ))}
            </div>

            <Button 
              disabled={!selectedProvider || savingProvider} 
              onClick={handleSaveProvider}
              className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] group"
            >
              {savingProvider ? (
                <div className="flex items-center gap-2">
                  <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Continue to Designer Portal
                  <ChevronRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}