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

export async function listListingsBySupplier(supplierId, options = {}) {
  if (!pool) return [];
  const client = await pool.connect();
  try {
    let q = 'SELECT id, supplier_id, title, slug, description, design_key, visibility, price, published, published_at, created_at FROM listings WHERE supplier_id = $1';
    const params = [supplierId];

    if (options.onlyPublished) {
      q += " AND published = true AND (visibility = 'public' OR visibility IS NULL)";
    } else {
      // Exclude archived/deleted items from active management list
      q += " AND (visibility != 'archived' OR visibility IS NULL)";
    }

    q += ' ORDER BY created_at DESC';

    const res = await client.query(q, params);
    return res.rows || [];
  } finally {
    client.release();
  }
}

export async function updateListingStatus(id, supplierId, { published, visibility } = {}) {
  if (!pool) throw new Error('Database not configured');
  const client = await pool.connect();
  try {
    const isPub = typeof published === 'boolean' ? published : (visibility === 'public');
    const vis = visibility || (isPub ? 'public' : 'unlisted');
    const res = await client.query(
      `UPDATE listings 
       SET published = $1, 
           visibility = $2, 
           published_at = CASE WHEN $1 THEN COALESCE(published_at, now()) ELSE published_at END 
       WHERE id = $3 AND (supplier_id = $4 OR $4 IS NULL)
       RETURNING id, supplier_id, title, slug, description, design_key, visibility, price, published, published_at, created_at`,
      [isPub, vis, id, supplierId]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function publishListing(listingId) {
  if (!pool) throw new Error('Database not configured');
  const client = await pool.connect();
  try {
    const res = await client.query("UPDATE listings SET published = true, visibility = 'public', published_at = now() WHERE id = $1 RETURNING id, slug", [listingId]);
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
    // Check if there are orders referencing this listing
    const checkOrders = await client.query(
      'SELECT 1 FROM order_items WHERE listing_id = $1 LIMIT 1',
      [id]
    );
    if (checkOrders.rows && checkOrders.rows.length > 0) {
      // Has orders: soft-unlist and archive to preserve historical customer/production orders
      const res = await client.query(
        "UPDATE listings SET published = false, visibility = 'archived' WHERE id = $1 AND (supplier_id = $2 OR $2 IS NULL)",
        [id, supplierId]
      );
      return { success: (res.rowCount || 0) > 0, archived: true };
    }

    // No orders referencing it: safe to delete row completely
    const res = await client.query(
      'DELETE FROM listings WHERE id = $1 AND (supplier_id = $2 OR $2 IS NULL)',
      [id, supplierId]
    );
    return { success: (res.rowCount || 0) > 0, archived: false };
  } finally {
    client.release();
  }
}

export default {
  createListing,
  listListingsBySupplier,
  updateListingStatus,
  publishListing,
  getListingBySlug,
  getListingById,
  deleteListing
};
