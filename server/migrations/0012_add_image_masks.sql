-- 0012_add_image_masks.sql
-- Add image_mask and back_image_mask columns to designs and update products_full aggregated designs JSON

BEGIN;

ALTER TABLE designs ADD COLUMN IF NOT EXISTS image_mask TEXT;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS back_image_mask TEXT;

-- Refresh the products_full designs JSON column to include the new mask fields
UPDATE products_full SET designs = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'slogan', d.slogan,
      'image', d.image,
      'image_mask', d.image_mask,
      'image_scale', d.image_scale,
      'image_rotation', d.image_rotation,
      'image_position', d.image_position,
      'color', d.color,
      'template', d.template,
      'back_slogan', d.back_slogan,
      'back_image', d.back_image,
      'back_image_mask', d.back_image_mask,
      'back_image_scale', d.back_image_scale,
      'back_image_rotation', d.back_image_rotation,
      'back_image_position', d.back_image_position
    ) ORDER BY d.id
  ) FROM designs d WHERE d.product_id = products_full.id
), '[]'::jsonb);

COMMIT;
