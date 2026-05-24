/**
 * batchInsertUnknownCandidates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: writes the 5 currently-unknown V4 ingredients into the
 * Supabase ingredient library so they resolve via PATH 1 on future requests.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertUnknownCandidates.ts
 *
 * IDEMPOTENT: safe to re-run — existing rows are never overwritten.
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT modify ingredient_unknown_queue
 *   - Does NOT touch score engine or resolver flow
 *   - Does NOT run automatically — manual execution only
 *
 * These 5 candidates were identified by verifyScoreComparison.ts as
 * "still_unknown_in_v4" across 3 real products.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

// ── Normalizer (identical to normalizeForSupabaseLookup) ──────────────────────

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 \-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidate {
  suggested_canonical_name: string;
  display_name?:            string;
  aliases:                  string[];
  risk_level?:              string;
  function_tags?:           string[];
  concern_flags?:           string[];
  pregnancy_flag?:          string;
  breastfeeding_flag?:      string;
  allergy_flag?:            string;
  description?:             string;
}

interface BatchResult {
  inserted_master_count: number;
  reused_master_count:   number;
  inserted_alias_count:  number;
  skipped_alias_count:   number;
  errors:                string[];
}

// ── 5 reviewed candidates (identified as still_unknown_in_v4) ─────────────────

const CANDIDATES: Candidate[] = [
  {
    suggested_canonical_name: "vp/eicosene copolymer",
    display_name:             "VP/Eicosene Copolymer",
    aliases: [
      "vp/eicosene copolymer",
    ],
    risk_level:         "low",
    function_tags:      ["film_former", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },
  {
    suggested_canonical_name: "silybum marianum seed extract",
    display_name:             "Silybum Marianum Seed Extract",
    aliases: [
      "silybum marianum seed extract",
      "milk thistle seed extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "antioxidant", "soothing"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },
  {
    suggested_canonical_name: "solanum lycopersicum fruit extract",
    display_name:             "Solanum Lycopersicum Fruit Extract",
    aliases: [
      "solanum lycopersicum fruit extract",
      "tomato fruit extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },
  {
    suggested_canonical_name: "hydrolyzed collagen",
    display_name:             "Hydrolyzed Collagen",
    aliases: [
      "hydrolyzed collagen",
      "collagen hydrolysate",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "film_former", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },
  {
    suggested_canonical_name: "avene thermal spring water",
    display_name:             "Avène Thermal Spring Water",
    aliases: [
      "avene thermal spring water",
      "avene thermal spring water",  // accent-stripped form normalises to same
    ],
    risk_level:         "low",
    function_tags:      ["solvent", "soothing", "thermal_water"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },
];

// ── Write logic (same semantics as applyUnknownResolutionCandidates) ──────────

async function runBatch(candidates: Candidate[]): Promise<BatchResult> {
  const result: BatchResult = {
    inserted_master_count: 0,
    reused_master_count:   0,
    inserted_alias_count:  0,
    skipped_alias_count:   0,
    errors:                [],
  };

  for (const candidate of candidates) {
    const normCanon = normalize(candidate.suggested_canonical_name);
    if (!normCanon) {
      result.errors.push(`Empty canonical after normalization: "${candidate.suggested_canonical_name}"`);
      continue;
    }

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
      console.log(`  ↩  reused   ingredients_master: "${normCanon}"`);
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

    // ── Step 2: Build alias set (canonical exact + extras as synonym) ────────
    // Deduplicate aliases before inserting
    const seenNorms   = new Set<string>();
    const aliasEntries: Array<{ raw: string; norm: string; priority: number; type: "exact" | "synonym" }> = [];

    // Canonical always first (priority 1, type "exact")
    const canonNorm = normCanon;
    seenNorms.add(canonNorm);
    aliasEntries.push({
      raw:      candidate.suggested_canonical_name,
      norm:     canonNorm,
      priority: 1,
      type:     "exact",
    });

    // Extra aliases (priority 10, type "synonym")
    for (const rawAlias of candidate.aliases) {
      const aliasNorm = normalize(rawAlias);
      if (!aliasNorm || seenNorms.has(aliasNorm)) continue;
      seenNorms.add(aliasNorm);
      aliasEntries.push({ raw: rawAlias, norm: aliasNorm, priority: 10, type: "synonym" });
    }

    // ── Step 3: Insert aliases (skip if already exists) ──────────────────────
    for (const { raw, norm, priority, type } of aliasEntries) {
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

      const { error: aliasErr } = await supabase
        .from("ingredient_aliases")
        .insert({
          ingredient_id:    ingredientId,
          alias_name:       raw,
          normalized_alias: norm,
          alias_type:       type,
          language_code:    "en",
          priority,
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
  console.log(" Batch Insert: Still-Unknown V4 Ingredients");
  console.log(` Supabase: ${SUPABASE_URL}`);
  console.log(`" Candidates: ${CANDIDATES.length}`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  for (const c of CANDIDATES) {
    console.log(`Processing: ${c.suggested_canonical_name}`);
    await runBatch([c]);
    console.log();
  }

  // ── Idempotency verification (re-run, expect all skips) ───────────────────
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Verifying idempotency (re-running for summary) …");
  console.log("─────────────────────────────────────────────────────────────");

  const summary = await runBatch(CANDIDATES);
  console.log();
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" RESULT SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  inserted_master_count : ${summary.inserted_master_count}`);
  console.log(`  reused_master_count   : ${summary.reused_master_count}`);
  console.log(`  inserted_alias_count  : ${summary.inserted_alias_count}`);
  console.log(`  skipped_alias_count   : ${summary.skipped_alias_count}`);
  console.log();

  if (summary.errors.length === 0) {
    console.log("  errors : none");
  } else {
    console.log(`  errors : ${summary.errors.length}`);
    for (const e of summary.errors) console.log(`    ✖ ${e}`);
  }

  console.log("─────────────────────────────────────────────────────────────");

  if (summary.errors.length === 0) {
    console.log(" Batch insert completed successfully.");
  } else {
    console.log(` Batch insert completed with ${summary.errors.length} error(s).`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
