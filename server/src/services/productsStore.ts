import { pool, db } from '../../db';
import { slugify } from '../utils';
import { storage } from '../services/storage';
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
}) {
  const slugBase = slugify(payload.name);
  if (pool) {
    // ensure slug uniqueness by appending a numeric suffix if needed
    let slug = slugBase;
    let counter = 1;
    while (true) {
      const exists = await pool.query('SELECT 1 FROM products WHERE lower(slug) = lower($1) LIMIT 1', [slug]);
      if (!exists.rows.length) break;
      slug = `${slugBase}-${counter++}`;
    }

    const res = await pool.query(
      'INSERT INTO products (name, slug, single_price, bulk_min, bulk_price) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, slug, single_price, bulk_min, bulk_price, created_at',
      [payload.name, slug, payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0]
    );
    const product = res.rows[0];
    const productId = product.id;

    // sizes
    if (payload.sizes && payload.sizes.length) {
      for (const sizeId of payload.sizes) {
        await pool.query('INSERT INTO product_sizes (product_id,size_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [productId, sizeId]);
      }
    }

    // colors
    if (payload.colors && payload.colors.length) {
      for (const colorId of payload.colors) {
        await pool.query('INSERT INTO product_colors (product_id,color_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [productId, colorId]);
      }
    }

    // designs: use storage.createDesign and link product_id
    if (payload.designs) {
      const designs = payload.designs;
      if (designs.front) {
        const d = await storage.createDesign({ ...designs.front, product: slug });
        await pool.query('UPDATE designs SET product_id=$1 WHERE id=$2', [productId, (d as any).id]);
      }
      if (designs.back) {
        const d = await storage.createDesign({ ...designs.back, product: slug });
        await pool.query('UPDATE designs SET product_id=$1 WHERE id=$2', [productId, (d as any).id]);
      }
    }

    // size chart
    if (payload.sizeChart && payload.sizeChart.length) {
      for (const sc of payload.sizeChart) {
        await catalog.upsertSizeChart({ product: slug, size_id: sc.size_id, chest: sc.chest, length: sc.length, shoulder: sc.shoulder });
      }
    }

    return product;
  }

  // JSON fallback - not implemented, throw
  throw new Error('DB not configured');
}

export async function listProducts() {
  if (pool) {
    const r = await pool.query('SELECT id, name, slug, single_price, bulk_min, bulk_price, created_at FROM products ORDER BY id');
    // Convert numeric strings to numbers so clients don't have to handle it
    return r.rows.map((row: any) => ({
      ...row,
      single_price: row.single_price !== null ? Number(row.single_price) : 0,
      bulk_price: row.bulk_price !== null ? Number(row.bulk_price) : 0,
    }));
  }
  return [];
}

export async function getProduct(id: number) {
  if (pool) {
    const r = await pool.query('SELECT id, name, slug, single_price, bulk_min, bulk_price, created_at FROM products WHERE id=$1', [id]);
    const prod = r.rows[0];
    if (!prod) return null;
    // coerce numeric values
    prod.single_price = prod.single_price !== null ? Number(prod.single_price) : 0;
    prod.bulk_price = prod.bulk_price !== null ? Number(prod.bulk_price) : 0;

    const sizes = (await pool.query('SELECT size_id FROM product_sizes WHERE product_id=$1 ORDER BY size_id', [id])).rows.map(r => r.size_id);
    const colors = (await pool.query('SELECT color_id FROM product_colors WHERE product_id=$1 ORDER BY color_id', [id])).rows.map(r => r.color_id);
    const sizeChart = await catalog.listSizeChart(prod.slug);
    // designs by product_id
    const designs = (await pool.query('SELECT * FROM designs WHERE product_id=$1 ORDER BY id', [id])).rows;
    return { ...prod, sizes, colors, sizeChart, designs };
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
}) {
  if (!pool) throw new Error('DB not configured');

  // Update product row
  const slugBase = slugify(payload.name || '');
  // If name changed, compute new unique slug; otherwise keep existing slug
  let slug: string | null = null;
  if (payload.name) {
    slug = slugBase;
    let counter = 1;
    while (true) {
      const exists = await pool.query('SELECT 1 FROM products WHERE lower(slug) = lower($1) AND id <> $2 LIMIT 1', [slug, id]);
      if (!exists.rows.length) break;
      slug = `${slugBase}-${counter++}`;
    }
    await pool.query('UPDATE products SET name=$1, slug=$2, single_price=$3, bulk_min=$4, bulk_price=$5 WHERE id=$6', [payload.name, slug, payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, id]);
  } else {
    await pool.query('UPDATE products SET single_price=$1, bulk_min=$2, bulk_price=$3 WHERE id=$4', [payload.single_price || 0, payload.bulk_min || 100, payload.bulk_price || 0, id]);
    const r = await pool.query('SELECT slug FROM products WHERE id=$1', [id]);
    slug = r.rows[0]?.slug || slugBase;
  }

  // sizes - replace
  await pool.query('DELETE FROM product_sizes WHERE product_id=$1', [id]);
  if (payload.sizes && payload.sizes.length) {
    for (const sizeId of payload.sizes) {
      await pool.query('INSERT INTO product_sizes (product_id,size_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, sizeId]);
    }
  }

  // colors - replace
  await pool.query('DELETE FROM product_colors WHERE product_id=$1', [id]);
  if (payload.colors && payload.colors.length) {
    for (const colorId of payload.colors) {
      await pool.query('INSERT INTO product_colors (product_id,color_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, colorId]);
    }
  }

  // designs - remove old and create new ones
  await pool.query('UPDATE designs SET product_id = NULL WHERE product_id = $1', [id]);
  if (payload.designs) {
    // delete previous design rows linked to this product
    await pool.query('DELETE FROM designs WHERE product_id=$1', [id]);
    const designs = payload.designs;
    if (designs.front) {
      const d = await storage.createDesign({ ...designs.front, product: slug });
      await pool.query('UPDATE designs SET product_id=$1 WHERE id=$2', [id, (d as any).id]);
    }
    if (designs.back) {
      const d = await storage.createDesign({ ...designs.back, product: slug });
      await pool.query('UPDATE designs SET product_id=$1 WHERE id=$2', [id, (d as any).id]);
    }
  }

  // size chart
  if (payload.sizeChart && payload.sizeChart.length) {
    for (const sc of payload.sizeChart) {
      await catalog.upsertSizeChart({ product: slug, size_id: sc.size_id, chest: sc.chest, length: sc.length, shoulder: sc.shoulder });
    }
  }

  return getProduct(id);
}