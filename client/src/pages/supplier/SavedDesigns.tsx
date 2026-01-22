import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function SavedDesignsPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [designs, setDesigns] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
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
        setDesigns(js.designs || []);
      } catch (e) {
        setDesigns([]);
      } finally { setLoading(false); }
    })();
  }, [token]);

  const openPreview = (d:any) => { setActive(d); setDialogOpen(true); };

  const copyLink = (d:any) => {
    const url = location.origin + d.url;
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
        {designs.map(d => (
          <Card key={d.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="h-40 flex items-center justify-center bg-gray-50 rounded mb-3 overflow-hidden">
                <img
                  src={d.url}
                  className="max-h-full"
                  alt={d.filename}
                  onError={(e: any) => {
                    // fallback to API asset endpoint if the static client copy is missing or 404s
                    try {
                      const el = e?.currentTarget as HTMLImageElement | null;
                      if (!el || !d || !d.id) return;
                      // avoid repeating the fallback repeatedly
                      if (el.dataset?.triedApiFallback === '1') return;
                      el.dataset.triedApiFallback = '1';
                      el.src = `${API_BASE}/api/assets/${d.id}`;
                    } catch (err) {
                      // ignore
                    }
                  }}
                />
              </div>
              <div className="mb-2"><div className="font-semibold">{d.filename}</div></div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openPreview(d)} className="px-3 py-1 bg-sky-600 text-white rounded text-sm">Preview</button>
                <button onClick={() => copyLink(d)} className="px-3 py-1 bg-gray-100 rounded text-sm">Copy link</button>
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
          <div className="p-4">
            {active ? (
              <img
                src={active.url}
                className="mx-auto max-h-[70vh]"
                alt={active.filename}
                onError={(e: any) => {
                  try {
                    const el = e?.currentTarget as HTMLImageElement | null;
                    if (!el || !active || !active.id) return;
                    if (el.dataset?.triedApiFallback === '1') return;
                    el.dataset.triedApiFallback = '1';
                    el.src = `${API_BASE}/api/assets/${active.id}`;
                  } catch (err) {}
                }}
              />
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
