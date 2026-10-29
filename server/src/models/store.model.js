import { pool } from '../config/database.js';
import userModel from './user.model.js';

export async function getAllStores() {
  if (pool) {
    try {
      // 1. Fetch active store-owning users (designers and print providers)
      const usersRes = await pool.query(`
        SELECT id, name, email, role, status, store_settings, created_at
        FROM users
        WHERE (status = 'active' OR status IS NULL)
          AND role IN ('designer', 'supplier', 'print_provider', 'admin')
        ORDER BY id ASC
      `);

      const users = usersRes.rows;

      // 2. Fetch counts of published listings per supplier
      const countsRes = await pool.query(`
        SELECT supplier_id, COUNT(*) as count
        FROM listings
        WHERE COALESCE(published, true) = true
        GROUP BY supplier_id
      `);
      const countsMap = Object.fromEntries(
        countsRes.rows.map((r) => [Number(r.supplier_id), Number(r.count)])
      );

      // 3. Fetch up to 4 recent listing sample previews per supplier
      const previewsRes = await pool.query(`
        SELECT l.supplier_id, l.id as listing_id, l.title, l.design_key,
               d.image as design_front, d.back_image as design_back,
               dv.payload as version_payload
        FROM listings l
        LEFT JOIN designs d ON (
          d.id = CASE
            WHEN l.design_key ~ '^design-[0-9]+$' THEN CAST(SUBSTRING(l.design_key FROM 8) AS INTEGER)
            WHEN l.design_key ~ '^[0-9]+$' THEN CAST(l.design_key AS INTEGER)
            ELSE NULL
          END
        )
        LEFT JOIN LATERAL (
          SELECT payload FROM design_versions WHERE design_id = d.id ORDER BY id DESC LIMIT 1
        ) dv ON true
        WHERE COALESCE(l.published, true) = true
        ORDER BY l.id DESC
      `);

      // Group samples by supplier
      const samplesMap = {};
      const normalize = (img) => {
        if (!img) return null;
        const s = String(img);
        if (s.startsWith('http') || s.startsWith('/') || s.startsWith('data:')) return s;
        return `/uploads/${s}`;
      };

      for (const row of previewsRes.rows) {
        const sId = Number(row.supplier_id);
        if (!samplesMap[sId]) samplesMap[sId] = [];
        if (samplesMap[sId].length >= 4) continue;

        let previewUrl = null;
        if (row.version_payload) {
          try {
            const p = typeof row.version_payload === 'string' ? JSON.parse(row.version_payload) : row.version_payload;
            const meta = p?.metadata || {};
            previewUrl = normalize(meta.preview_front || meta.preview_back);
          } catch {}
        }
        if (!previewUrl) {
          previewUrl = normalize(row.design_front || row.design_back);
        }

        if (previewUrl) {
          samplesMap[sId].push({
            listing_id: row.listing_id,
            title: row.title,
            preview_url: previewUrl
          });
        }
      }

      return users.map((u) => {
        let settings = u.store_settings;
        if (typeof settings === 'string') {
          try { settings = JSON.parse(settings); } catch {}
        }
        settings = settings || {};

        const isProvider = u.role === 'print_provider' || u.role === 'admin';
        const isPublic = settings.is_public !== false;
        const showInCustomerPortal = settings.show_in_customer_portal !== false;
        const defaultName = isProvider ? `${u.name || 'Print'} Facility Store` : `${u.name || 'Designer'} Collection`;
        const defaultTagline = isProvider
          ? 'Direct fulfillment printing hub with premium apparel blanks.'
          : 'Curated custom apparel creations printed on premium blanks.';

        return {
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          role: u.role,
          is_provider: isProvider,
          is_public: isPublic,
          show_in_customer_portal: showInCustomerPortal,
          store_name: settings.store_name || defaultName,
          logo_url: settings.logo_url || null,
          tagline: settings.tagline || defaultTagline,
          theme: settings.theme || 'midnight',
          announcement: settings.announcement || '',
          show_announcement: settings.show_announcement ?? false,
          social: {
            instagram: settings.social_instagram || '',
            twitter: settings.social_twitter || '',
            website: settings.social_website || ''
          },
          products_count: countsMap[u.id] || 0,
          sample_previews: samplesMap[u.id] || [],
          created_at: u.created_at
        };
      });
    } catch (err) {
      console.error('getAllStores DB query failed, falling back:', err);
    }
  }

  // Fallback to JSON
  const allUsers = await userModel.getAllUsers();
  return allUsers
    .filter((u) => ['designer', 'supplier', 'print_provider', 'admin'].includes(u.role))
    .map((u) => {
      const isProvider = u.role === 'print_provider' || u.role === 'admin';
      const settings = u.store_settings || {};
      const isPublic = settings.is_public !== false;
      const showInCustomerPortal = settings.show_in_customer_portal !== false;
      return {
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
        is_provider: isProvider,
        is_public: isPublic,
        show_in_customer_portal: showInCustomerPortal,
        store_name: settings.store_name || `${u.name || 'Store'}`,
        logo_url: settings.logo_url || null,
        tagline: settings.tagline || (isProvider ? 'Direct fulfillment print hub.' : 'Curated custom apparel.'),
        theme: settings.theme || 'midnight',
        products_count: 0,
        sample_previews: []
      };
    });
}

export async function getStoreById(storeId) {
  const stores = await getAllStores();
  return stores.find((s) => Number(s.id) === Number(storeId)) || null;
}

export default {
  getAllStores,
  getStoreById
};

