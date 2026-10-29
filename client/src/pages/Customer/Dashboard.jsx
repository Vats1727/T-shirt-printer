import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Search,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Palette,
  Factory,
  ChevronRight,
  SlidersHorizontal,
  RefreshCw,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { encodeId } from '@/utils/idEncoder';
import { cn } from '@/utils/cn';

// Predefined store theme gradients matching customizer
const THEME_GRADIENTS = {
  midnight: 'from-slate-950 via-indigo-950 to-slate-900 text-white',
  minimal_light: 'from-slate-100 via-white to-slate-100 text-slate-900 border-b border-slate-200',
  streetwear_dark: 'from-neutral-950 via-zinc-900 to-neutral-950 text-white',
  cyber_neon: 'from-slate-950 via-purple-950 to-cyan-950 text-white',
  sunset_amber: 'from-slate-900 via-amber-950 to-orange-950 text-white',
  emerald_luxury: 'from-slate-950 via-emerald-950 to-teal-950 text-white'
};

export default function CustomerDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'designers' | 'providers'
  const [sortBy, setSortBy] = useState('products'); // 'products' | 'newest' | 'alpha'

  useEffect(() => {
    loadStores();
  }, [selectedCategory, sortBy]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (sortBy) params.set('sort', sortBy);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/customer/stores?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadStores();
  };

  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return stores;
    const q = searchQuery.toLowerCase().trim();
    return stores.filter((s) => {
      const matchName = (s.store_name || '').toLowerCase().includes(q);
      const matchOwner = (s.name || '').toLowerCase().includes(q);
      const matchTagline = (s.tagline || '').toLowerCase().includes(q);
      return matchName || matchOwner || matchTagline;
    });
  }, [stores, searchQuery]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wide">
            <Sparkles className="size-3.5" />
            <span>Official Creator Marketplace Directory</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Discover Creator Storefronts & Fulfillment Hubs
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Browse public storefronts curated by independent fashion designers and verified print fulfillment facilities.
            Explore exclusive custom garments and proceed directly to order.
          </p>

          <div className="flex items-center gap-4 pt-2 text-xs text-slate-400 font-semibold">
            <div className="flex items-center gap-1.5">
              <Store className="size-4 text-emerald-400" />
              <span>{stores.length} Active Stores</span>
            </div>
          </div>
        </div>

        {/* Decorative backdrop glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-40 -top-20 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              All Stores ({stores.length})
            </button>
            <button
              onClick={() => setSelectedCategory('designers')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                selectedCategory === 'designers'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Palette className="size-3.5" />
              <span>Designer Collections</span>
            </button>
            <button
              onClick={() => setSelectedCategory('providers')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                selectedCategory === 'providers'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Factory className="size-3.5" />
              <span>Print Hub Stores</span>
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by store or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/60"
              />
            </form>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="products">Most Products</option>
              <option value="newest">Newest First</option>
              <option value="alpha">A to Z</option>
            </select>

            <Button
              variant="outline"
              size="icon"
              onClick={loadStores}
              disabled={loading}
              className="size-9 rounded-xl border-slate-200 text-slate-600 hover:text-emerald-600 shrink-0 cursor-pointer"
              title="Refresh Stores"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* Stores Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="size-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Loading available storefronts...</p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="py-20 text-center max-w-md mx-auto space-y-4 bg-white rounded-2xl border border-slate-200 p-8">
          <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <Store className="size-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800">No Stores Found</h2>
            <p className="text-xs text-slate-500">
              {searchQuery
                ? `No stores matched your search "${searchQuery}". Try a different keyword or clear your filter.`
                : 'No active creator stores are registered yet in this category.'}
            </p>
          </div>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="rounded-xl text-xs font-bold"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => {
            const gradientClass = THEME_GRADIENTS[store.theme] || THEME_GRADIENTS.midnight;
            const storeUrl = `/store/${encodeId(store.id)}`;

            return (
              <Card
                key={store.id}
                className="group rounded-2xl border border-slate-200/90 overflow-hidden bg-white hover:border-emerald-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                {/* Store Header with Custom Theme Styling - Clickable to open in new tab */}
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('relative p-6 bg-gradient-to-tr transition-all duration-300 block select-none cursor-pointer', gradientClass)}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Logo / Brand Avatar */}
                    <div className="size-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      {store.logo_url ? (
                        <img
                          src={store.logo_url}
                          alt={store.store_name}
                          className="size-full object-contain p-1.5"
                        />
                      ) : (
                        <Store className="size-7 text-white" />
                      )}
                    </div>

                    {/* Store Role & Live Badge */}
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        className={cn(
                          'text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border shadow-xs',
                          store.is_provider
                            ? 'bg-indigo-500/25 text-indigo-100 border-indigo-400/30'
                            : 'bg-violet-500/25 text-violet-100 border-violet-400/30'
                        )}
                      >
                        {store.is_provider ? (
                          <span className="flex items-center gap-1">
                            <Factory className="size-3" />
                            <span>Print Hub</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Palette className="size-3" />
                            <span>Designer Studio</span>
                          </span>
                        )}
                      </Badge>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-200">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Store</span>
                      </div>
                    </div>
                  </div>

                  {/* Store Titles */}
                  <div className="mt-4 space-y-1">
                    <h3 className="font-extrabold text-xl tracking-tight text-white drop-shadow-xs line-clamp-1 group-hover:text-emerald-200 transition-colors">
                      {store.store_name}
                    </h3>
                    <p className="text-xs opacity-85 font-medium text-slate-200 line-clamp-1 flex items-center gap-1.5">
                      <span>Curated by {store.name}</span>
                      <span className="opacity-50">•</span>
                      <span className="text-[11px] opacity-75">{store.is_provider ? 'Fulfillment Partner' : 'Fashion Creator'}</span>
                    </p>
                  </div>
                </a>

                {/* Card Body - Focused on Brand & Store Information (No product mockups) */}
                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Tagline / Bio & Announcement */}
                  <div className="space-y-3">
                    <p className="text-xs sm:text-[13px] text-slate-600 line-clamp-3 leading-relaxed min-h-[42px]">
                      {store.tagline || (store.is_provider ? 'Verified print fulfillment facility providing premium apparel manufacturing.' : 'Curated creator apparel collection printed on high quality blanks.')}
                    </p>

                    {store.show_announcement && store.announcement && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                        <Flame className="size-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{store.announcement}</span>
                      </div>
                    )}
                  </div>

                  {/* Action CTA - Opens in New Tab */}
                  <div className="pt-2">
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl h-11 transition-all shadow-xs group-hover:bg-emerald-600 cursor-pointer"
                    >
                      <span>Visit Storefront</span>
                      <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

