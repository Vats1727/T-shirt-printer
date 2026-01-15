import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function SupplierOrder() {
  const { token } = useAuth();
  const [catalog, setCatalog] = useState<any>(null);
  const [items, setItems] = useState<Array<{product?:string;color_id:number,size_id:number,quantity:number,price:number}>>([]);
  const [message, setMessage] = useState('');

  useEffect(() => { (async () => {
    const res = await fetch('/api/supplier/catalog', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (res.ok) setCatalog(await res.json());
  })(); }, [token]);

  function addRow() {
    setItems([...items, { product: 'tshirt', color_id: 0, size_id: 0, quantity: 1, price: 0 }]);
  }

  async function submit(e: any) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/supplier/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ items }) });
    if (!res.ok) setMessage('Failed to place order');
    else setMessage('Order placed');
  }

  if (!catalog) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Place Order</h1>
      <form onSubmit={submit} className="space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2">
            <select value={it.product} onChange={e => { const v=e.target.value; const c=[...items]; c[idx].product = v; setItems(c); }}>
              <option value={'tshirt'}>T-shirt</option>
              <option value={'hoodie'}>Hoodie</option>
              <option value={'women_tshirt'}>Women T-shirt</option>
            </select>
            <select value={it.color_id} onChange={e => { const v=Number(e.target.value); const c=[...items]; c[idx].color_id=v; setItems(c); }}>
              <option value={0}>Select color</option>
              {catalog.colors.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={it.size_id} onChange={e => { const v=Number(e.target.value); const c=[...items]; c[idx].size_id=v; setItems(c); }}>
              <option value={0}>Select size</option>
              {catalog.sizes.map((s:any)=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input type="number" value={it.quantity} min={1} onChange={e => { const v=Number(e.target.value); const c=[...items]; c[idx].quantity=v; setItems(c); }} />
            <input type="number" value={it.price} step="0.01" onChange={e => { const v=Number(e.target.value); const c=[...items]; c[idx].price=v; setItems(c); }} />
          </div>
        ))}
        <div>
          <button type="button" onClick={addRow} className="px-3 py-1 bg-gray-200">Add item</button>
        </div>
        <div>
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white">Place Order</button>
        </div>
      </form>
      {message && <div className="mt-3">{message}</div>}
    </div>
  );
}