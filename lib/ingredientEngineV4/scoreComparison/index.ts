/**
 * scoreComparison/index.ts — ingredientEngineV4
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only comparison utility: shows live score input (V1/local-registry only)
 * side-by-side with the new V4 resolved score input (Supabase + local).
 *
 * PURPOSE — DEBUG / SHADOW MODE:
 *   Compare what the current engine "sees" vs what V4 would see, without
 *   changing any live behaviour. Use this before wiring up any live cutover.
 *
 * "OLD" DEFINITION (V1 / current live path):
 *   known   = matched by local V4 registry  (matchV4Ingredient.matched === true)
 *   unknown = not matched by local registry (would enter the unknown queue)
 *
 * "V4" DEFINITION (new resolved path):
 *   resolved = PATH 1 (Supabase enriched) + PATH 2 (local registry)
 *   unknown  = neither Supabase nor local registry can identify it
 *
 * WHAT "newly_resolved_by_v4" MEANS:
 *   Ingredients that are currently unknown in the live engine but are now
 *   resolved by V4 via Supabase (PATH 1). These are the net gains from
 *   the new ingredient library — candidates for live engine improvement.
 *
 * STRICT RULES:
 *   - Does NOT call or modify the live score calculation
 *   - Does NOT replace the current scoring path
 *   - Pure read: no writes to any table
 *   - Additive only — zero changes to existing files
 *
 * USAGE (shadow/debug only):
 *   import { compareScoreInputsV1vsV4 } from
 *     "@/lib/ingredientEngineV4/scoreComparison";
 *
 *   const diff = await compareScoreInputsV1vsV4({
 *     id:              product.id,
 *     name:            product.name,
 *     ingredientsList: product.ingredientsList,
 *   });
 */

import { matchV4Ingredient }                     from "@/lib/ingredientEngineV4/registry";
import { buildResolvedIngredientScoreInputV4 }   from "@/lib/ingredientEngineV4/scoreInputBuilder";
import type { ResolveOptions }                   from "@/lib/ingredientEngineV4/resolver";

// ── Input type ────────────────────────────────────────────────────────────────

export interface ComparisonProductInput {
  id:              string;
  name:            string;
  /** Parsed, tokenised ingredient list (one string per ingredient) */
  ingredientsList: string[];
  /** Optional extra context for Supabase queue tracking */
  brand?:          string;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface OldInputSummary {
  /** Total ingredients in the product */
  total_count:   number;
  /** Matched by local V4 registry (matchV4Ingredient.matched === true) */
  known_count:   number;
  /** Not matched by local registry (current engine "black holes") */
  unknown_count: number;
  /** Coverage fraction for the old path */
  coverage_ratio: number;
}

export interface V4InputSummary {
  total_count:    number;
  /** PATH 1 + PATH 2 combined */
  resolved_count: number;
  /** PATH 1: Supabase enriched library */
  supabase_count: number;
  /** PATH 2: local V4 registry */
  local_count:    number;
  /** PATH 3: still unresolved */
  unknown_count:  number;
  /** Coverage fraction for the V4 path */
  coverage_ratio: number;
}

export interface NewlyResolvedEntry {
  /** Raw ingredient string from the product label */
  raw_name:       string;
  /** Canonical name from Supabase (null if resolved locally) */
  canonical_name: string | null;
  /** Which path resolved it in V4 (always "supabase" for truly new entries) */
  source:         "supabase" | "local";
}

export interface ScoreComparisonResult {
  product_id:   string;
  product_name: string;

  /** What the current live engine sees */
  old_input_summary: OldInputSummary;
  /** What the new V4 resolved path sees */
  v4_input_summary:  V4InputSummary;

  /**
   * Ingredients that were UNKNOWN in the old engine but are now resolved
   * by V4 — these are the concrete gains from the new Supabase library.
   * Primarily consists of PATH 1 (Supabase) entries not in local registry.
   */
  newly_resolved_by_v4: NewlyResolvedEntry[];

  /** Ingredients still unresolved in BOTH old and new systems */
  still_unknown_in_v4:  string[];
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * compareScoreInputsV1vsV4
 *
 * For a given product, returns a side-by-side comparison of:
 *   - old_input_summary  — what the current live engine sees (local registry only)
 *   - v4_input_summary   — what the V4 resolved path sees (Supabase + local)
 *   - newly_resolved_by_v4 — net gain: ingredients the new library just unlocked
 *   - still_unknown_in_v4  — ingredients still missing from both systems
 *
 * Read-only. Does NOT change live score engine behaviour.
 *
 * @param product  Minimal product shape: id, name, ingredientsList
 * @param options  Optional Supabase queue context (productId, productName)
 */
export async function compareScoreInputsV1vsV4(
  product: ComparisonProductInput,
  options?: ResolveOptions
): Promise<ScoreComparisonResult> {

  const { id, name, ingredientsList } = product;
  const total = ingredientsList.length;

  const resolveOptions: ResolveOptions = {
    productId:   options?.productId   ?? id,
    productName: options?.productName ?? name,
  };

  // ── Step 1: Old system — local registry only ──────────────────────────────
  const localResults = ingredientsList.map((raw) => ({
    raw,
    match: matchV4Ingredient(raw),
  }));

  const oldKnown   = localResults.filter((r) => r.match.matched);
  const oldUnknown = localResults.filter((r) => !r.match.matched);

  const oldSummary: OldInputSummary = {
    total_count:    total,
    known_count:    oldKnown.length,
    unknown_count:  oldUnknown.length,
    coverage_ratio: total > 0 ? oldKnown.length / total : 0,
  };

  // ── Step 2: V4 resolved path — Supabase + local ────────────────────────────
  const v4Payload = await buildResolvedIngredientScoreInputV4(
    ingredientsList,
    resolveOptions
  );

  const v4Summary: V4InputSummary = {
    total_count:    v4Payload.total_count,
    resolved_count: v4Payload.resolved_count,
    supabase_count: v4Payload.supabase_count,
    local_count:    v4Payload.local_count,
    unknown_count:  v4Payload.unknown_count,
    coverage_ratio: v4Payload.coverage_ratio,
  };

  // ── Step 3: Compute delta — what V4 gains over old system ─────────────────
  // Build a lookup of V4 results by raw_name for O(1) access
  const v4ByRaw = new Map(
    v4Payload.resolved_ingredients.map((e) => [e.raw_name, e])
  );

  // "Newly resolved by V4" = ingredients that were OLD unknown but are now
  // resolved in V4 (source: "supabase" — these are the true net new additions)
  const newlyResolved: NewlyResolvedEntry[] = [];
  const stillUnknown:  string[]             = [];

  for (const { raw } of oldUnknown) {
    const v4Entry = v4ByRaw.get(raw);

    if (v4Entry && v4Entry.source !== "unknown") {
      newlyResolved.push({
        raw_name:       raw,
        canonical_name: v4Entry.canonical_name,
        source:         v4Entry.source as "supabase" | "local",
      });
    } else {
      stillUnknown.push(raw);
    }
  }

  return {
    product_id:           id,
    product_name:         name,
    old_input_summary:    oldSummary,
    v4_input_summary:     v4Summary,
    newly_resolved_by_v4: newlyResolved,
    still_unknown_in_v4:  stillUnknown,
  };
}
