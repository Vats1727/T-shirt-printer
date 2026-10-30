import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { encodeId } from '@/utils/idEncoder';
import {
  ShoppingBag,
  Store,
  Plus,
  ExternalLink,
  Paintbrush,
  Search,
  Trash2,
  Tag,
  Shirt,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Copy,
  Check,
  Layers,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

export default function SupplierListings() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'unlisted'
  const [togglingId, setTogglingId] = useState(null);
  const [activeSide, setActiveSide] = useState({}); // { [listingId]: 'front' | 'back' }
  const [listingToDelete, setListingToDelete] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const supplierId = user?.id || user?.sub;
  const storeUrl = supplierId ? `/store/${encodeId(supplierId)}` : '/store';

  const fetchListings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supplier/listings', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) {
        throw new Error('Failed to load store listings');
      }
      const data = await res.json();
      setListings(Array.isArray(data) ? data : (data.listings || []));
    } catch (err) {
      console.error('fetchListings error:', err);
      toast({
        variant: 'destructive',
        title: 'Error Loading Listings',
        description: err?.message || 'Could not fetch your store listings.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [token]);

  const toggleListingStatus = async (listing) => {
    const isCurrentlyPublished = listing.published !== false && listing.visibility !== 'unlisted';
    const nextPublished = !isCurrentlyPublished;
    const nextVisibility = nextPublished ? 'public' : 'unlisted';
    setTogglingId(listing.id);

    try {
      const res = await fetch(`/api/supplier/listings/${encodeURIComponent(listing.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          published: nextPublished,
          visibility: nextVisibility
        })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || '');
        throw new Error(txt || 'Failed to update product visibility');
      }

      const updated = await res.json();
      setListings((prev) =>
        prev.map((l) =>
          Number(l.id) === Number(listing.id)
            ? { ...l, ...updated, published: nextPublished, visibility: nextVisibility }
            : l
        )
      );

      toast({
        title: nextPublished ? '🎉 Product Published to Store!' : 'Product Unlisted',
        description: nextPublished
          ? 'Product is now live on your official storefront for shoppers to buy.'
          : 'Product has been unlisted from your storefront and hidden from public search.'
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Status Update Failed',
        description: err?.message || 'Could not update listing status.'
      });
    } finally {
      setTogglingId(null);
    }
  };

  const executeDeleteListing = async (id) => {
    try {
      const res = await fetch(`/api/supplier/listings/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText || '');
        throw new Error(txt || 'Failed to remove listing from store');
      }
      const data = await res.json().catch(() => ({}));
      setListings((prev) => prev.filter((x) => Number(x.id) !== Number(id)));

      if (data?.archived) {
        toast({
          title: 'Listing Archived & Unlisted',
          description: 'This product had past orders, so it was safely unlisted and archived to protect historical purchase records.'
        });
      } else {
        toast({
          title: 'Listing Removed',
          description: 'Product listing has been removed from your storefront.'
        });
      }
    } catch (err) {
      toast({
        title: 'Delete Failed',
        description: err?.message || 'Could not delete listing.',
        variant: 'destructive'
      });
    } finally {
      setListingToDelete(null);
    }
  };

  const copyProductLink = (listing) => {
    const url = `${window.location.origin}/listing/id/${encodeId(listing.id)}?supplier=${encodeId(supplierId)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(listing.id);
    toast({
      title: 'Link Copied',
      description: 'Public product link copied to clipboard.'
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Counts and filters
  const publishedCount = listings.filter((l) => l.published !== false && l.visibility !== 'unlisted').length;
  const unlistedCount = listings.filter((l) => l.published === false || l.visibility === 'unlisted').length;

  const filteredListings = listings.filter((l) => {
    const isPub = l.published !== false && l.visibility !== 'unlisted';
    if (statusFilter === 'published' && !isPub) return false;
    if (statusFilter === 'unlisted' && isPub) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.description && l.description.toLowerCase().includes(q)) ||
      (l.designer_name && l.designer_name.toLowerCase().includes(q)) ||
      (l.product_name && l.product_name.toLowerCase().includes(q))
    );
  });

  const totalListings = listings.length;
  const avgPrice = totalListings > 0
    ? (listings.reduce((acc, curr) => acc + (Number(curr.price) || 29.99), 0) / totalListings).toFixed(2)
    : '0.00';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16 pt-2">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <Store className="size-3.5" />
            <span>Storefront Products</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            My Store Listings
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            Manage apparel listed on your personal storefront. You can publish, unlist, or preview your products anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(storeUrl, '_blank')}
            className="h-9 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-bold text-xs gap-1.5 shadow-2xs"
          >
            <ExternalLink className="size-3.5 text-indigo-600" />
            <span>View Live Store</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/supplier/customize-store')}
            className="h-9 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-bold text-xs gap-1.5 shadow-2xs"
          >
            <Paintbrush className="size-3.5 text-violet-600" />
            <span>Customize Store</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setLocation('/supplier/listings/create')}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm shadow-indigo-600/20"
          >
            <Plus className="size-4" />
            <span>+ Create New Listing</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Products</p>
            <h3 className="text-xl font-extrabold text-slate-900">{totalListings}</h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Globe className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live in Store</p>
            <h3 className="text-xl font-extrabold text-slate-900">{publishedCount}</h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <EyeOff className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unlisted (Draft)</p>
            <h3 className="text-xl font-extrabold text-slate-900">{unlistedCount}</h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Tag className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Price</p>
            <h3 className="text-xl font-extrabold text-slate-900">₹{avgPrice}</h3>
          </div>
        </div>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, garment..."
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({listings.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('published')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'published'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live in Store ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unlisted')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'unlisted'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <EyeOff className="size-3" />
              Unlisted ({unlistedCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1">
            Showing {filteredListings.length} of {listings.length}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchListings}
            disabled={loading}
            className="h-8 px-2.5 text-xs text-slate-600 hover:text-indigo-600 rounded-lg"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="size-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold text-slate-500">Loading your store listings...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="p-14 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-4">
          <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
            <ShoppingBag className="size-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-extrabold text-slate-900 text-lg">
              {searchQuery ? 'No Matching Products Found' : 'No Products Listed in Your Store Yet'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search query or clear the filter to view all products.'
                : 'Turn your saved artwork designs into live products! Set your retail price, choose visibility, and list them directly on your storefront.'}
            </p>
          </div>
          {!searchQuery && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                onClick={() => setLocation('/supplier/listings/create')}
                className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm shadow-indigo-600/20"
              >
                <Plus className="size-4" />
                <span>+ List Your First Product</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation(`/supplier/saved-designs/${encodeId(supplierId)}`)}
                className="h-10 px-4 rounded-xl border-slate-300 text-slate-700 hover:text-indigo-600 font-bold text-xs gap-1.5"
              >
                <Sparkles className="size-3.5 text-violet-600" />
                <span>Browse Saved Designs</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredListings.map((listing) => {
            const side = activeSide[listing.id] || 'front';
            const pg = listing.preview_group;
            const frontImg = pg?.front?.url || listing.preview_url || '/templates/tshirt.png';
            const backImg = pg?.back?.url || null;
            const currentImg = side === 'back' && backImg ? backImg : frontImg;
            const hasBothSides = Boolean(frontImg && backImg);
            const isLive = listing.published !== false && listing.visibility !== 'unlisted';
            const productStoreUrl = `/listing/id/${encodeId(listing.id)}?supplier=${encodeId(supplierId)}`;

            return (
              <Card
                key={listing.id}
                className="group overflow-hidden border border-slate-200/90 hover:border-indigo-400/80 hover:shadow-xl transition-all duration-300 rounded-2xl bg-white flex flex-col hover:-translate-y-1"
              >
                {/* Mockup Preview Area */}
                <div className="aspect-[4/5] bg-gradient-to-b from-slate-50 via-white to-slate-100/60 p-5 flex items-center justify-center relative overflow-hidden">
                  <img
                    src={currentImg}
                    alt={listing.title}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out drop-shadow-sm"
                    onError={(e) => {
                      e.currentTarget.src = '/templates/tshirt.png';
                    }}
                  />

                  {/* Side Switcher (Front/Back) */}
                  {hasBothSides && (
                    <div
                      className="absolute top-3 left-3 flex bg-white/95 backdrop-blur-md rounded-xl p-0.5 border border-slate-200/80 shadow-2xs z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSide((prev) => ({ ...prev, [listing.id]: 'front' }))}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                          side === 'front'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSide((prev) => ({ ...prev, [listing.id]: 'back' }))}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                          side === 'back'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Back
                      </button>
                    </div>
                  )}

                  {/* Price Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200 font-extrabold shadow-sm px-2.5 py-1 text-xs">
                      ₹{Number(listing.price || 29.99).toFixed(2)}
                    </Badge>
                  </div>

                  {/* Visibility & Status Badge */}
                  <div className={`absolute z-10 ${hasBothSides ? 'bottom-3 left-3' : 'top-3 left-3'}`}>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold bg-emerald-600/90 text-white px-2.5 py-1 rounded-lg backdrop-blur-md shadow-xs">
                        <span className="size-1.5 rounded-full bg-white animate-pulse" />
                        Live in Store
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold bg-amber-500/95 text-white px-2.5 py-1 rounded-lg backdrop-blur-md shadow-xs">
                        <EyeOff className="size-3" />
                        Unlisted (Hidden)
                      </span>
                    )}
                  </div>
                </div>

                {/* Content & Details */}
                <CardContent className="p-4 flex flex-col flex-grow justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-bold uppercase tracking-wider">
                        <Shirt className="size-3" />
                        <span>Custom Apparel</span>
                      </div>
                      {listing.design_key && (
                        <span
                          className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80 truncate max-w-[140px]"
                        >
                          {listing.design_key}
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-1">
                      {listing.title}
                    </h3>
                    {listing.description && (
                      <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">
                        {listing.description}
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 mt-auto">
                    <Button
                      size="sm"
                      onClick={() => window.open(productStoreUrl, '_blank')}
                      className="flex-1 h-8 px-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold transition-colors shadow-2xs gap-1.5 truncate"
                      title="Open Product in Storefront"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span className="truncate">Store</span>
                    </Button>

                    {/* Toggle Unlist / Publish Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleListingStatus(listing)}
                      disabled={togglingId === listing.id}
                      className={`h-8 px-2.5 rounded-xl font-bold text-xs gap-1 transition-all ${
                        isLive
                          ? 'border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100 hover:text-amber-800'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-800'
                      }`}
                      title={isLive ? 'Unlist product from your public store' : 'Publish product live to store'}
                    >
                      {togglingId === listing.id ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : isLive ? (
                        <>
                          <EyeOff className="size-3.5 shrink-0" />
                          <span>Unlist</span>
                        </>
                      ) : (
                        <>
                          <Eye className="size-3.5 shrink-0" />
                          <span>Publish</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyProductLink(listing)}
                      className="h-8 px-2 rounded-xl border-slate-200 text-slate-600 hover:text-indigo-600"
                      title="Copy Public Product Link"
                    >
                      {copiedId === listing.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setListingToDelete(listing)}
                      className="h-8 px-2 rounded-xl border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      title="Remove Listing from Store"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(listingToDelete)} onOpenChange={(open) => !open && setListingToDelete(null)}>
        <AlertDialogContent className="max-w-md bg-white rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold text-slate-900">
              Remove Listing from Store?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Are you sure you want to remove <strong className="text-slate-800">"{listingToDelete?.title}"</strong> from your storefront? Customers will no longer be able to purchase this product. You can re-list it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="h-9 rounded-xl text-xs font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => listingToDelete && executeDeleteListing(listingToDelete.id)}
              className="h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              Remove Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

