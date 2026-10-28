import { pool } from '../config/database.js';

export async function createListing(supplierId, title, description, slug, design_key, visibility, price) {
  if (!pool) throw new Error('Database not configured');
  const client = await pool.connect();
  try {
    const isPublic = (visibility || 'public') === 'public';
    const numPrice = price != null && !isNaN(Number(price)) ? Number(price) : 29.99;
    const q = `INSERT INTO listings (supplier_id, title, description, slug, design_key, visibility, price, published, published_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${isPublic ? 'now()' : 'null'},now()) RETURNING id, slug, published, price`;

    const MAX_RETRIES = 5;
    let attemptSlug = slug || null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await client.query(q, [supplierId, title, description, attemptSlug, design_key || null, visibility || 'public', numPrice, isPublic]);
        return res.rows[0];
      } catch (err) {
        if (err && err.code === '23505' && attempt < MAX_RETRIES - 1) {
          const suffix = Math.random().toString(36).slice(2, 7);
          attemptSlug = (String(slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + '-' + suffix;
          continue;
        }
        throw err;
      }
    }
    const res = await client.query(q, [supplierId, title, description, attemptSlug, design_key || null, visibility || 'public', numPrice, isPublic]);
    return res.rows[0];
  } finally {
    client.release();
  }
}

export async function listListingsBySupplier(supplierId) {
  if (!pool) return [];
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT id, supplier_id, title, slug, description, design_key, visibility, price, published, published_at, created_at FROM listings WHERE supplier_id = $1 ORDER BY created_at DESC',
      [supplierId]
    );
    return res.rows || [];
  } finally {
    client.release();
  }
}

export async function publishListing(listingId) {
  if (!pool) throw new Error('Database not configured');
  const client = await pool.connect();
  try {
    const res = await client.query('UPDATE listings SET published = true, published_at = now() WHERE id = $1 RETURNING id, slug', [listingId]);
    return res.rows[0];
  } finally {
    client.release();
  }
}

export async function getListingBySlug(slug) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, supplier_id, title, slug, description, design_key, visibility, price, published, published_at, created_at FROM listings WHERE slug = $1 LIMIT 1', [slug]);
    return (res.rows && res.rows[0]) || null;
  } finally {
    client.release();
  }
}

export async function getListingById(id) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, supplier_id, title, slug, description, design_key, visibility, price, published, published_at, created_at FROM listings WHERE id = $1 LIMIT 1', [id]);
    return (res.rows && res.rows[0]) || null;
  } finally {
    client.release();
  }
}

export async function deleteListing(id, supplierId) {
  if (!pool) return false;
  const client = await pool.connect();
  try {
    const res = await client.query('DELETE FROM listings WHERE id = $1 AND supplier_id = $2', [id, supplierId]);
    return (res.rowCount || 0) > 0;
  } finally {
    client.release();
  }
}

export default {
  createListing,
  listListingsBySupplier,
  publishListing,
  getListingBySlug,
  getListingById,
  deleteListing
};
