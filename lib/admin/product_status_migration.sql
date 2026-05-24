-- product_status tablosu
-- Supabase Dashboard → SQL Editor'a yapıştırıp çalıştırın.
-- Bu script güvenli: IF NOT EXISTS kullanır, mevcut veriyi etkilemez.

CREATE TABLE IF NOT EXISTS product_status (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status      text        NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT  product_status_product_id_unique UNIQUE (product_id)
);

-- Index: product_id lookups için
CREATE INDEX IF NOT EXISTS idx_product_status_product_id
  ON product_status (product_id);

-- RLS: sadece authenticated kullanıcılar okuyabilir, sadece service_role yazabilir
-- (İsteğe bağlı — admin paneli anon key ile yazıyorsa RLS'yi devre dışı bırakın)
-- ALTER TABLE product_status ENABLE ROW LEVEL SECURITY;
