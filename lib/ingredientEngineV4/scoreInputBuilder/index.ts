/**
 * scoreInputBuilder/index.ts — ingredientEngineV4
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts a raw ingredient list into a fully resolved scoring payload,
 * ready to be consumed by a future V4 score engine.
 *
 * IMPORTANT — SHADOW MODE ONLY:
 *   This helper does NOT calculate a final score.
 *   It does NOT replace or modify the existing live scoring path.
 *   It is purely additive: call it alongside the current engine to compare
 *   resolved inputs before any cutover.
 *
 * RESOLUTION ORDER (via resolveIngredientV4):
 *   PATH 1 — Supabase ingredient_aliases + ingredients_master (enriched)
 *   PATH 2 — Local V4 registry matchV4Ingredient() (fallback)
 *   PATH 3 — Unknown (fire-and-forget queue, no score data)
 *
 * USAGE:
 *   import { buildResolvedIngredientScoreInputV4 } from
 *     "@/lib/ingredientEngineV4/scoreInputBuilder";
 *
 *   const payload = await buildResolvedIngredientScoreInputV4(
 *     product.ingredientsList,
 *     { productId: product.id, productName: product.name }
 *   );
 *   // → ResolvedScoreInputV4  (shadow payload for future engine)
 */

import {
  resolveIngredientV4,
  type ResolvedIngredientV4,
  type SupabaseResolvedIngredient,
  type LocalResolvedIngredient,
  type ResolveOptions,
} from "@/lib/ingredientEngineV4/resolver";

// ── Per-ingredient resolved entry ──────────────────────────────────────────────

export interface ResolvedIngredientEntry {
  /** Original string from the product label */
  raw_name:           string;
  /** Resolution path: "supabase" | "local" | "unknown" */
  source:             "supabase" | "local" | "unknown";
  /** Normalised canonical form (null for unknowns) */
  canonical_name:     string | null;
  /** Broad risk tier (null when unknown) */
  risk_level:         string | null;
  /** Concern flag tags (empty array when unknown) */
  concern_flags:      string[];
  /** Functional category tags (empty array when unknown) */
  function_tags:      string[];
  /** Pregnancy safety rating (null when not available) */
  pregnancy_flag:     string | null;
  /** Breastfeeding safety rating (null when not available) */
  breastfeeding_flag: string | null;
  /** Allergy risk rating (null when not available) */
  allergy_flag:       string | null;
}

// ── Score-ready summary ─────────────────────────────────────────────────────────

export interface ResolvedScoreInputV4 {
  /** Total number of raw ingredients passed in */
  total_count:          number;
  /** Ingredients successfully resolved (PATH 1 + PATH 2) */
  resolved_count:       number;
  /** PATH 1 hits (Supabase — enriched data) */
  supabase_count:       number;
  /** PATH 2 hits (local registry — basic data) */
  local_count:          number;
  /** PATH 3 (unresolved — no scoring data available) */
  unknown_count:        number;
  /** Coverage fraction 0.0–1.0 (resolved / total) */
  coverage_ratio:       number;
  /** Full resolved entry for every ingredient */
  resolved_ingredients: ResolvedIngredientEntry[];
  /** Subset of entries with source === "unknown" */
  unknown_ingredients:  ResolvedIngredientEntry[];
}

// ── Internal mapper ─────────────────────────────────────────────────────────────

function mapToEntry(raw: string, resolved: ResolvedIngredientV4): ResolvedIngredientEntry {
  if (resolved.source === "supabase") {
    const r = resolved as SupabaseResolvedIngredient;
    return {
      raw_name:           raw,
      source:             "supabase",
      canonical_name:     r.canonical_name,
      risk_level:         r.risk_level,
      concern_flags:      r.concern_flags,
      function_tags:      r.function_tags,
      pregnancy_flag:     r.pregnancy_flag,
      breastfeeding_flag: r.breastfeeding_flag,
      allergy_flag:       r.allergy_flag,
    };
  }

  if (resolved.source === "local") {
    const r = resolved as LocalResolvedIngredient;
    return {
      raw_name:           raw,
      source:             "local",
      canonical_name:     r.canonical_name,
      risk_level:         r.risk_level,
      concern_flags:      r.concern_flags,
      function_tags:      r.function_tags,
      pregnancy_flag:     r.pregnancy_flag,
      breastfeeding_flag: r.breastfeeding_flag,
      allergy_flag:       r.allergy_flag,
    };
  }

  // source === "unknown"
  return {
    raw_name:           raw,
    source:             "unknown",
    canonical_name:     null,
    risk_level:         null,
    concern_flags:      [],
    function_tags:      [],
    pregnancy_flag:     null,
    breastfeeding_flag: null,
    allergy_flag:       null,
  };
}

// ── Main export ─────────────────────────────────────────────────────────────────

/**
 * buildResolvedIngredientScoreInputV4
 *
 * Resolves every ingredient in the list via resolveIngredientV4 and returns
 * a structured payload ready for future V4 score engine consumption.
 *
 * SHADOW MODE: Does NOT calculate a score. Does NOT touch the live engine.
 * Safe to call alongside the current scoring pipeline for comparison.
 *
 * @param rawIngredients  Parsed ingredient token array (one string per ingredient)
 * @param options         Optional product context for Supabase queue tracking
 */
export async function buildResolvedIngredientScoreInputV4(
  rawIngredients: string[],
  options: ResolveOptions = {}
): Promise<ResolvedScoreInputV4> {

  // Resolve all ingredients in parallel for speed
  const resolved = await Promise.all(
    rawIngredients.map((raw) =>
      resolveIngredientV4(raw, options).then((r) => mapToEntry(raw, r))
    )
  );

  const supabaseCount = resolved.filter((e) => e.source === "supabase").length;
  const localCount    = resolved.filter((e) => e.source === "local").length;
  const unknownCount  = resolved.filter((e) => e.source === "unknown").length;
  const resolvedCount = supabaseCount + localCount;
  const total         = rawIngredients.length;

  return {
    total_count:          total,
    resolved_count:       resolvedCount,
    supabase_count:       supabaseCount,
    local_count:          localCount,
    unknown_count:        unknownCount,
    coverage_ratio:       total > 0 ? resolvedCount / total : 0,
    resolved_ingredients: resolved,
    unknown_ingredients:  resolved.filter((e) => e.source === "unknown"),
  };
}
