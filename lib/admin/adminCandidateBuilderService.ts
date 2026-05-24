/**
 * adminCandidateBuilderService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ingredient Learning Pipeline — Phase 1 — CANDIDATE BUILDER
 *
 * PURPOSE:
 *   Pure TypeScript transform: converts CaptureAggregate[] (from the Capture
 *   Engine) into LearningCandidate[] ready for human review or DB persistence.
 *
 * POSITION IN PIPELINE:
 *   CaptureAggregate[]
 *     ──[buildAllCandidates]──▶ LearningCandidate[]
 *       ──[adminReviewQueueService.syncCandidates]──▶ ingredient_learning_candidates
 *
 * NO SUPABASE DEPENDENCY:
 *   This module is pure TypeScript — no Supabase imports.
 *   Safe to use in Node.js admin scripts without createLeanSupabase().
 *
 * STRICT RULES:
 *   - Does NOT call any external API (Phase 1 — evidence layer is placeholder)
 *   - Does NOT write to any table (caller decides whether to persist)
 *   - Does NOT auto-promote anything
 *   - Additive only — no existing file modified
 *
 * CONFIDENCE SCORE FORMULA (0.00–1.00):
 *   Base:                    0.50
 *   + seen_count >= 5:      +0.15
 *   + seen_count >= 10:     +0.15  (cumulative with above)
 *   + unique_products >= 2: +0.10
 *   - alias length < 3:     -0.40  (likely parsing artifact)
 *   - alias length < 5:     -0.20  (probably too short to be INCI)
 *   - suspicious chars:     -0.20  (digits, %, @, etc.)
 *   Clamped to [0.00, 1.00].
 *
 * PROMOTION STATUS:
 *   "capture_only":    confidence < 0.50  OR  seen_count < 3
 *   "review_ready":    confidence >= 0.50 AND seen_count >= 3
 *   "promotion_ready": confidence >= 0.75 AND seen_count >= 5 AND clean alias
 */

import type { CaptureAggregate } from "./adminLearningCaptureService";
import {
  bestCandidateName,
  cleanAliasesFromRawNames,
  type NormalizationTrace,
} from "./adminIngredientNormalizer";

// ── Evidence placeholder (Phase 1) ────────────────────────────────────────────

/**
 * Phase 1 evidence: placeholder structure only.
 * No external APIs are called. evidence_sources is always empty.
 * A future Phase 2 upgrade will populate this from INCI databases, PubChem, etc.
 */
export interface EvidencePlaceholder {
  /** Always "not_checked" in Phase 1 */
  evidence_status:  "not_checked" | "pending" | "reviewed";
  /** Always [] in Phase 1 — reserved for future external source results */
  evidence_sources: EvidenceSource[];
  /** Free-form notes from the admin reviewer */
  notes:            string;
}

/** Reserved type for future external evidence entries (Phase 2+). */
export interface EvidenceSource {
  source_name: string;       // e.g. "pubchem", "inci_decoder", "cosing"
  source_url:  string;
  found:       boolean;
  data:        Record<string, unknown>;
}

// ── Promotion status ──────────────────────────────────────────────────────────

export type PromotionStatus = "capture_only" | "review_ready" | "promotion_ready";

// ── Output type ───────────────────────────────────────────────────────────────

/**
 * LearningCandidate — fully built review candidate.
 * Matches the ingredient_learning_candidates table schema.
 */
export interface LearningCandidate {
  /** Normalized name from the unknown queue */
  normalized_name:          string;
  /** Best-guess canonical INCI name (admin should verify) */
  suggested_canonical_name: string;
  /**
   * Suggested alias forms: normalized variants that could also map
   * to the canonical name. Derived from sample_raw_names.
   */
  suggested_aliases:        string[];
  /** Total sightings across all products */
  total_seen_count:         number;
  /** Number of distinct products (Phase 1: always 1, see capture service note) */
  unique_product_count:     number;
  /** Most recent queue sighting */
  latest_seen_at:           string | null;
  /** Distinct raw strings seen for this ingredient (up to 5) */
  sample_raw_names:         string[];
  /** Products that triggered this unknown (up to 5) */
  sample_product_names:     string[];
  /**
   * Computed 0.00–1.00 confidence that this is a valid ingredient
   * and worth promoting. See file header for formula.
   */
  confidence_score:         number;
  /** Phase 1: always "not_checked" */
  evidence_status:          EvidencePlaceholder["evidence_status"];
  /** Phase 1: always [] */
  evidence_sources:         EvidenceSource[];
  /**
   * Review status for the admin workflow.
   * Derived from confidence_score and seen_count.
   */
  review_status:            PromotionStatus;
  /**
   * Promotion readiness flag.
   * NEVER auto-promoted — admin must explicitly approve.
   */
  promotion_status:         PromotionStatus;
  /** Free-form notes (empty until human reviewer adds) */
  notes:                    string;
  /** True if the alias string looks clean (INCI-safe characters only) */
  is_clean_alias:           boolean;
  /** True if flagged as a possible parsing artifact */
  needs_manual_review:      boolean;
  /**
   * Normalization trace: raw → cleaned → final.
   * Debug-only field. NOT persisted to ingredient_learning_candidates table.
   * syncCandidatesToSupabase explicitly omits this field.
   */
  _normTrace?:              NormalizationTrace;
}

