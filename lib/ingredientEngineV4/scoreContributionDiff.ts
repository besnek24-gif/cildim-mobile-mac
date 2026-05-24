/**
 * scoreContributionDiff.ts — ingredientEngineV4
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only debug helper: compares legacy vs V4 score input at the
 * per-ingredient contribution level — not just final score totals.
 *
 * PURPOSE:
 *   Reveal whether identical final scores are expected or hiding a mapping bug.
 *   A V4 upgrade that only changes INPUT SOURCE (not the formula) may produce
 *   the same or different final scores depending on how many ingredients are
 *   newly resolved and what risk_level data is available in Supabase.
 *
 * USAGE (Expo / React Native — async, reads Supabase):
 *   import { compareScoreContributionsLegacyVsV4 } from
 *     "@/lib/ingredientEngineV4/scoreContributionDiff";
 *
 *   const diff = await compareScoreContributionsLegacyVsV4(
 *     product.rawText,
 *     product.ingredientsList,   // pre-tokenised array
 *     { productId: product.id, productName: product.name }
 *   );
 *   console.log(JSON.stringify(diff, null, 2));
 *
 * FOR NODE.JS ADMIN SCRIPTS: use debugScoreContributionDiff.ts instead.
 *   This file imports buildResolvedIngredientScoreInputV4, which transitively
 *   uses the Expo Supabase client and is not node-safe.
 *
 * STRICT RULES:
 *   - Read/debug only — no writes to any table
 *   - Does NOT change the live score formula (scoreEngine.ts unchanged)
 *   - Does NOT change resolver behavior
 *   - Does NOT run automatically
 *   - Additive only — zero changes to existing files
 */

import { analyzeProduct }                       from "@/lib/ingredientIntelligence/analyzeProduct";
import { calculateIngredientScore }             from "@/lib/ingredientIntelligence/scoreEngine";
import { buildResolvedIngredientScoreInputV4 }  from "@/lib/ingredientEngineV4/scoreInputBuilder";
import { adaptV4InputToIntelligenceResult }     from "@/lib/ingredientEngineV4/scoreInputAdapter";
import type { AnalyzedItem }                    from "@/lib/ingredientIntelligence/analyzeProduct";
import type { RiskBucket, DecisionSource }      from "@/lib/ingredientIntelligence/riskEngine";
import type { ResolveOptions }                  from "@/lib/ingredientEngineV4/resolver";

// ── Output types ──────────────────────────────────────────────────────────────

/**
 * Per-ingredient diff entry — only populated for ingredients where something
 * changed between legacy and V4.
 */
export interface IngredientMappingDiff {
  /** Raw string from the product label */
  raw_name:        string;
  /** Bucket assigned by the legacy local-registry path */
  legacy_bucket:   RiskBucket;
  /** Bucket assigned by the V4-adapted path */
  v4_bucket:       RiskBucket;
  /** Flags in legacy (concern flags from local registry) */
  legacy_flags:    string[];
  /** Flags in V4 (concern_flags from Supabase or local registry) */
  v4_flags:        string[];
  /** Category in legacy (from local registry) */
  legacy_category: string | null;
  /** Category in V4 (first function_tag from Supabase or local registry) */
  v4_category:     string | null;
  /** How V4 decided this ingredient's risk (from adapter decision_source) */
  decision_source: DecisionSource;
  /** Which resolution path V4 used: supabase | local | unknown */
  v4_source:       string;
}

/**
 * Aggregated per-path summary (mirrors IngredientIntelligenceSummary
 * but with explicit safe/unknown counts and flags/categories lists).
 */
export interface ScoreContributionSummary {
  total_ingredients:  number;
  safe_count:         number;
  low_risk_count:     number;
  medium_risk_count:  number;
  high_risk_count:    number;
  unknown_count:      number;
  /** Resolved / total (0–100 %) */
  coverage_pct:       number;
  /** Sorted, deduplicated list of all flag tags across all items */
  flags:              string[];
  /** Sorted, deduplicated list of all category values across all items */
  categories:         string[];
}

/**
 * Full comparison result: both paths side by side + diff list.
 */
export interface ScoreContributionDiffResult {
  /** 0–100 score from legacy path */
  final_score_legacy: number;
  /** 0–100 score from V4-adapted path */
  final_score_v4:     number;
  /** True if both paths produce the same final integer score */
  same_final_score:   boolean;

  /** Aggregated summary for the legacy path */
  legacy_summary: ScoreContributionSummary;
  /** Aggregated summary for the V4-adapted path */
  v4_summary:     ScoreContributionSummary;

  /**
   * Ingredients where bucket, flags, or category differ between paths.
   * Empty array = all mappings are identical (may be expected or a bug — see adapter_warning).
   */
  ingredients_with_different_mapping: IngredientMappingDiff[];

