/**
 * nodeResolver.ts — lib/admin
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared Node.js-safe ingredient resolution helper.
 *
 * WHY THIS EXISTS:
 *   Admin/debug scripts run via tsx in Node.js and cannot import the real
 *   `resolveIngredientV4` (which imports `supabaseClient.ts` → expo AsyncStorage).
 *   This module provides an identical resolution path using a caller-supplied
 *   lean SupabaseClient, including the parenthetical pre-processor step.
 *
 * RESOLUTION ORDER — mirrors resolver/index.ts exactly:
 *   PATH 1   Supabase ingredient_aliases  (original normalized form)
 *   PATH 1b  Supabase ingredient_aliases  (parenthetical-stripped form)
 *   PATH 2   Local V4 registry            (original raw string)
 *   PATH 2b  Local V4 registry            (parenthetical-stripped raw)
 *   PATH 3   Unknown — no write (suppressed in all admin scripts)
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to ingredient_unknown_queue
 *   - Does NOT import supabaseClient.ts or any expo module
 *   - Does NOT change the live resolver/index.ts behavior
 *
 * USAGE:
 *   import { resolveIngredientNodeSafe, normalizeForLookup, createLeanSupabase }
 *     from "../nodeResolver";
 *
 *   const sb  = createLeanSupabase();
 *   const res = await resolveIngredientNodeSafe("Water (Aqua)", sb);
 *   // res.source      → "supabase"
 *   // res.path        → "supabase_stripped"
 *   // res.canonical_name → "water"
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { matchV4Ingredient }                  from "@/lib/ingredientEngineV4/registry";
import { buildParentheticalCandidates }       from "@/lib/ingredientEngineV4/resolver/parentheticalPreProcessor";

// ── Lean client factory ────────────────────────────────────────────────────────

/**
 * Creates a lean Supabase client suitable for Node.js scripts.
 * Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from env.
 * Call once per script, at module level.
 */
