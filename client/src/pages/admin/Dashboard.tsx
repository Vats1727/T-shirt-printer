import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ShieldCheck, Clock, AlertTriangle, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { token, user } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Add state for user extended data (status, subscription)
  const [userData, setUserData] = useState<any>(null);

  const blocked = !!(userData && userData.status && userData.status !== 'active');
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);

  useEffect(() => {
    if (userData && userData.status && userData.status !== 'active') setShowBlockedDialog(true);
  }, [userData]);

  async function fetchUserStatus() {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/profile`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (res.ok) {
        const me = await res.json();
        if (me) setUserData(me);
      }
    } catch (e) { }
  }

  async function deleteProduct(id: number) {
    if (!confirm('Delete this product? This is a soft delete and can be restored in the DB.')) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        setError(js.message || 'Failed to delete product');
      } else {
        setMessage('Product deleted');
        fetchProducts();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete');
    }
  }

  useEffect(() => {
    fetchProducts();
    fetchUserStatus();
  }, [token]);

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
    <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Print Provider Console</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your catalog, inventory and orders.</p>
        </div>
      </div>

      {userData?.status === 'pending' && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 flex items-start gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-yellow-200 p-3 rounded-full">
            <Clock className="text-yellow-700 w-6 h-6" />
          </div>
          <div>
            <h3 className="text-yellow-900 font-bold text-lg">Registration Pending</h3>
            <p className="text-yellow-800">Your account is currently being reviewed by our administrators. Some features may be restricted until approval.</p>
          </div>
        </div>
      )}

      {userData?.status === 'suspended' && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-4">
          <div className="bg-red-200 p-3 rounded-full">
            <AlertTriangle className="text-red-700 w-6 h-6" />
          </div>
          <div>
            <h3 className="text-red-900 font-bold text-lg">Account Suspended</h3>
            <p className="text-red-800">Your account has been suspended. Please contact portal support for more information.</p>
          </div>
        </div>
      )}

      {/* Blocking dialog for non-active accounts - prevents actions */}
      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{userData?.status === 'pending' ? 'Registration Pending' : userData?.status === 'suspended' ? 'Account Restricted' : 'Account Restricted'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {userData?.status === 'pending' && (
              <p>Your account is currently under review by our administrators. Some features are restricted until approval.</p>
            )}
            {userData?.status === 'suspended' && (
              <p>Your account has been suspended. Please contact portal support for assistance and more information.</p>
            )}
            {userData && !['pending','suspended'].includes(userData.status) && (
              <p>Your account status is '{userData.status}'. Access is restricted. Contact support for help.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBlockedDialog(false)}>Close</Button>
            <Button variant="secondary" onClick={() => { try { window.open('mailto:support@example.com'); } catch {} }}>Contact Support</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Manage products, inventory and size charts</h2>
          <p className="text-sm text-muted-foreground mt-1">Create and manage products, sizes, colors and inventory from a single place.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={blocked} onClick={() => setLocation('/admin/clothes')} className={`inline-flex items-center gap-2 px-4 py-2 ${blocked ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'} rounded`}>Create Product</button>
          <button disabled={blocked} onClick={() => setLocation('/admin/designers')} className={`inline-flex items-center gap-2 px-4 py-2 ${blocked ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white'} rounded`}><Users className="w-4 h-4" /> Designers</button>
          <button disabled={blocked} onClick={() => setLocation('/admin/orders')} className={`inline-flex items-center gap-2 px-4 py-2 ${blocked ? 'bg-gray-200 text-gray-500' : 'bg-slate-100 text-slate-900'} rounded`}>View Orders</button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Products</h2>
        {loading && <div className="text-sm text-muted-foreground">Loading products…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {message && <div className="text-sm text-green-600">{message}</div>}
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
                <div className="text-sm mb-3">
                  <div className="mb-1">Single unit: <strong>${formatPrice(p.single_price)}</strong></div>
                  <div className="mb-1">Bulk minimum qty: <strong>{p.bulk_min || 0}</strong></div>
                  <div>Bulk price: <strong>${formatPrice(p.bulk_price)}</strong></div>
                </div>
                <div className="flex gap-2">
                  <button disabled={blocked} onClick={() => setLocation('/admin/clothes?productId=' + p.id)} className={`px-3 py-1 ${blocked ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'} rounded text-sm`}>Edit</button>
                  <button disabled={blocked} onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/product/' + p.slug); }} className={`px-3 py-1 ${blocked ? 'bg-gray-100 text-gray-400' : 'bg-gray-100'} rounded text-sm`}>Copy URL</button>
                  <button disabled={blocked} onClick={() => deleteProduct(p.id)} className={`px-3 py-1 ${blocked ? 'bg-gray-200 text-gray-500' : 'bg-red-600 text-white'} rounded text-sm`}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}