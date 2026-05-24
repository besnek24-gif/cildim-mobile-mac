/**
 * resolver/index.ts — ingredientEngineV4
 *
 * Safe, additive ingredient resolver.
 * ZERO modifications to existing local registry or analyzer logic.
 *
 * Resolution priority:
 *   1. Supabase ingredient_aliases + ingredients_master  (primary)
 *   2. Local V4 registry matchV4Ingredient()             (fallback)
 *   3. ingredient_unknown_queue insert + "unknown" result (unresolved)
 *
 * Usage:
 *   import { resolveIngredientV4 } from "@/lib/ingredientEngineV4/resolver";
 *   const result = await resolveIngredientV4("Niacinamide");
 *
 * DO NOT use this function inside the synchronous V4 analysis pipeline.
 * This resolver is async (Supabase I/O) and intended for:
 *   - Pre-fetching enrichment data
 *   - Admin tools / unknown queue population
 *   - Future async analysis layer (v5+)
 *
 * The existing analyzeProductV4() / matchV4Ingredient() are untouched.
 */

import { supabase }                      from "../../supabaseClient";
import { matchV4Ingredient }             from "../registry";
import type { V4MatchResult }            from "../registry/types";
import { buildParentheticalCandidates }  from "./parentheticalPreProcessor";

// ── Result types ──────────────────────────────────────────────────────────────

/** Full result when found in Supabase ingredients_master */
export interface SupabaseResolvedIngredient {
  source:             "supabase";
  canonical_name:     string;
  display_name:       string;
  risk_level:         string | null;
  concern_flags:      string[];
  function_tags:      string[];
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
  evidence_score:     number | null;
}

/** Result when found only in the local V4 registry */
export interface LocalResolvedIngredient {
  source:             "local";
  canonical_name:     string | null;
  risk_level:         string | null;
  concern_flags:      string[];   // mapped from V4MatchResult.flags
  function_tags:      string[];   // derived from category
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
  matched:            boolean;
  match_tier:         V4MatchResult["match_tier"];
  confidence:         string | null;
}

/** Result when ingredient is unknown in both Supabase and local registry */
export interface UnknownResolvedIngredient {
  source:     "unknown";
  raw:        string;
  normalized: string;
}

export type ResolvedIngredientV4 =
  | SupabaseResolvedIngredient
  | LocalResolvedIngredient
  | UnknownResolvedIngredient;

// ── Resolution options ─────────────────────────────────────────────────────────

export interface ResolveOptions {
  /** UUID of the product this ingredient comes from (for queue tracking) */
  productId?:   string;
  /** Display name of the source product (for queue tracking) */
  productName?: string;
}

// ── Normalizer ────────────────────────────────────────────────────────────────
//
// Lightweight text normalizer for Supabase column lookup.
// Produces the same output as the ingredient_aliases.normalized_alias column.
//
// Steps:
//   1. Lowercase
//   2. Trim leading/trailing whitespace
//   3. Remove special characters (keep a-z, 0-9, space, hyphen)
//   4. Collapse multiple spaces to single space
//   5. Final trim

export function normalizeForSupabaseLookup(raw: string): string {
  // Pre-normalization (Dalga E1 / Phase 1):
  //   1. NFD diacritic fold so "Avène" → "Avene" before character strip.
  //   2. Conservative CI typo fix: "Cl 77492" / "cl 77492" → "ci 77492".
  //      Only triggers when the WHOLE token matches /^cl\s+(\d{4,5})$/i so
  //      unrelated words starting with "cl" are unaffected.
  // This function MUST stay in sync with `normalizeForLookup` in
  // lib/admin/nodeResolver.ts.
  const folded = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^cl\s+(\d{4,5})$/i, "ci $1");
  return folded
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 \-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Supabase ingredient resolution ────────────────────────────────────────────

async function resolveFromSupabase(
  normalized: string
): Promise<SupabaseResolvedIngredient | null> {
  // Step 1: look up alias in ingredient_aliases
  const { data: aliasRows, error: aliasErr } = await supabase
    .from("ingredient_aliases")
    .select("ingredient_id")
    .eq("normalized_alias", normalized)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(1);

  if (aliasErr || !aliasRows || aliasRows.length === 0) return null;

  const ingredientId: string = aliasRows[0].ingredient_id;

  // Step 2: fetch master record
  const { data: masterRows, error: masterErr } = await supabase
    .from("ingredients_master")
    .select(
      "canonical_name, display_name, risk_level, concern_flags, function_tags, pregnancy_flag, breastfeeding_flag, allergy_flag, evidence_score"
    )
    .eq("id", ingredientId)
    .eq("is_active", true)
    .limit(1);

  if (masterErr || !masterRows || masterRows.length === 0) return null;

  const m = masterRows[0];

  return {
    source:             "supabase",
    canonical_name:     m.canonical_name ?? "",
    display_name:       m.display_name ?? m.canonical_name ?? "",
    risk_level:         m.risk_level ?? null,
    concern_flags:      Array.isArray(m.concern_flags) ? m.concern_flags : [],
    function_tags:      Array.isArray(m.function_tags) ? m.function_tags : [],
    pregnancy_flag:     m.pregnancy_flag ?? null,
    breastfeeding_flag: m.breastfeeding_flag ?? null,
    allergy_flag:       m.allergy_flag ?? null,
    evidence_score:     typeof m.evidence_score === "number" ? m.evidence_score : null,
  };
}

