import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Paintbrush, 
  Store, 
  ExternalLink, 
  Save, 
  Sparkles, 
  Flame, 
  Instagram, 
  Twitter, 
  Globe, 
  Check, 
  ArrowLeft,
  Eye,
  Shirt
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const THEME_OPTIONS = [
  {
    id: 'midnight',
    name: 'Midnight Luxe',
    desc: 'Deep obsidian & indigo gradient with luminous glassmorphism',
    previewBg: 'from-slate-950 via-indigo-950 to-slate-900',
    accentColor: '#6366f1'
  },
  {
    id: 'minimal_light',
    name: 'Minimal Light',
    desc: 'Crisp porcelain white & slate with refined modern typography',
    previewBg: 'from-slate-100 via-white to-slate-100 text-slate-900',
    accentColor: '#0f172a'
  },
  {
    id: 'streetwear_dark',
    name: 'Streetwear Dark',
    desc: 'Carbon graphite & industrial black with bold amber accents',
    previewBg: 'from-neutral-950 via-zinc-900 to-neutral-950',
    accentColor: '#f59e0b'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    desc: 'Electric purple & cyan neon with futuristic edge',
    previewBg: 'from-slate-950 via-purple-950 to-cyan-950',
    accentColor: '#06b6d4'
  },
  {
    id: 'sunset_amber',
    name: 'Sunset Amber',
    desc: 'Warm sunset glow and bronze tones for artisanal brands',
    previewBg: 'from-slate-900 via-amber-950 to-orange-950',
    accentColor: '#ea580c'
  },
  {
    id: 'emerald_luxury',
    name: 'Emerald Luxury',
    desc: 'Deep bottle green & rich emerald for high-end boutique aesthetics',
    previewBg: 'from-slate-950 via-emerald-950 to-teal-950',
    accentColor: '#10b981'
  }
];

