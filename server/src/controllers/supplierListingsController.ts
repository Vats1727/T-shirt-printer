import { Request, Response } from 'express';
import * as listingsStore from '../services/listingsStore';

export async function createListing(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  const { title, description, slug, design_key, visibility } = req.body || {};
  if (!title) return res.status(400).json({ message: 'title is required' });
  try {
    // Ensure there is a slug: if not provided, generate from title
    let finalSlug = (slug || '').trim();
    if (!finalSlug) {
      finalSlug = slugify(title);
      // append short suffix to reduce collisions
      finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2,7)}`;
    }

    const row = await listingsStore.createListing(user.sub || user.id || null, title, description || null, finalSlug, design_key || null, visibility || 'public');
    const id = row?.id;
    let publishedUrl = null;
    if (visibility === 'public' && row?.slug) {
      const proto = req.protocol || 'https';
      const host = req.get('host') || req.hostname || '';
      publishedUrl = `${proto}://${host}/listing/${row.slug}`;
      try { await listingsStore.publishListing(Number(id)); } catch (e) { /* ignore */ }
    }
    return res.status(201).json({ id, slug: row?.slug || null, published_url: publishedUrl });
  } catch (e: unknown) {
    console.error('createListing error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Failed to create listing' });
  }
}

export async function listListings(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const rows = await listingsStore.listListingsBySupplier(user.sub || user.id || null);
    return res.json({ listings: rows });
  } catch (e: unknown) {
    console.error('listListings error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Failed to list listings' });
  }
}

