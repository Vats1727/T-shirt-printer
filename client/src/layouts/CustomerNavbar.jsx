import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import {
  Store,
  Search,
  ShoppingBag,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  Compass,
  ShoppingBasket
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

export function CustomerNavbar({ onSearchSubmit, initialSearch = '' }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { cartCount, setIsCartOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(searchQuery);
    } else {
      const sp = new URLSearchParams();
      if (searchQuery.trim()) sp.set('search', searchQuery.trim());
      setLocation(`/customer/dashboard?${sp.toString()}`);
    }
  };

  const navLinks = [
    {
      title: 'Stores Catalog',
      url: '/customer/dashboard',
      active: location === '/customer/dashboard' || location === '/customer',
      icon: Store,
      badge: 'Explore'
    },
    {
      title: 'My Orders',
      url: '/customer/orders',
      active: location.startsWith('/customer/orders') || location.startsWith('/customer/order'),
      icon: ShoppingBag,
      badge: null
    }
  ];

  return (
    <header className="sticky top-0 z-40 w-full select-none font-sans bg-white border-b border-slate-200/80 shadow-xs">
      {/* Top Main Bar */}
      <div className="px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          
          {/* Brand & Customer Identity */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <Link href="/customer/dashboard" className="flex items-center gap-2.5 group cursor-pointer">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                <Store className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">
                    PRINT<span className="text-emerald-600">PORTAL</span>
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    CUSTOMER
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 leading-none">
                  Creator Stores & Merchandising Network
                </span>
              </div>
            </Link>
          </div>

          {/* Central Search Bar */}
          <form
            onSubmit={handleSearch}
            className="w-full md:flex-1 max-w-2xl flex items-center h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-50/60 hover:bg-white focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 transition-all shadow-2xs"
          >
            <div className="h-full bg-slate-100/80 text-slate-700 font-semibold text-xs px-3.5 flex items-center border-r border-slate-200 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
              <span>Stores & Hubs</span>
            </div>
            <div className="relative flex-1 flex items-center h-full">
              <Search className="absolute left-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search designer storefronts, print hubs, styles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full pl-9 pr-3 text-xs bg-transparent text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-full px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Right User Account & Cart Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
              title="Open Shopping Cart"
            >
              <ShoppingBasket className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Bag</span>
              {cartCount > 0 && (
                <span className="size-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-extrabold shadow-2xs">
                  {cartCount}
                </span>
              )}
            </button>

            <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer outline-none border border-transparent hover:border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-400 leading-none">
                      Customer, {user?.name?.split(' ')[0] || 'Shopper'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      My Account
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
                    {user?.email || user?.name || 'Customer'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />

                <DropdownMenuItem
                  onClick={() => setLocation('/customer/dashboard')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <Compass className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                  Explore Stores Directory
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setLocation('/customer/orders')}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                  My Purchase Orders
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
      </div>

      {/* Sub-Navigation Strip (Modern Segmented Tab Control with custom-scrollbar) */}
      <div className="bg-white border-t border-slate-200/80 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between overflow-x-auto custom-scrollbar pt-2 pb-2.5 px-0.5 gap-3">
          <nav className="w-full min-w-max flex-1 flex items-center p-1.5 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.url}
                  href={link.url}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer group text-center shrink-0",
                    link.active
                      ? "bg-white text-emerald-600 font-bold shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 transition-colors shrink-0",
                      link.active
                        ? "text-emerald-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span>{link.title}</span>
                  {link.badge && (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold shadow-2xs transition-colors shrink-0",
                        link.active
                          ? "bg-emerald-600 text-white"
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
        </div>
      </div>
    </header>
  );
}

export default CustomerNavbar;

