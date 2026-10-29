-- Migration 0025: Add B2B wholesale financial settings and designer B2B purchase orders
BEGIN;

-- 1. Dedicated B2B Wholesale Financial Governance Settings
CREATE TABLE IF NOT EXISTS platform_b2b_financial_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 8.00,
    provider_margin_percent NUMERIC(5, 2) NOT NULL DEFAULT 92.00,
    
    standard_shipping_charge NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    free_shipping_threshold NUMERIC(10, 2) NOT NULL DEFAULT 2500.00,
    shipping_enabled BOOLEAN NOT NULL DEFAULT true,
    
    tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    gst_enabled BOOLEAN NOT NULL DEFAULT true,
    
    bulk_tier1_min_qty INT NOT NULL DEFAULT 10,
    bulk_tier1_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    bulk_tier2_min_qty INT NOT NULL DEFAULT 50,
    bulk_tier2_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    bulk_tier3_min_qty INT NOT NULL DEFAULT 100,
    bulk_tier3_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    
    notes TEXT DEFAULT 'Global B2B wholesale rules configured by Portal Superadmin',
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_b2b_row_check CHECK (id = 1)
);

INSERT INTO platform_b2b_financial_settings (
    id, platform_fee_percent, provider_margin_percent,
    standard_shipping_charge, free_shipping_threshold, shipping_enabled,
    tax_percent, gst_enabled,
    bulk_tier1_min_qty, bulk_tier1_discount_pct,
    bulk_tier2_min_qty, bulk_tier2_discount_pct,
    bulk_tier3_min_qty, bulk_tier3_discount_pct,
    notes
) VALUES (
    1, 8.00, 92.00,
    150.00, 2500.00, true,
    5.00, true,
    10, 5.00,
    50, 10.00,
    100, 15.00,
    'Global B2B wholesale rules configured by Portal Superadmin'
) ON CONFLICT (id) DO NOTHING;

-- 2. B2B Designer Direct & Bulk Orders Table
CREATE TABLE IF NOT EXISTS b2b_designer_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(64) UNIQUE NOT NULL,
    designer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    order_type VARCHAR(32) NOT NULL DEFAULT 'bulk', -- 'sample' (1-4 pcs) | 'bulk' (5+ pcs)
    total_quantity INT NOT NULL DEFAULT 1,
    
    base_subtotal_cents BIGINT NOT NULL,
    discount_cents BIGINT DEFAULT 0,
    subtotal_cents BIGINT NOT NULL,
    shipping_cost_cents BIGINT DEFAULT 0,
    tax_cents BIGINT DEFAULT 0,
    total_cents BIGINT NOT NULL,
    
    b2b_platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 8.00,
    platform_commission_cents BIGINT NOT NULL,
    provider_earnings_cents BIGINT NOT NULL,
    
    payment_status VARCHAR(32) DEFAULT 'pending',
    payment_method VARCHAR(32) DEFAULT 'razorpay',
    razorpay_order_id VARCHAR(128),
    razorpay_payment_id VARCHAR(128),
    razorpay_signature VARCHAR(256),
    
    status VARCHAR(32) DEFAULT 'pending',
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    tracking_info JSONB DEFAULT '{}'::jsonb,
    designer_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. B2B Designer Order Line Items (Specific to Color × Size Combinations)
CREATE TABLE IF NOT EXISTS b2b_designer_order_items (
    id SERIAL PRIMARY KEY,
    b2b_order_id INT NOT NULL REFERENCES b2b_designer_orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products_full(id),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(128),
    
    color_name VARCHAR(64) NOT NULL,
    color_hex VARCHAR(32),
    garment_size VARCHAR(32) NOT NULL,
    
    custom_design_id INT REFERENCES designs(id),
    custom_mockup_url TEXT,
    
    quantity INT NOT NULL DEFAULT 1,
    unit_price_cents BIGINT NOT NULL,
    line_total_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_designer_id ON b2b_designer_orders(designer_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_provider_id ON b2b_designer_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_created_at ON b2b_designer_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_order_items_order_id ON b2b_designer_order_items(b2b_order_id);

COMMIT;