export function createLeanSupabase(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? "";
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !key) {
    console.error(
      "ERROR: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set."
    );
    process.exit(1);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Normalizer ────────────────────────────────────────────────────────────────

/**
 * Normalizes a raw ingredient string for Supabase column lookup.
 * Identical to `normalizeForSupabaseLookup` in resolver/index.ts.
 */
export function normalizeForLookup(raw: string): string {
  // Pre-normalization (Dalga E1 / Phase 1):
  //   1. NFD diacritic fold so "Avène" → "Avene" before character strip.
  //   2. Conservative CI typo fix: "Cl 77492" / "cl 77492" → "ci 77492".
  //      Only triggers when the WHOLE token matches /^cl\s+(\d{4,5})$/i so
  //      unrelated words starting with "cl" are unaffected.
  // This function MUST stay in sync with `normalizeForSupabaseLookup` in
  // lib/ingredientEngineV4/resolver/index.ts.
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

// ── Result types ──────────────────────────────────────────────────────────────

/** Which resolution path was taken */
export type NodeResolvePath =
  | "supabase_original"  // PATH 1  — Supabase, original normalized form
  | "supabase_stripped"  // PATH 1b — Supabase, parenthetical-stripped form
  | "local_original"     // PATH 2  — Local V4 registry, original raw
  | "local_stripped"     // PATH 2b — Local V4 registry, stripped raw
  | "unknown";           // PATH 3  — not resolved (no write)

/** Top-level source category (for backward-compatible grouping) */
export type NodeResolveSource = "supabase" | "local" | "unknown";

export interface NodeResolveResult {
  // ── Top-level grouping (mirrors ResolvedIngredientV4.source) ─────────────
  source: NodeResolveSource;

  // ── Detailed path taken ───────────────────────────────────────────────────
  path: NodeResolvePath;

  // ── Lookup context (useful for debug/comparison scripts) ─────────────────
  original_norm:     string;
  stripped_raw:      string;
  stripped_norm:     string;
  has_parenthetical: boolean;

  // ── Rich ingredient data (null / empty when unknown) ─────────────────────
  canonical_name:     string | null;
  display_name:       string | null;
  risk_level:         string | null;
  concern_flags:      string[];
  function_tags:      string[];
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
}

// ── Internal Supabase lookup ──────────────────────────────────────────────────

interface SupabaseMasterRow {
  canonical_name:     string | null;
  display_name:       string | null;
  risk_level:         string | null;
  concern_flags:      unknown;
  function_tags:      unknown;
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
}

async function lookupSupabase(
  norm: string,
  sb:   SupabaseClient
): Promise<Omit<NodeResolveResult, "source" | "path" | "original_norm" | "stripped_raw" | "stripped_norm" | "has_parenthetical"> | null> {
  const { data: aliases } = await sb
    .from("ingredient_aliases")
    .select("ingredient_id")
    .eq("normalized_alias", norm)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(1);

  if (!aliases || aliases.length === 0) return null;

  const { data: master } = await sb
    .from("ingredients_master")
    .select(
      "canonical_name, display_name, risk_level, concern_flags, function_tags, " +
      "pregnancy_flag, breastfeeding_flag, allergy_flag"
    )
    .eq("id", aliases[0].ingredient_id)
    .eq("is_active", true)
    .limit(1);

  if (!master || master.length === 0) return null;

  const m = master[0] as unknown as SupabaseMasterRow;

  return {
    canonical_name:     m.canonical_name     ?? null,
    display_name:       m.display_name       ?? m.canonical_name ?? null,
    risk_level:         m.risk_level         ?? null,
    concern_flags:      Array.isArray(m.concern_flags) ? (m.concern_flags as string[]) : [],
    function_tags:      Array.isArray(m.function_tags) ? (m.function_tags as string[]) : [],
    pregnancy_flag:     m.pregnancy_flag     ?? null,
    breastfeeding_flag: m.breastfeeding_flag ?? null,
    allergy_flag:       m.allergy_flag       ?? null,
  };
}

// ── Internal local lookup ─────────────────────────────────────────────────────

function lookupLocal(
  raw: string
): Omit<NodeResolveResult, "source" | "path" | "original_norm" | "stripped_raw" | "stripped_norm" | "has_parenthetical"> | null {
  const match = matchV4Ingredient(raw);
  if (!match.matched) return null;

  const pregnancyFlag =
    match.pregnancy_safe === true        ? "safe"    :
    match.pregnancy_safe === false       ? "avoid"   :
    match.pregnancy_safe === "uncertain" ? "caution" :
    null;

  return {
    canonical_name:     match.canonical_name ?? null,
    display_name:       match.canonical_name ?? null,
    risk_level:         match.risk_level,
    concern_flags:      match.flags as string[],
    function_tags:      match.category ? [match.category] : [],
    pregnancy_flag:     pregnancyFlag,
    breastfeeding_flag: null,
    allergy_flag:       match.flags.includes("allergen") ? "possible" : null,
  };
}

// ── Unknown result builder ────────────────────────────────────────────────────

function unknownResult(
  origNorm:   string,
  stripped:   ReturnType<typeof buildParentheticalCandidates>,
  stripNorm:  string
): NodeResolveResult {
  return {
    source:            "unknown",
    path:              "unknown",
    original_norm:     origNorm,
    stripped_raw:      stripped.stripped,
    stripped_norm:     stripNorm,
    has_parenthetical: stripped.hasParentheticals,
    canonical_name:     null,
    display_name:       null,
    risk_level:         null,
    concern_flags:      [],
    function_tags:      [],
    pregnancy_flag:     null,
    breastfeeding_flag: null,
    allergy_flag:       null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * resolveIngredientNodeSafe
 *
 * Node.js-safe ingredient resolution that mirrors the real `resolveIngredientV4`
 * path — including the parenthetical pre-processor (PATH 1b / PATH 2b).
 *
 * PATH 3 (unknown queue write) is always suppressed.
 *
 * @param raw  Raw ingredient string from product label
 * @param sb   Lean SupabaseClient (from createLeanSupabase())
 */
export async function resolveIngredientNodeSafe(
  raw: string,
  sb:  SupabaseClient
): Promise<NodeResolveResult> {
  const candidates  = buildParentheticalCandidates(raw);
  const origNorm    = normalizeForLookup(raw);
  const stripNorm   = candidates.hasParentheticals
    ? normalizeForLookup(candidates.stripped)
    : origNorm;

  const ctx = {
    original_norm:     origNorm,
    stripped_raw:      candidates.stripped,
    stripped_norm:     stripNorm,
    has_parenthetical: candidates.hasParentheticals,
  };

  // ── PATH 1: Supabase — original ────────────────────────────────────────────
  const p1 = await lookupSupabase(origNorm, sb);
  if (p1) return { source: "supabase", path: "supabase_original", ...ctx, ...p1 };

  // ── PATH 1b: Supabase — stripped ───────────────────────────────────────────
  if (candidates.hasParentheticals && stripNorm !== origNorm) {
    const p1b = await lookupSupabase(stripNorm, sb);
    if (p1b) return { source: "supabase", path: "supabase_stripped", ...ctx, ...p1b };
  }

  // ── PATH 2: Local — original ───────────────────────────────────────────────
  const p2 = lookupLocal(raw);
  if (p2) return { source: "local", path: "local_original", ...ctx, ...p2 };

  // ── PATH 2b: Local — stripped ──────────────────────────────────────────────
  if (candidates.hasParentheticals && candidates.stripped !== raw) {
    const p2b = lookupLocal(candidates.stripped);
    if (p2b) return { source: "local", path: "local_stripped", ...ctx, ...p2b };
  }

  // ── PATH 3: Unknown (no write) ─────────────────────────────────────────────
  return unknownResult(origNorm, candidates, stripNorm);
}
