import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DesignCanvas } from '@/components/design/DesignCanvas';
import { useLocation } from 'wouter';

export default function SavedDesignsPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [designs, setDesigns] = useState<Array<any>>([]);
  const [deletingKeys, setDeletingKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [designPayload, setDesignPayload] = useState<any | null>(null);
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:5000`;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers: Record<string,string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch('/api/supplier/saved-designs', { headers });
        if (!res.ok) {
          setDesigns([]);
          setLoading(false);
          return;
        }
        const js = await res.json();
        console.log('[SavedDesigns] fetched saved-designs:', { count: (js?.designs || []).length, designs: js?.designs });
        // If the server already returned grouped previews (key/front/back), use them directly
        const maybe = js?.designs || [];
        if (maybe.length && typeof maybe[0] === 'object') {
          const sample = maybe[0];
          console.log('[SavedDesigns] sample returned item shape:', Object.keys(sample));
          if (sample.key && (('front' in sample) || ('back' in sample) || ('any' in sample))) {
            console.log('[SavedDesigns] server returned grouped preview objects, using directly');
            setDesigns(maybe);
            setLoading(false);
            return;
          }
          // If the server returned design objects (id, version, image), build groups from them
          if ('id' in sample && (sample.version || sample.image || sample.image_data || sample.back_image)) {
            console.log('[SavedDesigns] server returned design objects, building fallback groups from designs');
            const fallback: any[] = [];
            for (const d of maybe) {
              const key = `design-${d.id}`;
              const meta = d.version?.metadata || {};
              const frontUrl = meta?.preview_front || d.image || d.image_data || null;
              const backUrl = meta?.preview_back || d.back_image || null;
              const anyUrl = frontUrl || backUrl || null;
              const entry = { key, front: frontUrl ? { id: null, filename: null, url: frontUrl, mime: 'image/png', metadata: meta } : null, back: backUrl ? { id: null, filename: null, url: backUrl, mime: 'image/png', metadata: meta } : null, any: anyUrl ? { id: null, filename: null, url: anyUrl, mime: 'image/png', metadata: meta } : null };
              fallback.push(entry);
            }
            if (fallback.length) {
              console.log('[SavedDesigns] built groups from returned designs', { count: fallback.length });
              setDesigns(fallback);
              setLoading(false);
              return;
            }
          }
        }

        // Group flat asset list into design groups by filename pattern: design-<id>-front/back
        const flat: any[] = js.designs || [];
        const groupsMap: Record<string, any> = {};
        for (const a of flat) {
          const fname: string = a.filename || '';
          const m = fname.match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
          let key = fname;
          let side: 'front' | 'back' | null = null;
          if (m) {
            key = `design-${m[1]}`;
            side = m[2] === 'back' ? 'back' : 'front';
          }
          if (!groupsMap[key]) groupsMap[key] = { id: key, front: null, back: null, any: null };
          const entry = { id: a.id, filename: a.filename, url: a.url, mime: a.mime, metadata: a.metadata };
          console.debug('[SavedDesigns] grouping asset', { filename: a.filename, key, side, id: a.id });
          if (side === 'front') { groupsMap[key].front = entry; }
          else if (side === 'back') { groupsMap[key].back = entry; }
          else { groupsMap[key].any = entry; }
        }
        const groups = Object.keys(groupsMap).map(k => ({ key: k, ...groupsMap[k] }));
        console.log('[SavedDesigns] grouped preview assets:', { count: groups.length, groupsSample: groups.slice(0,5) });
        // If no preview assets were found, fall back to reading designs list and using embedded previews
        if (!groups || groups.length === 0) {
          try {
            const dres = await fetch('/api/designs');
            if (dres.ok) {
              const djs = await dres.json();
              console.log('[SavedDesigns] fallback /api/designs fetched:', { count: (djs || []).length });
              const fallback: any[] = [];
              for (const d of (djs || [])) {
                const key = `design-${d.id}`;
                const meta = d.version?.metadata || {};
                const frontUrl = meta?.preview_front || d.image || d.image_data || null;
                const backUrl = meta?.preview_back || d.back_image || null;
                const anyUrl = frontUrl || backUrl || null;
                const entry = { key, front: frontUrl ? { id: null, filename: null, url: frontUrl, mime: 'image/png', metadata: meta } : null, back: backUrl ? { id: null, filename: null, url: backUrl, mime: 'image/png', metadata: meta } : null, any: anyUrl ? { id: null, filename: null, url: anyUrl, mime: 'image/png', metadata: meta } : null };
                fallback.push(entry);
              }
              if (fallback.length) {
                console.log('[SavedDesigns] built fallback groups from /api/designs', { count: fallback.length, sample: fallback.slice(0,5) });
                setDesigns(fallback);
                setLoading(false);
                return;
              }
            }
          } catch (ee) {
            console.error('[SavedDesigns] fallback /api/designs error', ee);
          }
        }

        setDesigns(groups);
      } catch (e) {
        console.error('[SavedDesigns] failed to fetch saved-designs', e);
        setDesigns([]);
      } finally { setLoading(false); }
    })();
  }, [token]);

  const openPreview = async (group:any, side: 'front' | 'back' = 'front') => {
    setActive(group);
    setPreviewSide(side);
    setDesignPayload(null);
    setPreviewColor(null);
    setLoadingDesign(true);
    setDialogOpen(true);
    // try to extract design id from group key like 'design-<id>'
    try {
      const m = String(group.key || '').match(/^design-(\d+)$/);
      if (m) {
        const id = Number(m[1]);
        const res = await fetch(`/api/designs/${id}`);
        if (res.ok) {
          const js = await res.json();
          console.log('[SavedDesigns] fetched design payload', { id, metadata: js?.version?.metadata, sides: js?.version?.sides?.map((s:any)=>s.name) });
          setDesignPayload(js || null);
          // prefer featured_color from design metadata when available, else fallback to asset metadata
          const featured = js?.version?.metadata?.featured_color;
          if (featured && (featured.hex || featured.id)) {
            console.log('[SavedDesigns] using featured_color from design metadata', featured);
            setPreviewColor(featured.hex || featured.id as any);
          } else {
            const sc = (group.front?.metadata?.selected_colors || group.back?.metadata?.selected_colors || []);
            console.log('[SavedDesigns] no featured in design metadata, falling back to asset selected_colors', sc);
            if (sc && sc.length) setPreviewColor(sc[0].hex || sc[0]?.hex || null);
          }
        }
      }
    } catch (e) {
      // ignore, we'll fallback to static images
    } finally {
      setLoadingDesign(false);
    }
  };

  const copyLink = (asset:any) => {
    if (!asset) return alert('No asset to copy');
    const url = location.origin + asset.url;
    try { navigator.clipboard?.writeText(url); } catch (e) {}
    alert('Copied: ' + url);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Saved designs</h1>
        <div>
          <button onClick={() => setLocation('/supplier/dashboard')} className="px-3 py-1 bg-gray-100 rounded">Back</button>
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {!loading && designs.length === 0 && <div className="text-sm text-muted-foreground">No saved designs found.</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {designs.map((g:any) => (
          <Card key={g.key} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="h-40 flex items-center justify-center bg-gray-50 rounded mb-3 gap-2 overflow-hidden">
                <div className="flex-1 flex items-center justify-center">
                  {(g.front?.url || g.any?.url) ? (
                    <img src={g.front?.url || g.any?.url} className="max-h-full" alt={(g.front?.filename || g.any?.filename) || 'front'} onError={(e:any)=>{const el=e.currentTarget as HTMLImageElement; try { if(el.dataset?.triedApiFallback==='1')return; el.dataset.triedApiFallback='1'; const asset = g.front || g.any; console.warn('[SavedDesigns] card image load failed, attempting API asset fallback', { src: el.src, assetId: asset?.id }); if(asset && asset.id) el.src=`${API_BASE}/api/assets/${asset.id}` } catch(err) { console.error('[SavedDesigns] error in front image onError', err) } }} />
                  ) : (
                    <div className="text-sm text-muted-foreground">No front</div>
                  )}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  {(g.back?.url || g.any?.url) ? (
                    <img src={g.back?.url || g.any?.url} className="max-h-full" alt={(g.back?.filename || g.any?.filename) || 'back'} onError={(e:any)=>{const el=e.currentTarget as HTMLImageElement; try { if(el.dataset?.triedApiFallback==='1')return; el.dataset.triedApiFallback='1'; const asset = g.back || g.any; console.warn('[SavedDesigns] card image load failed, attempting API asset fallback', { src: el.src, assetId: asset?.id }); if(asset && asset.id) el.src=`${API_BASE}/api/assets/${asset.id}` } catch(err) { console.error('[SavedDesigns] error in back image onError', err) } }} />
                  ) : (
                    <div className="text-sm text-muted-foreground">No back</div>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <div className="font-semibold">{g.key}</div>
                <div className="mt-2 flex items-center gap-2">
                  {(g.front?.metadata?.selected_colors || g.back?.metadata?.selected_colors || g.any?.metadata?.selected_colors || []).map((c:any, idx:number)=> {
                    const featuredId = (g.front?.metadata?.featured_color?.id || g.back?.metadata?.featured_color?.id || g.any?.metadata?.featured_color?.id || null);
                    const isFeatured = featuredId && Number(featuredId) === Number(c?.id);
                    return (
                      <div key={idx} title={c?.name || c?.id} className={`w-5 h-5 rounded-full border ${isFeatured ? 'ring-2 ring-sky-500' : ''}`} style={{ background: c?.hex || '#ddd' }} />
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openPreview(g, 'front')} className="px-3 py-1 bg-sky-600 text-white rounded text-sm">Preview</button>
                <button onClick={() => copyLink(g.front || g.any || g.back)} className="px-3 py-1 bg-gray-100 rounded text-sm">Copy link</button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete this saved design permanently? This cannot be undone.')) return;
                    const m = String(g.key || '').match(/^design-(\d+)$/);
                    if (!m) return alert('Could not determine design id');
                    const id = Number(m[1]);
                    try {
                      setDeletingKeys(prev => [...prev, g.key]);
                      const res = await fetch(`/api/designs/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
                      if (res.status === 204 || res.ok) {
                        setDesigns(prev => prev.filter((x:any)=>x.key !== g.key));
                      } else if (res.status === 404) {
                        // already removed on server — remove locally
                        setDesigns(prev => prev.filter((x:any)=>x.key !== g.key));
                        alert('Design not found on server; removed locally.');
                      } else {
                        const txt = await res.text().catch(()=>res.statusText || '');
                        alert('Failed to delete design: ' + (txt || res.status));
                      }
                    } catch (e:any) {
                      alert('Failed to delete: ' + (e?.message || e));
                    } finally {
                      setDeletingKeys(prev => prev.filter(k => k !== g.key));
                    }
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm ml-auto"
                  disabled={deletingKeys.includes(g.key)}
                >
                  {deletingKeys.includes(g.key) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            {active ? (
              <div>
                <div className="mb-3">
                  <button className={`px-3 py-1 mr-2 rounded ${previewSide==='front' ? 'bg-sky-600 text-white' : 'bg-gray-100'}`} onClick={() => setPreviewSide('front')}>Front</button>
                  <button className={`px-3 py-1 rounded ${previewSide==='back' ? 'bg-sky-600 text-white' : 'bg-gray-100'}`} onClick={() => setPreviewSide('back')}>Back</button>
                </div>
                <div className="mb-4">
                  {/* color swatches to pick preview color (from asset metadata) */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {((designPayload?.version?.metadata?.selected_colors) || (active.front?.metadata?.selected_colors || active.back?.metadata?.selected_colors || active.any?.metadata?.selected_colors || [])).map((c:any, i:number) => (
                      <button key={i} className={`w-6 h-6 rounded-full border ${previewColor === (c?.hex || c?.id) ? 'ring-2 ring-sky-500' : ''}`} style={{ background: c?.hex || '#ddd' }} onClick={() => setPreviewColor(c?.hex || c?.id)} title={c?.name || c?.id} />
                    ))}
                  </div>

                  {designPayload ? (
                    // If a per-color pre-rendered preview exists for the selected color, show it directly (exact card preview)
                    (() => {
                      try {
                        const mapping = designPayload.version?.metadata?.preview_by_color || null;
                        console.debug('[SavedDesigns] preview_by_color mapping length', mapping ? mapping.length : 0, 'previewColor', previewColor);
                        const chosen = mapping && previewColor ? mapping.find((m:any)=> (String(m.id) === String(previewColor) || String(m.hex) === String(previewColor))) : null;
                        const previewImg = chosen ? (previewSide === 'front' ? (chosen.preview_front || chosen.front) : (chosen.preview_back || chosen.back)) : null;
                        // Also allow a top-level version preview_front/back as fallback
                        const fallbackPreview = previewSide === 'front' ? (designPayload.version?.metadata?.preview_front || null) : (designPayload.version?.metadata?.preview_back || null);
                        const imgToShow = previewImg || fallbackPreview || null;
                        if (imgToShow) {
                          console.log('[SavedDesigns] showing pre-rendered image for preview', { previewSide, previewColor, previewImg: !!previewImg, fallbackPreview: !!fallbackPreview, imgToShow });
                          return (
                            <div className="mx-auto">
                              <img src={imgToShow} className="mx-auto max-h-[70vh]" alt={`preview-${previewSide}`} />
                            </div>
                          );
                        } else {
                          console.debug('[SavedDesigns] no pre-rendered image found, will fallback to canvas rendering', { previewSide, previewColor });
                        }
                      } catch (e) {
                        // ignore and fallback to rendering canvas
                      }

                      // No pre-rendered image available for selected color — fallback to drawing on canvas and tinting image only.
                      return (
                        <div className="mx-auto">
                          <DesignCanvas
                            side={previewSide}
                            slogan={(previewSide === 'front'
                              ? (designPayload.version?.sides?.find((s:any)=>s.name==='front')?.layers?.find((l:any)=>l.type==='text')?.text)
                              : (designPayload.version?.sides?.find((s:any)=>s.name==='back')?.layers?.find((l:any)=>l.type==='text')?.text)) || ''}
                            color={'#000000'}
                            template={designPayload.template || 'tshirt'}
                            templateImage={null}
                            showTemplate={true}
                            // Keep template color unchanged; only tint the image layer
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
                                  if (found) {
                                    console.log('[SavedDesigns] using found per-color image for canvas', { found: { id: found.id, hasFront: !!found.preview_front || !!found.front, hasBack: !!found.preview_back || !!found.back } });
                                    return previewSide === 'front' ? (found.preview_front || found.front || null) : (found.preview_back || found.back || null);
                                  }
                                }
                              } catch (e) { console.error('[SavedDesigns] error locating per-color image for canvas', e); }
                              const fallbackDataUrl = (previewSide === 'front'
                                ? (designPayload.version?.sides?.find((s:any)=>s.name==='front')?.layers?.find((l:any)=>l.type==='image')?.asset?.dataUrl || null)
                                : (designPayload.version?.sides?.find((s:any)=>s.name==='back')?.layers?.find((l:any)=>l.type==='image')?.asset?.dataUrl || null));
                              console.debug('[SavedDesigns] canvas will use fallback image dataUrl present?', !!fallbackDataUrl);
                              return fallbackDataUrl;
                            })()}
                            imageScale={100}
                            imageRotation={0}
                            imagePosition={{ x: 150, y: 150 }}
                            width={480}
                            height={480}
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <img
                      src={previewSide === 'front' ? (active.front?.url || active.any?.url) : (active.back?.url || active.any?.url)}
                      className="mx-auto max-h-[70vh]"
                      alt={previewSide}
                      onError={(e: any) => {
                        try {
                          const el = e?.currentTarget as HTMLImageElement | null;
                          if (!el || !active) return;
                          if (el.dataset?.triedApiFallback === '1') return;
                          el.dataset.triedApiFallback = '1';
                          const asset = previewSide === 'front' ? active.front : active.back;
                          console.warn('[SavedDesigns] modal image load failed, attempting API asset fallback', { src: el.src, assetId: asset?.id });
                          if (asset && asset.id) el.src = `${API_BASE}/api/assets/${asset.id}`;
                        } catch (err) { console.error('[SavedDesigns] modal image onError', err); }
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div>No preview</div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