export async function getPublicListing(req: Request, res: Response) {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).send('Missing slug');
    const row = await listingsStore.getListingBySlug(slug);
    if (!row || !row.published) return res.status(404).send('Listing not found');
    // Try to locate a preview image for the designKey.
    const title = row.title || 'Listing';
    const description = row.description || '';
    const designKey = row.design_key || '';

    // If a CLIENT_BASE_URL is configured, use it for attached assets.
    const configuredClientBase = process.env.CLIENT_BASE_URL ? String(process.env.CLIENT_BASE_URL).replace(/\/$/, '') : null;

    // Helper to attempt to find client attached asset first, then DB assets.
    let previewUrl: string | null = null;
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const clientPath = path.join(process.cwd(), 'client', 'attached_assets');
      if (designKey) {
        // try front image pattern
        const patterns = [`${designKey}-front`, `${designKey}`];
        for (const p of patterns) {
          try {
            const files = await fs.readdir(clientPath);
            const found = files.find(f => f.toLowerCase().startsWith(p.toLowerCase()));
            if (found) {
              // only use client attached_assets path if CLIENT_BASE_URL is configured
              if (configuredClientBase) {
                previewUrl = `${configuredClientBase}/attached_assets/${found}`;
                break;
              }
              // otherwise prefer the server-served asset endpoint (resolved below via DB lookup)
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore client attached lookup errors
    }

    if (!previewUrl && designKey) {
      // fallback: query assets table for filenames matching designKey
      try {
        const { pool } = await import('../../db');
        if (pool) {
          const clientDb = await pool.connect();
          try {
            const likePattern = `%${designKey}%`;
            const r = await clientDb.query('SELECT filename, id FROM assets WHERE filename ILIKE $1 OR filename ILIKE $2 LIMIT 1', [likePattern, `${designKey}%`]);
            if (r && r.rows && r.rows[0]) {
              const fn = r.rows[0].filename;
              const aid = r.rows[0].id;
              // Prefer serving via server asset endpoint so server-rendered pages can fetch it.
              previewUrl = `/api/assets/${aid}`;
            }
          } finally { clientDb.release(); }
        }
      } catch (e) {
        // ignore DB lookup errors
      }
    }

    // Build the HTML with preview image and links
    const clientBase = process.env.CLIENT_BASE_URL ? String(process.env.CLIENT_BASE_URL).replace(/\/$/, '') : `${req.protocol}://${req.hostname}:5173`;
    const supplierTemplate = process.env.SUPPLIER_STORE_URL_TEMPLATE ? String(process.env.SUPPLIER_STORE_URL_TEMPLATE) : null;
    const supplierUrl = supplierTemplate
      ? supplierTemplate.replace('{supplier_id}', String(row.supplier_id || '')).replace('{slug}', slug)
      : `${clientBase}/store/${encodeURIComponent(String(row.supplier_id || ''))}`;

    const redirectScript = clientBase ? `<script>window.location.replace('${clientBase}/listing/${encodeURIComponent(slug)}');</script>` : '';

    const imgHtml = previewUrl ? `<div style="max-width:480px;margin-bottom:12px"><img src="${escapeHtml(previewUrl)}" alt="preview" style="width:100%;height:auto;border:1px solid #eee;border-radius:6px"/></div>` : '';

    // Remove server-side "Open at supplier store" button — client SPA handles storefront.
    const supplierButton = '';
    const storefrontButton = clientBase ? `<a href="${escapeHtml(clientBase)}/listing/${encodeURIComponent(slug)}" style="display:inline-block;padding:8px 12px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none" target="_blank" rel="noopener">Open in storefront</a>` : '';

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:24px;color:#111} .card{border:1px solid #eee;padding:20px;border-radius:8px;max-width:900px}</style>
        </head>
        <body>
          <div class="card">
            <h1>${escapeHtml(title)}</h1>
            ${imgHtml}
            <p>${escapeHtml(description)}</p>
            <p><strong>Design key:</strong> ${escapeHtml(String(designKey))}</p>
            <p><em>Published at: ${row.published_at || row.created_at}</em></p>
            <div style="margin-top:12px">${supplierButton}${storefrontButton}</div>
          </div>
          ${redirectScript}
        </body>
      </html>`;
    res.set('Content-Type','text/html; charset=utf-8');
    return res.send(html);
  } catch (e: unknown) {
    console.error('getPublicListing error', (await import('../utils')).fmtErr(e));
    return res.status(500).send('Server error');
  }
}

export async function getSupplierStore(req: Request, res: Response) {
  try {
    const supplierId = String(req.params.supplierId || '').trim();
    if (!supplierId) return res.status(400).send('Missing supplier id');
    const rows = await listingsStore.listListingsBySupplier(supplierId);
    console.log('getSupplierStore: supplierId=', supplierId, 'rowsFound=', (rows || []).length);
    // only show published listings
    const pubs = (rows || []).filter(r => r.published);
    console.log('getSupplierStore: publishedCount=', pubs.length);

    // clientBase can be used to construct absolute URLs to client-side attached assets
    const clientBase = process.env.CLIENT_BASE_URL ? String(process.env.CLIENT_BASE_URL).replace(/\/$/, '') : null;

    // Build HTML list
    let itemsHtml = '';
    for (const row of pubs) {
      const slug = row.slug || '';
      const title = row.title || 'Listing';
      const desc = row.description || '';
      const designKey = row.design_key || '';

      // Attempt to find a preview (lightweight: look for client attached asset file matching designKey)
      let previewUrl: string | null = null;
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const clientPath = path.join(process.cwd(), 'client', 'attached_assets');
        if (designKey) {
          const files = await fs.readdir(clientPath);
          const found = files.find(f => f.toLowerCase().startsWith(String(designKey).toLowerCase()));
          if (found && clientBase) previewUrl = `${clientBase}/attached_assets/${found}`;
        }
      } catch (e) {
        // ignore
      }

      const img = previewUrl ? `<div style="width:160px;height:160px;overflow:hidden;border-radius:6px;margin-bottom:8px"><img src="${escapeHtml(previewUrl)}" style="width:100%;height:100%;object-fit:cover"/></div>` : '';

      itemsHtml += `<div style="border:1px solid #eee;border-radius:8px;padding:12px;margin:8px;width:220px;box-sizing:border-box">${img}<h3 style="margin:6px 0 4px 0;font-size:16px">${escapeHtml(title)}</h3><p style="margin:0 0 8px 0;color:#444;font-size:13px">${escapeHtml(desc)}</p><div><a href="/listing/${encodeURIComponent(slug)}" style="margin-right:6px;padding:6px 8px;background:#e5e7eb;border-radius:6px;text-decoration:none;color:#111">View</a><a href="/listing/${encodeURIComponent(slug)}" style="padding:6px 8px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Buy</a></div></div>`;
    }

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Store ${escapeHtml(supplierId)}</title>
          <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:24px;color:#111}.grid{display:flex;flex-wrap:wrap}</style>
        </head>
        <body>
          <h1>Store: ${escapeHtml(supplierId)}</h1>
          <div class="grid">${itemsHtml || '<p>No published listings</p>'}</div>
        </body>
      </html>`;

    res.set('Content-Type','text/html; charset=utf-8');
    return res.send(html);
  } catch (e: unknown) {
    console.error('getSupplierStore error', (await import('../utils')).fmtErr(e));
    return res.status(500).send('Server error');
  }
}

export async function getListingJson(req: Request, res: Response) {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ message: 'Missing slug' });
    const row = await listingsStore.getListingBySlug(slug);
    if (!row || !row.published) return res.status(404).json({ message: 'Listing not found' });

    // find preview similar to getPublicListing
    let previewUrl: string | null = null;
    const clientBase = process.env.CLIENT_BASE_URL ? String(process.env.CLIENT_BASE_URL).replace(/\/$/, '') : `http://localhost:5173`;
    let previewAssetId: number | null = null;
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const clientPath = path.join(process.cwd(), 'client', 'attached_assets');
      const designKey = row.design_key || '';
      if (designKey) {
        const patterns = [`${designKey}-front`, `${designKey}`];
        for (const p of patterns) {
          try {
            const files = await fs.readdir(clientPath);
            const found = files.find(f => f.toLowerCase().startsWith(p.toLowerCase()));
            if (found) { previewUrl = `${clientBase}/attached_assets/${found}`; break; }
          } catch (e) { }
        }
      }
    } catch (e) { }

    let preview_group: any = null;
    if (!previewUrl && row.design_key) {
      try {
        const db = await import('../../db');
        if (db.pool) {
          const clientDb = await db.pool.connect();
          try {
            const likePattern = `%${row.design_key}%`;
            const r = await clientDb.query('SELECT id, filename, mime, metadata FROM assets WHERE filename ILIKE $1 OR filename ILIKE $2 ORDER BY id', [likePattern, `${row.design_key}%`]);
            if (r && r.rows && r.rows.length) {
              const groupsMap: Record<string, any> = {};
              for (const a of r.rows) {
                const fn = a.filename || '';
                const m = String(fn || '').match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
                const key = m ? `design-${m[1]}` : `asset-${a.id}`;
                const side = m ? (m[2] === 'back' ? 'back' : 'front') : null;
                if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
                let url = `${clientBase}/api/assets/${a.id}`;
                try { if (fn) { const fs = await import('fs/promises'); const path = await import('path'); await fs.access(path.join(process.cwd(), 'client', 'attached_assets', fn)); url = `${clientBase}/attached_assets/${fn}`; } } catch (e) { }
                let meta: any = a.metadata || null;
                try { if (meta && typeof meta === 'string') meta = JSON.parse(meta); } catch (e) { /* ignore */ }
                const entry = { id: a.id, filename: fn, url, mime: a.mime, metadata: meta };
                if (side === 'front') groupsMap[key].front = entry;
                else if (side === 'back') groupsMap[key].back = entry;
                else groupsMap[key].any = entry;
              }
              const keys = Object.keys(groupsMap);
              if (keys.length) preview_group = groupsMap[keys[0]];
              const firstRow = r.rows[0];
              if (firstRow) previewAssetId = firstRow.id;
              if (!previewUrl && preview_group) previewUrl = (preview_group.front?.url || preview_group.any?.url || preview_group.back?.url) || null;
            }
          } finally { clientDb.release(); }
        }
      } catch (e) { }
    }

    return res.json({ listing: { ...row, preview_url: previewUrl, preview_asset_id: previewAssetId, preview_group } });
  } catch (e: unknown) {
    console.error('getListingJson error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function getListingByIdJson(req: Request, res: Response) {
  try {
    const id = Number(req.params.id || 0);
    console.log('DEBUG: getListingByIdJson called for id=', id);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const row = await listingsStore.getListingById(id);
    if (!row) return res.status(404).json({ message: 'Listing not found' });

    // reuse logic from getListingJson to compute preview
    // find preview similar to getPublicListing
    let previewUrl: string | null = null;
    let previewAssetId: number | null = null;
    const clientBase = process.env.CLIENT_BASE_URL ? String(process.env.CLIENT_BASE_URL).replace(/\/$/, '') : `http://localhost:5173`;
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const clientPath = path.join(process.cwd(), 'client', 'attached_assets');
      const uploadsPath = path.join(process.cwd(), 'uploads');
      const designKey = row.design_key || '';
      if (designKey) {
        const patterns = [`${designKey}-front`, `${designKey}`];
        for (const p of patterns) {
          try {
            const files = await fs.readdir(clientPath);
            const found = files.find(f => f.toLowerCase().startsWith(p.toLowerCase()));
            if (found) { previewUrl = `${clientBase}/attached_assets/${found}`; break; }
          } catch (e) { }
          try {
            const files2 = await fs.readdir(uploadsPath);
            const found2 = files2.find(f => f.toLowerCase().startsWith(p.toLowerCase()));
            if (found2) { previewUrl = `${clientBase}/uploads/${found2}`; break; }
          } catch (e) { }
        }
      }
    } catch (e) { }

    let preview_group: any = null;
    if (!previewUrl && row.design_key) {
      try {
        const db = await import('../../db');
        if (db.pool) {
          const clientDb = await db.pool.connect();
          try {
            const likePattern = `%${row.design_key}%`;
            const r = await clientDb.query('SELECT id, filename, mime, metadata FROM assets WHERE filename ILIKE $1 OR filename ILIKE $2 ORDER BY id', [likePattern, `${row.design_key}%`]);
            if (r && r.rows && r.rows.length) {
              const groupsMap: Record<string, any> = {};
              for (const a of r.rows) {
                const fn = a.filename || '';
                const m = String(fn || '').match(/^design-(\d+)-(front|back)\.(png|jpg|jpeg)$/i);
                const key = m ? `design-${m[1]}` : `asset-${a.id}`;
                const side = m ? (m[2] === 'back' ? 'back' : 'front') : null;
                if (!groupsMap[key]) groupsMap[key] = { key, front: null, back: null, any: null };
                let url = `${clientBase}/api/assets/${a.id}`;
                try { if (fn) { const fs = await import('fs/promises'); const path = await import('path'); await fs.access(path.join(process.cwd(), 'client', 'attached_assets', fn)); url = `${clientBase}/attached_assets/${fn}`; } } catch (e) { }
                let meta: any = a.metadata || null;
                try { if (meta && typeof meta === 'string') meta = JSON.parse(meta); } catch (e) { /* ignore */ }
                const entry = { id: a.id, filename: fn, url, mime: a.mime, metadata: meta };
                if (side === 'front') groupsMap[key].front = entry;
                else if (side === 'back') groupsMap[key].back = entry;
                else groupsMap[key].any = entry;
              }
              const keys = Object.keys(groupsMap);
              if (keys.length) preview_group = groupsMap[keys[0]];
              const firstRow = r.rows[0];
              if (firstRow) previewAssetId = firstRow.id;
              if (!previewUrl && preview_group) previewUrl = (preview_group.front?.url || preview_group.any?.url || preview_group.back?.url) || null;
            }
          } finally { clientDb.release(); }
        }
      } catch (e) { }
    }

    return res.json({ listing: { ...row, preview_url: previewUrl, preview_asset_id: previewAssetId, preview_group } });
  } catch (e: unknown) {
    console.error('getListingByIdJson error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteListing(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ message: 'Missing id' });
  try {
    console.log('deleteListing attempt', { id, userId: user.sub || user.id || null });
    // Attempt delete; listingsStore.deleteListing enforces supplier ownership
    const ok = await listingsStore.deleteListing(id, user.sub || user.id || null);
    console.log('deleteListing result', { id, ok });
    if (!ok) return res.status(404).json({ message: 'Listing not found or not owned by you' });
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error('deleteListing error', (await import('../utils')).fmtErr(e));
    return res.status(500).json({ message: 'Failed to delete listing' });
  }
}

function escapeHtml(s: any) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as any)[c]);
}

function slugify(s: any) {
  if (!s) return 'listing';
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
