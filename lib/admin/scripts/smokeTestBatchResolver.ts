/**
 * smokeTestBatchResolver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual smoke test: writes 5 reviewed resolution candidates into the
 * Supabase ingredient library and prints a clear result summary.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/smokeTestBatchResolver.ts
 *
 * NOTE ON CLIENT:
 *   This script uses a lean Node.js-compatible Supabase client (no AsyncStorage,
 *   no expo-linking, no react-native). It exercises the same write logic as
 *   applyUnknownResolutionCandidates without the mobile dependency chain.
 *   This is intentional and expected for a server-side/script context.
 *
 * WHAT THIS DOES:
 *   - Writes 5 curated ingredients into ingredients_master + ingredient_aliases
 *   - Idempotent: safe to re-run — existing rows are never overwritten
 *   - Prints a clear summary on completion
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT modify ingredient_unknown_queue
 *   - Does NOT touch score engine or resolver flow
 *   - Does NOT run automatically — manual execution only
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Lean Node.js Supabase client (no AsyncStorage / no expo deps) ─────────────

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("ERROR: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:   false,  // no AsyncStorage needed in Node.js
    autoRefreshToken: false,
  },
});

// ── Inline normalizer (identical to resolveIngredientV4 / normalizeForSupabaseLookup) ──

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Candidate {
  suggested_canonical_name: string;
  display_name?:            string;
  aliases:                  string[];
  risk_level?:              string;
  concern_flags?:           string[];
  function_tags?:           string[];
  pregnancy_flag?:          string;
  breastfeeding_flag?:      string;
  allergy_flag?:            string;
  description?:             string;
}

interface SmokeResult {
  inserted_master_count: number;
  reused_master_count:   number;
  inserted_alias_count:  number;
  skipped_alias_count:   number;
  errors:                string[];
}

// ── 5 reviewed candidates ─────────────────────────────────────────────────────

const CANDIDATES: Candidate[] = [
  {
    suggested_canonical_name: "niacinamide",
    display_name:             "Niacinamide",
    aliases: ["nicotinamide", "vitamin b3", "niacin amide"],
    risk_level:         "low",
    function_tags:      ["brightening", "anti-inflammatory", "barrier-repair", "pore-minimizing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Water-soluble vitamin B3 derivative. Reduces pore appearance, evens skin tone, and strengthens the skin barrier.",
  },
  {
    suggested_canonical_name: "glycerin",
    display_name:             "Glycerin",
    aliases: ["glycerol", "glycerine", "vegetable glycerin", "glycerine usp"],
    risk_level:         "low",
    function_tags:      ["humectant", "moisturizer", "solvent"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "A naturally derived or synthetic humectant that draws water into the skin. Well-tolerated by all skin types.",
  },
  {
    suggested_canonical_name: "tocopherol",
    display_name:             "Tocopherol (Vitamin E)",
    aliases: ["tocopherols", "vitamin e", "dl-alpha-tocopherol", "d-alpha-tocopherol", "mixed tocopherols"],
    risk_level:         "low",
    function_tags:      ["antioxidant", "moisturizer", "skin-conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Fat-soluble antioxidant (Vitamin E) that neutralises free radicals, supports barrier function, and prevents lipid peroxidation.",
  },
  {
    suggested_canonical_name: "citric acid",
    display_name:             "Citric Acid",
    aliases: ["anhydrous citric acid", "citric acid monohydrate", "e330"],
    risk_level:         "low",
    function_tags:      ["ph-adjuster", "chelating-agent", "exfoliant", "preservative-booster"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Naturally derived alpha-hydroxy acid used primarily as a pH adjuster and chelating agent.",
  },
  {
    suggested_canonical_name: "sodium hyaluronate",
    display_name:             "Sodium Hyaluronate",
    aliases: ["hyaluronic acid", "hyaluronate sodium", "sodium hyaluronate crosspolymer", "ha", "low molecular weight hyaluronic acid"],
    risk_level:         "low",
    function_tags:      ["humectant", "moisturizer", "plumping", "anti-aging"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Sodium salt of hyaluronic acid. Holds up to 1000× its weight in water.",
  },
];

// ── Write logic (same semantics as applyUnknownResolutionCandidates) ──────────

async function runBatch(candidates: Candidate[]): Promise<SmokeResult> {
  const result: SmokeResult = {
    inserted_master_count: 0,
    reused_master_count:   0,
    inserted_alias_count:  0,
    skipped_alias_count:   0,
    errors:                [],
  };

  for (const candidate of candidates) {
    const normCanon = normalize(candidate.suggested_canonical_name);

    // ── Step 1: Resolve ingredients_master row ───────────────────────────────
    const { data: existing } = await supabase
      .from("ingredients_master")
      .select("id")
      .eq("canonical_name", normCanon)
      .limit(1);

    let ingredientId: string;

    if (existing && existing.length > 0) {
      ingredientId = existing[0].id as string;
      result.reused_master_count++;
      console.log(`  ↩  reused   ingredients_master: "${normCanon}" (id: ${ingredientId})`);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("ingredients_master")
        .insert({
          canonical_name:     normCanon,
          display_name:       candidate.display_name ?? candidate.suggested_canonical_name,
          description:        candidate.description  ?? null,
          risk_level:         candidate.risk_level   ?? null,
          concern_flags:      candidate.concern_flags     ?? [],
          function_tags:      candidate.function_tags     ?? [],
          pregnancy_flag:     candidate.pregnancy_flag    ?? null,
          breastfeeding_flag: candidate.breastfeeding_flag ?? null,
          allergy_flag:       candidate.allergy_flag      ?? null,
          is_active:          true,
          metadata:           {},
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        const msg = `ingredients_master insert failed for "${normCanon}": ${insertErr?.message ?? "no data"}`;
        result.errors.push(msg);
        console.log(`  ✖  error    ${msg}`);
        continue;
      }

      ingredientId = inserted.id as string;
      result.inserted_master_count++;
      console.log(`  +  inserted ingredients_master: "${normCanon}" (id: ${ingredientId})`);
    }

    // ── Step 2: Resolve aliases (canonical first, then extras) ───────────────
    const aliasEntries = [
      { raw: candidate.suggested_canonical_name, norm: normCanon },
      ...candidate.aliases
        .map((a) => ({ raw: a, norm: normalize(a) }))
        .filter((a) => a.norm && a.norm !== normCanon),
    ];

    for (const { raw, norm } of aliasEntries) {
      const { data: existingAlias } = await supabase
        .from("ingredient_aliases")
        .select("id")
        .eq("normalized_alias", norm)
        .limit(1);

      if (existingAlias && existingAlias.length > 0) {
        result.skipped_alias_count++;
        console.log(`  ↩  skipped  ingredient_aliases: "${norm}"`);
        continue;
      }

      // alias_type CHECK constraint: "exact"|"synonym"|"language"|"trade_name"|"misspelling"|"parser_rule"
      const { error: aliasErr } = await supabase
        .from("ingredient_aliases")
        .insert({
          ingredient_id:    ingredientId,
          alias_name:       raw,
          normalized_alias: norm,
          alias_type:       norm === normCanon ? "exact" : "synonym",
          language_code:    "en",
          priority:         norm === normCanon ? 1 : 10,
          is_active:        true,
        });

      if (aliasErr) {
        const msg = `ingredient_aliases insert failed for "${norm}": ${aliasErr.message}`;
        result.errors.push(msg);
        console.log(`  ✖  error    ${msg}`);
      } else {
        result.inserted_alias_count++;
        console.log(`  +  inserted ingredient_aliases: "${norm}"`);
      }
    }
  }

  return result;
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Batch Resolver Smoke Test");
  console.log(` Supabase: ${SUPABASE_URL}`);
  console.log(`" Candidates: ${CANDIDATES.length}`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  for (const c of CANDIDATES) {
    console.log(`Processing: ${c.suggested_canonical_name}`);
    const result = await runBatch([c]);

    // Print per-candidate result inline (verbose mode)
    if (result.errors.length > 0) {
      for (const e of result.errors) console.log(`  ✖ ${e}`);
    }
    console.log();
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Re-running full batch for summary …");
  console.log("─────────────────────────────────────────────────────────────");

  const summary = await runBatch(CANDIDATES);
  console.log();
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" RESULT SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  ingredients_master inserted : ${summary.inserted_master_count}`);
  console.log(`  ingredients_master reused   : ${summary.reused_master_count}`);
  console.log(`  ingredient_aliases inserted : ${summary.inserted_alias_count}`);
  console.log(`  ingredient_aliases skipped  : ${summary.skipped_alias_count}`);
  console.log();

  if (summary.errors.length === 0) {
    console.log("  errors : none");
  } else {
    console.log(`  errors : ${summary.errors.length}`);
    for (const e of summary.errors) console.log(`    ✖ ${e}`);
  }

  console.log("─────────────────────────────────────────────────────────────");

  if (summary.errors.length === 0) {
    console.log(" Smoke test completed successfully.");
  } else {
    console.log(` Smoke test completed with ${summary.errors.length} error(s).`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
