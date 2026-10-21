import React, { useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Store as StoreIcon, 
  ShoppingBag, 
  Upload, 
  Camera, 
  Sparkles, 
  Paintbrush, 
  Search, 
  LogIn,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

export interface HeaderProps {
  storeSettings?: any;
  storeTitle?: string;
  isOwner?: boolean;
  onLogoUpdated?: (newLogoUrl: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  cartCount?: number;
}

export default function Header({
  storeSettings,
  storeTitle = 'Signature Threads',
  isOwner = false,
  onLogoUpdated,
  selectedCategory = 'all',
  onSelectCategory,
  searchQuery = '',
  onSearchChange,
  cartCount = 0,
}: HeaderProps) {
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const logoUrl = storeSettings?.logo_url;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select a valid image file (PNG, JPG, SVG, WebP).',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Logo image must be smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const token = localStorage.getItem('token');

          // 1. Upload file to backend asset storage
          const res = await fetch('/api/assets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({
              dataUrl,
              filename: file.name,
              metadata: { type: 'store_logo' },
            }),
          });

          if (!res.ok) {
            throw new Error('Failed to upload logo image to server.');
          }

          const assetData = await res.json();
          const newLogoUrl = assetData.url;

          // 2. Persist to store settings
          if (token) {
            const patchRes = await fetch('/api/supplier/store-settings', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                store_settings: {
                  logo_url: newLogoUrl,
                },
              }),
            });

            if (!patchRes.ok) {
              console.warn('Failed to update store settings with new logo');
            }
          }

          if (onLogoUpdated) {
            onLogoUpdated(newLogoUrl);
          }

          toast({
            title: 'Logo Updated Successfully!',
            description: 'Your custom store logo is now active in the navbar and footer.',
          });
        } catch (err: any) {
          toast({
            title: 'Upload Failed',
            description: err?.message || 'Unable to upload logo.',
            variant: 'destructive',
          });
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      reader.onerror = () => {
        setUploading(false);
        toast({
          title: 'Read Error',
          description: 'Failed to read image file.',
          variant: 'destructive',
        });
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploading(false);
      toast({
        title: 'Upload Error',
        description: err?.message || 'Could not process logo file.',
        variant: 'destructive',
      });
    }
  };

  const navCategories = [
    { id: 'all', label: 'All Garments' },
    { id: 't-shirt', label: 'T-Shirts' },
    { id: 'hoodie', label: 'Hoodies' },
    { id: 'sweatshirt', label: 'Sweatshirts' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-900/90 border-b border-slate-800 text-slate-100 shadow-md transition-all">
      {/* Hidden File Input for Logo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoUpload}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand / Logo Section */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            {logoUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt={storeTitle}
                  className="h-9 sm:h-11 w-auto max-w-[160px] sm:max-w-[200px] object-contain rounded-lg border border-slate-700/60 shadow-xs bg-slate-950/40 p-1"
                />
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white hidden md:inline-block">
                  {storeTitle}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="size-9 sm:size-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <StoreIcon className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-white leading-tight">
                    {storeTitle}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                    Official Storefront
                  </span>
                </div>
              </div>
            )}

            {/* If Owner: Upload/Change Logo Trigger Overlay */}
            {isOwner && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload or change store logo"
                className="absolute -bottom-1 -right-1 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-1 shadow-md border border-slate-900 flex items-center justify-center"
              >
                {uploading ? (
                  <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
              </button>
            )}
          </div>

          {isOwner && !logoUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="hidden lg:inline-flex items-center gap-1.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border-indigo-500/30 h-8 px-2.5 rounded-lg"
            >
              <Upload className="size-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload Logo'}</span>
            </Button>
          )}
        </div>

        {/* Center Category Navigation (Desktop) */}
        {onSelectCategory && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/40 p-1.5 rounded-2xl border border-slate-800/80">
            {navCategories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Action Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Toggle if supported */}
          {onSearchChange && (
            <div className="relative flex items-center">
              {showSearch ? (
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                  <Search className="size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search collection..."
                    autoFocus
                    className="bg-transparent border-none outline-hidden text-xs text-white placeholder-slate-500 w-32 sm:w-48"
                    onBlur={() => !searchQuery && setShowSearch(false)}
                  />
                </div>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowSearch(true)}
                  className="size-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Search Store"
                >
                  <Search className="size-4" />
                </Button>
              )}
            </div>
          )}

          {/* Cart Icon */}
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="size-9 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 relative"
              title="Cart"
            >
              <ShoppingBag className="size-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 size-4 bg-indigo-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>

          {/* Owner Quick Action or Public Auth Link */}
          {isOwner ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setLocation('/supplier/customize-store')}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-9 px-3.5 shadow-md shadow-indigo-600/20"
              >
                <Paintbrush className="size-3.5" />
                <span>Customize Store</span>
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700 h-9 px-3.5 rounded-xl"
              >
                <LogIn className="size-3.5" />
                <span>Sign In</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
