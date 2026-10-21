import React, { useRef, useState } from 'react';
import { 
  Store as StoreIcon, 
  Upload, 
  Camera, 
  Instagram, 
  Twitter, 
  Globe, 
  ShieldCheck, 
  Truck, 
  Sparkles, 
  RotateCcw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export interface FooterProps {
  storeSettings?: any;
  storeTitle?: string;
  storeTagline?: string;
  isOwner?: boolean;
  onLogoUpdated?: (newLogoUrl: string) => void;
  onSelectCategory?: (category: string) => void;
}

export default function Footer({
  storeSettings,
  storeTitle = 'Signature Threads',
  storeTagline = 'Handcrafted high-density apparel printed on demand.',
  isOwner = false,
  onLogoUpdated,
  onSelectCategory,
}: FooterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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

          if (!res.ok) throw new Error('Failed to upload logo asset');
          const assetData = await res.json();
          const newLogoUrl = assetData.url;

          if (token) {
            await fetch('/api/supplier/store-settings', {
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
          }

          if (onLogoUpdated) {
            onLogoUpdated(newLogoUrl);
          }

          toast({
            title: 'Logo Updated Successfully!',
            description: 'Your custom store logo is now updated across the store.',
          });
        } catch (err: any) {
          toast({
            title: 'Upload Failed',
            description: err?.message || 'Unable to update logo.',
            variant: 'destructive',
          });
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploading(false);
      toast({
        title: 'Upload Error',
        description: err?.message || 'Could not process logo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-16 pb-12 mt-auto font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoUpload}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Assurance Feature Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-12 mb-12 border-b border-slate-800/60 text-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
              <Truck className="size-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Free Express Delivery</div>
              <div className="text-slate-500">Orders over ₹500 qualify automatically</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">High-Density DTG</div>
              <div className="text-slate-500">Vibrant wash-resistant garment prints</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Easy Exchanges</div>
              <div className="text-slate-500">Hassle-free 30-day garment guarantee</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Secure Checkout</div>
              <div className="text-slate-500">256-bit encrypted merchant payment</div>
            </div>
          </div>
        </div>

        {/* Main Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12">
          {/* Brand Info & Logo Column (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative group">
                  <img
                    src={logoUrl}
                    alt={storeTitle}
                    className="h-10 w-auto max-w-[200px] object-contain rounded-lg border border-slate-800 bg-slate-900 p-1"
                  />
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-1 shadow-md border border-slate-900"
                      title="Update logo"
                    >
                      <Camera className="size-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md">
                  <StoreIcon className="size-5" />
                </div>
              )}
              <span className="font-black text-xl text-white tracking-tight">{storeTitle}</span>
            </div>

            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              {storeTagline}
            </p>

            {isOwner && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 text-xs bg-slate-900 hover:bg-slate-800 text-indigo-300 border-slate-800 rounded-xl"
                >
                  <Upload className="size-3.5" />
                  <span>{uploading ? 'Updating Logo...' : logoUrl ? 'Change Store Logo' : 'Upload Store Logo'}</span>
                </Button>
              </div>
            )}

            {/* Social Icons */}
            {(storeSettings?.social_instagram || storeSettings?.social_twitter || storeSettings?.social_website) && (
              <div className="flex items-center gap-2.5 pt-2">
                {storeSettings.social_instagram && (
                  <a
                    href={storeSettings.social_instagram.startsWith('http') ? storeSettings.social_instagram : `https://instagram.com/${storeSettings.social_instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800 text-slate-400"
                    title="Instagram"
                  >
                    <Instagram className="size-4" />
                  </a>
                )}
                {storeSettings.social_twitter && (
                  <a
                    href={storeSettings.social_twitter.startsWith('http') ? storeSettings.social_twitter : `https://twitter.com/${storeSettings.social_twitter.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800 text-slate-400"
                    title="Twitter / X"
                  >
                    <Twitter className="size-4" />
                  </a>
                )}
                {storeSettings.social_website && (
                  <a
                    href={storeSettings.social_website.startsWith('http') ? storeSettings.social_website : `https://${storeSettings.social_website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800 text-slate-400"
                    title="Official Website"
                  >
                    <Globe className="size-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Categories Column (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-bold text-white text-xs tracking-wider uppercase">Collection Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onSelectCategory?.('all')}
                  className="hover:text-white transition-colors text-left"
                >
                  All Garments
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory?.('t-shirt')}
                  className="hover:text-white transition-colors text-left"
                >
                  Crewneck T-Shirts
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory?.('hoodie')}
                  className="hover:text-white transition-colors text-left"
                >
                  Fleece Pullover Hoodies
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory?.('sweatshirt')}
                  className="hover:text-white transition-colors text-left"
                >
                  Classic Sweatshirts
                </button>
              </li>
            </ul>
          </div>

          {/* Store Support & Policy Column (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-bold text-white text-xs tracking-wider uppercase">Direct-To-Garment Production</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every garment is individually crafted on certified sustainable combed cotton blanks using water-based inks for an ultra-soft feel and durable print clarity.
            </p>
            <div className="pt-2 text-xs text-slate-500">
              Need custom volume orders or printing inquiries? Reach out via your verified provider portal.
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} <span className="text-slate-300 font-semibold">{storeTitle}</span>. Powered by On-Demand Garment Printing.
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer">Garment Care Guide</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