// ── Local registry resolution ─────────────────────────────────────────────────

function resolveFromLocal(raw: string): LocalResolvedIngredient {
  // Call the existing resolver — NO modifications to matchV4Ingredient
  const match: V4MatchResult = matchV4Ingredient(raw);

  const pregnancyFlag: string | null =
    match.pregnancy_safe === true    ? "safe" :
    match.pregnancy_safe === false   ? "avoid" :
    match.pregnancy_safe === "uncertain" ? "uncertain" :
    null;

  return {
    source:             "local",
    canonical_name:     match.canonical_name,
    risk_level:         match.risk_level,
    concern_flags:      match.flags as string[],
    function_tags:      match.category ? [match.category] : [],
    pregnancy_flag:     pregnancyFlag,
    breastfeeding_flag: null,   // not stored in local registry
    allergy_flag:       match.flags.includes("allergen") ? "possible" : null,
    matched:            match.matched,
    match_tier:         match.match_tier,
    confidence:         match.confidence,
  };
}

// ── Unknown queue ──────────────────────────────────────────────────────────────
//
// Fire-and-forget: errors are swallowed so they never interrupt resolution.
// If the same normalized ingredient is already queued, its seen_count is incremented.

async function enqueueUnknown(
  raw:        string,
  normalized: string,
  options:    ResolveOptions
): Promise<void> {
  try {
    // Check for existing queue entry (no UNIQUE constraint on normalized_name,
    // so we SELECT first to avoid duplicates)
    const { data: existing } = await supabase
      .from("ingredient_unknown_queue")
      .select("id, seen_count")
      .eq("normalized_name", normalized)
      .limit(1);

    if (existing && existing.length > 0) {
      // Bump seen_count and last_seen_at
      await supabase
        .from("ingredient_unknown_queue")
        .update({
          seen_count:  (existing[0].seen_count ?? 0) + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
    } else {
      // First time seeing this ingredient — insert
      await supabase.from("ingredient_unknown_queue").insert({
        raw_name:           raw,
        normalized_name:    normalized,
        source_product_id:  options.productId   ?? null,
        source_product_name: options.productName ?? null,
        seen_count:         1,
        first_seen_at:      new Date().toISOString(),
        last_seen_at:       new Date().toISOString(),
        resolution_status:  "pending",
      });
    }
  } catch {
    // Fire-and-forget: never surface queue errors to callers
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * resolveIngredientV4
 *
 * Async, safe, additive ingredient resolver.
 * Does NOT modify or replace the existing synchronous V4 analysis pipeline.
 *
 * Resolution order:
 *   1. Supabase ingredient_aliases + ingredients_master (empty today, populated by admin)
 *   2. Local V4 registry matchV4Ingredient() (existing, untouched)
 *   3. ingredient_unknown_queue insert, return { source: "unknown" }
 *
 * @param rawIngredient  Raw ingredient string from product label
 * @param options        Optional product context for queue tracking
 */
export async function resolveIngredientV4(
  rawIngredient: string,
  options: ResolveOptions = {}
): Promise<ResolvedIngredientV4> {
  const normalized  = normalizeForSupabaseLookup(rawIngredient);

  // Pre-compute parenthetical candidates once (pure string ops, zero I/O)
  const candidates  = buildParentheticalCandidates(rawIngredient);
  const normStripped = candidates.hasParentheticals
    ? normalizeForSupabaseLookup(candidates.stripped)
    : normalized;

  // ── PATH 1: Supabase — original normalized form (primary) ───────────────────
  const supabaseResult = await resolveFromSupabase(normalized);
  if (supabaseResult) return supabaseResult;

  // ── PATH 1b: Supabase — parenthetical-stripped form ─────────────────────────
  // Only attempted when the ingredient label contained `(…)` blocks AND the
  // stripped form differs from the original after normalization.
  if (candidates.hasParentheticals && normStripped !== normalized) {
    const supabaseStripped = await resolveFromSupabase(normStripped);
    if (supabaseStripped) return supabaseStripped;
  }

  // ── PATH 2: Local V4 registry — original raw (fallback) ─────────────────────
  const localResult = resolveFromLocal(rawIngredient);
  if (localResult.matched) return localResult;

  // ── PATH 2b: Local V4 registry — parenthetical-stripped raw ─────────────────
  // Only attempted when the stripped form differs from the original.
  if (candidates.hasParentheticals && candidates.stripped !== rawIngredient) {
    const localStripped = resolveFromLocal(candidates.stripped);
    if (localStripped.matched) return localStripped;
  }

  // ── PATH 3: Unknown — queue + return ────────────────────────────────────────
  // Fire-and-forget queue insert (never blocks resolution)
  enqueueUnknown(rawIngredient, normalized, options).catch(() => {});

  return {
    source:     "unknown",
    raw:        rawIngredient,
    normalized,
  };
}
