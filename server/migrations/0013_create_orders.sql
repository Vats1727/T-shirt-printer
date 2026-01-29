-- Migration: 0013_create_orders.sql
-- Purpose: store supplier orders and order lines (minimal required fields) using non-conflicting table names

-- Orders table (one per supplier order)
CREATE TABLE IF NOT EXISTS supplier_orders (
  id serial PRIMARY KEY,
  supplier_id integer REFERENCES users(id) ON DELETE SET NULL, -- supplier placing/fulfilling the order
  placed_by integer REFERENCES users(id) ON DELETE SET NULL, -- user who created the order (could be supplier or customer)

  -- shipping / recipient
  customer_name text,
  customer_email text,
  shipping_address jsonb, -- { street, city, state, postal_code, country }
  shipping_method text,
  shipping_cost_cents integer NOT NULL DEFAULT 0,

  -- price breakdown
  subtotal_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',

  status text NOT NULL CHECK (status IN ('pending','confirmed','paid','processing','shipped','completed','cancelled')) DEFAULT 'pending',
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier_id ON supplier_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders (status);

-- Order lines: one or more lines per order representing items/sizes/qtys
CREATE TABLE IF NOT EXISTS supplier_order_lines (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  design_id integer REFERENCES designs(id) ON DELETE SET NULL,
  design_snapshot jsonb, -- store the design payload (or minimal snapshot) at order time

  product_sku text, -- optional product/variant identifier
  size text, -- S/M/L/XL etc
  color text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  line_total_cents integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_order_lines_order_id ON supplier_order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_lines_design_id ON supplier_order_lines (design_id);

-- Keep supplier_orders.updated_at fresh using existing function
-- (function update_updated_at_column is defined in prior migration)
DROP TRIGGER IF EXISTS trg_supplier_orders_updated_at ON supplier_orders;
CREATE TRIGGER trg_supplier_orders_updated_at
BEFORE UPDATE ON supplier_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
