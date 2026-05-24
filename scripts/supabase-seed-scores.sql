-- ============================================================
-- Mevcut ürünlere örnek dermo_score değerleri ekler.
-- Supabase → SQL Editor → New Query → Yapıştır → Run
-- NOT: dermo_score kolonu yoksa önce migration-add-dermo-score.sql çalıştırın.
-- ============================================================

UPDATE products SET dermo_score = 82, rating = 4.1 WHERE brand ILIKE '%cerave%';
UPDATE products SET dermo_score = 74, rating = 3.7 WHERE brand ILIKE '%zigavus%';
UPDATE products SET dermo_score = 68, rating = 3.4 WHERE brand ILIKE '%swiss bork%';
UPDATE products SET dermo_score = 88, rating = 4.4 WHERE brand ILIKE '%bioxcin%';
UPDATE products SET dermo_score = 76, rating = 3.8 WHERE brand ILIKE '%dermolife%';
UPDATE products SET dermo_score = 80, rating = 4.0 WHERE brand ILIKE '%dermoskin%';
UPDATE products SET dermo_score = 65, rating = 3.2 WHERE brand ILIKE '%agarta%';
UPDATE products SET dermo_score = 70, rating = 3.5 WHERE brand ILIKE '%dalin%';
UPDATE products SET dermo_score = 72, rating = 3.6 WHERE brand ILIKE '%uni baby%';
UPDATE products SET dermo_score = 85, rating = 4.2 WHERE brand ILIKE '%solante%';
UPDATE products SET dermo_score = 90, rating = 4.5 WHERE brand ILIKE '%la roche%';

-- Boş kalanları varsayılan değerle doldur
UPDATE products SET dermo_score = 70, rating = 3.5
WHERE dermo_score IS NULL;

-- Sonucu doğrula
SELECT brand, name, dermo_score, rating FROM products ORDER BY dermo_score DESC;
