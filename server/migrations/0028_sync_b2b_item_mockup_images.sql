-- Migration 0028: Sync actual custom mockup image URLs for B2B designer order items
-- Populates custom_mockup_url from products_full designs if previously null or defaulted to generic placeholder

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
  AND (pf.designs->0->>'image' IS NOT NULL OR pf.designs->1->>'image' IS NOT NULL);

