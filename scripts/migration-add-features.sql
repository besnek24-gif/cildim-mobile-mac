-- ─── Ürün Özellik Listesi Kolonu ─────────────────────────────────────────────
-- featureBadges motoru bu kolondaki ham etiketleri anlamlı rozetlere dönüştürür.
--
-- Supabase SQL Editöründe bu sorguyu çalıştırın:
--   Supabase → SQL Editor → New Query → Yapıştır → Run
--
-- Mevcut kolonlar bozulmaz (IF NOT EXISTS / IF EXISTS).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS features text[];

COMMENT ON COLUMN products.features IS
  'Ham özellik listesi. featureBadges motoru bu değerleri anlamlı Türkçe rozetlere dönüştürür.
   Örnekler: ["Parabensiz","SPF 30","Hyalüronik Asit","Akne Karşıtı","Hassas Cilt"]
   Motor bu listeye ek olarak concerns, tags, active_ingredients ve boolean bayrakları da kullanır.';

-- İndeks: özellikle sorgularda hızlı erişim (GIN — dizi araması için ideal)
CREATE INDEX IF NOT EXISTS idx_products_features
  ON products USING GIN (features);

-- Doğrulama
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name = 'features';

-- ─── İsteğe bağlı: örnek güncelleme ──────────────────────────────────────────
-- Belirli bir ürüne el ile özellik eklemek için:
--
-- UPDATE products
--   SET features = ARRAY['Parabensiz', 'Hyalüronik Asit', 'Akne Karşıtı']
-- WHERE id = '<ürün-id>';
