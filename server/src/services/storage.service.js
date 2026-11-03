import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import assetModel from '../models/asset.model.js';
import { pool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, 'farmo/front'), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, 'farmo/back'), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, 'artwork/front'), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, 'artwork/back'), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, 'designs/front'), { recursive: true });
    await fs.mkdir(path.resolve(UPLOAD_DIR, 'designs/back'), { recursive: true });
  } catch (e) {
    // ignore
  }
}

function mimeToExt(mime) {
  if (!mime) return 'bin';
  const m = mime.split('/')[1];
  if (!m) return 'bin';
  return m.split('+')[0];
}

/**
 * Recursively retrieves absolute paths of all files in a directory
 */
export async function getAllUploadFilesRecursively(dir = UPLOAD_DIR) {
  const filePaths = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await getAllUploadFilesRecursively(fullPath);
        filePaths.push(...nested);
      } else if (entry.isFile()) {
        filePaths.push(fullPath);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[Storage] getAllUploadFilesRecursively error:', err.message);
    }
  }
  return filePaths;
}

/**
 * Resolves any URL, asset ID, relative path, or filename into an array of actual existing disk paths in UPLOAD_DIR
 */
export async function findFilePathsOnDisk(fileRef) {
  if (!fileRef || (typeof fileRef !== 'string' && typeof fileRef !== 'number')) {
    return [];
  }

  const strRef = String(fileRef).trim();
  if (!strRef) return [];

  const matchedPaths = new Set();
  const allDiskFiles = await getAllUploadFilesRecursively(UPLOAD_DIR);

  // 1. Resolve asset ID if given as number or /api/assets/:id
  let candidateRelPaths = [];
  let candidateBasenames = [];

  const assetMatch = strRef.match(/(?:^|\/api\/assets\/)(\d+)$/);
  if (assetMatch) {
    const assetId = Number(assetMatch[1]);
    try {
      if (pool) {
        const aRes = await pool.query('SELECT filename, storage_key FROM assets WHERE id = $1', [assetId]);
        if (aRes.rows[0]) {
          const a = aRes.rows[0];
          if (a.storage_key) candidateRelPaths.push(a.storage_key.replace(/^uploads\//, ''));
          if (a.filename) candidateRelPaths.push(a.filename);
        }
      } else {
        const asset = await assetModel.findAssetById(assetId);
        if (asset?.storage_key) candidateRelPaths.push(asset.storage_key.replace(/^uploads\//, ''));
        if (asset?.filename) candidateRelPaths.push(asset.filename);
      }
    } catch (e) {
      console.warn('[Storage] Error looking up asset for path resolution:', e.message);
    }
  }

  // 2. Normalize input string
  const cleanStr = strRef
    .replace(/^https?:\/\/[^\/]+/, '')
    .replace(/^\/?(api\/assets\/|attached_assets\/|uploads\/)/, '')
    .trim();

  if (cleanStr) {
    candidateRelPaths.push(cleanStr);
  }

  for (const c of candidateRelPaths) {
    candidateBasenames.push(path.basename(c));
  }

  // 3. Check direct resolution for each candidate
  for (const c of candidateRelPaths) {
    const directPath = path.resolve(UPLOAD_DIR, c);
    if (directPath.startsWith(UPLOAD_DIR)) {
      try {
        const stat = await fs.stat(directPath);
        if (stat.isFile()) {
          matchedPaths.add(directPath);
        }
      } catch {}
    }
  }

  // 4. Search recursively across all disk files for matching basename or pattern
  for (const diskPath of allDiskFiles) {
    const diskBasename = path.basename(diskPath);
    const diskRelPath = path.relative(UPLOAD_DIR, diskPath).replace(/\\/g, '/');

    for (const c of candidateRelPaths) {
      const normalizedC = c.replace(/\\/g, '/');
      if (diskRelPath === normalizedC || diskRelPath.endsWith(normalizedC)) {
        matchedPaths.add(diskPath);
      }
    }

    for (const base of candidateBasenames) {
      if (!base) continue;
      // Exact basename match
      if (diskBasename === base) {
        matchedPaths.add(diskPath);
      }
      // Hex prefix match (e.g. base = "design-2-back.png" matches "01bcfd9b9b4e19589a98-design-2-back.png")
      else if (diskBasename.endsWith(`-${base}`)) {
        matchedPaths.add(diskPath);
      }
      // Pattern match for design hints (e.g. "design-2-")
      else if (base.startsWith('design-') && (diskBasename.startsWith(base) || diskBasename.includes(`-${base}`))) {
        matchedPaths.add(diskPath);
      }
    }
  }

  return Array.from(matchedPaths).filter(p => p.startsWith(UPLOAD_DIR));
}

/**
 * Checks if a file is referenced in past customer orders (order_items) or B2B designer orders (b2b_designer_order_items).
 * Prevents broken images on fulfillment screens, invoices, and customer receipt histories.
 */
export async function isFileReferencedInOrders(filePathOrRef) {
  if (!pool || !filePathOrRef) return false;

  const basename = path.basename(String(filePathOrRef));
  if (!basename) return false;

  const cleanBasename = basename.replace(/^[a-f0-9]{20}-/, '');

  try {
    // 1. Check order_items
    const orderCheck = await pool.query(
      `SELECT 1 FROM order_items 
       WHERE (preview_url LIKE '%' || $1 || '%' OR print_file_url LIKE '%' || $1 || '%' OR back_preview_url LIKE '%' || $1 || '%' OR back_print_file_url LIKE '%' || $1 || '%'
              OR preview_url LIKE '%' || $2 || '%' OR print_file_url LIKE '%' || $2 || '%' OR back_preview_url LIKE '%' || $2 || '%' OR back_print_file_url LIKE '%' || $2 || '%')
       LIMIT 1`,
      [basename, cleanBasename]
    );
    if (orderCheck.rows.length > 0) return true;

    // 2. Check b2b_designer_order_items
    const b2bCheck = await pool.query(
      `SELECT 1 FROM b2b_designer_order_items 
       WHERE (custom_mockup_url LIKE '%' || $1 || '%' OR print_file_url LIKE '%' || $1 || '%' OR back_preview_url LIKE '%' || $1 || '%' OR back_print_file_url LIKE '%' || $1 || '%'
              OR custom_mockup_url LIKE '%' || $2 || '%' OR print_file_url LIKE '%' || $2 || '%' OR back_preview_url LIKE '%' || $2 || '%' OR back_print_file_url LIKE '%' || $2 || '%')
       LIMIT 1`,
      [basename, cleanBasename]
    );
    if (b2bCheck.rows.length > 0) return true;

    // 3. Check if file is tied to an asset ID referenced in order_items
    const assetCheck = await pool.query(
      `SELECT id FROM assets WHERE filename LIKE '%' || $1 || '%' OR storage_key LIKE '%' || $1 || '%'`,
      [basename]
    );
    for (const aRow of assetCheck.rows) {
      const assetUrl = `/api/assets/${aRow.id}`;
      const oAsset = await pool.query(
        `SELECT 1 FROM order_items 
         WHERE preview_url = $1 OR print_file_url = $1 OR back_preview_url = $1 OR back_print_file_url = $1
         LIMIT 1`,
        [assetUrl]
      );
      if (oAsset.rows.length > 0) return true;

      const bAsset = await pool.query(
        `SELECT 1 FROM b2b_designer_order_items 
         WHERE custom_mockup_url = $1 OR print_file_url = $1 OR back_preview_url = $1 OR back_print_file_url = $1
         LIMIT 1`,
        [assetUrl]
      );
      if (bAsset.rows.length > 0) return true;
    }
  } catch (err) {
    console.warn('[Storage] isFileReferencedInOrders error:', err.message);
  }

  return false;
}

/**
 * Checks if another active entity in the database is currently referencing this file.
 */
export async function isFileReferencedInOtherActiveEntities(filePath, exclude = {}) {
  if (!pool || !filePath) return false;

  const basename = path.basename(String(filePath));
  if (!basename) return false;

  try {
    // Check other designs
    const excludeDesignId = exclude.designId ? Number(exclude.designId) : -1;
    const designCheck = await pool.query(
      `SELECT 1 FROM designs 
       WHERE id != $1 AND (image LIKE '%' || $2 || '%' OR back_image LIKE '%' || $2 || '%' OR preview_front LIKE '%' || $2 || '%' OR preview_back LIKE '%' || $2 || '%')
       LIMIT 1`,
      [excludeDesignId, basename]
    );
    if (designCheck.rows.length > 0) return true;

    // Check active products
    const excludeProdId = exclude.productId ? String(exclude.productId) : '-1';
    const prodCheck = await pool.query(
      `SELECT 1 FROM products_full 
       WHERE id != $1 AND COALESCE(is_deleted, false) = false 
         AND (designs::text LIKE '%' || $2 || '%' OR colors::text LIKE '%' || $2 || '%' OR size_chart::text LIKE '%' || $2 || '%')
       LIMIT 1`,
      [excludeProdId, basename]
    );
    if (prodCheck.rows.length > 0) return true;

    // Check listings
    const excludeListingId = exclude.listingId ? Number(exclude.listingId) : -1;
    const listingCheck = await pool.query(
      `SELECT 1 FROM listings 
       WHERE id != $1 AND (description LIKE '%' || $2 || '%' OR design_key LIKE '%' || $2 || '%')
       LIMIT 1`,
      [excludeListingId, basename]
    );
    if (listingCheck.rows.length > 0) return true;
  } catch (err) {
    console.warn('[Storage] isFileReferencedInOtherActiveEntities error:', err.message);
  }

  return false;
}

/**
 * Safely unlinks a physical file from server/uploads with order protection and active entity protection
 */
export async function safeDeletePhysicalFile(ref, { checkOrders = true, checkOtherEntities = true, exclude = {} } = {}) {
  if (!ref) return false;

  const diskPaths = await findFilePathsOnDisk(ref);
  if (!diskPaths || diskPaths.length === 0) {
    return false;
  }

  let unlinkedAny = false;

  for (const diskPath of diskPaths) {
    // 1. Order safeguard check
    if (checkOrders && (await isFileReferencedInOrders(diskPath))) {
      console.log(`[Storage] Preserving order image on disk: ${path.basename(diskPath)}`);
      continue;
    }

    // 2. Other active entity check
    if (checkOtherEntities && (await isFileReferencedInOtherActiveEntities(diskPath, exclude))) {
      console.log(`[Storage] Preserving shared file on disk (in use by another entity): ${path.basename(diskPath)}`);
      continue;
    }

    // 3. Unlink file
    try {
      await fs.unlink(diskPath);
      unlinkedAny = true;
      console.log(`[Storage] Successfully deleted physical file: ${diskPath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`[Storage] Failed to unlink file ${diskPath}:`, err.message);
      }
    }
  }

  // 4. Remove corresponding row from assets table if safe
  try {
    const basename = path.basename(String(ref));
    if (pool && basename) {
      const isProtected = checkOrders && (await isFileReferencedInOrders(basename));
      if (!isProtected) {
        await pool.query(
          `DELETE FROM assets WHERE filename LIKE '%' || $1 || '%' OR storage_key LIKE '%' || $1 || '%'`,
          [basename]
        );
      }
    }
  } catch (e) {
    console.warn('[Storage] Error cleaning assets table entry:', e.message);
  }

  return unlinkedAny;
}

/**
 * Backwards-compatible alias for deletePhysicalFile
 */
export async function deletePhysicalFile(relativeOrFullUrl) {
  return await safeDeletePhysicalFile(relativeOrFullUrl);
}

/**
 * Deletes all physical upload files belonging to a design
 */
export async function deleteDesignPhysicalFiles(designId, { checkOrders = true } = {}) {
  const dId = Number(designId);
  if (!dId) return;

  const refsToDelete = new Set();

  if (pool) {
    try {
      // 1. Design table image references
      const dRes = await pool.query('SELECT image, back_image, preview_front, preview_back FROM designs WHERE id = $1', [dId]);
      if (dRes.rows[0]) {
        const d = dRes.rows[0];
        if (d.image) refsToDelete.add(d.image);
        if (d.back_image) refsToDelete.add(d.back_image);
        if (d.preview_front) refsToDelete.add(d.preview_front);
        if (d.preview_back) refsToDelete.add(d.preview_back);
      }

      // 2. Design versions preview and layer images
      const vRes = await pool.query('SELECT payload FROM design_versions WHERE design_id = $1', [dId]);
      for (const vRow of vRes.rows) {
        let p = vRow.payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch {}
        }
        if (p && typeof p === 'object') {
          if (p.metadata?.preview_front) refsToDelete.add(p.metadata.preview_front);
          if (p.metadata?.preview_back) refsToDelete.add(p.metadata.preview_back);
          if (Array.isArray(p.sides)) {
            for (const side of p.sides) {
              for (const layer of side.layers || []) {
                if (layer.type === 'image' && layer.asset) {
                  if (layer.asset.url) refsToDelete.add(layer.asset.url);
                  if (layer.asset.filename) refsToDelete.add(layer.asset.filename);
                  if (layer.asset.id) refsToDelete.add(`/api/assets/${layer.asset.id}`);
                }
              }
            }
          }
        }
      }

      // 3. Assets table records linked to this design
      const aRes = await pool.query(
        `SELECT id, filename, storage_key FROM assets 
         WHERE (metadata->>'designId')::int = $1 OR filename LIKE '%' || $2 || '%'`,
        [dId, `design-${dId}-`]
      );
      for (const a of aRes.rows) {
        if (a.storage_key) refsToDelete.add(a.storage_key);
        if (a.filename) refsToDelete.add(a.filename);
        refsToDelete.add(`/api/assets/${a.id}`);
      }
    } catch (e) {
      console.warn('[Storage] deleteDesignPhysicalFiles query warning:', e.message);
    }
  }

  // Also include general pattern for design previews generated with design-${id}-
  refsToDelete.add(`design-${dId}-front.png`);
  refsToDelete.add(`design-${dId}-back.png`);
  refsToDelete.add(`design-${dId}-`);

  for (const ref of refsToDelete) {
    try {
      await safeDeletePhysicalFile(ref, {
        checkOrders,
        checkOtherEntities: true,
        exclude: { designId: dId }
      });
    } catch (err) {
      console.warn(`[Storage] Failed to delete file ${ref} for design ${dId}:`, err.message);
    }
  }
}

/**
 * Deletes all physical upload files belonging to a product
 */
export async function deleteProductPhysicalFiles(product, { checkOrders = true } = {}) {
  if (!product) return;

  const refsToDelete = new Set();
  const prodId = product.id;

  // 1. Collect images from product.designs
  if (product.designs) {
    const rawDesigns = Array.isArray(product.designs) ? product.designs : Object.values(product.designs);
    for (const d of rawDesigns) {
      if (d?.image) refsToDelete.add(d.image);
      if (d?.image_url) refsToDelete.add(d.image_url);
    }
  }

  // 2. Collect images from product.colors
  if (product.colors) {
    const rawColors = Array.isArray(product.colors) ? product.colors : Object.values(product.colors);
    for (const c of rawColors) {
      if (typeof c === 'object' && c !== null) {
        if (c.front_image) refsToDelete.add(c.front_image);
        if (c.back_image) refsToDelete.add(c.back_image);
        if (c.image) refsToDelete.add(c.image);
      }
    }
  }

  // 3. Top-level images
  if (product.front_image) refsToDelete.add(product.front_image);
  if (product.back_image) refsToDelete.add(product.back_image);
  if (product.image) refsToDelete.add(product.image);

  // 4. Safely unlink
  for (const ref of refsToDelete) {
    try {
      await safeDeletePhysicalFile(ref, {
        checkOrders,
        checkOtherEntities: true,
        exclude: { productId: prodId }
      });
    } catch (err) {
      console.warn(`[Storage] Failed to delete file ${ref} for product ${prodId}:`, err.message);
    }
  }
}

/**
 * Deletes all physical upload files belonging to a listing
 */
export async function deleteListingPhysicalFiles(listing, { checkOrders = true } = {}) {
  if (!listing) return;

  const refsToDelete = new Set();
  if (listing.thumbnail_url) refsToDelete.add(listing.thumbnail_url);
  if (listing.preview_url) refsToDelete.add(listing.preview_url);
  if (Array.isArray(listing.preview_images)) {
    for (const img of listing.preview_images) {
      if (typeof img === 'string') refsToDelete.add(img);
      else if (img?.url) refsToDelete.add(img.url);
    }
  }

  for (const ref of refsToDelete) {
    try {
      await safeDeletePhysicalFile(ref, {
        checkOrders,
        checkOtherEntities: true,
        exclude: { listingId: listing.id }
      });
    } catch (err) {
      console.warn(`[Storage] Failed to delete file ${ref} for listing ${listing.id}:`, err.message);
    }
  }
}

/**
 * When updating a product, unlinks any previous garment images that were replaced or removed
 */
export async function cleanReplacedProductImages(oldProduct, newPayload) {
  if (!oldProduct || !newPayload) return;

  const oldImages = new Set();
  const newImages = new Set();

  const extractImages = (source, targetSet) => {
    if (!source) return;
    const designs = Array.isArray(source.designs) ? source.designs : Object.values(source.designs || {});
    for (const d of designs) {
      if (d?.image) targetSet.add(d.image);
      if (d?.image_url) targetSet.add(d.image_url);
    }
    const colors = Array.isArray(source.colors) ? source.colors : Object.values(source.colors || {});
    for (const c of colors) {
      if (typeof c === 'object' && c !== null) {
        if (c.front_image) targetSet.add(c.front_image);
        if (c.back_image) targetSet.add(c.back_image);
        if (c.image) targetSet.add(c.image);
      }
    }
    if (source.front_image) targetSet.add(source.front_image);
    if (source.back_image) targetSet.add(source.back_image);
    if (source.image) targetSet.add(source.image);
  };

  extractImages(oldProduct, oldImages);
  extractImages(newPayload, newImages);

  for (const oldImg of oldImages) {
    if (!newImages.has(oldImg)) {
      console.log(`[Storage] Cleaning replaced product image: ${oldImg}`);
      await safeDeletePhysicalFile(oldImg, {
        checkOrders: true,
        checkOtherEntities: true,
        exclude: { productId: oldProduct.id }
      });
    }
  }
}

/**
 * Scans server/uploads and purges any orphaned upload files that are not referenced in the database.
 * Preserves files created within the last 10 minutes to allow in-flight uploads to complete.
 */
export async function purgeOrphanUploads() {
  await ensureUploadDir();
  const allDiskFiles = await getAllUploadFilesRecursively(UPLOAD_DIR);
  if (allDiskFiles.length === 0) return { deleted: [], totalDiskFiles: 0 };

  const activeRefs = new Set();

  if (pool) {
    try {
      // 1. Designs
      const dRows = await pool.query('SELECT image, back_image, preview_front, preview_back FROM designs');
      for (const d of dRows.rows) {
        if (d.image) activeRefs.add(path.basename(d.image));
        if (d.back_image) activeRefs.add(path.basename(d.back_image));
        if (d.preview_front) activeRefs.add(path.basename(d.preview_front));
        if (d.preview_back) activeRefs.add(path.basename(d.preview_back));
      }

      // 2. Design versions
      const vRows = await pool.query('SELECT payload FROM design_versions');
      for (const v of vRows.rows) {
        const text = typeof v.payload === 'string' ? v.payload : JSON.stringify(v.payload || {});
        for (const f of allDiskFiles) {
          const b = path.basename(f);
          if (text.includes(b)) activeRefs.add(b);
        }
      }

      // 3. Products
      const pRows = await pool.query('SELECT designs, colors, size_chart FROM products_full WHERE COALESCE(is_deleted, false) = false');
      for (const p of pRows.rows) {
        const text = JSON.stringify(p);
        for (const f of allDiskFiles) {
          const b = path.basename(f);
          if (text.includes(b)) activeRefs.add(b);
        }
      }

      // 4. Listings
      const lRows = await pool.query('SELECT description, design_key FROM listings');
      for (const l of lRows.rows) {
        const text = JSON.stringify(l);
        for (const f of allDiskFiles) {
          const b = path.basename(f);
          if (text.includes(b)) activeRefs.add(b);
        }
      }

      // 5. Order items
      const oRows = await pool.query('SELECT preview_url, print_file_url, back_preview_url, back_print_file_url FROM order_items');
      for (const o of oRows.rows) {
        if (o.preview_url) activeRefs.add(path.basename(o.preview_url));
        if (o.print_file_url) activeRefs.add(path.basename(o.print_file_url));
        if (o.back_preview_url) activeRefs.add(path.basename(o.back_preview_url));
        if (o.back_print_file_url) activeRefs.add(path.basename(o.back_print_file_url));
      }

      // 6. B2B order items
      const bRows = await pool.query('SELECT custom_mockup_url, print_file_url, back_preview_url, back_print_file_url FROM b2b_designer_order_items');
      for (const b of bRows.rows) {
        if (b.custom_mockup_url) activeRefs.add(path.basename(b.custom_mockup_url));
        if (b.print_file_url) activeRefs.add(path.basename(b.print_file_url));
        if (b.back_preview_url) activeRefs.add(path.basename(b.back_preview_url));
        if (b.back_print_file_url) activeRefs.add(path.basename(b.back_print_file_url));
      }

      // 7. Assets table
      const aRows = await pool.query('SELECT filename, storage_key FROM assets');
      for (const a of aRows.rows) {
        if (a.filename) activeRefs.add(path.basename(a.filename));
        if (a.storage_key) activeRefs.add(path.basename(a.storage_key));
      }
    } catch (e) {
      console.warn('[Storage] purgeOrphanUploads query warning:', e.message);
    }
  }

  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const deletedFiles = [];

  for (const diskPath of allDiskFiles) {
    const basename = path.basename(diskPath);
    if (activeRefs.has(basename)) {
      continue;
    }

    try {
      const stats = await fs.stat(diskPath);
      // Skip files created or modified within the last 10 minutes
      if (now - stats.mtimeMs < TEN_MINUTES_MS) {
        continue;
      }

      await fs.unlink(diskPath);
      deletedFiles.push(diskPath);
      console.log(`[Storage Purge] Deleted orphan upload: ${diskPath}`);
    } catch (err) {
      console.warn(`[Storage Purge] Could not delete ${diskPath}:`, err.message);
    }
  }

  return { deleted: deletedFiles, totalDiskFiles: allDiskFiles.length };
}

export async function storeDataUrl(dataUrl, filenameHint, uploaderId, metadata = {}) {
  await ensureUploadDir();
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error('Invalid dataUrl');
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, 'base64');
  const ext = mimeToExt(mime);

  // Subfolder categorization:
  // 1. Farmo garment images (print provider blanks) -> farmo/front or farmo/back
  // 2. Automated canvas previews/mockups (automated design previews) -> designs/front or designs/back
  // 3. ALL designer uploaded artworks, logos, layer graphics -> artwork/front or artwork/back (default)
  let type = 'artwork';
  if (metadata?.type === 'farmo') {
    type = 'farmo';
  } else if (metadata?.type === 'designs' && metadata?.automated) {
    type = 'designs';
  }
  const side = metadata?.side === 'back' ? 'back' : 'front';
  const subFolder = metadata?.subFolder || `${type}/${side}`;

  const targetDir = path.resolve(UPLOAD_DIR, subFolder);
  await fs.mkdir(targetDir, { recursive: true });

  const id = crypto.randomBytes(10).toString('hex');
  const sanitizedHint = filenameHint ? filenameHint.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_') : '';
  const fileBasename = sanitizedHint ? `${id}-${sanitizedHint}` : `${id}.${ext}`;
  const filename = `${subFolder}/${fileBasename}`;
  const storageKey = `uploads/${filename}`;
  const outPath = path.resolve(targetDir, fileBasename);
  await fs.writeFile(outPath, buf);

  let assetRow = null;
  try {
    const finalMetadata = { ...(metadata || {}), type, side, subFolder, uploaded: true };
    assetRow = await assetModel.createAsset({
      filename,
      mime,
      size: buf.length,
      storage_key: storageKey,
      metadata: finalMetadata,
      uploader_id: uploaderId,
      owner_id: uploaderId
    });
  } catch (e) {
    console.error('storage.service: error creating asset row:', e.message);
  }

  const publicUrl = `/uploads/${filename}`;

  return {
    storageKey,
    filename,
    mime,
    size: buf.length,
    id: assetRow ? assetRow.id : null,
    url: publicUrl
  };
}

export async function storePreviewFiles(front, back, designId, uploaderId) {
  const result = {};

  if (front && front.startsWith('data:')) {
    try {
      const stored = await storeDataUrl(front, `design-${designId}-front.png`, uploaderId, { designId, side: 'front', type: 'designs', automated: true });
      result.front = stored.id ? `/api/assets/${stored.id}` : (stored.filename ? `/uploads/${stored.filename}` : undefined);
    } catch (e) {
      console.error(`storage.service: failed to store front preview for design ${designId}`, e);
    }
  }

  if (back && back.startsWith('data:')) {
    try {
      const stored = await storeDataUrl(back, `design-${designId}-back.png`, uploaderId, { designId, side: 'back', type: 'designs', automated: true });
      result.back = stored.id ? `/api/assets/${stored.id}` : (stored.filename ? `/uploads/${stored.filename}` : undefined);
    } catch (e) {
      console.error(`storage.service: failed to store back preview for design ${designId}`, e);
    }
  }

  return result;
}

/**
 * Automatically converts any Base64 data URLs inside a design version payload
 * (including preview_by_color, preview_front, preview_back, and layer assets)
 * into physical .png files on disk in server/uploads/designs/.
 * Replaces the Base64 strings with lightweight public URLs (/uploads/...) to prevent database bloat.
 */
export async function convertPayloadBase64Images(rawPayload, designId, uploaderId) {
  if (!rawPayload) return rawPayload;

  let payload = rawPayload;
  let wasString = false;
  if (typeof payload === 'string') {
    wasString = true;
    try {
      payload = JSON.parse(payload);
    } catch {
      return rawPayload;
    }
  }

  if (typeof payload !== 'object' || payload === null) {
    return rawPayload;
  }

  const dId = Number(designId) || 'unknown';

  // 1. Process metadata previews
  if (payload.metadata && typeof payload.metadata === 'object') {
    const meta = payload.metadata;

    if (typeof meta.preview_front === 'string' && meta.preview_front.startsWith('data:image/')) {
      try {
        const stored = await storeDataUrl(meta.preview_front, `design-${dId}-front.png`, uploaderId, { designId: dId, side: 'front', type: 'designs', automated: true });
        meta.preview_front = stored.url;
      } catch (e) {
        console.warn(`[Storage] Failed to convert meta.preview_front base64 for design ${dId}:`, e.message);
      }
    }

    if (typeof meta.preview_back === 'string' && meta.preview_back.startsWith('data:image/')) {
      try {
        const stored = await storeDataUrl(meta.preview_back, `design-${dId}-back.png`, uploaderId, { designId: dId, side: 'back', type: 'designs', automated: true });
        meta.preview_back = stored.url;
      } catch (e) {
        console.warn(`[Storage] Failed to convert meta.preview_back base64 for design ${dId}:`, e.message);
      }
    }

    // Process preview_by_color array
    if (Array.isArray(meta.preview_by_color)) {
      for (const colorItem of meta.preview_by_color) {
        if (!colorItem || typeof colorItem !== 'object') continue;
        const colorKey = String(colorItem.id || colorItem.name || colorItem.hex || 'color').replace(/[^a-zA-Z0-9_\-]/g, '_');

        if (typeof colorItem.preview_front === 'string' && colorItem.preview_front.startsWith('data:image/')) {
          try {
            const stored = await storeDataUrl(
              colorItem.preview_front,
              `design-${dId}-color-${colorKey}-front.png`,
              uploaderId,
              { designId: dId, side: 'front', type: 'designs', color: colorKey, automated: true }
            );
            colorItem.preview_front = stored.url;
          } catch (e) {
            console.warn(`[Storage] Failed to convert color front preview base64 for design ${dId}:`, e.message);
          }
        }

        if (typeof colorItem.preview_back === 'string' && colorItem.preview_back.startsWith('data:image/')) {
          try {
            const stored = await storeDataUrl(
              colorItem.preview_back,
              `design-${dId}-color-${colorKey}-back.png`,
              uploaderId,
              { designId: dId, side: 'back', type: 'designs', color: colorKey, automated: true }
            );
            colorItem.preview_back = stored.url;
          } catch (e) {
            console.warn(`[Storage] Failed to convert color back preview base64 for design ${dId}:`, e.message);
          }
        }
      }
    }
  }

  // 2. Process layers in sides
  if (Array.isArray(payload.sides)) {
    for (const side of payload.sides) {
      if (!side || typeof side !== 'object') continue;
      const sideName = side.side || 'front';

      if (Array.isArray(side.layers)) {
        for (const layer of side.layers) {
          if (!layer || typeof layer !== 'object') continue;
          if (layer.type === 'image') {
            const layerKey = String(layer.id || 'layer').replace(/[^a-zA-Z0-9_\-]/g, '_');

            if (typeof layer.url === 'string' && layer.url.startsWith('data:image/')) {
              try {
                const stored = await storeDataUrl(
                  layer.url,
                  `design-${dId}-layer-${layerKey}.png`,
                  uploaderId,
                  { designId: dId, side: sideName, type: 'artwork' }
                );
                layer.url = stored.url;
                if (layer.asset) layer.asset.url = stored.url;
              } catch (e) {
                console.warn(`[Storage] Failed to convert layer.url base64 for design ${dId}:`, e.message);
              }
            }

            if (layer.asset && typeof layer.asset.url === 'string' && layer.asset.url.startsWith('data:image/')) {
              try {
                const stored = await storeDataUrl(
                  layer.asset.url,
                  `design-${dId}-layer-${layerKey}.png`,
                  uploaderId,
                  { designId: dId, side: sideName, type: 'artwork' }
                );
                layer.asset.url = stored.url;
                if (!layer.url || layer.url.startsWith('data:image/')) layer.url = stored.url;
              } catch (e) {
                console.warn(`[Storage] Failed to convert layer.asset.url base64 for design ${dId}:`, e.message);
              }
            }

            if (layer.asset && layer.asset.dataUrl) {
              delete layer.asset.dataUrl;
            }
          }
        }
      }
    }
  }

  return wasString ? JSON.stringify(payload) : payload;
}

export default {
  ensureUploadDir,
  getAllUploadFilesRecursively,
  findFilePathsOnDisk,
  isFileReferencedInOrders,
  isFileReferencedInOtherActiveEntities,
  safeDeletePhysicalFile,
  deletePhysicalFile,
  deleteDesignPhysicalFiles,
  deleteProductPhysicalFiles,
  deleteListingPhysicalFiles,
  cleanReplacedProductImages,
  purgeOrphanUploads,
  storeDataUrl,
  storePreviewFiles,
  convertPayloadBase64Images
};
