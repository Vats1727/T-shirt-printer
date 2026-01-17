import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from 'wouter';

export default function SupplierDashboard() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [catalog, setCatalog] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const res = await fetch('/api/supplier/catalog', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (res.ok) setCatalog(await res.json());

    // load recent orders
    const res2 = await fetch('/api/supplier/orders', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (res2.ok) {
      const js = await res2.json();
      setOrders(js.orders || []);
    }
  })(); }, [token]);

  if (!catalog) return <div className="p-6">Loading...</div>;
  const getPreviewUrl = (d: any) => {
    if (!d) return '/templates/tshirt.png';
    let img = d.image || d.image_data || d.image_url || d.image_src || d.filename || d.file_name || null;
    if (!img && typeof d === 'string') img = d;
    if (!img) return '/templates/tshirt.png';
    img = String(img);
    if (img.startsWith('data:') || img.startsWith('http') || img.startsWith('/')) return img;
    return `/attached_assets/${img}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Supplier catalog</h1>

      <div className="mb-6">
        <h2 className="font-semibold mb-3">Products</h2>
        {(!catalog.products || catalog.products.length === 0) && <div className="text-sm text-muted-foreground">No products available</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.products?.map((p:any) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4">
              <div className="h-40 flex items-center justify-center bg-gray-50 rounded mb-3 overflow-hidden">
                <img src={getPreviewUrl(p.designs?.[0])} className="max-h-full" alt={p.name} />
              </div>
              <div className="mb-2"><div className="font-semibold text-lg">{p.name}</div><div className="text-sm text-muted-foreground">{p.slug}</div></div>
              <div className="text-sm mb-3">Price: <strong>${Number(p.single_price || 0).toFixed(2)}</strong></div>
              <div className="text-sm text-muted-foreground mb-2">Sizes:
                <div className="flex flex-wrap gap-2 mt-2">
                  {(p.sizes && p.sizes.length) ? p.sizes.map((id:number) => {
                    const sizeObj = catalog.sizes.find((s:any)=> (s.id === Number(id) || String(s.id) === String(id)));
                    if (!sizeObj) return null; // skip unmapped numeric ids
                    return <span key={id} className="text-xs px-2 py-1 border rounded bg-slate-50" title={`Size ${sizeObj.label}`}>{sizeObj.label}</span>;
                  }) : <div className="text-sm text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="text-sm text-muted-foreground mb-2">Colors:
                <div className="flex items-center gap-4 flex-wrap mt-2">
                  {(p.colors && p.colors.length) ? p.colors.map((id:number) => {
                    const c = catalog.colors.find((col:any)=> (col.id === Number(id) || String(col.id) === String(id)));
                    if (!c) return null; // skip unmapped
                    const name = c.name;
                    const hex = c.hex || '#cccccc';
                    return (
                      <div key={id} className="flex items-center gap-2" title={`${name} (${hex})`}>
                        <span className="w-5 h-5 rounded-full border" style={{ background: hex }} />
                        <span className="text-sm">{name}</span>
                      </div>
                    );
                  }) : <div className="text-sm text-muted-foreground">—</div>}
                </div>
              </div>
              <details className="text-sm"><summary className="cursor-pointer text-sky-600">View size chart</summary>
                <div className="mt-2">
                  {p.sizeChart?.length ? (
                    p.sizeChart.map((sc:any)=> (<div key={sc.size_id} className="border-b py-1">{(catalog.sizes.find((s:any)=>s.id===sc.size_id)?.label) || sc.size_id}: chest {sc.chest}, length {sc.length}, shoulder {sc.shoulder}</div>))
                  ) : <div className="text-sm text-muted-foreground">No size chart</div>}
                </div>
              </details>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setLocation('/supplier/product/' + p.id)} className="px-3 py-1 bg-sky-600 text-white rounded text-sm">Design</button>
                <button onClick={() => { navigator.clipboard?.writeText(location.origin + '/product/' + p.slug); }} className="px-3 py-1 bg-gray-100 rounded text-sm">Copy URL</button>
              </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-3">Recent Orders</h2>
        {orders.length === 0 && <div className="text-sm text-muted-foreground">No recent orders</div>}
        <div className="space-y-3">
          {orders.map((o:any) => (
            <div key={o.id} className="p-3 border rounded bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Order #{o.id}</div>
                  <div className="text-xs text-muted-foreground">Placed: {new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="text-sm">
                  <div>Total: <strong>${((o.total_cents||0)/100).toFixed(2)}</strong></div>
                  <div className="text-xs text-muted-foreground">Status: {o.status || 'pending'}</div>
                </div>
              </div>
              <div className="mt-2 text-sm">
                {o.items && o.items.length ? o.items.slice(0,3).map((it:any, idx:number)=> (
                  <div key={idx} className="flex items-center gap-3 py-1 border-t pt-2">
                    <div>Qty: <strong>{it.quantity}</strong></div>
                    <div>Size: <strong>{it.size}</strong></div>
                    <div>Color: <strong>{it.color}</strong></div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No items</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}