// ── Confidence scoring ────────────────────────────────────────────────────────

/** Returns true if the string looks like a clean INCI alias. */
function isCleanAlias(name: string): boolean {
  if (name.length < 3) return false;
  // INCI names use letters, digits, spaces, hyphens, and parentheses only
  // Flag anything with: @, %, =, /, \, &, $, numbers at start, or long digit runs
  if (/[@%=\\/&$]/.test(name))     return false;
  if (/^\d/.test(name))             return false;   // starts with digit
  if (/\d{4,}/.test(name))          return false;   // long digit run (EAN/barcode artifact)
  return true;
}

/**
 * computeConfidenceScore
 *
 * Heuristic 0.00–1.00 score indicating how likely this unknown is to be a
 * real, promotable INCI ingredient (vs a parsing artifact or noise).
 */
export function computeConfidenceScore(agg: CaptureAggregate): number {
  const name = agg.normalized_name;
  let score  = 0.50;  // base

  // ── Frequency bonuses ────────────────────────────────────────────────────
  if (agg.total_seen_count >= 5)  score += 0.15;
  if (agg.total_seen_count >= 10) score += 0.15;   // cumulative (+0.30 total at 10+)

  // ── Multi-product bonus ─────────────────────────────────────────────────
  if (agg.unique_product_count >= 2) score += 0.10;

  // ── Length penalties (likely parsing artifact) ──────────────────────────
  if (name.length < 3) {
    score -= 0.40;   // 1–2 chars: almost certainly noise
  } else if (name.length < 5) {
    score -= 0.20;   // 3–4 chars: could be a real abbreviation, but doubtful
  }

  // ── Suspicious character penalty ────────────────────────────────────────
  if (!isCleanAlias(name)) score -= 0.20;

  // ── All-digits penalty ───────────────────────────────────────────────────
  if (/^\d+$/.test(name)) score -= 0.40;

  return Math.max(0.00, Math.min(1.00, Math.round(score * 100) / 100));
}

// ── Promotion status logic ────────────────────────────────────────────────────

/**
 * computePromotionStatus
 *
 * Computes the promotion readiness of a candidate.
 * NEVER triggers any actual promotion — this is a classification only.
 * A human admin must explicitly approve promotion.
 */
export function computePromotionStatus(
  normalizedName: string,
  seenCount:      number,
  confidence:     number,
): PromotionStatus {
  const clean = isCleanAlias(normalizedName);

  if (confidence >= 0.75 && seenCount >= 5 && clean) {
    return "promotion_ready";
  }
  if (confidence >= 0.50 && seenCount >= 3) {
    return "review_ready";
  }
  return "capture_only";
}

// ── Per-candidate builder ─────────────────────────────────────────────────────

/**
 * buildLearningCandidate
 *
 * Converts a single CaptureAggregate into a LearningCandidate.
 * Pure function — no side effects, no Supabase calls.
 *
 * Normalization strategy (via adminIngredientNormalizer):
 *   suggested_canonical_name: cleaned via bestCandidateName()
 *     PATH A (preferred): cleanRawNameForCandidate(sample_raw_names[0])
 *       → handles "/" → space (fixes "acrylatesvinyl" → "acrylates vinyl")
 *       → strips parens content (fixes "avene aqua" from "Avene (Aqua)")
 *       → deduplicates word sequences (fixes "oryza sativa starch")
 *     PATH B (fallback): collapseDuplicateWordSequences(normalized_name)
 *
 *   suggested_aliases: cleaned via cleanAliasesFromRawNames()
 *     Same cleaning applied to each raw variant (not the resolver's stripping)
 */
