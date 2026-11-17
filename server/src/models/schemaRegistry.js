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
      is_approved BOOLEAN NOT NULL DEFAULT TRUE,
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
      gateway_account_id INTEGER,
      active_payment_attempt_id INTEGER,
      gateway_fee_paise BIGINT NOT NULL DEFAULT 0,
      subtotal_paise BIGINT NOT NULL DEFAULT 0,
      tax_paise BIGINT NOT NULL DEFAULT 0,
      shipping_cost_paise BIGINT NOT NULL DEFAULT 0,
      total_paise BIGINT NOT NULL DEFAULT 0,
      designer_royalty_payable_paise BIGINT NOT NULL DEFAULT 0,
      provider_earnings_paise BIGINT NOT NULL DEFAULT 0,
      invoice_number VARCHAR(64),
      invoice_url TEXT,
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
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_id_provider') THEN ALTER TABLE orders ADD CONSTRAINT uq_orders_id_provider UNIQUE (id, provider_id); END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_id_gateway') THEN ALTER TABLE orders ADD CONSTRAINT uq_orders_id_gateway UNIQUE (id, gateway_account_id); END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_id_prov_gateway') THEN ALTER TABLE orders ADD CONSTRAINT uq_orders_id_prov_gateway UNIQUE (id, provider_id, gateway_account_id); END IF; END $$;`
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
  },

  // 17. Provider Gateway Accounts (Multi-Provider Merchant-of-Record Gateway Routing)
  {
    name: 'provider_gateway_accounts',
    columns: `
      id SERIAL PRIMARY KEY,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      gateway_name VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      environment_mode VARCHAR(16) NOT NULL CHECK (environment_mode IN ('test', 'live')),
      webhook_url_slug VARCHAR(64) UNIQUE NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'unconfigured' 
        CHECK (status IN ('unconfigured', 'testing', 'active', 'suspended', 'deactivated')),
      business_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verified_gstin VARCHAR(32) NULL,
      verified_legal_name VARCHAR(255) NULL,
      custody_terms_accepted_at TIMESTAMPTZ NULL,
      last_test_ping_at TIMESTAMPTZ NULL,
      last_test_ping_status VARCHAR(32) NULL,
      last_error_message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_provider_gateway_env UNIQUE (provider_id, gateway_name, environment_mode),
      CONSTRAINT uq_provider_gateway_composite UNIQUE (provider_id, id),
      CONSTRAINT uq_provider_gateway_acc_id UNIQUE (id)
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_provider_gateway_slug ON provider_gateway_accounts(webhook_url_slug);`,
      `CREATE INDEX IF NOT EXISTS idx_provider_gateway_provider ON provider_gateway_accounts(provider_id);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_provider_gateway_accounts_updated_at ON provider_gateway_accounts;
       CREATE TRIGGER trg_provider_gateway_accounts_updated_at BEFORE UPDATE ON provider_gateway_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 18. Provider Gateway Credentials (Independently Versioned Gateway API Credentials)
  {
    name: 'provider_gateway_credentials',
    columns: `
      id SERIAL PRIMARY KEY,
      gateway_account_id INTEGER NOT NULL REFERENCES provider_gateway_accounts(id) ON DELETE RESTRICT,
      version_number INTEGER NOT NULL DEFAULT 1,
      key_id VARCHAR(128) NOT NULL,
      key_secret_encrypted TEXT NOT NULL,
      key_secret_iv VARCHAR(32) NOT NULL,
      key_secret_auth_tag VARCHAR(32) NOT NULL,
      encryption_key_version VARCHAR(32) NOT NULL DEFAULT 'v1',
      status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'active', 'retired')),
      activated_at TIMESTAMPTZ NULL,
      retired_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_gateway_account_version UNIQUE (gateway_account_id, version_number),
      CONSTRAINT uq_gateway_account_cred_composite UNIQUE (gateway_account_id, id)
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_active_gateway_credential ON provider_gateway_credentials(gateway_account_id) WHERE status = 'active';`,
      `CREATE INDEX IF NOT EXISTS idx_gateway_credentials_acc ON provider_gateway_credentials(gateway_account_id);`
    ]
  },

  // 19. Provider Webhook Secrets (Independently Versioned Webhook Credentials)
  {
    name: 'provider_webhook_secrets',
    columns: `
      id SERIAL PRIMARY KEY,
      gateway_account_id INTEGER NOT NULL REFERENCES provider_gateway_accounts(id) ON DELETE RESTRICT,
      version_number INTEGER NOT NULL DEFAULT 1,
      webhook_secret_encrypted TEXT NOT NULL,
      webhook_secret_iv VARCHAR(32) NOT NULL,
      webhook_secret_auth_tag VARCHAR(32) NOT NULL,
      encryption_key_version VARCHAR(32) NOT NULL DEFAULT 'v1',
      status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'active', 'rotating', 'retired')),
      activated_at TIMESTAMPTZ NULL,
      expires_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_gateway_webhook_version UNIQUE (gateway_account_id, version_number),
      CONSTRAINT uq_gateway_webhook_sec_composite UNIQUE (gateway_account_id, id)
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_active_webhook_secret ON provider_webhook_secrets(gateway_account_id) WHERE status = 'active';`,
      `CREATE INDEX IF NOT EXISTS idx_webhook_secrets_acc ON provider_webhook_secrets(gateway_account_id);`
    ]
  },

  // 20. Payment Attempts (Parent Checkout Attempt & Receipt Tracking)
  {
    name: 'payment_attempts',
    columns: `
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      gateway_account_id INTEGER NOT NULL,
      credential_id INTEGER NOT NULL,
      idempotency_key VARCHAR(128) NOT NULL,
      receipt VARCHAR(40) UNIQUE NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      razorpay_order_id VARCHAR(128) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'creating' 
        CHECK (status IN (
          'creating',
          'created',
          'processing',
          'partially_failed',
          'reconciliation_required',
          'fulfilled',
          'failed',
          'superseded',
          'expired'
        )),
      failure_reason TEXT NULL,
      raw_response JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_payment_attempts_idempotency UNIQUE (order_id, idempotency_key),
      CONSTRAINT uq_payment_attempts_order_attempt UNIQUE (order_id, attempt_number),
      CONSTRAINT uq_payment_attempts_gateway_rzp_order UNIQUE (gateway_account_id, razorpay_order_id),
      CONSTRAINT uq_payment_attempts_id_order UNIQUE (id, order_id),
      CONSTRAINT uq_payment_attempts_id_gateway UNIQUE (id, gateway_account_id),
      CONSTRAINT uq_payment_attempts_composite UNIQUE (id, order_id, gateway_account_id),
      CONSTRAINT uq_payment_attempts_id_rzp_order_gateway UNIQUE (id, razorpay_order_id, gateway_account_id),
      CONSTRAINT fk_payment_attempts_gateway_credential FOREIGN KEY (gateway_account_id, credential_id) REFERENCES provider_gateway_credentials(gateway_account_id, id) ON DELETE RESTRICT
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON payment_attempts(order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_attempts_rzp_order ON payment_attempts(razorpay_order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_attempts_receipt ON payment_attempts(receipt);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_payment_attempts_updated_at ON payment_attempts;
       CREATE TRIGGER trg_payment_attempts_updated_at BEFORE UPDATE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 21. Gateway Payment Transactions (Multi-Transaction Support per Order)
  {
    name: 'gateway_payment_transactions',
    columns: `
      id SERIAL PRIMARY KEY,
      payment_attempt_id INTEGER NOT NULL,
      gateway_account_id INTEGER NOT NULL,
      razorpay_order_id VARCHAR(128) NOT NULL,
      razorpay_payment_id VARCHAR(128) UNIQUE NOT NULL,
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      status VARCHAR(32) NOT NULL DEFAULT 'created'
        CHECK (status IN (
          'created',
          'authorized',
          'captured',
          'late_captured',
          'reconciliation_required',
          'failed',
          'superseded',
          'refund_pending',
          'refunded',
          'voided'
        )),
      payment_method VARCHAR(32) NULL,
      fee_paise BIGINT NOT NULL DEFAULT 0,
      tax_paise BIGINT NOT NULL DEFAULT 0,
      failure_reason TEXT NULL,
      capture_in_progress BOOLEAN NOT NULL DEFAULT FALSE,
      capture_operation_id UUID NULL,
      capture_claimed_at TIMESTAMPTZ NULL,
      capture_lease_until TIMESTAMPTZ NULL,
      authorized_at TIMESTAMPTZ NULL,
      captured_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_gateway_payment_tx_composite UNIQUE (id, payment_attempt_id, gateway_account_id, razorpay_payment_id),
      CONSTRAINT fk_payment_tx_attempt_gateway FOREIGN KEY (payment_attempt_id, gateway_account_id) REFERENCES payment_attempts(id, gateway_account_id) ON DELETE RESTRICT,
      CONSTRAINT fk_payment_tx_attempt_rzp_order FOREIGN KEY (payment_attempt_id, razorpay_order_id, gateway_account_id) REFERENCES payment_attempts(id, razorpay_order_id, gateway_account_id) ON DELETE RESTRICT
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_payment_tx_rzp_pay ON gateway_payment_transactions(razorpay_payment_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_tx_rzp_ord ON gateway_payment_transactions(razorpay_order_id);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_gateway_payment_tx_updated_at ON gateway_payment_transactions;
       CREATE TRIGGER trg_gateway_payment_tx_updated_at BEFORE UPDATE ON gateway_payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 22. Webhook Events Ledger (Durable Ingest with Fencing Lease Tokens)
  {
    name: 'webhook_events',
    columns: `
      id SERIAL PRIMARY KEY,
      gateway_account_id INTEGER NOT NULL REFERENCES provider_gateway_accounts(id) ON DELETE RESTRICT,
      event_id VARCHAR(128) NOT NULL,
      webhook_secret_id INTEGER NOT NULL,
      provider_id INTEGER NULL,
      gateway VARCHAR(32) NOT NULL DEFAULT 'razorpay',
      event_name VARCHAR(64) NOT NULL,
      payload JSONB NOT NULL,
      processing_status VARCHAR(32) NOT NULL DEFAULT 'received' 
        CHECK (processing_status IN ('received', 'processing', 'processed', 'retry_wait', 'dead_letter', 'ignored')),
      lease_token UUID NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      last_error TEXT NULL,
      locked_at TIMESTAMPTZ NULL,
      locked_until TIMESTAMPTZ NULL,
      next_retry_at TIMESTAMPTZ NULL,
      processed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_webhook_events_gateway_event UNIQUE (gateway_account_id, event_id),
      CONSTRAINT fk_webhook_events_gateway_secret FOREIGN KEY (gateway_account_id, webhook_secret_id) REFERENCES provider_webhook_secrets(gateway_account_id, id) ON DELETE RESTRICT,
      CONSTRAINT fk_webhook_events_provider_gateway FOREIGN KEY (provider_id, gateway_account_id) REFERENCES provider_gateway_accounts(provider_id, id) ON DELETE RESTRICT
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_webhook_events_queue ON webhook_events(processing_status, next_retry_at, locked_until);`
    ]
  },

  // 23. Transactional Outbox (External Side-Effects Engine with Distributed Leases)
  {
    name: 'outbox_events',
    columns: `
      id SERIAL PRIMARY KEY,
      aggregate_type VARCHAR(64) NOT NULL,
      aggregate_id INTEGER NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      idempotency_key VARCHAR(128) UNIQUE NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'retry_wait', 'dead_letter', 'failed')),
      lease_token UUID NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      last_error TEXT NULL,
      locked_at TIMESTAMPTZ NULL,
      locked_until TIMESTAMPTZ NULL,
      next_retry_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_outbox_queue ON outbox_events(status, next_retry_at, locked_until);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_outbox_events_updated_at ON outbox_events;
       CREATE TRIGGER trg_outbox_events_updated_at BEFORE UPDATE ON outbox_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 24. Payment Exceptions (Deduplicated Exception Audit Ledger)
  {
    name: 'payment_exceptions',
    columns: `
      id SERIAL PRIMARY KEY,
      dedupe_key VARCHAR(255) UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      payment_attempt_id INTEGER NULL,
      provider_id INTEGER NOT NULL,
      gateway_account_id INTEGER NOT NULL,
      razorpay_payment_id VARCHAR(128) NULL,
      exception_type VARCHAR(64) NOT NULL 
        CHECK (exception_type IN (
          'duplicate_capture',
          'amount_mismatch',
          'currency_mismatch',
          'unlinked_webhook',
          'orphaned_payment',
          'dead_letter_webhook',
          'late_capture_out_of_stock',
          'refund_idempotency_payload_conflict'
        )),
      severity VARCHAR(16) NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      resolution_status VARCHAR(32) NOT NULL DEFAULT 'open' 
        CHECK (resolution_status IN ('open', 'investigating', 'refund_queued', 'resolved', 'dismissed')),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      resolved_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ NULL,
      resolution_notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_payment_exceptions_order_attempt FOREIGN KEY (order_id, payment_attempt_id) REFERENCES payment_attempts(order_id, id) ON DELETE RESTRICT,
      CONSTRAINT fk_payment_exceptions_provider_gateway FOREIGN KEY (provider_id, gateway_account_id) REFERENCES provider_gateway_accounts(provider_id, id) ON DELETE RESTRICT
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_payment_exceptions_status ON payment_exceptions(resolution_status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_payment_exceptions_updated_at ON payment_exceptions;
       CREATE TRIGGER trg_payment_exceptions_updated_at BEFORE UPDATE ON payment_exceptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 25. Refunds (Audit-Grade Refund Tracking)
  {
    name: 'refunds',
    columns: `
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      payment_attempt_id INTEGER NOT NULL,
      gateway_payment_transaction_id INTEGER NOT NULL,
      provider_id INTEGER NOT NULL,
      gateway_account_id INTEGER NOT NULL,
      razorpay_payment_id VARCHAR(128) NOT NULL,
      razorpay_refund_id VARCHAR(128) UNIQUE NULL,
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      refund_type VARCHAR(16) NOT NULL DEFAULT 'full' CHECK (refund_type IN ('full', 'partial')),
      reason VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'initiated' 
        CHECK (status IN ('initiated', 'processing', 'processed', 'failed')),
      failure_reason TEXT NULL,
      receipt VARCHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_refunds_tx_attempt_gateway FOREIGN KEY (gateway_payment_transaction_id, payment_attempt_id, gateway_account_id, razorpay_payment_id) REFERENCES gateway_payment_transactions(id, payment_attempt_id, gateway_account_id, razorpay_payment_id) ON DELETE RESTRICT,
      CONSTRAINT fk_refunds_attempt_order_gateway FOREIGN KEY (payment_attempt_id, order_id, gateway_account_id) REFERENCES payment_attempts(id, order_id, gateway_account_id) ON DELETE RESTRICT,
      CONSTRAINT fk_refunds_order_prov_gateway FOREIGN KEY (order_id, provider_id, gateway_account_id) REFERENCES orders(id, provider_id, gateway_account_id) ON DELETE RESTRICT
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_refunds_updated_at ON refunds;
       CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 26. Refund Attempts (Idempotency and API Recovery Log)
  {
    name: 'refund_attempts',
    columns: `
      id SERIAL PRIMARY KEY,
      refund_id INTEGER NOT NULL REFERENCES refunds(id) ON DELETE RESTRICT,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      idempotency_key VARCHAR(128) NOT NULL,
      raw_request JSONB DEFAULT '{}'::jsonb,
      raw_response JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(32) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'succeeded', 'failed')),
      error_code VARCHAR(64) NULL,
      error_description TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_refund_attempt_step UNIQUE (refund_id, attempt_number),
      CONSTRAINT uq_refund_attempt_idempotency UNIQUE (idempotency_key)
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_refund_attempts_refund ON refund_attempts(refund_id);`
    ]
  },

  // 27. Subscription Plans (Configurable SaaS Pricing Catalog)
  {
    name: 'subscription_plans',
    columns: `
      id SERIAL PRIMARY KEY,
      plan_code VARCHAR(32) UNIQUE NOT NULL,
      name VARCHAR(64) NOT NULL,
      target_role VARCHAR(32) NOT NULL CHECK (target_role IN ('all', 'print_provider', 'designer')),
      tier VARCHAR(32) NOT NULL CHECK (tier IN ('none', 'pro', 'business', 'enterprise')),
      billing_interval VARCHAR(16) NOT NULL CHECK (billing_interval IN ('monthly', 'yearly', 'lifetime', 'trial')),
      price_paise BIGINT NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      limits JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_popular BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_subscription_plans_role_active ON subscription_plans(target_role, is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_subscription_plans_code ON subscription_plans(plan_code);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON subscription_plans;
       CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 28. User Subscriptions (Authoritative Active & Historical Subscriptions)
  {
    name: 'user_subscriptions',
    columns: `
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      status VARCHAR(32) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'expired', 'cancelled', 'payment_pending', 'suspended', 'superseded')),
      billing_interval VARCHAR(16) NOT NULL,
      price_paise BIGINT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NULL,
      cancelled_at TIMESTAMPTZ NULL,
      granted_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      grant_reason TEXT NULL,
      grant_type VARCHAR(32) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expiry ON user_subscriptions(status, expires_at);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_active_user_subscription ON user_subscriptions(user_id) WHERE status = 'active';`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON user_subscriptions;
       CREATE TRIGGER trg_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 29. Subscription Invoices (Audit-Grade Billing Records)
  {
    name: 'subscription_invoices',
    columns: `
      id SERIAL PRIMARY KEY,
      user_subscription_id INTEGER NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      invoice_number VARCHAR(64) UNIQUE NOT NULL,
      amount_paise BIGINT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'voided')),
      paid_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_sub_invoices_user ON subscription_invoices(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_sub_invoices_status ON subscription_invoices(status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_subscription_invoices_updated_at ON subscription_invoices;
       CREATE TRIGGER trg_subscription_invoices_updated_at BEFORE UPDATE ON subscription_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 30. Subscription Payment Attempts (Cycle Payment Attempts & Replay Protection)
  {
    name: 'subscription_payment_attempts',
    columns: `
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      subscription_id INTEGER NOT NULL REFERENCES user_subscriptions(id) ON DELETE RESTRICT,
      invoice_id INTEGER NOT NULL REFERENCES subscription_invoices(id) ON DELETE RESTRICT,
      plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      idempotency_key VARCHAR(128) UNIQUE NOT NULL,
      receipt VARCHAR(40) UNIQUE NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      razorpay_order_id VARCHAR(128) NULL,
      razorpay_payment_id VARCHAR(128) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'creating' 
        CHECK (status IN ('creating', 'created', 'processing', 'captured', 'failed')),
      failure_reason TEXT NULL,
      raw_response JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_pay_att_order ON subscription_payment_attempts(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_pay_att_pay ON subscription_payment_attempts(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_sub_pay_att_user ON subscription_payment_attempts(user_id);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_sub_pay_attempts_updated_at ON subscription_payment_attempts;
       CREATE TRIGGER trg_sub_pay_attempts_updated_at BEFORE UPDATE ON subscription_payment_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    ]
  },

  // 31. Platform Webhook Events (Isolated from Provider Webhook Ledger)
  {
    name: 'platform_webhook_events',
    columns: `
      id SERIAL PRIMARY KEY,
      event_id VARCHAR(128) UNIQUE NOT NULL,
      event_name VARCHAR(64) NOT NULL,
      payload JSONB NOT NULL,
      processing_status VARCHAR(32) NOT NULL DEFAULT 'received' 
        CHECK (processing_status IN ('received', 'processing', 'processed', 'retry_wait', 'dead_letter', 'ignored')),
      lease_token UUID NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      last_error TEXT NULL,
      locked_at TIMESTAMPTZ NULL,
      locked_until TIMESTAMPTZ NULL,
      next_retry_at TIMESTAMPTZ NULL,
      processed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_platform_wh_events_queue ON platform_webhook_events(processing_status, next_retry_at, locked_until);`
    ]
  },

  // 32. Designer Payout Requests & Settlement Ledger
  {
    name: 'designer_payout_requests',
    columns: `
      id SERIAL PRIMARY KEY,
      designer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
      amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
      payout_method VARCHAR(32) NOT NULL DEFAULT 'upi' CHECK (payout_method IN ('upi', 'bank_transfer')),
      payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'settled', 'rejected')),
      settlement_reference_utr TEXT NULL,
      settled_at TIMESTAMPTZ NULL,
      rejected_reason TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_designer_payouts_designer ON designer_payout_requests(designer_id);`,
      `CREATE INDEX IF NOT EXISTS idx_designer_payouts_provider ON designer_payout_requests(provider_id);`,
      `CREATE INDEX IF NOT EXISTS idx_designer_payouts_status ON designer_payout_requests(status);`
    ],
    triggers: [
      `DROP TRIGGER IF EXISTS trg_designer_payouts_updated_at ON designer_payout_requests;
       CREATE TRIGGER trg_designer_payouts_updated_at BEFORE UPDATE ON designer_payout_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
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
   ON CONFLICT (product, color_id, size_id, owner_id) DO NOTHING;`,

  // Phase 2 Composite Constraints and Inter-Table Foreign Keys
  `DO $$ 
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_id_provider') THEN
       ALTER TABLE orders ADD CONSTRAINT uq_orders_id_provider UNIQUE (id, provider_id);
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_id_gateway') THEN
       ALTER TABLE orders ADD CONSTRAINT uq_orders_id_gateway UNIQUE (id, gateway_account_id);
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_id_prov_gateway') THEN
       ALTER TABLE orders ADD CONSTRAINT uq_orders_id_prov_gateway UNIQUE (id, provider_id, gateway_account_id);
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_provider_gateway') THEN
       ALTER TABLE orders ADD CONSTRAINT fk_orders_provider_gateway 
         FOREIGN KEY (provider_id, gateway_account_id) 
         REFERENCES provider_gateway_accounts(provider_id, id) 
         ON DELETE RESTRICT NOT VALID;
       ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_provider_gateway;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_attempts_order_gateway') THEN
       ALTER TABLE payment_attempts ADD CONSTRAINT fk_payment_attempts_order_gateway
         FOREIGN KEY (order_id, gateway_account_id)
         REFERENCES orders(id, gateway_account_id)
         ON DELETE RESTRICT NOT VALID;
       ALTER TABLE payment_attempts VALIDATE CONSTRAINT fk_payment_attempts_order_gateway;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_active_attempt') THEN
       ALTER TABLE orders ADD CONSTRAINT fk_orders_active_attempt 
         FOREIGN KEY (id, active_payment_attempt_id) 
         REFERENCES payment_attempts(order_id, id) 
         ON DELETE RESTRICT NOT VALID;
       ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_active_attempt;
     END IF;
   END $$;`,

  // Phase 2 Paise Direct Assignment Backfill from Phase 1 integer *_cents
  `UPDATE orders SET total_paise = total_cents WHERE total_paise = 0 AND total_cents > 0;`,
  `UPDATE orders SET subtotal_paise = subtotal_cents WHERE subtotal_paise = 0 AND subtotal_cents > 0;`,
  `UPDATE orders SET shipping_cost_paise = shipping_cost_cents WHERE shipping_cost_paise = 0 AND shipping_cost_cents > 0;`,
  `UPDATE orders SET tax_paise = tax_cents WHERE tax_paise = 0 AND tax_cents > 0;`,
  `UPDATE orders SET provider_earnings_paise = provider_earnings_cents WHERE provider_earnings_paise = 0 AND provider_earnings_cents > 0;`,
  `UPDATE orders SET designer_royalty_payable_paise = designer_earnings_cents WHERE designer_royalty_payable_paise = 0 AND designer_earnings_cents > 0;`,

  // Update billing_interval check constraint to allow 'trial'
  `ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_billing_interval_check;
   ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_billing_interval_check CHECK (billing_interval IN ('monthly', 'yearly', 'lifetime', 'trial'));`,

  // Phase 3 Standard Subscription Plans (Exactly 4 Plans)
  `INSERT INTO subscription_plans (
     id, plan_code, name, target_role, tier, billing_interval, price_paise, display_order, features, limits, is_active
   ) VALUES
     (1, 'starter', 'Starter Partner', 'all', 'none', 'trial', 0, 1, 
      '["7-Day free trial on approval", "Up to 10 product blanks", "Up to 10 design uploads", "Standard order management"]'::jsonb,
      '{"max_products": 10, "max_designs": 10, "canvas_export": "standard", "priority_routing": false}'::jsonb, TRUE),
     (2, 'pro_designer', 'Pro Designer', 'designer', 'pro', 'monthly', 29900, 2,
      '["Unlimited design uploads", "High-resolution canvas exports", "Custom designer storefront badge", "Store analytics & traffic insights", "Priority email support"]'::jsonb,
      '{"max_products": 50, "max_designs": -1, "canvas_export": "high_res", "priority_routing": false}'::jsonb, TRUE),
     (3, 'pro_provider', 'Pro Provider', 'print_provider', 'pro', 'monthly', 99900, 3,
      '["Up to 100 garment blank listings", "Priority customer order routing", "Automated low-stock alerts", "CSV bulk inventory management", "Priority provider support"]'::jsonb,
      '{"max_products": 100, "max_designs": 50, "canvas_export": "standard", "priority_routing": true}'::jsonb, TRUE),
     (4, 'business_enterprise', 'Business Enterprise', 'print_provider', 'business', 'monthly', 249900, 4,
      '["Unlimited garment blank listings", "Industrial techpack platen specs", "Highest priority order routing", "Dedicated SLA support (24/7)", "Custom domain & storefront branding"]'::jsonb,
      '{"max_products": -1, "max_designs": -1, "canvas_export": "high_res", "priority_routing": true}'::jsonb, TRUE)
   ON CONFLICT (id) DO UPDATE SET
     plan_code = EXCLUDED.plan_code,
     name = EXCLUDED.name,
     target_role = EXCLUDED.target_role,
     tier = EXCLUDED.tier,
     billing_interval = EXCLUDED.billing_interval,
     price_paise = EXCLUDED.price_paise,
     display_order = EXCLUDED.display_order,
     features = EXCLUDED.features,
     limits = EXCLUDED.limits,
     is_active = EXCLUDED.is_active;`,

  // Advance sequence for subscription_plans
  `SELECT setval('subscription_plans_id_seq', (SELECT COALESCE(MAX(id), 1) FROM subscription_plans));`,

  // Idempotent Partner Starter Backfill for existing print providers and designers
  `INSERT INTO user_subscriptions (
     user_id, plan_id, status, billing_interval, price_paise, currency, plan_snapshot, starts_at, expires_at, grant_type, grant_reason
   )
   SELECT 
     u.id, 1, 'active', 'trial', 0, 'INR', 
     p.limits, NOW(), NOW() + INTERVAL '7 days', 'system_default', '7-day introductory free trial'
   FROM users u
   JOIN subscription_plans p ON p.id = 1
   WHERE u.role IN ('print_provider', 'designer')
     AND NOT EXISTS (
       SELECT 1 FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'active'
     );`
];

