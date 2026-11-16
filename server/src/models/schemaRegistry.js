/**
 * schemaRegistry.js
 * 
 * Single Source of Truth for the entire PostgreSQL database schema.
 * Replaces 30 fragmented historical migration files with a unified,
 * model-driven declarative table registry.
 */

export const CORE_FUNCTIONS = [
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`
];

export const TABLES = [
  // 1. Users
  {
    name: 'users',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'supplier', 'portal_admin', 'print_provider', 'designer', 'customer')),
      status TEXT NOT NULL DEFAULT 'active',
      subscription_tier TEXT NOT NULL DEFAULT 'none',
      subscription_expiry TIMESTAMPTZ,
      associated_provider_id INTEGER,
      store_settings JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users(LOWER(email));`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
      `CREATE INDEX IF NOT EXISTS idx_users_associated_provider ON users(associated_provider_id);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
       CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 2. Colors
  {
    name: 'colors',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      hex TEXT NOT NULL,
      owner_id INTEGER
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_colors_owner_id ON colors(owner_id);`
    ]
  },

  // 3. Sizes
  {
    name: 'sizes',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      owner_id INTEGER
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS unique_sizes_label ON sizes (LOWER(label)) WHERE owner_id IS NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_sizes_owner_id ON sizes(owner_id);`
    ]
  },

  // 4. Size Chart
  {
    name: 'size_chart',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      size_id BIGINT NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
      product TEXT NOT NULL DEFAULT 'tshirt',
      chest REAL NOT NULL,
      length REAL NOT NULL,
      shoulder REAL NOT NULL,
      owner_id INTEGER
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS unique_size_chart_product_size_owner ON size_chart(product, size_id, owner_id);`
    ]
  },

  // 4a. Apparel Categories (Strict apparel-only marketplace taxonomy)
  {
    name: 'apparel_categories',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      hsn_code TEXT NOT NULL DEFAULT '6109',
      gst_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_apparel_categories_slug ON apparel_categories(slug);`
    ]
  },

  // 4b. Apparel Master Garments (Standardized apparel specifications)
  {
    name: 'apparel_master_garments',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      category_id BIGINT NOT NULL REFERENCES apparel_categories(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      fabric_composition TEXT NOT NULL,
      knit_type TEXT NOT NULL,
      gsm INTEGER NOT NULL,
      hsn_code TEXT NOT NULL DEFAULT '6109',
      gst_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      print_platen_specs JSONB NOT NULL DEFAULT '{"front": {"width_in": 12, "height_in": 16}, "back": {"width_in": 12, "height_in": 16}}'::jsonb,
      size_chart JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_master_garments_slug ON apparel_master_garments(slug);`,
      `CREATE INDEX IF NOT EXISTS idx_master_garments_cat ON apparel_master_garments(category_id);`
    ]
  },

  // 5. Cloth Inventory
  {
    name: 'cloth_inventory',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      color_id BIGINT NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
      size_id BIGINT NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      product TEXT NOT NULL DEFAULT 'tshirt',
      owner_id INTEGER
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS cloth_inventory_unique_product_color_size_owner ON cloth_inventory(product, color_id, size_id, owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_cloth_inventory_owner_product ON cloth_inventory(owner_id, product);`
    ]
  },

  // 6. Products (Simple)
  {
    name: 'products',
    columns: `
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      single_price NUMERIC NOT NULL DEFAULT 0,
      bulk_min INTEGER NOT NULL DEFAULT 100,
      bulk_price NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);`
    ]
  },

  // 7. Product Sizes
  {
    name: 'product_sizes',
    columns: `
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      size_id INTEGER NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id ON product_sizes(product_id);`
    ]
  },

  // 8. Product Colors
  {
    name: 'product_colors',
    columns: `
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      color_id INTEGER NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors(product_id);`
    ]
  },

  // 9. Products Full (Production Catalog with JSON specs)
  {
    name: 'products_full',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      garment_id BIGINT REFERENCES apparel_master_garments(id) ON DELETE RESTRICT,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      single_price NUMERIC NOT NULL DEFAULT 0,
      bulk_min INTEGER NOT NULL DEFAULT 100,
      bulk_price NUMERIC NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'men',
      sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
      colors JSONB NOT NULL DEFAULT '[]'::jsonb,
      size_chart JSONB NOT NULL DEFAULT '[]'::jsonb,
      designs JSONB NOT NULL DEFAULT '[]'::jsonb,
      inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      owner_id INTEGER,
      status TEXT DEFAULT 'published'
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_products_full_slug ON products_full(slug);`,
      `CREATE INDEX IF NOT EXISTS idx_products_full_owner_id ON products_full(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_products_full_status ON products_full(status);`,
      `CREATE INDEX IF NOT EXISTS idx_products_full_category ON products_full(category);`,
      `CREATE INDEX IF NOT EXISTS idx_products_full_garment_id ON products_full(garment_id);`
    ]
  },

  // 10. Designs
  {
    name: 'designs',
    columns: `
      id SERIAL PRIMARY KEY,
      slogan TEXT,
      color TEXT NOT NULL,
      text_size INTEGER NOT NULL DEFAULT 24,
      text_rotation INTEGER NOT NULL DEFAULT 0,
      text_position JSONB NOT NULL DEFAULT '{"x": 150, "y": 135}'::jsonb,
      image TEXT,
      image_scale INTEGER NOT NULL DEFAULT 100,
      image_rotation INTEGER NOT NULL DEFAULT 0,
      image_position JSONB NOT NULL DEFAULT '{"x": 150, "y": 150}'::jsonb,
      product TEXT NOT NULL DEFAULT 'T-shirt',
      template_color TEXT NOT NULL DEFAULT '#ffffff',
      template TEXT NOT NULL DEFAULT 'tshirt',
      back_slogan TEXT,
      back_image TEXT,
      back_image_scale INTEGER NOT NULL DEFAULT 100,
      back_image_rotation INTEGER NOT NULL DEFAULT 0,
      back_image_position JSONB NOT NULL DEFAULT '{"x": 150, "y": 150}'::jsonb,
      back_text_size INTEGER NOT NULL DEFAULT 24,
      back_text_rotation INTEGER NOT NULL DEFAULT 0,
      back_text_position JSONB NOT NULL DEFAULT '{"x": 150, "y": 135}'::jsonb,
      image_mask TEXT,
      back_image_mask TEXT,
      preview_front TEXT,
      preview_back TEXT,
      product_id INTEGER,
      owner_id INTEGER,
      provider_id INTEGER,
      group_id TEXT,
      design_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_designs_product_id ON designs(product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_designs_owner_id ON designs(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_designs_provider_id ON designs(provider_id);`
    ]
  },

  // 11. Assets
  {
    name: 'assets',
    columns: `
      id SERIAL PRIMARY KEY,
      filename TEXT,
      mime TEXT,
      size INTEGER,
      storage_key TEXT,
      metadata JSONB,
      uploader_id INTEGER,
      owner_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_assets_uploader_id ON assets(uploader_id);`
    ]
  },

  // 12. Design Versions
  {
    name: 'design_versions',
    columns: `
      id SERIAL PRIMARY KEY,
      design_id INTEGER REFERENCES designs(id) ON DELETE CASCADE,
      version_name TEXT,
      payload JSONB NOT NULL,
      price_cents INTEGER,
      currency TEXT DEFAULT 'USD',
      processing_state TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_design_versions_design_id ON design_versions(design_id);`
    ]
  },

  // 13. Listings
  {
    name: 'listings',
    columns: `
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      design_key TEXT,
      visibility TEXT DEFAULT 'public',
      published BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMP WITHOUT TIME ZONE,
      price NUMERIC(10,2) DEFAULT 29.99,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_listings_supplier ON listings(supplier_id);`,
      `CREATE INDEX IF NOT EXISTS idx_listings_slug ON listings(slug);`,
      `CREATE INDEX IF NOT EXISTS idx_listings_published ON listings(published);`
    ]
  },

  // 14. Listing Versions
  {
    name: 'listing_versions',
    columns: `
      id SERIAL PRIMARY KEY,
      listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
      version_name TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_listing_versions_listing ON listing_versions(listing_id);`
    ]
  },

  // 15. Supplier Orders
  {
    name: 'supplier_orders',
    columns: `
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      placed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT,
      customer_email TEXT,
      shipping_address JSONB,
      shipping_method TEXT,
      shipping_cost_cents INTEGER NOT NULL DEFAULT 0,
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL CHECK (status IN ('pending','confirmed','paid','processing','shipped','completed','cancelled')) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier_id ON supplier_orders(supplier_id);`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_supplier_orders_updated_at ON supplier_orders;
       CREATE TRIGGER trg_supplier_orders_updated_at BEFORE UPDATE ON supplier_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 16. Supplier Order Lines
  {
    name: 'supplier_order_lines',
    columns: `
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      design_id INTEGER REFERENCES designs(id) ON DELETE SET NULL,
      design_snapshot JSONB,
      product_sku TEXT,
      size TEXT,
      color TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      line_total_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_supplier_order_lines_order_id ON supplier_order_lines(order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_order_lines_design_id ON supplier_order_lines(design_id);`,
      `CREATE INDEX IF NOT EXISTS idx_supplier_order_lines_product_id ON supplier_order_lines(product_id);`
    ]
  },

  // 17. Orders (B2C Customer Storefront Orders)
  {
    name: 'orders',
    columns: `
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(64) UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES users(id),
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(64),
      designer_id INTEGER REFERENCES users(id),
      provider_id INTEGER REFERENCES users(id),
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      razorpay_order_id VARCHAR(128),
      razorpay_payment_id VARCHAR(128),
      razorpay_signature VARCHAR(255),
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      shipping_cost_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL DEFAULT 0,
      designer_earnings_cents INTEGER NOT NULL DEFAULT 0,
      provider_earnings_cents INTEGER NOT NULL DEFAULT 0,
      platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
      tracking_info JSONB DEFAULT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_designer_id ON orders(designer_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON orders(provider_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
       CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 18. Order Items (B2C with Industrial Techpack print columns)
  {
    name: 'order_items',
    columns: `
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      listing_id INTEGER REFERENCES listings(id),
      design_id INTEGER,
      product_id INTEGER,
      product_title VARCHAR(255) NOT NULL,
      product TEXT,
      price NUMERIC(10,2) DEFAULT 0,
      color_id VARCHAR(32),
      color_name VARCHAR(64),
      color_hex VARCHAR(32),
      size_label VARCHAR(32),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      total_price_cents INTEGER NOT NULL DEFAULT 0,
      preview_url TEXT,
      print_file_url TEXT,
      print_dimensions JSONB,
      print_method VARCHAR(50) DEFAULT 'DTF',
      back_print_file_url TEXT,
      back_preview_url TEXT,
      back_print_dimensions JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`
    ]
  },

  // 19. Payments
  {
    name: 'payments',
    columns: `
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      transaction_id VARCHAR(128) UNIQUE NOT NULL,
      gateway VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      payment_method VARCHAR(32) NOT NULL DEFAULT 'online',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      status VARCHAR(32) NOT NULL DEFAULT 'captured',
      raw_payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);`
    ]
  },

  // 20. B2B Designer Wholesale Orders
  {
    name: 'b2b_designer_orders',
    columns: `
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(64) UNIQUE NOT NULL,
      designer_id INTEGER NOT NULL REFERENCES users(id),
      provider_id INTEGER NOT NULL REFERENCES users(id),
      order_type VARCHAR(32) NOT NULL DEFAULT 'bulk',
      total_quantity INTEGER NOT NULL DEFAULT 1,
      base_subtotal_cents BIGINT NOT NULL,
      discount_cents BIGINT DEFAULT 0,
      subtotal_cents BIGINT NOT NULL,
      shipping_cost_cents BIGINT DEFAULT 0,
      tax_cents BIGINT DEFAULT 0,
      total_cents BIGINT NOT NULL,
      b2b_platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 8.00,
      platform_commission_cents BIGINT NOT NULL,
      provider_earnings_cents BIGINT NOT NULL,
      payment_status VARCHAR(32) DEFAULT 'pending',
      payment_method VARCHAR(32) DEFAULT 'razorpay',
      razorpay_order_id VARCHAR(128),
      razorpay_payment_id VARCHAR(128),
      razorpay_signature VARCHAR(255),
      status VARCHAR(32) DEFAULT 'pending',
      shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
      tracking_info JSONB DEFAULT '{}'::jsonb,
      designer_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_b2b_designer_orders_designer ON b2b_designer_orders(designer_id);`,
      `CREATE INDEX IF NOT EXISTS idx_b2b_designer_orders_provider ON b2b_designer_orders(provider_id);`,
      `CREATE INDEX IF NOT EXISTS idx_b2b_designer_orders_number ON b2b_designer_orders(order_number);`,
      `CREATE INDEX IF NOT EXISTS idx_b2b_designer_orders_status ON b2b_designer_orders(status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_b2b_designer_orders_updated_at ON b2b_designer_orders;
       CREATE TRIGGER trg_b2b_designer_orders_updated_at BEFORE UPDATE ON b2b_designer_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 21. B2B Designer Order Items (with Techpack print specs)
  {
    name: 'b2b_designer_order_items',
    columns: `
      id SERIAL PRIMARY KEY,
      b2b_order_id INTEGER NOT NULL REFERENCES b2b_designer_orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      product_name VARCHAR(255) NOT NULL,
      product_sku VARCHAR(64),
      color_name VARCHAR(64) DEFAULT 'Standard',
      color_hex VARCHAR(32),
      garment_size VARCHAR(32) NOT NULL,
      custom_design_id INTEGER,
      custom_mockup_url TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents BIGINT NOT NULL,
      line_total_cents BIGINT NOT NULL,
      print_file_url TEXT,
      print_dimensions JSONB,
      print_method VARCHAR(50) DEFAULT 'DTF',
      back_print_file_url TEXT,
      back_preview_url TEXT,
      back_print_dimensions JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_b2b_items_order_id ON b2b_designer_order_items(b2b_order_id);`
    ]
  },

  // 22. Platform B2C Financial Settings
  {
    name: 'platform_financial_settings',
    columns: `
      id INTEGER PRIMARY KEY DEFAULT 1,
      standard_shipping_charge NUMERIC(10,2) NOT NULL DEFAULT 50.00,
      free_shipping_threshold NUMERIC(10,2) NOT NULL DEFAULT 500.00,
      shipping_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      platform_fixed_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      designer_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 35.00,
      min_designer_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
      provider_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 60.00,
      min_provider_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00,
      tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
      gst_enabled BOOLEAN DEFAULT TRUE,
      notes TEXT DEFAULT 'Global financial governance rules set by Portal Superadmin',
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT single_row_check CHECK (id = 1)
    `
  },

  // 23. Platform B2B Financial Settings
  {
    name: 'platform_b2b_financial_settings',
    columns: `
      id INTEGER PRIMARY KEY DEFAULT 1,
      platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 8.00,
      provider_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 92.00,
      single_platform_fee_percent NUMERIC(5,2) DEFAULT 10.00,
      single_provider_margin_percent NUMERIC(5,2) DEFAULT 90.00,
      bulk_platform_fee_percent NUMERIC(5,2) DEFAULT 8.00,
      bulk_provider_margin_percent NUMERIC(5,2) DEFAULT 92.00,
      bulk_min_qty INTEGER DEFAULT 2,
      standard_shipping_charge NUMERIC(10,2) NOT NULL DEFAULT 150.00,
      free_shipping_threshold NUMERIC(10,2) NOT NULL DEFAULT 2500.00,
      shipping_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      tax_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      gst_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      bulk_tier1_min_qty INTEGER NOT NULL DEFAULT 10,
      bulk_tier1_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      bulk_tier2_min_qty INTEGER NOT NULL DEFAULT 50,
      bulk_tier2_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
      bulk_tier3_min_qty INTEGER NOT NULL DEFAULT 100,
      bulk_tier3_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
      notes TEXT DEFAULT 'Global B2B wholesale rules configured by Portal Superadmin',
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT single_b2b_row_check CHECK (id = 1)
    `
  },

  // 15. Password Reset OTPs
  {
    name: 'password_reset_otps',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(LOWER(email));`,
      `CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expiry ON password_reset_otps(expires_at);`
    ]
  },

  // 16. Inventory Reservations (Atomic reservation locks for checkout concurrency)
  {
    name: 'inventory_reservations',
    columns: `
      id BIGSERIAL PRIMARY KEY,
      inventory_id BIGINT NOT NULL REFERENCES cloth_inventory(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      reservation_token UUID NOT NULL UNIQUE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      status TEXT NOT NULL CHECK (status IN ('reserved', 'confirmed', 'released', 'expired')) DEFAULT 'reserved',
      customer_session_id TEXT,
      payment_attempt_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_token ON inventory_reservations(reservation_token);`,
      `CREATE INDEX IF NOT EXISTS idx_inventory_reservations_inventory_id ON inventory_reservations(inventory_id);`,
      `CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status_expires ON inventory_reservations(status, expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_inventory_reservations_payment_attempt ON inventory_reservations(payment_attempt_id) WHERE payment_attempt_id IS NOT NULL;`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_inventory_reservations_updated_at ON inventory_reservations;
       CREATE TRIGGER trg_inventory_reservations_updated_at BEFORE UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  }
];

export const INITIAL_SEEDS = [
  // Default Sizes
  `INSERT INTO sizes (label) VALUES
     ('S'), ('M'), ('L'), ('XL'), ('XXL'), ('XXXL')
   ON CONFLICT (LOWER(label)) WHERE owner_id IS NULL DO NOTHING;`,

  // Default B2C Platform Settings
  `INSERT INTO platform_financial_settings (
     id, standard_shipping_charge, free_shipping_threshold, shipping_enabled,
     platform_fee_percent, platform_fixed_fee, designer_margin_percent,
     min_designer_margin_percent, provider_margin_percent, min_provider_margin_percent,
     tax_percent, gst_enabled, notes
   ) VALUES (
     1, 50.00, 500.00, TRUE,
     5.00, 0.00, 35.00,
     10.00, 60.00, 50.00,
     0.00, TRUE, 'Global financial rules configured by Portal Superadmin'
   ) ON CONFLICT (id) DO NOTHING;`,

  // Default B2B Platform Settings
  `INSERT INTO platform_b2b_financial_settings (
     id, platform_fee_percent, provider_margin_percent,
     single_platform_fee_percent, single_provider_margin_percent,
     bulk_platform_fee_percent, bulk_provider_margin_percent, bulk_min_qty,
     standard_shipping_charge, free_shipping_threshold, shipping_enabled,
     tax_percent, gst_enabled,
     bulk_tier1_min_qty, bulk_tier1_discount_pct,
     bulk_tier2_min_qty, bulk_tier2_discount_pct,
     bulk_tier3_min_qty, bulk_tier3_discount_pct,
     notes
   ) VALUES (
     1, 8.00, 92.00,
     10.00, 90.00,
     8.00, 92.00, 2,
     150.00, 2500.00, TRUE,
     5.00, TRUE,
     10, 5.00,
     50, 10.00,
     100, 15.00,
     'Global B2B wholesale rules configured by Portal Superadmin'
   ) ON CONFLICT (id) DO NOTHING;`,

  // Default Apparel Categories (Strict apparel-only marketplace governance)
  `INSERT INTO apparel_categories (id, name, slug, description, hsn_code, gst_rate, is_active) VALUES
     (1, 'T-Shirts', 't-shirts', 'Short and long sleeve casual knit t-shirts', '6109', 5.00, TRUE),
     (2, 'Hoodies & Sweatshirts', 'hoodies-sweatshirts', 'Fleece pullovers, zip hoodies and crewneck sweatshirts', '6110', 5.00, TRUE),
     (3, 'Polos', 'polos', 'Collared pique and jersey polo shirts', '6105', 5.00, TRUE),
     (4, 'Tank Tops', 'tank-tops', 'Sleeveless athletic and lifestyle tops', '6109', 5.00, TRUE)
   ON CONFLICT (id) DO UPDATE SET
     name = EXCLUDED.name,
     slug = EXCLUDED.slug,
     hsn_code = EXCLUDED.hsn_code,
     gst_rate = EXCLUDED.gst_rate;`,

  // Sequence advance for apparel_categories
  `SELECT setval('apparel_categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM apparel_categories));`,

  // Standardized Master Garments with exact fabric, knit, GSM, and platen specs
  `INSERT INTO apparel_master_garments (
     id, category_id, name, slug, description, fabric_composition, knit_type, gsm, hsn_code, gst_rate, print_platen_specs, size_chart, is_active
   ) VALUES
     (1, 1, 'Classic Crewneck T-Shirt', 'classic-crewneck-tshirt', 'Premium standard fit ring-spun cotton tee', '100% Combed Cotton', 'Single Jersey', 180, '6109', 5.00,
      '{"front": {"width_in": 12, "height_in": 16}, "back": {"width_in": 12, "height_in": 16}}'::jsonb,
      '[{"size": "S", "chest": 38, "length": 27}, {"size": "M", "chest": 40, "length": 28}, {"size": "L", "chest": 42, "length": 29}, {"size": "XL", "chest": 44, "length": 30}]'::jsonb, TRUE),
     (2, 1, 'Heavyweight Oversized T-Shirt', 'heavyweight-oversized-tshirt', 'Boxy drop-shoulder streetwear tee', '100% Cotton', 'Heavy Jersey', 240, '6109', 5.00,
      '{"front": {"width_in": 14, "height_in": 18}, "back": {"width_in": 14, "height_in": 18}}'::jsonb,
      '[{"size": "S", "chest": 42, "length": 28}, {"size": "M", "chest": 44, "length": 29}, {"size": "L", "chest": 46, "length": 30}, {"size": "XL", "chest": 48, "length": 31}]'::jsonb, TRUE),
     (3, 2, 'French Terry Pullover Hoodie', 'french-terry-pullover-hoodie', 'Heavyweight plush pullover hoodie with kangaroo pocket', '100% Cotton French Terry', '3-Thread Fleece', 380, '6110', 5.00,
      '{"front": {"width_in": 11, "height_in": 14}, "back": {"width_in": 12, "height_in": 16}}'::jsonb,
      '[{"size": "S", "chest": 40, "length": 27}, {"size": "M", "chest": 42, "length": 28}, {"size": "L", "chest": 44, "length": 29}, {"size": "XL", "chest": 46, "length": 30}]'::jsonb, TRUE),
     (4, 3, 'Classic Pique Polo Shirt', 'classic-pique-polo', 'Collared 2-button knit polo shirt', '100% Ring-Spun Cotton', 'Honeycomb Pique', 220, '6105', 5.00,
      '{"front": {"width_in": 10, "height_in": 12}, "back": {"width_in": 12, "height_in": 15}}'::jsonb,
      '[{"size": "S", "chest": 38, "length": 27}, {"size": "M", "chest": 40, "length": 28}, {"size": "L", "chest": 42, "length": 29}, {"size": "XL", "chest": 44, "length": 30}]'::jsonb, TRUE),
     (5, 2, 'Classic Crewneck Sweatshirt', 'classic-crewneck-sweatshirt', 'Brushed fleece crewneck pullover sweatshirt', '80% Cotton 20% Polyester', 'Brushed Fleece', 320, '6110', 5.00,
      '{"front": {"width_in": 12, "height_in": 15}, "back": {"width_in": 12, "height_in": 16}}'::jsonb,
      '[{"size": "S", "chest": 40, "length": 27}, {"size": "M", "chest": 42, "length": 28}, {"size": "L", "chest": 44, "length": 29}, {"size": "XL", "chest": 46, "length": 30}]'::jsonb, TRUE),
     (6, 1, 'Classic V-Neck T-Shirt', 'classic-v-neck-tshirt', 'Premium standard fit ring-spun cotton v-neck tee', '100% Combed Cotton', 'Single Jersey', 180, '6109', 5.00,
      '{"front": {"width_in": 12, "height_in": 16}, "back": {"width_in": 12, "height_in": 16}}'::jsonb,
      '[{"size": "S", "chest": 38, "length": 27}, {"size": "M", "chest": 40, "length": 28}, {"size": "L", "chest": 42, "length": 29}, {"size": "XL", "chest": 44, "length": 30}]'::jsonb, TRUE)
   ON CONFLICT (id) DO UPDATE SET
     name = EXCLUDED.name,
     slug = EXCLUDED.slug,
     fabric_composition = EXCLUDED.fabric_composition,
     knit_type = EXCLUDED.knit_type,
     gsm = EXCLUDED.gsm,
     hsn_code = EXCLUDED.hsn_code,
     gst_rate = EXCLUDED.gst_rate,
     print_platen_specs = EXCLUDED.print_platen_specs,
     size_chart = EXCLUDED.size_chart;`,

  // Sequence advance for apparel_master_garments
  `SELECT setval('apparel_master_garments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM apparel_master_garments));`,

  // Invariant check constraint for cloth_inventory reserved_quantity
  `DO $$ 
   BEGIN 
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cloth_inventory_reservations') THEN 
       ALTER TABLE cloth_inventory ADD CONSTRAINT chk_cloth_inventory_reservations CHECK (reserved_quantity <= quantity AND quantity >= 0 AND reserved_quantity >= 0); 
     END IF; 
   END $$;`,

  // Ensure is_approved column defaults to FALSE for new products
  `ALTER TABLE products_full ALTER COLUMN is_approved SET DEFAULT FALSE;`,

  // Safe legacy catalog backfill mapping
  `UPDATE products_full SET garment_id = 3, is_approved = TRUE WHERE id = 1 AND (garment_id IS NULL OR garment_id <> 3);`,
  `UPDATE products_full SET garment_id = 5, is_approved = TRUE WHERE id IN (2, 3, 4, 5) AND (garment_id IS NULL OR garment_id <> 5);`,
  `UPDATE products_full SET garment_id = 6, is_approved = TRUE WHERE id = 6 AND (garment_id IS NULL OR garment_id <> 6);`,
  `UPDATE products_full SET is_approved = TRUE WHERE id IN (1, 2, 3, 4, 5, 6) AND is_approved IS NULL;`,

  // Seed inventory for Hoodie (#1) so it has stock ready for sizes & colors
  `INSERT INTO cloth_inventory (color_id, size_id, quantity, price, owner_id, product)
   VALUES (1, 1, 150, 25.00, 3, 'hoodie')
   ON CONFLICT (product, color_id, size_id, owner_id) DO NOTHING;`,
  `INSERT INTO cloth_inventory (color_id, size_id, quantity, price, owner_id, product)
   VALUES (2, 2, 120, 25.00, 3, 'hoodie')
   ON CONFLICT (product, color_id, size_id, owner_id) DO NOTHING;`
];

