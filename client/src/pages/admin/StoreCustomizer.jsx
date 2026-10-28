import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  Building2,
  ArrowLeft
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { encodeId } from '@/utils/idEncoder';

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

export default function AdminStoreCustomizer() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [tagline, setTagline] = useState('');
  const [theme, setTheme] = useState('midnight');
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [announcement, setAnnouncement] = useState('🔥 DIRECT FROM FACTORY • EXPRESS DISPATCH ON ALL DESIGNS');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');

  const providerId = user?.id || user?.sub;
  const storeUrl = providerId ? `/store/${encodeId(providerId)}` : '/store';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/store-settings', {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const data = await res.json();
          const s = data.store_settings || {};
          setStoreName(s.store_name || data.name || user?.name || 'Production Facility Store');
          setTagline(s.tagline || 'Direct fulfillment hub selling exclusive apparel designed by verified creators.');
          setTheme(s.theme || 'midnight');
          setShowAnnouncement(s.show_announcement ?? true);
          setAnnouncement(s.announcement || '🔥 DIRECT FROM FACTORY • EXPRESS DISPATCH ON ALL DESIGNS');
          setInstagram(s.social_instagram || '');
          setTwitter(s.social_twitter || '');
          setWebsite(s.social_website || '');
        }
      } catch (e) {
        console.warn('Failed to load store settings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, user]);

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
          social_website: website.trim()
        }
      };

      const res = await fetch('/api/admin/store-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save store settings');

      toast({
        title: '✨ Store Settings Updated!',
        description: 'Your changes are live on your public storefront.'
      });
    } catch (e) {
      toast({
        title: 'Save Failed',
        description: e.message || 'Could not update store settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedTheme = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-16 pt-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation('/admin/listings')}
            className="size-9 p-0 rounded-xl border-slate-200 text-slate-600 hover:text-indigo-600 shadow-2xs"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Customize Facility Storefront
              </h1>
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold uppercase">
                Branding
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Personalize your facility's public store banner, color theme, announcement bar, and social presence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(storeUrl, '_blank')}
            className="h-9 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:text-indigo-600 font-bold text-xs gap-1.5 shadow-2xs"
          >
            <ExternalLink className="size-3.5 text-indigo-600" />
            <span>View Live Store</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm shadow-indigo-600/20"
          >
            <Save className="size-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Publish'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Settings Left Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Identity & Basic Info */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Store className="size-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Store Identity</h3>
                <p className="text-[11px] text-slate-500">Displayed in your storefront header and hero banner</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Storefront Name
                </label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Apex Printworks & Apparel Co."
                  className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Storefront Tagline / Bio
                </label>
                <Textarea
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Tell shoppers about your garment blanks, printing technology, and independent designer partnerships..."
                  rows={3}
                  className="text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Theme Palette Selection */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="size-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <Paintbrush className="size-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Visual Theme & Aesthetic</h3>
                <p className="text-[11px] text-slate-500">Select a curated colorway for your storefront</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEME_OPTIONS.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all space-y-2 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900">{t.name}</span>
                      {isSelected && (
                        <div className="size-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className={`h-8 rounded-lg bg-gradient-to-r ${t.previewBg} border border-slate-300/40`} />
                    <p className="text-[10px] text-slate-500 leading-tight">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Announcement Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Flame className="size-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Announcement Ticker</h3>
                  <p className="text-[11px] text-slate-500">Highlighted banner displayed at the top of your store</p>
                </div>
              </div>
              <Switch checked={showAnnouncement} onCheckedChange={setShowAnnouncement} />
            </div>

            {showAnnouncement && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Banner Text
                </label>
                <Input
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="e.g. 🔥 DIRECT FROM FACTORY • EXPRESS SHIPPING WORLDWIDE"
                  className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Globe className="size-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Social & Facility Channels</h3>
                <p className="text-[11px] text-slate-500">Allow customers to connect with your facility</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Instagram className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Instagram username or URL"
                  className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div className="relative">
                <Twitter className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="Twitter / X handle or URL"
                  className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div className="relative">
                <Globe className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website URL (e.g. apexapparel.com)"
                  className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900">Live Hero Preview</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {selectedTheme.name}
              </span>
            </div>

            {/* Announcement Banner Preview */}
            {showAnnouncement && announcement && (
              <div className="py-1 px-3 rounded-lg bg-slate-900 text-white text-[10px] font-bold text-center tracking-wider truncate">
                {announcement}
              </div>
            )}

            {/* Hero Mockup */}
            <div
              className={`rounded-xl p-5 bg-gradient-to-r ${selectedTheme.previewBg} text-white space-y-2 border border-slate-800 shadow-inner`}
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider border border-white/20">
                <Sparkles className="size-3" />
                Official Production Facility Store
              </div>

              <h2 className="text-xl font-extrabold tracking-tight">
                {storeName || 'Your Storefront Name'}
              </h2>

              <p className="text-xs text-white/80 line-clamp-2">
                {tagline || 'Your storefront story, printing equipment, and custom apparel collections.'}
              </p>

              {(instagram || twitter || website) && (
                <div className="flex items-center gap-2 pt-1 text-white/70">
                  {instagram && <Instagram className="size-3.5" />}
                  {twitter && <Twitter className="size-3.5" />}
                  {website && <Globe className="size-3.5" />}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center pt-1">
              Changes saved will instantly reflect on your public store page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
