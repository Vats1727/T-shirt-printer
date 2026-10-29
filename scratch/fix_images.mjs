import { pool } from "../server/src/config/database.js";

async function main() {
  try {
    const r = await pool.query(`
      UPDATE b2b_designer_order_items i
      SET custom_mockup_url = COALESCE(
        NULLIF(pf.designs->0->>'image', ''),
        NULLIF(pf.designs->1->>'image', '')
      )
      FROM products_full pf
      WHERE pf.id = i.product_id
        AND (i.custom_mockup_url IS NULL OR i.custom_mockup_url = '/templates/tshirt.png')
        AND pf.designs IS NOT NULL
        AND jsonb_typeof(pf.designs) = 'array'
        AND jsonb_array_length(pf.designs) > 0
        AND (pf.designs->0->>'image' IS NOT NULL OR pf.designs->1->>'image' IS NOT NULL)
      RETURNING i.id, i.b2b_order_id, i.product_id, i.custom_mockup_url;
    `);
    console.log("Updated rows count:", r.rowCount);
    console.log("Updated items:", r.rows);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

main();
