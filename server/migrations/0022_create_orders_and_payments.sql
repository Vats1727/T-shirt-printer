-- Migration 0022: Create robust orders, order_items, and payments tables
BEGIN;

CREATE TABLE IF NOT EXISTS orders (
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
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id),
  design_id INTEGER,
  product_id INTEGER,
  product_title VARCHAR(255) NOT NULL,
  color_id VARCHAR(32),
  color_name VARCHAR(64),
  color_hex VARCHAR(32),
  size_label VARCHAR(32),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_price_cents INTEGER NOT NULL DEFAULT 0,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
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
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_designer_id ON orders(designer_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

COMMIT;

