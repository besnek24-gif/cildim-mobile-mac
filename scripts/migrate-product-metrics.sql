-- ────────────────────────────────────────────────────────────────────────────
-- migrate-product-metrics.sql
-- Ürün etkileşim metrikleri tablosu + atomik artırma RPC fonksiyonu
--
-- Supabase SQL Editörü'nde BİR KEZ çalıştırın.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. product_metrics tablosu
-- products tablosundan ayrı tutulur — temiz mimari, import pipeline etkilenmez.

CREATE TABLE IF NOT EXISTS product_metrics (
  product_id          TEXT        PRIMARY KEY,
  view_count          INTEGER     NOT NULL DEFAULT 0,
  compare_count       INTEGER     NOT NULL DEFAULT 0,
  compare_win_count   INTEGER     NOT NULL DEFAULT 0,
  similar_click_count INTEGER     NOT NULL DEFAULT 0,
  interest_score      NUMERIC(10, 4) NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  product_metrics               IS 'Ürün başına etkileşim sayaçları ve hesaplanmış ilgi skoru';
COMMENT ON COLUMN product_metrics.interest_score IS
  'view×0.5 + compare×1.0 + compare_win×3.0 + similar_click×1.5';

-- 2. Row Level Security

ALTER TABLE product_metrics ENABLE ROW LEVEL SECURITY;

-- Herkese okuma izni (trend, sıralama için)
DROP POLICY IF EXISTS "product_metrics_select" ON product_metrics;
CREATE POLICY "product_metrics_select" ON product_metrics
  FOR SELECT USING (true);

-- Upsert/update izni (anon RPC ile çağrılır)
DROP POLICY IF EXISTS "product_metrics_modify" ON product_metrics;
CREATE POLICY "product_metrics_modify" ON product_metrics
  FOR ALL USING (true);

-- 3. Atomik artırma + interest_score yeniden hesaplama RPC fonksiyonu
--
-- Desteklenen p_field değerleri:
--   'view'          → view_count          (ağırlık 0.5)
--   'compare'       → compare_count       (ağırlık 1.0)
--   'compare_win'   → compare_win_count   (ağırlık 3.0)
--   'similar_click' → similar_click_count (ağırlık 1.5)

CREATE OR REPLACE FUNCTION increment_product_metric(p_id TEXT, p_field TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Satır yoksa oluştur, varsa sadece last_interaction_at güncelle
  INSERT INTO product_metrics (product_id, last_interaction_at)
  VALUES (p_id, now())
  ON CONFLICT (product_id) DO UPDATE
    SET last_interaction_at = now();

  -- İlgili sayacı atomik olarak artır
  IF p_field = 'view' THEN
    UPDATE product_metrics
      SET view_count = view_count + 1
      WHERE product_id = p_id;

  ELSIF p_field = 'compare' THEN
    UPDATE product_metrics
      SET compare_count = compare_count + 1
      WHERE product_id = p_id;

  ELSIF p_field = 'compare_win' THEN
    UPDATE product_metrics
      SET compare_win_count = compare_win_count + 1
      WHERE product_id = p_id;

  ELSIF p_field = 'similar_click' THEN
    UPDATE product_metrics
      SET similar_click_count = similar_click_count + 1
      WHERE product_id = p_id;
  END IF;

  -- interest_score deterministik ağırlıklarla yeniden hesapla
  -- view×0.5 + compare×1.0 + compare_win×3.0 + similar_click×1.5
  UPDATE product_metrics
    SET interest_score = (
      view_count          * 0.5  +
      compare_count       * 1.0  +
      compare_win_count   * 3.0  +
      similar_click_count * 1.5
    )
    WHERE product_id = p_id;
END;
$$;
