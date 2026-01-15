import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchProducts(); }, [token]);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Admin dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-6 rounded-lg border bg-white cursor-pointer hover:shadow" onClick={() => setLocation('/admin/clothes')}>
          <h2 className="font-semibold">Clothes</h2>
          <p className="text-sm text-muted-foreground mt-2">Manage colors, sizes, size chart and inventory</p>
        </div>

        <div className="p-6 rounded-lg border bg-white cursor-pointer hover:shadow" onClick={() => setLocation('/admin/clothes')}>
          <h2 className="font-semibold">Inventory</h2>
          <p className="text-sm text-muted-foreground mt-2">Upsert inventory per product / color / size</p>
        </div>

        <div className="p-6 rounded-lg border bg-white cursor-pointer hover:shadow" onClick={() => setLocation('/admin/clothes')}>
          <h2 className="font-semibold">Size Chart</h2>
          <p className="text-sm text-muted-foreground mt-2">Edit size measurements for each size</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Products</h2>
        {loading && <div className="text-sm text-muted-foreground">Loading products…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && products.length === 0 && <div className="text-sm text-muted-foreground">No products yet. Create one via Create Product.</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {products.map(p => {
            const formatPrice = (v: any) => {
              const n = Number(v);
              return isNaN(n) ? '0.00' : n.toFixed(2);
            };
            return (
              <div key={p.id} className="p-4 rounded-lg border bg-white">
                <div className="h-40 flex items-center justify-center bg-gray-50 rounded mb-3 overflow-hidden">
                  {p.designs?.front?.image ? (
                    <img src={p.designs.front.image} alt={p.name} className="max-h-full" />
                  ) : (
                    <div className="text-sm text-muted-foreground">No preview</div>
                  )}
                </div>
                <div className="mb-2">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.slug}</div>
                </div>
                <div className="text-sm mb-3">Price: <strong>${formatPrice(p.single_price)}</strong></div>
                <div className="flex gap-2">
                  <button onClick={() => setLocation('/admin/clothes?productId=' + p.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Edit</button>
                  <button onClick={() => { navigator.clipboard?.writeText(location.origin + '/product/' + p.slug); }} className="px-3 py-1 bg-gray-100 rounded text-sm">Copy URL</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}