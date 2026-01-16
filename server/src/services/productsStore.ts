import { pool, db } from '../../db';
import { slugify } from '../utils';
import * as catalog from './catalogStore';

export async function createProduct(payload: {
  name: string;
  single_price?: number;
  bulk_min?: number;
  bulk_price?: number;
  sizes?: number[];
  colors?: number[];
  designs?: any; // { front: {...}, back: {...} }
  sizeChart?: Array<{ size_id: number; chest: number; length: number; shoulder: number }>;
  inventory?: Array<{ color_id:number; size_id:number; quantity:number; price:number }>;
}) {
  const slugBase = slugify(payload.name);
  if (pool) {
    // ensure slug uniqueness in products_full
    let slug = slugBase;
    let counter = 1;
    while (true) {
      const exists = await pool.query('SELECT 1 FROM products_full WHERE lower(slug) = lower($1) LIMIT 1', [slug]);
      if (!exists.rows.length) break;
      slug = `${slugBase}-${counter++}`;
    }

    const sizes = payload.sizes || [];
    const colors = payload.colors || [];
    const sizeChart = payload.sizeChart || [];
    const designs = [] as any[];
    if (payload.designs) {
      if (payload.designs.front) designs.push({ side: 'front', ...payload.designs.front });
      if (payload.designs.back) designs.push({ side: 'back', ...payload.designs.back });
    }
    const inventory = payload.inventory || [];

    const res = await pool.query(
      `INSERT INTO products_full (name, slug, single_price, bulk_min, bulk_price, sizes, colors, size_chart, designs, inventory)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name, slug, single_price, bulk_min, bulk_price, created_at`, 
      [payload.name, slug, payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, JSON.stringify(sizes), JSON.stringify(colors), JSON.stringify(sizeChart), JSON.stringify(designs), JSON.stringify(inventory)]
    );

    return res.rows[0];
  }

  throw new Error('DB not configured');
}

export async function listProducts() {
  if (pool) {
    // Exclude soft-deleted products by default
    const r = await pool.query(`SELECT id, name, slug, single_price, bulk_min, bulk_price, created_at, designs FROM products_full WHERE COALESCE(is_deleted, false) = false ORDER BY id`);
    return r.rows.map((row: any) => {
      // ensure numeric coercion
      const single_price = row.single_price !== null ? Number(row.single_price) : 0;
      const bulk_price = row.bulk_price !== null ? Number(row.bulk_price) : 0;
      // normalize designs into { front, back } shape if stored as array
      const rawDesigns = row.designs || [];
      let designs: any = {};
      if (Array.isArray(rawDesigns)) {
        for (const d of rawDesigns) {
          if (!d) continue;
          const side = (d.side || '').toLowerCase();
          if (side === 'front') designs.front = d;
          else if (side === 'back') designs.back = d;
        }
        // fallback: if array but no named sides, map by position
        if (!designs.front && rawDesigns[0]) designs.front = rawDesigns[0];
        if (!designs.back && rawDesigns[1]) designs.back = rawDesigns[1];
      } else {
        designs = rawDesigns;
      }

      return { ...row, single_price, bulk_price, designs };
    });
  }
  return [];
}

export async function getProduct(id: number) {
  if (pool) {
    const r = await pool.query('SELECT id, name, slug, single_price, bulk_min, bulk_price, sizes, colors, size_chart, designs, inventory, is_deleted, deleted_at, updated_at, created_at FROM products_full WHERE id=$1', [id]);
    const prod = r.rows[0];
    if (!prod) return null;
    prod.single_price = prod.single_price !== null ? Number(prod.single_price) : 0;
    prod.bulk_price = prod.bulk_price !== null ? Number(prod.bulk_price) : 0;

    // sizes/colors are stored as arrays of ids
    const sizes = prod.sizes || [];
    const colors = prod.colors || [];
    const sizeChart = prod.size_chart || [];
    const designs = prod.designs || [];
    const inventory = prod.inventory || [];

    return { ...prod, sizes, colors, sizeChart, designs, inventory };
  }
  return null;
}

export async function updateProduct(id: number, payload: {
  name?: string;
  single_price?: number;
  bulk_min?: number;
  bulk_price?: number;
  sizes?: number[];
  colors?: number[];
  designs?: any;
  sizeChart?: Array<{ size_id: number; chest: number; length: number; shoulder: number }>;
  inventory?: Array<{ color_id:number; size_id:number; quantity:number; price:number }>;
}) {
  if (!pool) throw new Error('DB not configured');

  // Name/slug handling
  let slug: string | null = null;
  if (payload.name) {
    const slugBase = slugify(payload.name);
    slug = slugBase;
    let counter = 1;
    while (true) {
      const exists = await pool.query('SELECT 1 FROM products_full WHERE lower(slug) = lower($1) AND id <> $2 LIMIT 1', [slug, id]);
      if (!exists.rows.length) break;
      slug = `${slugBase}-${counter++}`;
    }
    await pool.query('UPDATE products_full SET name=$1, slug=$2, single_price=$3, bulk_min=$4, bulk_price=$5, updated_at=now() WHERE id=$6', [payload.name, slug, payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, id]);
  } else {
    await pool.query('UPDATE products_full SET single_price=$1, bulk_min=$2, bulk_price=$3, updated_at=now() WHERE id=$4', [payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, id]);
    const r = await pool.query('SELECT slug FROM products_full WHERE id=$1', [id]);
    slug = r.rows[0]?.slug || null;
  }

  // replace sizes/colors/size_chart/designs/inventory if provided
  if (payload.sizes) {
    await pool.query('UPDATE products_full SET sizes=$1, updated_at=now() WHERE id=$2', [JSON.stringify(payload.sizes), id]);
  }
  if (payload.colors) {
    await pool.query('UPDATE products_full SET colors=$1, updated_at=now() WHERE id=$2', [JSON.stringify(payload.colors), id]);
  }
  if (payload.sizeChart) {
    await pool.query('UPDATE products_full SET size_chart=$1, updated_at=now() WHERE id=$2', [JSON.stringify(payload.sizeChart), id]);
  }
  if (payload.designs) {
    const designs = [] as any[];
    if (payload.designs.front) designs.push({ side: 'front', ...payload.designs.front });
    if (payload.designs.back) designs.push({ side: 'back', ...payload.designs.back });
    await pool.query('UPDATE products_full SET designs=$1, updated_at=now() WHERE id=$2', [JSON.stringify(designs), id]);
  }
  if (payload.inventory) {
    await pool.query('UPDATE products_full SET inventory=$1, updated_at=now() WHERE id=$2', [JSON.stringify(payload.inventory), id]);
  }

  return getProduct(id);
}

export async function softDeleteProduct(id: number) {
  if (!pool) throw new Error('DB not configured');
  await pool.query('UPDATE products_full SET is_deleted = true, deleted_at = now(), updated_at = now() WHERE id=$1', [id]);
  return getProduct(id);
}