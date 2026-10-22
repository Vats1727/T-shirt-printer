import { pool } from './db.js';
async function fixDb() {
  if (!pool) {
    console.error("No database connection pool");
    process.exit(1);
  }
  try {
    console.log("--- Fixing Database Schema ---");
    console.log("Fixing cloth_inventory...");
    await pool.query("ALTER TABLE cloth_inventory ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'tshirt'");
    await pool.query("ALTER TABLE cloth_inventory ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    await pool.query("DROP INDEX IF EXISTS cloth_inventory_unique_product_color_size_owner");
    await pool.query("DROP INDEX IF EXISTS cloth_inventory_unique_product_color_size");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS cloth_inventory_unique_product_color_size_owner ON cloth_inventory(product, color_id, size_id, owner_id)");
    console.log("Fixing size_chart...");
    await pool.query("ALTER TABLE size_chart ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'tshirt'");
    await pool.query("ALTER TABLE size_chart ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    await pool.query("DROP INDEX IF EXISTS unique_size_chart_product_size_owner");
    await pool.query("DROP INDEX IF EXISTS unique_size_chart_product_size");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS unique_size_chart_product_size_owner ON size_chart(product, size_id, owner_id)");
    console.log("Fixing colors...");
    await pool.query("ALTER TABLE colors ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    console.log("Fixing sizes...");
    await pool.query("ALTER TABLE sizes ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    console.log("Fixing products_full...");
    await pool.query("ALTER TABLE products_full ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    console.log("Fixing products...");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    console.log("Fixing designs...");
    await pool.query("ALTER TABLE designs ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    console.log("Fixing assets...");
    await pool.query("ALTER TABLE assets ADD COLUMN IF NOT EXISTS uploader_id INTEGER");
    await pool.query("ALTER TABLE assets ADD COLUMN IF NOT EXISTS owner_id INTEGER");
    console.log("--- Schema Fix Complete ---");
  } catch (err) {
    console.error("Error fixing schema:", err.message);
  } finally {
    await pool.end();
  }
}
fixDb();
