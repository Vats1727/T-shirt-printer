import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { encodeId } from '@/utils/idEncoder';
import {
  Palette,
  Search,
  ShoppingBag,
  Store,
  RefreshCw,
  User,
  LogOut,
  HelpCircle,
  Package,
  LayoutTemplate,
  Paintbrush,
  ExternalLink,
  ChevronDown,
  Sparkles,
  PlusCircle,
  Factory,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';
import { toast } from '@/hooks/use-toast';

export function DesignerNavbar({ onRefresh, isRefreshing, onChangeProvider }) {
  const [location, setLocation] = useLocation();
  const { user, token, logout } = useAuth();
  const CLIENT_ORIGIN =
    typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin.replace(/\/$/, '')
      : '';

  const [searchQuery, setSearchQuery] = useState('');

  // Real-time query to track designer's orders requiring action/updates
  const { data: designerOrdersRaw } = useQuery({
    queryKey: ['/api/supplier/orders'],
    queryFn: async () => {
      const res = await fetch('/api/supplier/orders', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  const designerOrders = Array.isArray(designerOrdersRaw)
    ? designerOrdersRaw
    : Array.isArray(designerOrdersRaw?.orders)
    ? designerOrdersRaw.orders
    : [];

  const pendingOrdersCount = designerOrders.filter((o) => {
    const s = (o.status || '').toLowerCase();
    return !s || ['pending', 'placed', 'processing', 'in_production'].includes(s);
  }).length;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    setLocation(`/supplier/dashboard?${params.toString()}`);
  };

  const openStore = () => {
    const sid = user && (user.id || user.sub) ? user.id || user.sub : '';
    const url = sid ? `${CLIENT_ORIGIN}/store/${encodeId(sid)}` : `${CLIENT_ORIGIN}/store`;
    window.open(url, '_blank');
  };

  const designerId = user?.id || user?.sub;
  const savedDesignsUrl = designerId
    ? `/supplier/saved-designs/${encodeId(designerId)}`
    : '/supplier/saved-designs';

  const navLinks = [
    {
      title: 'Studio Dashboard',
      url: '/supplier/dashboard',
      active: location === '/supplier/dashboard',
      icon: Palette
    },
    {
      title: 'Saved Designs',
      url: savedDesignsUrl,
      active: location.includes('/supplier/saved-designs'),
      icon: LayoutTemplate
    },
    {
      title: 'Orders & Production',
      url: '/supplier/orders',
      active: location.startsWith('/supplier/order'),
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      icon: ShoppingBag
    },
    {
      title: 'Store Product Listings',
      url: '/supplier/listings',
      active: location === '/supplier/listings',
      icon: Store
    },
    {
      title: 'Customize Storefront',
      url: '/supplier/customize-store',
      active: location.includes('customize-store') || location.includes('store-settings'),
      icon: Paintbrush
    },
    {
      title: 'Add New Listing',
      url: '/supplier/listings/create',
      active: location.includes('/supplier/listings/create'),
      icon: PlusCircle
    }
  ];

  return (
    <header className="sticky top-0 z-40 w-full select-none font-sans bg-white border-b border-slate-200/80 shadow-xs">
      {/* Top Main Navigation Bar */}
      <div className="px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          {/* Brand & Portal Identity */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <Link href="/supplier/dashboard" className="flex items-center gap-2.5 group cursor-pointer">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-violet-600/20 group-hover:scale-105 transition-transform">
                <Palette className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                    PRINT<span className="text-violet-600">PORTAL</span>
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded border border-violet-200/60">
                    DESIGNER
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 leading-none">
                  Creator Studio & Merchandising Hub
                </span>
              </div>
            </Link>

            {/* Mobile Actions */}
            <div className="flex items-center gap-2 md:hidden">
              <Button
                size="sm"
                onClick={openStore}
                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg px-2.5 shadow-xs"
              >
                <Store className="w-3.5 h-3.5 mr-1" />
                Store
              </Button>
            </div>
          </div>

          {/* Central Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full md:flex-1 max-w-2xl flex items-center h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-50/60 hover:bg-white focus-within:bg-white focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-2xs"
          >
            <div className="h-full bg-slate-100/80 text-slate-700 font-semibold text-xs px-3.5 flex items-center border-r border-slate-200 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 mr-1.5" />
              <span>Catalog & Studio</span>
            </div>
            <div className="relative flex-1 flex items-center h-full">
              <Search className="absolute left-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search blank garments, styles, models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full pl-9 pr-3 text-xs bg-transparent text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-full px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Right Action Icons & User Account */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {/* View My Public Storefront Button */}
            <Button
              size="sm"
              onClick={openStore}
              className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs shadow-indigo-600/20"
              title="Launch Public Merchandising Storefront"
            >
              <Store className="w-4 h-4" />
              <span>View Store</span>
              <ExternalLink className="w-3 h-3 opacity-80 ml-0.5" />
            </Button>

            {/* Account & Facility Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer outline-none border border-transparent hover:border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center font-bold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-400 leading-none">
                      Creator, {user?.name?.split(' ')[0] || 'Designer'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      Studio Console
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-white border border-slate-200 text-slate-800 shadow-xl rounded-xl p-1"
              >
                <DropdownMenuLabel className="p-2 pb-1.5 text-xs text-slate-500 font-normal">
                  Signed in as
                  <span className="block font-bold text-slate-900 truncate">
                    {user?.email || user?.name || 'Designer'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />

                <DropdownMenuItem
                  onClick={() => setLocation('/supplier/profile')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <User className="w-3.5 h-3.5 mr-2 text-violet-600" />
                  Studio Profile & Credentials
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setLocation('/supplier/orders')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-2 text-violet-600" />
                  My Orders ({pendingOrdersCount})
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setLocation('/supplier/listings')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <Store className="w-3.5 h-3.5 mr-2 text-violet-600" />
                  Store Product Listings
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setLocation('/supplier/customize-store')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <Paintbrush className="w-3.5 h-3.5 mr-2 text-violet-600" />
                  Customize Storefront
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    try {
                      window.open('mailto:portaladmin@gmail.com');
                    } catch {}
                  }}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-2 text-violet-600" />
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
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer group text-center shrink-0',
                    link.active
                      ? 'bg-white text-indigo-600 font-bold shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 transition-colors shrink-0',
                      link.active
                        ? 'text-indigo-600'
                        : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  <span className="truncate">{link.title}</span>
                  {link.badge && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-bold shadow-2xs transition-colors shrink-0',
                        link.badge === 'Required'
                          ? 'bg-amber-500 text-white animate-pulse'
                          : link.badge === 'Connected'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : link.active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      )}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Sync Control */}
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
                    'w-3 h-3 text-indigo-600',
                    isRefreshing && 'animate-spin'
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

export default DesignerNavbar;
