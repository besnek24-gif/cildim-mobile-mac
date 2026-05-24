-- ─── Toplu Import Sistemi — Yeni Kolonlar ────────────────────────────────────
-- Bu migration import scriptinin desteklediği tüm yeni kolonları ekler.
--
-- Supabase SQL Editöründe çalıştırın:
--   Supabase Dashboard → SQL Editor → New Query → Yapıştır → Run
--
-- Tüm ifadeler IF NOT EXISTS / DEFAULT ile güvenlidir — mevcut veri bozulmaz.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. segment: ürün fiyat/pazar segmenti
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS segment text;

COMMENT ON COLUMN products.segment IS
  'Ürün segmenti. Önerilen değerler: "ekonomik" | "orta" | "profesyonel" | "lüks"';


-- 2. active_ingredients: badge engine + arama için aktif bileşen listesi
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS active_ingredients text[];

COMMENT ON COLUMN products.active_ingredients IS
  'Ürünün aktif bileşen listesi (badge engine ve arama için kullanılır).
   Örnek: ["niacinamide", "hyaluronic acid", "ceramide"]';

CREATE INDEX IF NOT EXISTS idx_products_active_ingredients
  ON products USING GIN (active_ingredients);


-- 2. concerns: badge engine input — hedef cilt sorunları
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS concerns text[];

COMMENT ON COLUMN products.concerns IS
  'Ürünün hedef aldığı cilt sorunları listesi (badge engine input).
   Örnek: ["leke", "kuru cilt", "kırışık", "akne"]';

CREATE INDEX IF NOT EXISTS idx_products_concerns
  ON products USING GIN (concerns);


-- 3. badges_manual: true → badges[] alanı manuel olarak girilmiş, import override etmez
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS badges_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN products.badges_manual IS
  'true ise badges[] alanı editoryal olarak kilitlenmiştir.
   Import sistemi badges_manual=true olan ürünlerde badges[] alanını override ETMEZ.
   Varsayılan: false (engine otomatik türetir).';


-- 4. editor_tags: editör/admin etiketleri — badge sisteminden bağımsız, UI filtreleme için
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS editor_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN products.editor_tags IS
  'Editör/admin tarafından atanan etiketler. Badge engine tarafından kullanılmaz.
   UI filtreleme, kuratoryal sıralama ve içerik yönetimi için.
   Örnek: ["öne-çıkan", "editör-seçimi", "yeni-gelen", "sezon-favorisi"]';

CREATE INDEX IF NOT EXISTS idx_products_editor_tags
  ON products USING GIN (editor_tags);


-- ─── Doğrulama ────────────────────────────────────────────────────────────────

SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN (
    'segment',
    'active_ingredients',
    'concerns',
    'badges_manual',
    'editor_tags',
    'features',
    'badges'
  )
ORDER BY column_name;

-- ─── Beklenen çıktı ───────────────────────────────────────────────────────────
-- column_name          | data_type | column_default | is_nullable
-- active_ingredients   | ARRAY     | null           | YES
-- badges               | ARRAY     | null           | YES
-- badges_manual        | boolean   | false          | NO
-- concerns             | ARRAY     | null           | YES
-- editor_tags          | ARRAY     | '{}'::text[]   | NO
-- features             | ARRAY     | null           | YES
-- segment              | text      | null           | YES
