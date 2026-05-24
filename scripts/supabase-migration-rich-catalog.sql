-- ============================================================
-- Migration: Add rich catalog columns to Supabase products table
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category            text,
  ADD COLUMN IF NOT EXISTS subcategory         text,
  ADD COLUMN IF NOT EXISTS short_description   text,
  ADD COLUMN IF NOT EXISTS full_description    text,
  ADD COLUMN IF NOT EXISTS benefits            jsonb,
  ADD COLUMN IF NOT EXISTS ingredients         text,
  ADD COLUMN IF NOT EXISTS usage_instructions  text,
  ADD COLUMN IF NOT EXISTS warnings            text,
  ADD COLUMN IF NOT EXISTS pregnancy_use       text,
  ADD COLUMN IF NOT EXISTS breastfeeding_use   text,
  ADD COLUMN IF NOT EXISTS allergy_info        text,
  ADD COLUMN IF NOT EXISTS skin_types          jsonb,
  ADD COLUMN IF NOT EXISTS age_group           text,
  ADD COLUMN IF NOT EXISTS size                text,
  ADD COLUMN IF NOT EXISTS form                text,
  ADD COLUMN IF NOT EXISTS rating              numeric(3, 1),
  ADD COLUMN IF NOT EXISTS review_count        integer,
  ADD COLUMN IF NOT EXISTS stock_status        text,
  ADD COLUMN IF NOT EXISTS featured            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags                jsonb,
  ADD COLUMN IF NOT EXISTS disclaimer          text;

-- ============================================================
-- Example: jsonb columns expect arrays or objects, e.g.:
--   benefits:   '["Nemlendirici", "Anti-aging", "Aydınlatıcı"]'
--   skin_types: '["kuru", "karma"]'
--   tags:       '["vegan", "parfümsüz"]'
-- ============================================================
