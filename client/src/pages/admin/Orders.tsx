import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { DesignCanvas } from '@/components/design/DesignCanvas';

export default function AdminOrders() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => { (async () => {
    const res = await fetch('/api/admin/orders', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (!res.ok) return;
    const js = await res.json();
    setOrders(js.orders || []);
  })(); }, [token]);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">All supplier orders (admin view). IDs are hidden and snapshots are preserved.</p>
        </div>
        <div>
          <button onClick={() => setLocation('/admin/dashboard')} className="px-3 py-1 bg-gray-100 rounded">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {orders.length === 0 && <div className="text-sm text-muted-foreground">No orders yet</div>}
          <div className="space-y-3">
            {orders.map(o => (
              <Card key={o.created_at} className="p-3">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">Order</div>
                      <div className="text-xs text-muted-foreground">Placed: {new Date(o.created_at).toLocaleString()}</div>
                      {o.supplier && <div className="text-xs text-muted-foreground">Supplier: {o.supplier.name || o.supplier.email}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Total: <strong>${(o.total||0).toFixed ? (o.total).toFixed(2) : o.total}</strong></div>
                      <div className="text-xs text-muted-foreground">Status: {o.status || 'pending'}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {o.items && o.items.length ? o.items.map((it:any, i:number) => (
                      <div key={i} className="flex items-center gap-4 py-2 border-t pt-2">
                        <div>Qty: <strong>{it.quantity}</strong></div>
                        <div>Size: <strong>{it.size}</strong></div>
                        <div>Color: <strong>{it.color?.name || it.color || ''}</strong></div>
                        <div>Line: <strong>${(it.line_total || 0).toFixed(2)}</strong></div>
                      </div>
                    )) : <div className="text-sm text-muted-foreground">No items</div>}
                  </div>
                  <div className="mt-3">
                    <button onClick={() => setSelected(o)} className="px-3 py-1 bg-slate-100 rounded text-sm">View details</button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <Card className="p-3">
            <CardHeader>
              <div className="font-semibold">Order details</div>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="text-sm space-y-2">
                  <div>Placed: {new Date(selected.created_at).toLocaleString()}</div>
                  <div>Supplier: {selected.supplier ? (selected.supplier.name || selected.supplier.email) : '—'}</div>
                  <div>Total: <strong>${(selected.total || 0).toFixed(2)}</strong></div>
                  <div className="pt-2">Items:</div>
                  {selected.items.map((it:any, idx:number) => (
                    <div key={idx} className="border rounded p-2 mt-2 bg-white">
                      <div>Product: {it.product}</div>
                      <div>Size: {it.size}</div>
                      <div>Color: {it.color?.name || it.color}</div>
                      <div>Qty: {it.quantity}</div>
                      <div>Unit price: ${(it.unit_price || 0).toFixed(2)}</div>
                      <div>Line total: ${(it.line_total || 0).toFixed(2)}</div>
                      {it.design_snapshot && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                          <div className="w-full">
                            <div className="border rounded overflow-hidden bg-white p-2">
                              <div className="text-xs text-muted-foreground mb-1">Design preview</div>
                              <DesignCanvas
                                width={220}
                                height={220}
                                readonly
                                showTemplate={true}
                                slogan={it.design_snapshot.front?.slogan || ''}
                                color={it.design_snapshot.front?.color || (it.design_snapshot.front?.templateColor || '#000')}
                                template={it.design_snapshot.front?.template || 'tshirt'}
                                templateColor={it.design_snapshot.front?.templateColor || undefined}
                                templateImage={it.design_snapshot.front?.templateImage || undefined}
                                image={it.design_snapshot.front?.image || undefined}
                                imageScale={it.design_snapshot.front?.imageScale || 100}
                                imageRotation={it.design_snapshot.front?.imageRotation || 0}
                                imagePosition={it.design_snapshot.front?.imagePosition || { x: 150, y: 150 }}
                                textSize={it.design_snapshot.front?.textSize || 24}
                                textRotation={it.design_snapshot.front?.textRotation || 0}
                                textPosition={it.design_snapshot.front?.textPosition || { x: 150, y: 135 }}
                                tintImage={false}
                              />
                            </div>
                          </div>

                          <div>
                            <details className="mt-2"><summary className="cursor-pointer text-sky-600">View design snapshot (raw)</summary>
                              <pre className="text-xs whitespace-pre-wrap mt-2">{JSON.stringify(it.design_snapshot, null, 2)}</pre>
                            </details>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="pt-3">Shipping: {selected.shipping ? JSON.stringify(selected.shipping) : '—'}</div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select an order to view details</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
