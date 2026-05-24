/**
 * scoreInputAdapter.ts — ingredientEngineV4
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts a `ResolvedScoreInputV4` payload (from buildResolvedIngredientScoreInputV4)
 * into the `IngredientIntelligenceResult` shape that `calculateIngredientScore`
 * expects — making V4 resolved input drop-in compatible with the existing score
 * formula without any changes to scoreEngine.ts.
 *
 * WHY AN ADAPTER (not a rewrite):
 *   `calculateIngredientScore` already works correctly and is battle-tested.
 *   The only thing changing is the INPUT SOURCE (richer Supabase data vs local
 *   registry only). The formula, penalty weights, confidence thresholds, and
 *   warning logic remain 100% unchanged.
 *
 * MAPPING STRATEGY:
 *   V4 risk_level   → IngredientIntelligence bucket
 *   ─────────────────────────────────────────────────
 *   "low"           → "low_risk"   (conservative — V4 has no "safe" bucket)
 *   "medium"        → "medium_risk"
 *   "high"          → "high_risk"
 *   "unknown" / null → "unknown"
 *
 *   V4 concern_flags → AnalyzedItem.flags
 *   V4 function_tags → AnalyzedItem.category (first tag, or null)
 *   V4 source        → AnalyzedItem.match_tier + matched + decision_source
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT change scoreEngine.ts or its formula
 *   - Does NOT activate in production (controlled by USE_V4_SCORE_INPUT flag)
 *   - Does NOT write to any table
 *   - Does NOT call Supabase directly (input is already resolved)
 */

import type { ResolvedScoreInputV4, ResolvedIngredientEntry }
  from "@/lib/ingredientEngineV4/scoreInputBuilder";
import type {
  IngredientIntelligenceResult,
  AnalyzedItem,
  IngredientIntelligenceSummary,
} from "@/lib/ingredientIntelligence/analyzeProduct";
import type { RiskLevel, RiskBucket, DecisionSource }
  from "@/lib/ingredientIntelligence/riskEngine";

// ── Risk mapping ──────────────────────────────────────────────────────────────

function mapRiskLevel(rl: string | null): RiskLevel {
  switch (rl) {
    case "low":    return "low";
    case "medium": return "medium";
    case "high":   return "high";
    default:       return "unknown";
  }
}

function mapBucket(rl: string | null): RiskBucket {
  switch (rl) {
    case "low":    return "low_risk";
    case "medium": return "medium_risk";
    case "high":   return "high_risk";
    default:       return "unknown";
  }
}

function mapDecisionSource(source: "supabase" | "local" | "unknown"): DecisionSource {
  switch (source) {
    case "supabase": return "canonical_override";  // Supabase data = most authoritative
    case "local":    return "category_policy";     // local registry = category-based policy
    default:         return "fallback_unknown";
  }
}

// ── Per-entry adapter ─────────────────────────────────────────────────────────

function adaptEntry(e: ResolvedIngredientEntry): AnalyzedItem {
  return {
    raw:             e.raw_name,
    normalized:      e.raw_name.toLowerCase().trim(),
    canonical_name:  e.canonical_name,
    // Use first function_tag as category (closest semantic equivalent)
    category:        e.function_tags.length > 0 ? e.function_tags[0] : null,
    // concern_flags maps directly to flags (both use the same tag conventions)
    flags:           e.concern_flags,
    matched:         e.source !== "unknown",
    match_tier:      e.source,   // "supabase" | "local" | "unknown"
    risk_level:      mapRiskLevel(e.risk_level),
    bucket:          mapBucket(e.risk_level),
    reasons:         e.risk_level ? [`v4_risk_level:${e.risk_level}`] : ["v4_unresolved"],
    decision_source: mapDecisionSource(e.source),
  };
}

// ── Summary builder ───────────────────────────────────────────────────────────

function buildSummary(items: AnalyzedItem[]): IngredientIntelligenceSummary {
  const total    = items.length;
  const matched  = items.filter((i) => i.matched).length;
  const buckets  = { safe: 0, low_risk: 0, medium_risk: 0, high_risk: 0, unknown: 0 };

  for (const item of items) {
    const b = item.bucket as keyof typeof buckets;
    if (b in buckets) buckets[b]++;
    else              buckets.unknown++;
  }

  return {
    total,
    ...buckets,
    coverage_pct: total > 0 ? Math.round((matched / total) * 100) : 0,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * adaptV4InputToIntelligenceResult
 *
 * Converts a `ResolvedScoreInputV4` (from buildResolvedIngredientScoreInputV4)
 * into an `IngredientIntelligenceResult` that `calculateIngredientScore` can
 * consume unchanged.
 *
 * The resulting object has `version: "ingredient_intelligence_v1"` so downstream
 * consumers that check the version field continue to work without modification.
 *
 * @param v4Input   V4 resolved payload from buildResolvedIngredientScoreInputV4
 * @param rawText   Original raw INCI string (used for result.raw_text field)
 */
export function adaptV4InputToIntelligenceResult(
  v4Input: ResolvedScoreInputV4,
  rawText: string
): IngredientIntelligenceResult {
  const items   = v4Input.resolved_ingredients.map(adaptEntry);
  const summary = buildSummary(items);

  return {
    version:  "ingredient_intelligence_v1",   // keeps downstream consumers compatible
    raw_text: rawText,
    tokens:   v4Input.resolved_ingredients.map((e) => e.raw_name),
    items,
    summary,
  };
}

// ── V4 metadata type (for debug logging in the gate) ─────────────────────────

export interface V4InputMeta {
  total_count:    number;
  supabase_count: number;
  local_count:    number;
  unknown_count:  number;
  coverage_ratio: number;
}

export function extractV4Meta(v4Input: ResolvedScoreInputV4): V4InputMeta {
  return {
    total_count:    v4Input.total_count,
    supabase_count: v4Input.supabase_count,
    local_count:    v4Input.local_count,
    unknown_count:  v4Input.unknown_count,
    coverage_ratio: v4Input.coverage_ratio,
  };
}
