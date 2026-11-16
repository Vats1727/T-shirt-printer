import { pool } from '../config/database.js';

/**
 * apparelGuard.js
 * 
 * Strict Industry-Standard Apparel Marketplace Governance Middleware.
 * Enforces that only sanctioned apparel & clothing garments (t-shirts, hoodies, sweatshirts,
 * polos, tank tops) can be created, updated, or linked into the marketplace catalog.
 */

// Cache of sanctioned categories and master garments
let cachedSanctionedGarments = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function getSanctionedApparelData() {
  const now = Date.now();
  if (cachedSanctionedGarments && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedSanctionedGarments;
  }

  if (!pool) return { categories: [], garments: [] };

  const [catRes, garmentRes] = await Promise.all([
    pool.query('SELECT id, name, slug, hsn_code, gst_rate FROM apparel_categories WHERE is_active = TRUE'),
    pool.query('SELECT id, category_id, name, slug, knit_type, gsm, hsn_code, gst_rate FROM apparel_master_garments WHERE is_active = TRUE')
  ]);

  cachedSanctionedGarments = {
    categories: catRes.rows,
    garments: garmentRes.rows
  };
  cacheTimestamp = now;
  return cachedSanctionedGarments;
}

/**
 * Express middleware to validate apparel conformity on product creation/updates.
 */
export async function validateApparelOnly(req, res, next) {
  try {
    const { garment_id, category, name } = req.body;

    const { categories, garments } = await getSanctionedApparelData();

    // 1. If explicit garment_id is provided, verify it exists and is active
    if (garment_id !== undefined && garment_id !== null) {
      const numericGarmentId = Number(garment_id);
      if (isNaN(numericGarmentId) || numericGarmentId <= 0) {
        return res.status(422).json({
          error: 'InvalidMasterGarment',
          message: `The specified garment_id (${garment_id}) is invalid.`
        });
      }
      const gCheck = await pool.query(
        'SELECT id, name, slug, is_active FROM apparel_master_garments WHERE id = $1',
        [numericGarmentId]
      );
      if (gCheck.rows.length === 0) {
        return res.status(422).json({
          error: 'InvalidMasterGarment',
          message: `The specified garment_id (${garment_id}) does not exist in master catalog.`
        });
      }
      if (!gCheck.rows[0].is_active) {
        return res.status(422).json({
          error: 'InactiveMasterGarment',
          message: `The master garment "${gCheck.rows[0].name}" is inactive and cannot be used.`
        });
      }
      req.body.garment_id = numericGarmentId;
      req.sanctionedGarment = gCheck.rows[0];
      return next();
    }

    // 2. Prohibited non-apparel keywords / category checks
    const prohibitedKeywords = [
      'mug', 'cup', 'phone', 'case', 'sticker', 'electronics', 'hardware',
      'furniture', 'poster', 'stationery', 'toy', 'bottle', 'shoes', 'book'
    ];

    const targetCategory = String(category || '').trim().toLowerCase();
    const targetName = String(name || '').trim().toLowerCase();

    for (const kw of prohibitedKeywords) {
      if (targetCategory.includes(kw) || targetName.includes(kw)) {
        return res.status(422).json({
          error: 'NonApparelProhibited',
          message: `Non-apparel items ("${kw}") are strictly prohibited. This platform exclusively supports apparel and garments.`
        });
      }
    }

    // 3. Attempt to match an existing master garment by slug or name keyword
    let matched = null;
    if (targetCategory) {
      // Check category match
      const matchedCat = categories.find(
        (c) => c.slug.toLowerCase() === targetCategory || c.name.toLowerCase() === targetCategory
      );
      if (matchedCat) {
        matched = garments.find((g) => Number(g.category_id) === Number(matchedCat.id));
      }
    }

    if (!matched && targetName) {
      if (targetName.includes('v-neck') || targetName.includes('vneck')) {
        matched = garments.find((g) => g.slug.includes('v-neck'));
      } else if (targetName.includes('hoodie')) {
        matched = garments.find((g) => g.slug.includes('hoodie'));
      } else if (targetName.includes('sweatshirt') || targetName.includes('crewneck')) {
        matched = garments.find((g) => g.slug.includes('sweatshirt')) || garments.find((g) => g.slug.includes('crewneck'));
      } else if (targetName.includes('polo')) {
        matched = garments.find((g) => g.slug.includes('polo'));
      } else if (targetName.includes('tank')) {
        matched = garments.find((g) => g.slug.includes('tank'));
      } else if (targetName.includes('shirt') || targetName.includes('tee')) {
        matched = garments.find((g) => g.slug.includes('tshirt') || g.slug.includes('crewneck-tshirt'));
      }
    }

    // Default to Classic Crewneck T-Shirt (ID 1) if garment represents basic apparel
    if (!matched) {
      matched = garments[0] || null;
    }

    if (matched) {
      req.body.garment_id = Number(matched.id);
      req.sanctionedGarment = matched;
    }

    // New products default to is_approved = false unless explicitly approved by admin
    if (req.method === 'POST') {
      const userRole = req.user?.role;
      if (userRole !== 'admin' && userRole !== 'portal_admin') {
        req.body.is_approved = false;
      }
    }

    next();
  } catch (err) {
    console.error('[ApparelGuard] Error verifying apparel restriction:', err);
    return res.status(500).json({ message: 'Internal error validating apparel category specifications' });
  }
}

export default { validateApparelOnly, getSanctionedApparelData };

