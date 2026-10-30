-- Migration 0030: Add Back Print Assets & Placement Columns
-- Enables industrial print operators to inspect and download back print assets alongside front print assets.

ALTER TABLE b2b_designer_order_items
  ADD COLUMN IF NOT EXISTS back_print_file_url TEXT,
  ADD COLUMN IF NOT EXISTS back_preview_url TEXT,
  ADD COLUMN IF NOT EXISTS back_print_dimensions JSONB;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS back_print_file_url TEXT,
  ADD COLUMN IF NOT EXISTS back_preview_url TEXT,
  ADD COLUMN IF NOT EXISTS back_print_dimensions JSONB;

