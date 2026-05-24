-- ─────────────────────────────────────────────────────────────────────────────
-- migration-learning-pipeline.sql
-- Ingredient Learning Pipeline — Phase 1
-- ─────────────────────────────────────────────────────────────────────────────
--
-- PURPOSE:
--   Additive admin-only table for passive ingredient learning.
--   Stores review candidates derived from ingredient_unknown_queue aggregates.
--   Does NOT alter any existing production tables.
--
-- DEPENDS ON:
--   ingredient_unknown_queue (already exists — managed by resolveIngredientV4)
--
-- SAFE TO RUN:
--   Uses IF NOT EXISTS throughout. Idempotent.
--
-- RULES:
--   - No existing table is altered
--   - No production data is affected
--   - This table is read/written by admin services only
--   - Live scoring and resolver are completely unaffected
--
-- APPLY TO SUPABASE:
--   Paste into Supabase SQL Editor and run.
--   Or use: supabase db push (if using local CLI)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Main learning candidates table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingredient_learning_candidates (
  -- Primary key
  id                       uuid            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identity — must match ingredient_unknown_queue.normalized_name
  normalized_name          text            NOT NULL,

  -- Suggested resolution fields (admin verifies before promotion)
  suggested_canonical_name text            NOT NULL,
  suggested_aliases        jsonb           NOT NULL DEFAULT '[]'::jsonb,

  -- Frequency metrics captured from ingredient_unknown_queue
  total_seen_count         integer         NOT NULL DEFAULT 0,
  unique_product_count     integer         NOT NULL DEFAULT 0,
  latest_seen_at           timestamptz     NULL,

  -- Sample data for human review
  sample_raw_names         jsonb           NOT NULL DEFAULT '[]'::jsonb,
  sample_product_names     jsonb           NOT NULL DEFAULT '[]'::jsonb,

  -- Confidence scoring (0.00–1.00, computed by candidate builder)
  confidence_score         numeric(4, 2)   NOT NULL DEFAULT 0.00,

  -- Evidence placeholder (Phase 1: static, no external API calls yet)
  -- evidence_status: "not_checked" | "pending" | "reviewed"
  evidence_status          text            NOT NULL DEFAULT 'not_checked',
  evidence_sources         jsonb           NOT NULL DEFAULT '[]'::jsonb,

  -- Review workflow
  -- review_status: "capture_only" | "review_ready" | "promotion_ready"
  review_status            text            NOT NULL DEFAULT 'capture_only',

  -- Promotion workflow (controlled, never auto-promoted)
  -- promotion_status: "capture_only" | "review_ready" | "promotion_ready"
  promotion_status         text            NOT NULL DEFAULT 'capture_only',

  -- Free-form admin notes
  notes                    text            NOT NULL DEFAULT '',

  -- Timestamps
  created_at               timestamptz     NOT NULL DEFAULT now(),
  updated_at               timestamptz     NOT NULL DEFAULT now()
);

-- ── Unique constraint on normalized_name (one candidate per ingredient) ───────

ALTER TABLE ingredient_learning_candidates
  DROP CONSTRAINT IF EXISTS uq_ilc_normalized_name;

ALTER TABLE ingredient_learning_candidates
  ADD CONSTRAINT uq_ilc_normalized_name UNIQUE (normalized_name);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ilc_total_seen_count
  ON ingredient_learning_candidates (total_seen_count DESC);

CREATE INDEX IF NOT EXISTS idx_ilc_promotion_status
  ON ingredient_learning_candidates (promotion_status);

CREATE INDEX IF NOT EXISTS idx_ilc_review_status
  ON ingredient_learning_candidates (review_status);

CREATE INDEX IF NOT EXISTS idx_ilc_confidence_score
  ON ingredient_learning_candidates (confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_ilc_updated_at
  ON ingredient_learning_candidates (updated_at DESC);

-- ── Check constraints (guard enum-like text fields) ───────────────────────────

ALTER TABLE ingredient_learning_candidates
  DROP CONSTRAINT IF EXISTS chk_ilc_evidence_status;

ALTER TABLE ingredient_learning_candidates
  ADD CONSTRAINT chk_ilc_evidence_status
  CHECK (evidence_status IN ('not_checked', 'pending', 'reviewed'));

ALTER TABLE ingredient_learning_candidates
  DROP CONSTRAINT IF EXISTS chk_ilc_review_status;

ALTER TABLE ingredient_learning_candidates
  ADD CONSTRAINT chk_ilc_review_status
  CHECK (review_status IN ('capture_only', 'review_ready', 'promotion_ready'));

ALTER TABLE ingredient_learning_candidates
  DROP CONSTRAINT IF EXISTS chk_ilc_promotion_status;

ALTER TABLE ingredient_learning_candidates
  ADD CONSTRAINT chk_ilc_promotion_status
  CHECK (promotion_status IN ('capture_only', 'review_ready', 'promotion_ready'));

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_ilc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ilc_updated_at ON ingredient_learning_candidates;

CREATE TRIGGER trg_ilc_updated_at
  BEFORE UPDATE ON ingredient_learning_candidates
  FOR EACH ROW EXECUTE FUNCTION set_ilc_updated_at();

-- ── Table comment ─────────────────────────────────────────────────────────────

COMMENT ON TABLE ingredient_learning_candidates IS
  'Ingredient Learning Pipeline Phase 1 — admin-only review candidates built '
  'from ingredient_unknown_queue aggregates. Never auto-promoted. '
  'Safe to truncate/rebuild at any time.';

COMMENT ON COLUMN ingredient_learning_candidates.confidence_score IS
  'Computed 0.00–1.00. Formula: base 0.50 + frequency bonus + alias cleanliness. '
  'Does NOT reflect external evidence (Phase 1 only).';

COMMENT ON COLUMN ingredient_learning_candidates.promotion_status IS
  'capture_only: needs more data. '
  'review_ready: meets frequency threshold, ready for admin review. '
  'promotion_ready: high confidence + frequency, cleared for Supabase library promotion.';
