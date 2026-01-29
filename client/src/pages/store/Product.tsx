import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function StoreProduct() {
  const [, params] = useLocation();
  const path = window.location.pathname || '';
  const parts = path.split('/').filter(Boolean);
  let slug = (parts.pop() || '').trim();
  let byId = parts.length && parts[parts.length - 1] === 'id';

  const [listing, setListing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [designPayload, setDesignPayload] = useState<any | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);
  const [previewSide, setPreviewSide] = useState<'front'|'back'>('front');
  const [previewColor, setPreviewColor] = useState<string | null>(null);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:5000`;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const url = byId ? `${API_BASE}/api/listing/id/${encodeURIComponent(slug)}` : `${API_BASE}/api/listing/${encodeURIComponent(slug)}`;
        const res = await fetch(url);
        if (!res.ok) {
          // fallback: try supplier store if supplier query param provided
          try {
            const qp = new URLSearchParams(window.location.search || '');
            const supplier = qp.get('supplier');
            if (supplier && byId) {
              const r2 = await fetch(`${API_BASE}/api/store/${encodeURIComponent(supplier)}`);
              if (r2.ok) {
                const js2 = await r2.json();
                const found = (js2.listings || []).find((x:any) => String(x.id) === String(slug));
                if (found) { setListing(found); setLoading(false); return; }
              }
            }
          } catch (e) { /* ignore */ }
          setListing(null);
          setLoading(false);
          return;
        }
        const js = await res.json();
        setListing(js.listing || null);
      } catch (e) {
        setListing(null);
      } finally { setLoading(false); }
    })();
  }, [slug]);

  useEffect(() => {
    (async () => {
      if (!listing) return;
      setLoadingDesign(true);
      try {
        const m = String(listing.design_key || '').match(/^design-(\d+)$/);
        if (m) {
          const id = Number(m[1]);
          const r = await fetch(`${API_BASE}/api/designs/${id}`);
          if (r.ok) {
            const djs = await r.json();
            setDesignPayload(djs || null);
            const featured = djs?.version?.metadata?.featured_color;
            if (featured && (featured.hex || featured.id)) setPreviewColor(featured.hex || featured.id);
          }
        }
      } catch (e) { /* ignore */ } finally { setLoadingDesign(false); }
    })();
  }, [listing]);

  if (loading || loadingDesign) return <div className="p-6">Loading...</div>;
  if (!listing) return <div className="p-6">Listing not found</div>;

  const frontMeta = listing.preview_group?.front?.metadata || listing.preview_group?.any?.metadata || {};
  const backMeta = listing.preview_group?.back?.metadata || {};
  const anyMeta = listing.preview_group?.any?.metadata || {};
  const colors = (designPayload?.version?.metadata?.selected_colors || frontMeta?.selected_colors || backMeta?.selected_colors || anyMeta?.selected_colors || []) as any[];

  const getPreviewImg = () => {
    try {
      if (designPayload) {
        const mapping = designPayload.version?.metadata?.preview_by_color || null;
        const chosen = mapping && previewColor ? mapping.find((m:any)=> (String(m.id) === String(previewColor) || String(m.hex) === String(previewColor))) : null;
        if (chosen) return previewSide === 'front' ? (chosen.preview_front || chosen.front || null) : (chosen.preview_back || chosen.back || null);
        const fallbackPreview = previewSide === 'front' ? (designPayload.version?.metadata?.preview_front || null) : (designPayload.version?.metadata?.preview_back || null);
        if (fallbackPreview) return fallbackPreview;
      }
    } catch (e) { /* ignore */ }
    if (listing.preview_group) return previewSide === 'front' ? (listing.preview_group.front?.url || listing.preview_group.any?.url) : (listing.preview_group.back?.url || listing.preview_group.any?.url);
    if (listing.preview_asset_id) return `${API_BASE}/api/assets/${listing.preview_asset_id}`;
    return listing.preview_url || null;
  };

  const formatPrice = (p:any) => {
    if (p === null || p === undefined) return null;
    if (typeof p === 'number') return `$${(p/100).toFixed(2)}`;
    if (typeof p === 'string' && /^\d+$/.test(p)) return `$${(Number(p)/100).toFixed(2)}`;
    if (typeof p === 'string') return p;
    return null;
  };

  const rawPrice = listing.price_cents ?? listing.unit_price_cents ?? listing.price ?? listing.single_price ?? null;
  const priceLabel = formatPrice(rawPrice);

  // thumbnails
  const thumbs: string[] = [];
  try {
    const pg = listing.preview_group;
    if (pg) {
      if (pg.front?.url) thumbs.push(pg.front.url);
      if (pg.any?.url) thumbs.push(pg.any.url);
      if (pg.back?.url) thumbs.push(pg.back.url);
    }
    if (listing.preview_asset_id) thumbs.push(`${API_BASE}/api/assets/${listing.preview_asset_id}`);
    if (listing.preview_url) thumbs.push(listing.preview_url);
  } catch (e) { /* ignore */ }

  return (
    <div>
      <Header />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: '0 0 560px' }}>
            <h1 style={{ fontSize: 34, marginBottom: 8 }}>{listing.title}</h1>

            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <button className={`px-3 py-1 mr-2 rounded ${previewSide === 'front' ? 'bg-sky-600 text-white' : 'bg-gray-100'}`} onClick={() => setPreviewSide('front')}>Front</button>
                <button className={`px-3 py-1 rounded ${previewSide === 'back' ? 'bg-sky-600 text-white' : 'bg-gray-100'}`} onClick={() => setPreviewSide('back')}>Back</button>
              </div>

              <div style={{ marginBottom: 12 }}>
                {colors && colors.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {colors.map((c:any, idx:number) => (
                      <button key={idx} onClick={() => setPreviewColor(c?.hex || c?.id)} title={c?.name || c?.id} style={{ width: 24, height: 24, borderRadius: 999, marginRight: 6, border: '1px solid #ddd', background: c?.hex || '#ddd' }} />
                    ))}
                  </div>
                )}

                {getPreviewImg() ? (
                  <div><img src={getPreviewImg() as string} alt="preview" style={{ width: '100%', height: 'auto', borderRadius: 6, border: '1px solid #eee' }} /></div>
                ) : designPayload ? (
                  <div className="mx-auto">
                    <DesignCanvas
                      side={previewSide}
                      slogan={''}
                      color={'#000000'}
                      template={designPayload.template || 'tshirt'}
                      templateImage={null}
                      showTemplate={true}
                      templateColor={designPayload.templateColor || '#ffffff'}
                      imageTintColor={previewColor || null}
                      tintImage={!!previewColor}
                      forceTemplateFill={false}
                      textSize={24}
                      textRotation={0}
                      textPosition={{ x: 150, y: 150 }}
                      image={((): any => {
                        try {
                          const mapping = designPayload.version?.metadata?.preview_by_color || null;
                          if (mapping && previewColor) {
                            const found = mapping.find((m:any)=> (String(m.id) === String(previewColor) || String(m.hex) === String(previewColor)));
                            if (found) return previewSide === 'front' ? (found.preview_front || found.front || null) : (found.preview_back || found.back || null);
                          }
                        } catch (e) { }
                        const fallbackDataUrl = (previewSide === 'front'
                          ? (designPayload.version?.sides?.find((s:any)=>s.name==='front')?.layers?.find((l:any)=>l.type==='image')?.asset?.dataUrl || null)
                          : (designPayload.version?.sides?.find((s:any)=>s.name==='back')?.layers?.find((l:any)=>l.type==='image')?.asset?.dataUrl || null));
                        return fallbackDataUrl;
                      })()}
                      imageScale={100}
                      imageRotation={0}
                      imagePosition={{ x: 150, y: 150 }}
                      width={480}
                      height={480}
                    />
                  </div>
                ) : null}
              </div>

            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {thumbs.slice(0,4).map((t,i) => (
                <img key={i} src={t} alt={`thumb-${i}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee', cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{listing.title}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{priceLabel || ''}</div>
            </div>

            <div style={{ marginTop: 8, color: '#666' }}>{listing.description}</div>

            {colors && colors.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Color: {previewColor || (colors[0]?.name || '')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {colors.map((c:any, idx:number) => (
                    <button key={idx} title={c?.name || c?.id} onClick={() => setPreviewColor(c?.hex || c?.id)} style={{ width: 28, height: 28, borderRadius: 999, border: previewColor === (c?.hex || c?.id) ? '2px solid #2563eb' : '1px solid #ddd', background: c?.hex || '#ddd' }} />
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const sizes = listing.sizes || designPayload?.version?.metadata?.sizes || listing.size_options || [];
              if (!sizes || sizes.length === 0) return null;
              return (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Size</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {sizes.map((s:any, i:number) => (
                      <button key={i} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e6e6e6' }}>{s.label || s}</button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: 20 }}>
              <button style={{ width: '100%', padding: '12px 18px', background: '#2563eb', color: '#fff', borderRadius: 8, border: 'none', fontSize: 16 }}>Add to cart</button>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700 }}>Description</div>
              <div style={{ color: '#444', marginTop: 8 }}>{listing.description}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700 }}>Product Details</div>
              <div style={{ color: '#444', marginTop: 8 }}>{listing.design_key ? `Design key: ${listing.design_key}` : ''}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700 }}>Shipping & Returns</div>
              <div style={{ color: '#444', marginTop: 8 }}>30 Day Make It Right Policy</div>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
