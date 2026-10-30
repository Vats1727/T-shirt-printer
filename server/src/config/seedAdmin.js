import bcrypt from 'bcryptjs';
import { pool } from './database.js';

/**
 * Seeds or guarantees the Portal Admin credentials and default platform settings.
 * Email: portaladmin@gmail.com
 * Password: 123456
 * Role: portal_admin
 */
export async function seedPortalAdmin() {
  if (!pool) {
    console.warn('[Seed] PostgreSQL database pool not configured. Skipping Portal Admin seed.');
    return;
  }

  const client = await pool.connect();
  try {
    const adminEmail = 'portaladmin@gmail.com';
    const adminPassword = '123456';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 1. Check if portaladmin user exists
    const checkRes = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [adminEmail]);
    let adminUser;

    if (checkRes.rows && checkRes.rows.length > 0) {
      const updateRes = await client.query(
        `UPDATE users SET
          name = 'Portal Super Admin',
          password_hash = $1,
          role = 'portal_admin',
          status = 'active',
          subscription_tier = 'enterprise',
          updated_at = NOW()
        WHERE LOWER(email) = LOWER($2)
        RETURNING id, name, email, role, status;`,
        [hashedPassword, adminEmail]
      );
      adminUser = updateRes.rows[0];
    } else {
      const insertRes = await client.query(
        `INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          status,
          subscription_tier,
          created_at,
          updated_at
        )
        VALUES ('Portal Super Admin', $1, $2, 'portal_admin', 'active', 'enterprise', NOW(), NOW())
        RETURNING id, name, email, role, status;`,
        [adminEmail, hashedPassword]
      );
      adminUser = insertRes.rows[0];
    }

    console.log(`[Seed] ✓ Portal Admin guaranteed: ID=${adminUser.id}, Email=${adminUser.email}, Role=${adminUser.role}, Status=${adminUser.status}`);

    // 2. Ensure default Platform B2C Financial Settings exist
    await client.query(`
      INSERT INTO platform_financial_settings (
        id, standard_shipping_charge, free_shipping_threshold, shipping_enabled,
        platform_fee_percent, platform_fixed_fee, designer_margin_percent,
        min_designer_margin_percent, provider_margin_percent, min_provider_margin_percent,
        tax_percent, notes, updated_at
      ) VALUES (
        1, 50.00, 500.00, true,
        5.00, 0.00, 35.00,
        10.00, 60.00, 50.00,
        0.00, 'Global financial rules configured by Portal Superadmin', NOW()
      ) ON CONFLICT (id) DO NOTHING;
    `);

    // 3. Ensure default Platform B2B Wholesale Settings exist
    await client.query(`
      INSERT INTO platform_b2b_financial_settings (
        id, platform_fee_percent, provider_margin_percent,
        standard_shipping_charge, free_shipping_threshold, shipping_enabled,
        tax_percent, gst_enabled,
        bulk_tier1_min_qty, bulk_tier1_discount_pct,
        bulk_tier2_min_qty, bulk_tier2_discount_pct,
        bulk_tier3_min_qty, bulk_tier3_discount_pct,
        notes, updated_at
      ) VALUES (
        1, 8.00, 92.00,
        150.00, 2500.00, true,
        5.00, true,
        10, 5.00,
        50, 10.00,
        100, 15.00,
        'Global B2B wholesale rules configured by Portal Superadmin', NOW()
      ) ON CONFLICT (id) DO NOTHING;
    `);

    console.log('[Seed] ✓ Global B2C and B2B Financial Settings guaranteed.');
    return adminUser;
  } catch (err) {
    console.error('[Seed] Error seeding Portal Admin:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Support running directly via `node seedAdmin.js`
if (process.argv[1] && process.argv[1].endsWith('seedAdmin.js')) {
  seedPortalAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
