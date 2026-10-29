import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  Search,
  ShoppingBag,
  Plus,
  RefreshCw,
  User,
  LogOut,
  HelpCircle,
  Package,
  Users,
  LayoutTemplate,
  CheckCircle2,
  ChevronDown,
  Building2,
  Store,
  Paintbrush,
  PlusCircle,
  ExternalLink,
  Tag
} from 'lucide-react';
import { encodeId } from '@/utils/idEncoder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

export function PrintProviderNavbar({ onRefresh, isRefreshing }) {
  const [location, setLocation] = useLocation();
  const { user, token, logout } = useAuth();

  // Search state for storefront search bar
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time query to track pending orders requiring fulfillment
  const { data: adminOrdersRaw } = useQuery({
    queryKey: ['/api/admin/orders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  const adminOrders = Array.isArray(adminOrdersRaw)
    ? adminOrdersRaw
    : (Array.isArray(adminOrdersRaw?.orders) ? adminOrdersRaw.orders : []);

  const pendingOrdersCount = adminOrders.filter((o) => {
    const s = (o.status || '').toLowerCase();
    return !s || ['pending', 'placed', 'processing', 'in_production'].includes(s);
  }).length;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchCategory !== 'all') params.set('cat', searchCategory);
    
    setLocation(`/admin/dashboard?${params.toString()}`);
  };

  const providerId = user?.id || user?.sub;
  const storeUrl = providerId ? `/store/${encodeId(providerId)}` : '/store';

  const navLinks = [
    {
      title: 'Dashboard',
      url: '/admin/dashboard',
      active: location === '/admin/dashboard',
      icon: Factory
    },
    {
      title: 'Garment Catalog',
      url: '/admin/clothes',
      active: location.startsWith('/admin/clothes'),
      icon: Package
    },
    {
      title: 'Orders & Production',
      url: '/admin/orders',
      active: location.startsWith('/admin/orders') || location === '/orders',
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      icon: ShoppingBag
    },
    {
      title: 'Associated Designers',
      url: '/admin/designers',
      active: location.startsWith('/admin/designers'),
      icon: Users
    },
    {
      title: 'Designer Designs',
      url: '/admin/designer-designs',
      active: location.startsWith('/admin/designer-designs'),
      icon: LayoutTemplate
    },
    {
      title: 'Store Product Listings',
      url: '/admin/listings',
      active: location === '/admin/listings',
      icon: Store
    },
    {
      title: 'Customize Storefront',
      url: '/admin/customize-store',
      active: location.includes('customize-store') || location.includes('store-settings'),
      icon: Paintbrush
    },
    {
      title: 'Add New Listing',
      url: '/admin/listings/create',
      active: location.includes('/admin/listings/create'),
      icon: PlusCircle
    }
  ];

  return (
    <header className="sticky top-0 z-40 w-full select-none font-sans bg-white border-b border-slate-200/80 shadow-xs">
      {/* Top Main Navigation Bar - Project's Signature Clean Aesthetic with Indigo / Violet Brand Accent */}
      <div className="px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          
          {/* Brand & Portal Identity */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                <Factory className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                    PRINT<span className="text-indigo-600">PORTAL</span>
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60">
                    PROVIDER
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 leading-none">
                  Production & Fulfillment Hub
                </span>
              </div>
            </Link>

            {/* Mobile Actions (Visible on small screens) */}
            <div className="flex items-center gap-2 md:hidden">
              <Button
                size="sm"
                onClick={() => setLocation('/admin/clothes')}
                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg px-2.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Blank
              </Button>
            </div>
          </div>

          {/* Storefront Central Search Bar (Expanded width) */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full md:flex-1 max-w-4xl flex items-center h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-50/60 hover:bg-white focus-within:bg-white focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-2xs"
          >
            {/* Category Filter Dropdown */}
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="h-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs px-3 border-r border-slate-200 outline-none cursor-pointer transition-colors"
            >
              <option value="all">All Garments</option>
              <option value="men">Men's Fit</option>
              <option value="women">Women's Fit</option>
            </select>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search base garments, fabrics, styles, or cut codes..."
              className="flex-1 h-full px-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />

            {/* Search Button with Indigo Accent */}
            <button
              type="submit"
              className="h-full px-4 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Search Catalog"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Right Utility & Status Controls */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {/* View Store Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(storeUrl, '_blank')}
              className="h-9 px-3 rounded-xl border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-semibold text-xs gap-1.5 shadow-2xs cursor-pointer"
              title="Open Public Facility Storefront"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
              <span>View Store</span>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            </Button>

            {/* Primary Action Button (+ Add Garment in Project Indigo) */}
            <Button
              size="sm"
              onClick={() => setLocation('/admin/clothes')}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl px-3.5 shadow-sm shadow-indigo-600/20 gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Garment</span>
            </Button>

            {/* Account & Facility Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer outline-none border border-transparent hover:border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <Building2 className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-400 leading-none">
                      Hello, {user?.name?.split(' ')[0] || 'Provider'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      Facility Console
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 text-slate-800 shadow-xl rounded-xl p-1">
                <DropdownMenuLabel className="p-2 pb-1.5 text-xs text-slate-500 font-normal">
                  Signed in as
                  <span className="block font-bold text-slate-900 truncate">{user?.email || user?.name || 'Print Provider'}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                
                <DropdownMenuItem
                  onClick={() => setLocation('/admin/listings')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <Store className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                  Store Product Listings
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setLocation('/admin/customize-store')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <Paintbrush className="w-3.5 h-3.5 mr-2 text-violet-600" />
                  Customize Storefront
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open(storeUrl, '_blank')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                  View Public Store
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-100" />

                <DropdownMenuItem
                  onClick={() => setLocation('/admin/profile')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <User className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                  Facility Profile & Credentials
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setLocation('/admin/orders')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                  Production Queue ({pendingOrdersCount})
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    try {
                      window.open('mailto:portaladmin@gmail.com');
                    } catch {}
                  }}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                  Help & Portal Support
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-slate-100" />

                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-xs font-semibold py-2 rounded-lg hover:bg-rose-50 text-rose-600 focus:text-rose-600"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2 text-rose-500" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Strip (Modern Segmented Tab Control - Full Width Expanded) */}
      <div className="bg-white border-t border-slate-200/80 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between overflow-x-auto custom-scrollbar pt-2 pb-2.5 px-0.5 gap-3">
          {/* Segmented Navigation Tabs Expanded */}
          <nav className="w-full min-w-max flex-1 flex items-center p-1.5 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.url}
                  href={link.url}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer group text-center shrink-0",
                    link.active
                      ? "bg-white text-indigo-600 font-bold shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 transition-colors shrink-0",
                      link.active
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span className="truncate">{link.title}</span>
                  {link.badge && (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold shadow-2xs transition-colors shrink-0",
                        link.active
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      )}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Refresh / Sync Control */}
          {onRefresh && (
            <div className="flex items-center pl-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-9 text-[11px] text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg px-2.5 gap-1.5 cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
                title="Refresh Portal Data"
              >
                <RefreshCw
                  className={cn(
                    "w-3 h-3 text-indigo-600",
                    isRefreshing && "animate-spin"
                  )}
                />
                <span className="hidden sm:inline font-semibold">Sync Data</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default PrintProviderNavbar;