export function buildLearningCandidate(agg: CaptureAggregate): LearningCandidate {
  const confidence      = computeConfidenceScore(agg);
  const promotionStatus = computePromotionStatus(agg.normalized_name, agg.total_seen_count, confidence);

  // ── Normalizer-based canonical name selection ──────────────────────────────
  const { name: canonical, trace: normTrace } = bestCandidateName(
    agg.normalized_name,
    agg.sample_raw_names,
  );

  // ── Normalizer-based alias generation ─────────────────────────────────────
  const aliases = cleanAliasesFromRawNames(canonical, agg.sample_raw_names);

  const clean       = isCleanAlias(agg.normalized_name);
  const needsReview = !clean || agg.normalized_name.length < 4 || confidence < 0.30;

  return {
    normalized_name:          agg.normalized_name,
    suggested_canonical_name: canonical,
    suggested_aliases:        aliases,
    total_seen_count:         agg.total_seen_count,
    unique_product_count:     agg.unique_product_count,
    latest_seen_at:           agg.latest_seen_at ?? null,
    sample_raw_names:         agg.sample_raw_names,
    sample_product_names:     agg.sample_product_names,
    confidence_score:         confidence,
    evidence_status:          "not_checked",
    evidence_sources:         [],
    review_status:            promotionStatus,
    promotion_status:         promotionStatus,
    notes:                    "",
    is_clean_alias:           clean,
    needs_manual_review:      needsReview,
    _normTrace:               normTrace,
  };
}

// ── Batch builder ─────────────────────────────────────────────────────────────

/**
 * buildAllCandidates
 *
 * Converts all CaptureAggregates into LearningCandidates.
 * Output is sorted by: promotion_status (promotion_ready first), then
 * confidence DESC, then total_seen_count DESC.
 *
 * @param aggregates  Output of captureUnknownAggregates()
 */
export function buildAllCandidates(
  aggregates: CaptureAggregate[]
): LearningCandidate[] {
  const statusOrder: Record<PromotionStatus, number> = {
    promotion_ready: 0,
    review_ready:    1,
    capture_only:    2,
  };

  return aggregates
    .map(buildLearningCandidate)
    .sort((a, b) => {
      const statusDiff = statusOrder[a.promotion_status] - statusOrder[b.promotion_status];
      if (statusDiff !== 0) return statusDiff;
      const confDiff = b.confidence_score - a.confidence_score;
      if (Math.abs(confDiff) > 0.001) return confDiff > 0 ? 1 : -1;
      return b.total_seen_count - a.total_seen_count;
    });
}

// ── Batch stats ───────────────────────────────────────────────────────────────

export interface CandidateBatchStats {
  total_candidates:     number;
  promotion_ready:      number;
  review_ready:         number;
  capture_only:         number;
  needs_manual_review:  number;
  avg_confidence:       number;
  high_confidence:      number;  // confidence >= 0.75
}

/**
 * computeBatchStats
 *
 * Returns aggregate statistics for a batch of LearningCandidates.
 * Useful for printing summaries in debug scripts.
 */
export function computeBatchStats(candidates: LearningCandidate[]): CandidateBatchStats {
  if (candidates.length === 0) {
    return {
      total_candidates:    0, promotion_ready: 0, review_ready: 0,
      capture_only: 0, needs_manual_review: 0, avg_confidence: 0, high_confidence: 0,
    };
  }

  const total        = candidates.length;
  const promReady    = candidates.filter((c) => c.promotion_status === "promotion_ready").length;
  const revReady     = candidates.filter((c) => c.promotion_status === "review_ready").length;
  const capOnly      = candidates.filter((c) => c.promotion_status === "capture_only").length;
  const needsReview  = candidates.filter((c) => c.needs_manual_review).length;
  const highConf     = candidates.filter((c) => c.confidence_score >= 0.75).length;
  const avgConf      = candidates.reduce((s, c) => s + c.confidence_score, 0) / total;

  return {
    total_candidates:    total,
    promotion_ready:     promReady,
    review_ready:        revReady,
    capture_only:        capOnly,
    needs_manual_review: needsReview,
    avg_confidence:      Math.round(avgConf * 100) / 100,
    high_confidence:     highConf,
  };
}
