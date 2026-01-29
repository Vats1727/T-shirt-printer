import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export default function CreateListing() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDesign, setSelectedDesign] = useState<any | null>(null);
  const [visibility, setVisibility] = useState<'public'|'private'>('public');
  const [saving, setSaving] = useState(false);
  const [createdListing, setCreatedListing] = useState<any | null>(null);

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

  async function handleCreate(e?: any) {
    if (e) e.preventDefault();
    if (!title) return alert('Title is required');
    if (!selectedDesign) return alert('Select a design');
    setSaving(true);
    try {
      const body = { title, description, design_key: selectedDesign.key, visibility };
      const res = await fetch('/api/supplier/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text().catch(()=>res.statusText || '');
        alert('Failed to create listing: ' + (txt || res.status));
        return;
      }
      const js = await res.json();
      // store created listing info and show Store button
      setCreatedListing(js || null);
    } catch (err:any) {
      alert('Failed to create listing: ' + (err?.message || err));
    } finally { setSaving(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Create Listing</h1>
      </div>
      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input className="w-full border rounded p-3 text-lg font-medium" value={title} onChange={(e)=>setTitle(e.target.value)} maxLength={100} placeholder="Fresh summer tee" />
          </div>
          <div>
            <label className="block text-sm font-medium">Description (max 250)</label>
            <textarea className="w-full border rounded p-3" value={description} onChange={(e)=>setDescription(e.target.value)} maxLength={250} rows={6} placeholder="Short product description to entice buyers" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-5 py-3 bg-sky-600 text-white rounded shadow">{saving ? 'Saving...' : 'Save & Launch'}</button>
            <button type="button" onClick={() => window.history.back()} className="px-4 py-3 bg-gray-100 rounded">Back</button>
            {createdListing?.slug && (
              <a
                href={`${window.location.origin.replace(/\/$/, '')}/listing/${encodeURIComponent(createdListing.slug)}`}
                target="_blank"
                rel="noopener"
                className="px-4 py-3 bg-green-600 text-white rounded"
              >
                Open Store
              </a>
            )}
            {createdListing && (
              <button type="button" onClick={() => setLocation('/supplier/dashboard')} className="px-4 py-3 bg-gray-200 rounded">Done</button>
            )}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Design</label>
            <div className="text-xs text-muted-foreground">Choose a saved design</div>
          </div>
          {loading && <div className="p-4">Loading designs...</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {designs.map(d => (
              <div key={d.key} className={`p-2 border rounded cursor-pointer transition-shadow hover:shadow-lg ${selectedDesign?.key===d.key ? 'ring-2 ring-sky-500' : ''}`} onClick={()=>setSelectedDesign(d)}>
                <div className="h-28 flex items-center justify-center bg-gray-50 rounded overflow-hidden">
                  <img src={d.front?.url || d.any?.url || d.back?.url} alt={d.key} className="max-h-full" />
                </div>
                <div className="text-sm mt-2 font-medium">{d.key}</div>
              </div>
            ))}
            {designs.length === 0 && !loading && <div className="text-sm text-muted-foreground">No saved designs</div>}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium">Visibility</label>
            <select value={visibility} onChange={(e)=>setVisibility(e.target.value as any)} className="w-full border rounded p-2 mt-2">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
      </form>
    </div>
  );
}
