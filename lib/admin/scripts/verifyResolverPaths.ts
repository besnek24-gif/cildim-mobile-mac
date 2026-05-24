/**
 * verifyResolverPaths.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual verification script: confirms that recently inserted Supabase
 * ingredient records are being resolved from PATH 1 (Supabase) instead of
 * PATH 2 (local fallback) or PATH 3 (unknown).
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/verifyResolverPaths.ts
 *
 * WHAT THIS DOES:
 *   - Mirrors the resolveIngredientV4 PATH priority (1 → 2 → 3) using
 *     a Node.js-compatible lean Supabase client + pure-TS local registry
 *   - Reports source for each test input
 *   - Prints a final summary (supabase / local / unknown counts)
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to ingredient_unknown_queue (PATH 3 suppressed)
 *   - Does NOT modify score engine or resolver logic
 *   - Does NOT replace or alter the app's resolveIngredientV4
 *   - Does NOT run automatically — manual execution only
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { matchV4Ingredient }            from "@/lib/ingredientEngineV4/registry";

// ── Lean Node.js Supabase client (no AsyncStorage / expo deps) ────────────────

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("ERROR: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Normalizer (identical to resolveIngredientV4 / normalizeForSupabaseLookup) ──

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 \-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── PATH 1: Supabase alias + master lookup ─────────────────────────────────────

interface SupabaseResult {
  source:         "supabase";
  canonical_name: string;
  display_name:   string;
  risk_level:     string | null;
  function_tags:  string[];
}

async function tryPathOne(normalized: string): Promise<SupabaseResult | null> {
  const { data: aliasRows, error: aliasErr } = await supabase
    .from("ingredient_aliases")
    .select("ingredient_id")
    .eq("normalized_alias", normalized)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(1);

  if (aliasErr || !aliasRows || aliasRows.length === 0) return null;

  const ingredientId: string = aliasRows[0].ingredient_id;

  const { data: masterRows, error: masterErr } = await supabase
    .from("ingredients_master")
    .select("canonical_name, display_name, risk_level, function_tags")
    .eq("id", ingredientId)
    .eq("is_active", true)
    .limit(1);

  if (masterErr || !masterRows || masterRows.length === 0) return null;

  const m = masterRows[0];
  return {
    source:         "supabase",
    canonical_name: m.canonical_name ?? "",
    display_name:   m.display_name   ?? m.canonical_name ?? "",
    risk_level:     m.risk_level     ?? null,
    function_tags:  Array.isArray(m.function_tags) ? m.function_tags : [],
  };
}

// ── PATH 2: Local V4 registry (matchV4Ingredient — unmodified) ─────────────────

interface LocalResult {
  source:         "local";
  canonical_name: string | null;
  risk_level:     string | null;
  match_tier:     string;
  confidence:     string | null;
}

function tryPathTwo(raw: string): LocalResult | null {
  const match = matchV4Ingredient(raw);
  if (!match.matched) return null;
  return {
    source:         "local",
    canonical_name: match.canonical_name,
    risk_level:     match.risk_level,
    match_tier:     match.match_tier,
    confidence:     match.confidence,
  };
}

// ── Combined resolver (mirrors resolveIngredientV4, PATH 3 suppressed) ─────────

type ResolvedPath =
  | SupabaseResult
  | LocalResult
  | { source: "unknown"; normalized: string };

async function resolveTestInput(raw: string): Promise<ResolvedPath> {
  const norm = normalize(raw);

  // PATH 1 — Supabase
  const p1 = await tryPathOne(norm);
  if (p1) return p1;

  // PATH 2 — Local registry
  const p2 = tryPathTwo(raw);
  if (p2) return p2;

  // PATH 3 — Unknown (no queue write: this is a read-only verification script)
  return { source: "unknown", normalized: norm };
}

// ── Test inputs ────────────────────────────────────────────────────────────────

const TEST_INPUTS: string[] = [
  "Niacinamide",
  "Nicotinamide",
  "Vitamin B3",
  "Glycerin",
  "Glycerine",
  "Tocopherol",
  "Vitamin E",
  "Citric Acid",
  "E330",
  "Sodium Hyaluronate",
  "Hyaluronic Acid",
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" resolveIngredientV4 Path Verification");
  console.log(` Supabase: ${SUPABASE_URL}`);
  console.log(`" Test inputs: ${TEST_INPUTS.length}`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  const counters = { supabase: 0, local: 0, unknown: 0 };

  for (const input of TEST_INPUTS) {
    const result = await resolveTestInput(input);
    counters[result.source]++;

    const pathLabel =
      result.source === "supabase" ? "PATH 1 (Supabase)  ✅" :
      result.source === "local"    ? "PATH 2 (Local)     ⚠️ " :
                                     "PATH 3 (Unknown)   ❌";

    console.log(`Input: "${input}"`);
    console.log(`  source       : ${pathLabel}`);

    if (result.source === "supabase") {
      console.log(`  canonical    : ${result.canonical_name}`);
      console.log(`  display_name : ${result.display_name}`);
      console.log(`  risk_level   : ${result.risk_level ?? "—"}`);
      console.log(`  function_tags: [${result.function_tags.join(", ")}]`);
    } else if (result.source === "local") {
      console.log(`  canonical    : ${result.canonical_name ?? "—"}`);
      console.log(`  risk_level   : ${result.risk_level ?? "—"}`);
      console.log(`  match_tier   : ${result.match_tier}`);
      console.log(`  confidence   : ${result.confidence ?? "—"}`);
    } else {
      console.log(`  normalized   : "${result.normalized}"`);
      console.log(`  note         : Not in Supabase or local registry`);
    }

    console.log();
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" FINAL SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  total_tested         : ${TEST_INPUTS.length}`);
  console.log(`  source_supabase_count: ${counters.supabase}   (PATH 1)`);
  console.log(`  source_local_count   : ${counters.local}   (PATH 2)`);
  console.log(`  source_unknown_count : ${counters.unknown}   (PATH 3 — suppressed, no queue write)`);
  console.log("─────────────────────────────────────────────────────────────");

  if (counters.supabase === TEST_INPUTS.length) {
    console.log(" All inputs resolved via Supabase (PATH 1). Library is live.");
  } else if (counters.supabase > 0) {
    console.log(` ${counters.supabase}/${TEST_INPUTS.length} resolved via Supabase.`);
    if (counters.local > 0)   console.log(`  ${counters.local} fell through to local registry (PATH 2).`);
    if (counters.unknown > 0) console.log(`  ${counters.unknown} are unresolved (PATH 3).`);
  } else {
    console.log(" No Supabase hits. Library may be empty or aliases not matching.");
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