  /**
   * Optional warning when the adapter may not be doing useful work.
   * Set when Supabase-resolved ingredients still map to "unknown" bucket,
   * indicating that risk_level is null/unpopulated in ingredients_master.
   *
   * Example:
   *   "3 Supabase-resolved ingredients still map to 'unknown' bucket.
   *    Check risk_level population in ingredients_master for: Aqua, Glycerin, ..."
   */
  adapter_warning?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildSummary(items: AnalyzedItem[]): ScoreContributionSummary {
  const total = items.length;
  let safe = 0, low = 0, med = 0, high = 0, unknown = 0, matched = 0;

  const allFlags:      Set<string> = new Set();
  const allCategories: Set<string> = new Set();

  for (const item of items) {
    if (item.matched) matched++;
    switch (item.bucket) {
      case "safe":        safe++;    break;
      case "low_risk":    low++;     break;
      case "medium_risk": med++;     break;
      case "high_risk":   high++;    break;
      default:            unknown++; break;
    }
    for (const f of item.flags)      allFlags.add(f);
    if (item.category)               allCategories.add(item.category);
  }

  return {
    total_ingredients: total,
    safe_count:         safe,
    low_risk_count:     low,
    medium_risk_count:  med,
    high_risk_count:    high,
    unknown_count:      unknown,
    coverage_pct:       total > 0 ? Math.round((matched / total) * 100) : 0,
    flags:              [...allFlags].sort(),
    categories:         [...allCategories].sort(),
  };
}

function bucketsDiffer(a: RiskBucket, b: RiskBucket): boolean {
  return a !== b;
}

function flagsDiffer(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  const sa = [...a].sort().join(",");
  const sb = [...b].sort().join(",");
  return sa !== sb;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * compareScoreContributionsLegacyVsV4
 *
 * Runs both the legacy pipeline and the V4 adapter pipeline for the same
 * product, then produces a side-by-side diff at the ingredient level.
 *
 * Use this to detect:
 *   1. Whether final score changes are real or coincidental
 *   2. Whether the adapter is correctly mapping Supabase data
 *   3. Which specific ingredients are responsible for score differences
 *   4. Whether Supabase risk_level data is populated (adapter_warning)
 *
 * NOTE: This function is async because the V4 path calls Supabase.
 *       For Node.js admin scripts, use debugScoreContributionDiff.ts instead.
 *
 * @param rawText         Raw INCI string (for legacy path tokenisation)
 * @param rawIngredients  Pre-tokenised ingredient array (for V4 path)
 * @param options         Optional product context (suppresses PATH 3 queue writes)
 */
export async function compareScoreContributionsLegacyVsV4(
  rawText:        string,
  rawIngredients: string[],
  options:        ResolveOptions = {}
): Promise<ScoreContributionDiffResult> {

  // ── Legacy path ────────────────────────────────────────────────────────────
  const legacyAnalysis = analyzeProduct(rawText, options.productId ?? "unknown");
  const legacyScore    = calculateIngredientScore(legacyAnalysis);

  // ── V4 path ────────────────────────────────────────────────────────────────
  const v4Input    = await buildResolvedIngredientScoreInputV4(rawIngredients, options);
  const v4Analysis = adaptV4InputToIntelligenceResult(v4Input, rawText);
  const v4Score    = calculateIngredientScore(v4Analysis);

  // ── Build per-ingredient lookup maps ──────────────────────────────────────
  // Both paths use the original raw string as the key.
  // Legacy: item.raw | V4 adapted: item.raw (set from e.raw_name in adapter)
  const legacyByRaw = new Map<string, AnalyzedItem>(
    legacyAnalysis.items.map((i) => [i.raw, i])
  );
  const v4ByRaw = new Map<string, AnalyzedItem>(
    v4Analysis.items.map((i) => [i.raw, i])
  );

  // Build a V4 source lookup from the raw resolution payload (before adaptation)
  const v4SourceByRaw = new Map<string, string>(
    v4Input.resolved_ingredients.map((e) => [e.raw_name, e.source])
  );

  // ── Compute diff ───────────────────────────────────────────────────────────
  const diffs: IngredientMappingDiff[] = [];

  // Use rawIngredients as the authoritative token list for the diff
  // (matches V4 path; legacy path may tokenise slightly differently but
  //  we want one canonical loop)
  for (const raw of rawIngredients) {
    const legacy = legacyByRaw.get(raw);
    const v4     = v4ByRaw.get(raw);

    // If either path is missing this token, skip (edge case: tokenisation mismatch)
    if (!legacy || !v4) continue;

    const bucketDiff   = bucketsDiffer(legacy.bucket, v4.bucket);
    const flagDiff     = flagsDiffer(legacy.flags, v4.flags);
    const categoryDiff = legacy.category !== v4.category;

    if (bucketDiff || flagDiff || categoryDiff) {
      diffs.push({
        raw_name:        raw,
        legacy_bucket:   legacy.bucket,
        v4_bucket:       v4.bucket,
        legacy_flags:    legacy.flags,
        v4_flags:        v4.flags,
        legacy_category: legacy.category,
        v4_category:     v4.category,
        decision_source: v4.decision_source,
        v4_source:       v4SourceByRaw.get(raw) ?? "unknown",
      });
    }
  }

  // ── Adapter warning ────────────────────────────────────────────────────────
  // Flag: Supabase-resolved entries that still map to "unknown" bucket.
  // This indicates risk_level is NULL in ingredients_master — the adapter
  // cannot improve on legacy if the data isn't there.
  const supabaseStillUnknown = v4Input.resolved_ingredients.filter(
    (e) => e.source === "supabase" && e.risk_level === null
  );

  let adapter_warning: string | undefined;

  if (supabaseStillUnknown.length > 0) {
    const names = supabaseStillUnknown
      .map((e) => e.canonical_name ?? e.raw_name)
      .slice(0, 5)
      .join(", ");
    const more = supabaseStillUnknown.length > 5
      ? ` … +${supabaseStillUnknown.length - 5} more`
      : "";
    adapter_warning =
      `${supabaseStillUnknown.length} Supabase-resolved ingredient(s) still map to ` +
      `'unknown' bucket because risk_level is NULL in ingredients_master. ` +
      `Check: ${names}${more}`;
  }

  return {
    final_score_legacy: legacyScore.score_0_100,
    final_score_v4:     v4Score.score_0_100,
    same_final_score:   legacyScore.score_0_100 === v4Score.score_0_100,
    legacy_summary:     buildSummary(legacyAnalysis.items),
    v4_summary:         buildSummary(v4Analysis.items),
    ingredients_with_different_mapping: diffs,
    adapter_warning,
  };
}
