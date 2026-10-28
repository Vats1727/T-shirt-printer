import { pool } from '../config/database.js';
import { slugify } from '../utils.js';
export async function createProduct(payload) {
  const slugBase = slugify(payload.name);
  if (pool) {
    let slug = slugBase;
    let counter = 1;
    let attempts = 0;
    while (true) {
      const exists = await pool.query("SELECT 1 FROM products_full WHERE lower(slug) = lower($1) LIMIT 1", [slug]);
      if (!exists.rows.length) break;
      if (++attempts > 1e3) throw new Error(`Unable to generate unique slug`);
      slug = `${slugBase}-${counter++}`;
    }
    const designsArray = [];
    if (payload.designs) {
      if (payload.designs.front) designsArray.push({ side: "front", ...payload.designs.front });
      if (payload.designs.back) designsArray.push({ side: "back", ...payload.designs.back });
    }
    const category = payload.category || "men";
    const status = payload.status || (payload.is_draft ? "draft" : "published");
    const res = await pool.query(
      `INSERT INTO products_full (name, slug, single_price, bulk_min, bulk_price, sizes, colors, size_chart, designs, inventory, category, owner_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, name, slug, category, single_price, bulk_min, bulk_price, status, created_at`,
      [payload.name, slug, payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, JSON.stringify(payload.sizes || []), JSON.stringify(payload.colors || []), JSON.stringify(payload.sizeChart || []), JSON.stringify(designsArray), JSON.stringify(payload.inventory || []), category, payload.owner_id || null, status]
    );
    return res.rows[0];
  }
  throw new Error("DB not configured");
}
export async function listProducts(ownerId) {
  if (pool) {
    const query = ownerId
      ? `SELECT id, name, slug, single_price, bulk_min, bulk_price, sizes, colors, size_chart, created_at, designs, category, status, owner_id FROM products_full WHERE owner_id = $1 AND COALESCE(is_deleted, false) = false ORDER BY id`
      : `SELECT id, name, slug, single_price, bulk_min, bulk_price, sizes, colors, size_chart, created_at, designs, category, status, owner_id FROM products_full WHERE COALESCE(is_deleted, false) = false ORDER BY id`;
    const r = await pool.query(query, ownerId ? [ownerId] : []);
    return r.rows.map((row) => {
      const single_price = row.single_price !== null ? Number(row.single_price) : 0;
      const bulk_price = row.bulk_price !== null ? Number(row.bulk_price) : 0;
      const category = row.category || "men";
      let sizes = [];
      try {
        sizes = Array.isArray(row.sizes) ? row.sizes : (typeof row.sizes === 'string' ? JSON.parse(row.sizes || '[]') : (row.sizes || []));
      } catch (e) {
        sizes = [];
      }
      let colors = [];
      try {
        colors = Array.isArray(row.colors) ? row.colors : (typeof row.colors === 'string' ? JSON.parse(row.colors || '[]') : (row.colors || []));
      } catch (e) {
        colors = [];
      }
      let size_chart = [];
      try {
        size_chart = Array.isArray(row.size_chart) ? row.size_chart : (typeof row.size_chart === 'string' ? JSON.parse(row.size_chart || '[]') : (row.size_chart || []));
      } catch (e) {
        size_chart = [];
      }
      const rawDesigns = row.designs || [];
      let designs = {};
      let designs_list = [];

      if (Array.isArray(rawDesigns)) {
        designs_list = rawDesigns;
        for (const d of rawDesigns) {
          if (!d) continue;
          const side = (d.side || "").toLowerCase();
          if (side === "front") designs.front = d;
          else if (side === "back") designs.back = d;
        }
        if (!designs.front && rawDesigns[0]) designs.front = rawDesigns[0];
        if (!designs.back && rawDesigns[1]) designs.back = rawDesigns[1];
      } else if (rawDesigns && typeof rawDesigns === 'object') {
        designs = rawDesigns;
        if (rawDesigns.front) designs_list.push({ side: 'front', ...rawDesigns.front });
        if (rawDesigns.back) designs_list.push({ side: 'back', ...rawDesigns.back });
      }

      const front_image = designs.front?.image || designs.front?.image_url || designs_list[0]?.image || null;
      const back_image = designs.back?.image || designs.back?.image_url || designs_list[1]?.image || null;
      const image = front_image || back_image || null;

      return { ...row, single_price, bulk_price, category, sizes, colors, size_chart, designs, designs_list, front_image, back_image, image };
    });
  }
  return [];
}
export async function getProduct(id, ownerId) {
  if (pool) {
    const query = ownerId ? "SELECT id, name, slug, category, single_price, bulk_min, bulk_price, sizes, colors, size_chart, designs, inventory, is_deleted, deleted_at, updated_at, created_at, status, owner_id FROM products_full WHERE id=$1 AND owner_id=$2" : "SELECT id, name, slug, category, single_price, bulk_min, bulk_price, sizes, colors, size_chart, designs, inventory, is_deleted, deleted_at, updated_at, created_at, status, owner_id FROM products_full WHERE id=$1";
    const params = ownerId ? [id, ownerId] : [id];
    const r = await pool.query(query, params);
    const prod = r.rows[0];
    if (!prod) return null;
    prod.single_price = prod.single_price !== null ? Number(prod.single_price) : 0;
    prod.bulk_price = prod.bulk_price !== null ? Number(prod.bulk_price) : 0;
    prod.category = prod.category || "men";
    const sizes = prod.sizes || [];
    const colors = prod.colors || [];
    const sizeChart = prod.size_chart || [];
    const inventory = prod.inventory || [];

    const rawDesigns = prod.designs || [];
    let designs = {};
    let designs_list = [];

    if (Array.isArray(rawDesigns)) {
      designs_list = rawDesigns;
      for (const d of rawDesigns) {
        if (!d) continue;
        const side = (d.side || "").toLowerCase();
        if (side === "front") designs.front = d;
        else if (side === "back") designs.back = d;
      }
      if (!designs.front && rawDesigns[0]) designs.front = rawDesigns[0];
      if (!designs.back && rawDesigns[1]) designs.back = rawDesigns[1];
    } else if (rawDesigns && typeof rawDesigns === 'object') {
      designs = rawDesigns;
      if (rawDesigns.front) designs_list.push({ side: 'front', ...rawDesigns.front });
      if (rawDesigns.back) designs_list.push({ side: 'back', ...rawDesigns.back });
    }

    const front_image = designs.front?.image || designs.front?.image_url || designs_list[0]?.image || null;
    const back_image = designs.back?.image || designs.back?.image_url || designs_list[1]?.image || null;
    const image = front_image || back_image || null;

    return { ...prod, sizes, colors, sizeChart, designs, designs_list, front_image, back_image, image, inventory };
  }
  return null;
}
export async function updateProduct(id, payload, ownerId) {
  if (!pool) throw new Error("DB not configured");
  const existing = await getProduct(id, ownerId);
  if (!existing) throw new Error("Product not found or access denied");
  let slug = null;
  if (payload.name) {
    const slugBase = slugify(payload.name);
    slug = slugBase;
    let counter = 1;
    let attempts = 0;
    const MAX_UNIQUE_ATTEMPTS = 1e3;
    while (true) {
      const exists = await pool.query("SELECT 1 FROM products_full WHERE lower(slug) = lower($1) AND id <> $2 LIMIT 1", [slug, id]);
      if (!exists.rows.length) break;
      if (++attempts > MAX_UNIQUE_ATTEMPTS) throw new Error(`Unable to generate unique slug after ${MAX_UNIQUE_ATTEMPTS} attempts`);
      slug = `${slugBase}-${counter++}`;
    }
    await pool.query("UPDATE products_full SET name=$1, slug=$2, single_price=$3, bulk_min=$4, bulk_price=$5, updated_at=now() WHERE id=$6 AND owner_id=$7", [payload.name, slug, payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, id, ownerId]);
  } else {
    await pool.query("UPDATE products_full SET single_price=$1, bulk_min=$2, bulk_price=$3, updated_at=now() WHERE id=$4 AND owner_id=$5", [payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, id, ownerId]);
    const r = await pool.query("SELECT slug FROM products_full WHERE id=$1", [id]);
    slug = r.rows[0]?.slug || null;
  }
  if (payload.category) {
    await pool.query("UPDATE products_full SET category=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [payload.category, id, ownerId]);
  }
  if (payload.sizes) {
    await pool.query("UPDATE products_full SET sizes=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [JSON.stringify(payload.sizes), id, ownerId]);
  }
  if (payload.colors) {
    await pool.query("UPDATE products_full SET colors=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [JSON.stringify(payload.colors), id, ownerId]);
  }
  if (payload.sizeChart) {
    await pool.query("UPDATE products_full SET size_chart=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [JSON.stringify(payload.sizeChart), id, ownerId]);
  }
  if (payload.designs) {
    const designs = [];
    if (payload.designs.front) designs.push({ side: "front", ...payload.designs.front });
    if (payload.designs.back) designs.push({ side: "back", ...payload.designs.back });
    await pool.query("UPDATE products_full SET designs=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [JSON.stringify(designs), id, ownerId]);
  }
  if (payload.inventory) {
    await pool.query("UPDATE products_full SET inventory=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [JSON.stringify(payload.inventory), id, ownerId]);
  }
  if (payload.status !== undefined) {
    await pool.query("UPDATE products_full SET status=$1, updated_at=now() WHERE id=$2 AND owner_id=$3", [payload.status, id, ownerId]);
  }
  return getProduct(id, ownerId);
}
export async function softDeleteProduct(id, ownerId) {
  if (!pool) throw new Error("DB not configured");
  await pool.query("UPDATE products_full SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id=$1 AND owner_id=$2", [id, ownerId]);
  return getProduct(id, ownerId);
}
