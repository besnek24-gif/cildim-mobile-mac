-- ─── Dermatolojik Puan Kolonları ─────────────────────────────────────────────
-- Supabase SQL Editöründe bu sorguyu çalıştırın:
--   Supabase → SQL Editor → New Query → Yapıştır → Run

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS dermo_score  integer,
  ADD COLUMN IF NOT EXISTS dermo_label  text;

COMMENT ON COLUMN products.dermo_score IS
  'Dermatolojik güvenlik puanı (0–100). EWG/CIR/ECHA kaynaklı. NULL = henüz hesaplanmamış.';
COMMENT ON COLUMN products.dermo_label IS
  'Puan etiketi: Mükemmel | İyi | Orta | Dikkatli | Riskli | Kaçınılmalı';

-- İndeks: puansız ürünleri hızlı bulmak için
CREATE INDEX IF NOT EXISTS idx_products_dermo_score
  ON products (dermo_score);

-- Doğrulama
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('dermo_score', 'dermo_label')
ORDER BY column_name;
