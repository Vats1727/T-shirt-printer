import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Avoid importing useAuth to keep this page accessible without an AuthProvider.
// Read auth info directly from localStorage so the page is authentication-free.
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

function CardPreviewImage({ listing, apiBase, designPayload, overrideColor }:{ listing:any, apiBase:string, designPayload?:any, overrideColor?:string | null }){
  const resolveFromDesign = () => {
    if (!designPayload) return null;
    const meta = designPayload.version?.metadata || designPayload.metadata || {};
    let byColor: any = meta.preview_by_color || meta.preview?.preview_by_color || meta.preview_by_color || null;
    // support array or object mapping
    if (Array.isArray(byColor)) {
      if (overrideColor && byColor.length) {
        const found = byColor.find((m:any) => String(m.id) === String(overrideColor) || String(m.hex) === String(overrideColor));
        if (found) return (found.preview_front || found.front || found.preview || found.url || null);
      }
      const first = byColor[0];
      if (first) return (first.preview_front || first.front || first.preview || first.url || null);
    } else if (byColor && typeof byColor === 'object') {
      if (overrideColor && byColor[overrideColor]) return byColor[overrideColor];
      const foundKey = Object.keys(byColor).find(k => k && overrideColor && k.replace('#','').toLowerCase() === overrideColor.replace('#','').toLowerCase());
      if (foundKey) return byColor[foundKey];
      const first = Object.values(byColor)[0];
      if (first) return first;
    }
    if (meta.preview?.front?.url) return meta.preview.front.url;
    if (meta.preview?.any?.url) return meta.preview.any.url;
    return null;
  };

  const resolveFromListing = () => {
    // prefer explicit preview_group front/any
    const pg = listing.preview_group;
    if (pg) {
      // if metadata includes per-color mapping
      const tryColor = (side:any) => {
        const meta = side?.metadata || {};
        const map = meta.preview_by_color || {};
        if (overrideColor && map && Object.keys(map).length > 0) {
          if (map[overrideColor]) return map[overrideColor];
          const found = Object.keys(map).find(k => k && overrideColor && k.replace('#','').toLowerCase() === overrideColor.replace('#','').toLowerCase());
          if (found) return map[found];
        }
        if (side?.url) return side.url;
        if (side?.asset_id) return `${apiBase}/api/assets/${side.asset_id}`;
        return null;
      };
      // prefer front
      return tryColor(pg.front) || tryColor(pg.any) || tryColor(pg.back);
    }

    if (listing.preview_asset_id) return `${apiBase}/api/assets/${listing.preview_asset_id}`;
    if (listing.preview_url) return listing.preview_url;
    return null;
  };

  const fromDesign = resolveFromDesign();
  const onErrorFallback = (e:any, candidate?: string | null) => {
    try {
      const el = e?.currentTarget as HTMLImageElement | null;
      if (!el) return;
      if (el.dataset?.triedApiFallback === '1') return;
      el.dataset.triedApiFallback = '1';
      // try listing preview_group asset id
      const pg = listing.preview_group;
      if (pg) {
        const asset = pg.front || pg.any || pg.back;
        if (asset && asset.id) { el.src = `${apiBase}/api/assets/${asset.id}`; return; }
      }
      if (listing.preview_asset_id) { el.src = `${apiBase}/api/assets/${listing.preview_asset_id}`; return; }
      // last resort: try candidate provided
      if (candidate) el.src = candidate;
    } catch (err) {
      // ignore
    }
  };

  if (fromDesign) return <img src={fromDesign} className="max-h-full" alt={listing.title} onError={(e:any)=>onErrorFallback(e, listing.preview_url || undefined)} />;
  const fromListing = resolveFromListing();
  if (fromListing) return <img src={fromListing} className="max-h-full" alt={listing.title} onError={(e:any)=>onErrorFallback(e, null)} />;
  return <img src={'/templates/tshirt.png'} className="max-h-full" alt={listing.title} onError={(e:any)=>onErrorFallback(e, null)} />;
}
export default function StorePage() {
  const rawPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
  const supplierId = (rawPath.split('/').filter(Boolean).pop() || '');
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [designPayloads, setDesignPayloads] = useState<Record<string, any>>({});
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, string | null>>({});
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch (e) { setUser(null); }
    try { setToken(localStorage.getItem('token')); } catch (e) { setToken(null); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // use relative API path so Vite dev proxy or same-origin server handles it
        const res = await fetch(`/api/store/${encodeURIComponent(supplierId)}`);
        if (!res.ok) {
          setListings([]);
          setLoading(false);
          return;
        }
        const js = await res.json();
          setListings(js.listings || []);
      } catch (e) {
        setListings([]);
      } finally { setLoading(false); }
    })();
  }, [supplierId]);

  // fetch design payloads for listings that reference a design id
  useEffect(() => {
    const toFetch = listings.filter(l => (l.design_id || l.design_key) && !designPayloads[l.id]);
    if (toFetch.length === 0) return;
    (async () => {
      const copy: Record<string, any> = { ...designPayloads };
      await Promise.all(toFetch.map(async (l:any) => {
        try {
          // Prefer explicit numeric design_id, else try to extract from design_key like 'design-61'
          let idToFetch: number | null = null;
          if (l.design_id) idToFetch = Number(l.design_id);
          else if (l.design_key) {
            const m = String(l.design_key).match(/design-(\d+)/i);
            if (m) idToFetch = Number(m[1]);
          }
          if (idToFetch) {
            const res = await fetch(`/api/designs/${encodeURIComponent(String(idToFetch))}`);
            if (!res.ok) return;
            const js = await res.json();
            copy[l.id] = js;
          }
        } catch (e) {
          // ignore
        }
      }));
      setDesignPayloads(copy);
    })();
  }, [listings]);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:5000`;

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }} className="p-6">
        <h1 className="text-2xl font-bold mb-4">Supplier Store</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.length === 0 && <div className="text-sm text-muted-foreground">No published listings</div>}
          {listings.map((p:any) => (
            <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-2 items-stretch mb-3">
                <div className="h-40 flex items-center justify-center bg-gray-50 rounded mb-3 overflow-hidden w-full">
                  <CardPreviewImage
                    listing={p}
                    apiBase={API_BASE}
                    designPayload={designPayloads[p.id]}
                    overrideColor={previewOverrides[p.id]}
                  />
                </div>
              </div>
              <div className="mb-2"><div className="font-semibold text-lg">{p.title}</div></div>
              <div className="text-sm mb-3">{p.description}</div>
              { (p.preview_group && ( (p.preview_group.front?.metadata?.selected_colors || p.preview_group.back?.metadata?.selected_colors || p.preview_group.any?.metadata?.selected_colors) || []).length > 0) ? (
                <div className="mb-3 flex items-center gap-2">
                  { (p.preview_group.front?.metadata?.selected_colors || p.preview_group.back?.metadata?.selected_colors || p.preview_group.any?.metadata?.selected_colors || []).map((c:any, idx:number) => (
                    <button
                      key={idx}
                      title={c?.name || c?.id}
                      className={`w-6 h-6 rounded-full border ${previewOverrides[p.id] === (c?.hex || c?.id) ? 'ring-2 ring-sky-500' : ''}`}
                      style={{ background: c?.hex || '#ddd' }}
                      onMouseEnter={() => setPreviewOverrides(prev => ({ ...prev, [p.id]: (c?.hex || c?.id) }))}
                      onMouseLeave={() => setPreviewOverrides(prev => ({ ...prev, [p.id]: null }))}
                      onClick={() => setPreviewOverrides(prev => ({ ...prev, [p.id]: (c?.hex || c?.id) }))}
                    />
                  ))}
                </div>
              ) : null }
              <div className="mt-4 flex gap-2 items-center">
                <a href={`${window.location.origin.replace(/\/$/, '')}/listing/id/${encodeURIComponent(p.id)}?supplier=${encodeURIComponent(supplierId)}`} target="_blank" rel="noreferrer" className="px-3 py-1 bg-gray-100 rounded text-sm">View</a>
                <a href={`${window.location.origin.replace(/\/$/, '')}/listing/id/${encodeURIComponent(p.id)}?supplier=${encodeURIComponent(supplierId)}`} target="_blank" rel="noreferrer" className="px-3 py-1 bg-black text-white rounded text-sm">Buy</a>
                {user && user.role === 'supplier' && String(user.id) === String(p.supplier_id || supplierId) && (
                  <button
                    onClick={async () => {
                      const apiBase = window.location.port === '5173' ? 'http://localhost:5000' : '';
                      if (!confirm('Delete this listing? This cannot be undone.')) return;
                      try {
                        const res = await fetch(`${apiBase}/api/supplier/listings/${encodeURIComponent(p.id)}`, {
                          method: 'DELETE',
                          headers: {
                            Authorization: token ? `Bearer ${token}` : '',
                            'Content-Type': 'application/json'
                          }
                        });
                        if (!res.ok) {
                          const txt = await res.text().catch(() => res.statusText || '');
                          alert('Failed to delete listing: ' + (txt || res.status));
                          return;
                        }
                        setListings(prev => prev.filter(x => String(x.id) !== String(p.id)));
                      } catch (err:any) {
                        alert('Failed to delete listing: ' + (err?.message || err));
                      }
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