export default function StoreCustomizer() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Store Settings State
  const [storeName, setStoreName] = useState('');
  const [tagline, setTagline] = useState('');
  const [theme, setTheme] = useState('midnight');
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [announcement, setAnnouncement] = useState('🔥 NEW DROP AVAILABLE • FREE SHIPPING OVER $50');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');

  const designerId = user?.id || (user as any)?.sub;
  const storeUrl = designerId ? `/store/${designerId}` : '/store';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/supplier/store-settings', {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const data = await res.json();
          const s = data.store_settings || {};
          setStoreName(s.store_name || data.name || 'Signature Threads');
          setTagline(s.tagline || 'Exclusive custom apparel crafted with precision and printed on high quality blanks.');
          setTheme(s.theme || 'midnight');
          setShowAnnouncement(s.show_announcement ?? true);
          setAnnouncement(s.announcement || '🔥 NEW DROP AVAILABLE • FREE SHIPPING OVER $50');
          setInstagram(s.social_instagram || '');
          setTwitter(s.social_twitter || '');
          setWebsite(s.social_website || '');
        }
      } catch (e) {
        console.error('Failed to load store settings', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        store_settings: {
          store_name: storeName.trim(),
          tagline: tagline.trim(),
          theme,
          show_announcement: showAnnouncement,
          announcement: announcement.trim(),
          social_instagram: instagram.trim(),
          social_twitter: twitter.trim(),
          social_website: website.trim(),
          updated_at: new Date().toISOString()
        }
      };

      const res = await fetch('/api/supplier/store-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to update store settings');
      }

      toast({
        title: "Store Redesigned Successfully!",
        description: "Your storefront customizations are now live for all customers.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error Saving Settings",
        description: err?.message || 'Something went wrong',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedThemeObj = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0];

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[500px]">
        <div className="size-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading store studio...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Paintbrush className="size-4" />
            Designer Store Studio
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Storefront Redesign & Customizer
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Personalize your store theme, announcement banner, brand messaging, and social presence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => window.open(storeUrl, '_blank')}
            className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <ExternalLink className="size-4" />
            View Live Store
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200"
          >
            {saving ? (
              <>
                <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save & Publish Store
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Two-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: Brand & Identity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Store className="size-4 text-indigo-600" />
              Store Identity
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Store Display Name
                </label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Signature Threads or Urban Edge"
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tagline & Bio
                </label>
                <Textarea
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Tell your customers about your custom apparel collection..."
                  rows={2}
                  className="rounded-xl border-slate-200 resize-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Visual Themes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="size-4 text-indigo-600" />
                Storefront Visual Theme
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose a curated color palette and visual atmosphere for your store hero and product grid.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {THEME_OPTIONS.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-slate-900">{t.name}</span>
                      {isSelected ? (
                        <div className="size-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div 
                          className="size-4 rounded-full border border-slate-300"
                          style={{ backgroundColor: t.accentColor }}
                        />
                      )}
                    </div>

                    <div className={`h-8 w-full rounded-lg bg-gradient-to-r ${t.previewBg} border border-black/10 flex items-center px-2.5`}>
                      <span className="text-[10px] font-bold text-white/80 truncate">
                        {t.name} Preview
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {t.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3: Announcement Bar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="size-4 text-amber-500" />
                  Top Announcement Bar
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Highlight deals, free shipping alerts, or release drops at the very top of your storefront.
                </p>
              </div>
              <Switch
                checked={showAnnouncement}
                onCheckedChange={setShowAnnouncement}
              />
            </div>

            {showAnnouncement && (
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Announcement Message
                </label>
                <Input
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="e.g. 🔥 FREE SHIPPING ON ORDERS OVER $50 • LIMITED TIME"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            )}
          </div>

          {/* Card 4: Social Media Links */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="size-4 text-indigo-600" />
              Social Presence
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100 shrink-0">
                  <Instagram className="size-4" />
                </div>
                <Input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Instagram username or URL (e.g. @mybrand)"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
                  <Twitter className="size-4" />
                </div>
                <Input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="Twitter / X username or URL"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                  <Globe className="size-4" />
                </div>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website or Portfolio URL"
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live WYSIWYG Storefront Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg overflow-hidden flex flex-col">
            
            {/* Mock Browser Header Bar */}
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-rose-500" />
                <div className="size-2.5 rounded-full bg-amber-500" />
                <div className="size-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium text-slate-400 ml-2">Live Storefront Preview</span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">
                WYSIWYG
              </Badge>
            </div>

            {/* Announcement Bar Preview */}
            {showAnnouncement && (
              <div className="bg-indigo-600 text-white py-2 px-3 text-center text-[11px] font-bold tracking-wide flex items-center justify-center gap-1.5">
                <Flame className="size-3 animate-pulse" />
                <span className="truncate">{announcement || 'Announcement message goes here'}</span>
              </div>
            )}

            {/* Hero Banner Preview */}
            <div className={`bg-gradient-to-r ${selectedThemeObj.previewBg} p-6 text-white text-center space-y-3`}>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-wider text-white">
                <Sparkles className="size-3" />
                Verified Designer Collection
              </div>

              <h3 className="text-xl font-black tracking-tight leading-snug">
                {storeName || 'Signature Threads'}
              </h3>

              <p className="text-[11px] text-white/80 line-clamp-2 max-w-sm mx-auto leading-relaxed">
                {tagline || 'Exclusive custom apparel crafted with precision and printed on high quality blanks.'}
              </p>

              {(instagram || twitter || website) && (
                <div className="flex items-center justify-center gap-2 pt-1 text-white/80">
                  {instagram && <Instagram className="size-3.5" />}
                  {twitter && <Twitter className="size-3.5" />}
                  {website && <Globe className="size-3.5" />}
                </div>
              )}
            </div>

            {/* Mock Products Grid Preview */}
            <div className="p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
                <span>Featured Collection</span>
                <span>Active Theme: {selectedThemeObj.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Mock Card 1 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
                  <div className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden">
                    <img src="/templates/tshirt.png" alt="Mock Shirt" className="size-20 object-contain drop-shadow-sm" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-indigo-600 uppercase">Custom Apparel</span>
                    <span className="block text-xs font-bold text-slate-900 truncate">Men's T-Shirt</span>
                    <span className="block text-xs font-extrabold text-slate-900 mt-1">$29.99</span>
                  </div>
                </div>

                {/* Mock Card 2 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
                  <div className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden">
                    <img src="/templates/hoodie.png" alt="Mock Hoodie" className="size-20 object-contain drop-shadow-sm" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-indigo-600 uppercase">Custom Apparel</span>
                    <span className="block text-xs font-bold text-slate-900 truncate">Pullover Hoodie</span>
                    <span className="block text-xs font-extrabold text-slate-900 mt-1">$44.99</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-medium">
                Changes update in real-time
              </span>
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm"
              >
                <Save className="size-3.5" />
                Publish Changes
              </Button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
