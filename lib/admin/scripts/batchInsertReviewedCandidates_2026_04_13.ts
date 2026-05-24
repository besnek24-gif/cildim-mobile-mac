/**
 * batchInsertReviewedCandidates_2026_04_13.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: 6 manually-reviewed ingredient candidates from the
 * Ingredient Learning Pipeline (Phase 1) candidate review queue.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertReviewedCandidates_2026_04_13.ts
 *
 * IDEMPOTENT — safe to re-run.  Existing rows are never overwritten.
 *   skipped_master_count  → canonical already in ingredients_master
 *   skipped_alias_count   → normalized_alias already in ingredient_aliases
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT touch the live score engine (V4 or any other)
 *   - Does NOT modify the local V4 registry (coreRegistry.ts or expansions)
 *   - Does NOT touch resolver/index.ts behaviour
 *   - Does NOT write to ingredient_unknown_queue
 *   - Does NOT remove or overwrite any existing row
 *   - Does NOT run automatically — manual execution only
 *
 * NOTES ON SPECIFIC CANDIDATES:
 *
 *   avene thermal spring water:
 *     If batchInsertUnknownCandidates.ts was previously run, the
 *     ingredients_master row already exists.  This script reuses that row
 *     and only inserts the new "avene aqua" alias (additive-only).
 *
 *   vp eicosene copolymer:
 *     normalizeForLookup("vp eicosene copolymer")  → "vp eicosene copolymer"
 *     normalizeForLookup("vp/eicosene copolymer")  → "vpeicosene copolymer"
 *     These are distinct normalized keys.  batchInsertUnknownCandidates.ts
 *     inserted the slash form ("vpeicosene copolymer").  This script inserts
 *     the space form so labels written either way resolve correctly.  Both
 *     entries are needed and co-exist without conflict.
 *
 *   oryza sativa starch:
 *     Corrected canonical — previously seen in the queue as
 *     "oryza sativa rice starch oryza sativa starch" (normalizer artifact).
 *     This inserts the clean INCI form.
 */

import { createLeanSupabase }              from "../nodeResolver";
import { applyUnknownResolutionCandidates } from "../batchResolverNodeSafe";
import type { BatchResolutionCandidate }   from "../batchResolverNodeSafe";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── 6 reviewed candidates ─────────────────────────────────────────────────────
//
// Sources: CosIng EU database, EWG Skin Deep, INCI official.
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Sodium Chloride ──────────────────────────────────────────────────────
  // Standard mineral salt.  Used as viscosity controller and preservative
  // booster.  One of the most widely-used, well-tolerated cosmetic ingredients.
  {
    suggested_canonical_name: "sodium chloride",
    aliases: [
      "sodium chloride",
      "salt",
    ],
    risk_level:         "low",
    function_tags:      ["mineral", "viscosity_control"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 2. Sodium Stearoyl Glutamate ────────────────────────────────────────────
  // Amino acid-derived (glutamic acid) anionic emulsifier.  Skin-conditioning,
  // biodegradable; often found in mineral sunscreens and sensitive-skin formulas.
  {
    suggested_canonical_name: "sodium stearoyl glutamate",
    aliases: [
      "sodium stearoyl glutamate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 3. Oryza Sativa Starch ──────────────────────────────────────────────────
  // Rice starch — fine-particle absorbent and texture modifier.  Used in BB
  // creams, powders, and sensitive-skin formulas.  Corrected canonical name:
  // previously appeared in the queue as "oryza sativa rice starch oryza sativa
  // starch" due to a parenthetical + duplicate-word normalizer artifact.
  {
    suggested_canonical_name: "oryza sativa starch",
    aliases: [
      "oryza sativa starch",
      "rice starch",
    ],
    risk_level:         "low",
    function_tags:      ["absorbent", "texture", "starch"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 4. Glycyrrhiza Inflata Root Extract ─────────────────────────────────────
  // Extract from Chinese licorice root (Xinjiang licorice).  Rich in licochalcone
  // A; soothing, anti-inflammatory, antioxidant.  Commonly used in sensitive- and
  // redness-prone skin products (e.g. Eucerin Redness Relief line).
  {
    suggested_canonical_name: "glycyrrhiza inflata root extract",
    aliases: [
      "glycyrrhiza inflata root extract",
      "licorice root extract",
    ],
    risk_level:         "low",
    function_tags:      ["soothing", "anti_inflammatory", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 5. VP Eicosene Copolymer ────────────────────────────────────────────────
  // Film-forming copolymer of vinylpyrrolidone and eicosene.  Provides gloss
  // and slip in lip products and foundations.  Limited safety data but no known
  // toxicity concerns at cosmetic concentrations.
  //
  // NOTE: normalizeForLookup("vp eicosene copolymer")  → "vp eicosene copolymer"
  //       normalizeForLookup("vp/eicosene copolymer")  → "vpeicosene copolymer"
  //       batchInsertUnknownCandidates.ts already covers the slash form.
  //       This entry covers the space-separated form (different normalized key).
  {
    suggested_canonical_name: "vp eicosene copolymer",
    aliases: [
      "vp eicosene copolymer",
    ],
    risk_level:         "low",
    function_tags:      ["film_forming", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 6. Avène Thermal Spring Water ───────────────────────────────────────────
  // Silica-rich thermal spring water from Saint-Gilles (southern France).
  // Soothing, anti-irritant; well-documented tolerance in sensitive skin.
  //
  // NOTE: If batchInsertUnknownCandidates.ts was already run, the
  //       ingredients_master row already exists.  Only "avene aqua" will be
  //       newly inserted as a synonym alias — all other writes will be skipped.
  {
    suggested_canonical_name: "avene thermal spring water",
    aliases: [
      "avene thermal spring water",
      "avene aqua",
    ],
    risk_level:         "low",
    function_tags:      ["soothing", "thermal_water"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const HR  = "─".repeat(65);
  const HR2 = "═".repeat(65);

  console.log(HR);
  console.log(" batchInsertReviewedCandidates_2026_04_13");
  console.log(" 6 manually-reviewed ingredient candidates");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Candidates: ${REVIEWED_CANDIDATES.length}`);
  console.log(" IDEMPOTENT — safe to re-run.");
  console.log(" Does NOT touch score engine, resolver, UI, or local registry.");
  console.log(HR);
  console.log();

  // ── Preview ────────────────────────────────────────────────────────────────

  console.log("Candidates:");
  for (const c of REVIEWED_CANDIDATES) {
    const aliasStr = c.aliases.join(", ");
    const tagStr   = (c.function_tags ?? []).join(", ");
    console.log(`  • "${c.suggested_canonical_name}"  [risk: ${c.risk_level ?? "?"}]`);
    console.log(`    aliases : ${aliasStr}`);
    console.log(`    tags    : ${tagStr}`);
    console.log(`    preg    : ${c.pregnancy_flag ?? "?"}  /  breast: ${c.breastfeeding_flag ?? "?"}`);
  }
  console.log();

  // ── Apply ──────────────────────────────────────────────────────────────────

  console.log("Applying …");
  const result = await applyUnknownResolutionCandidates(REVIEWED_CANDIDATES, sb);
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(HR2);
  console.log(" RESULT SUMMARY");
  console.log(HR2);
  console.log(`  inserted_master_count : ${result.inserted_master_count}`);
  console.log(`  reused_master_count   : ${result.reused_master_count}`);
  console.log(`  inserted_alias_count  : ${result.inserted_alias_count}`);
  console.log(`  skipped_alias_count   : ${result.skipped_alias_count}`);
  console.log(`  errors                : ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log();
    console.log("  ERRORS:");
    for (const e of result.errors) {
      const aliasHint = e.alias ? ` (alias: "${e.alias}")` : "";
      console.log(`    ✖ "${e.candidate_canonical}"${aliasHint}: ${e.message}`);
    }
  }

  console.log(HR2);

  if (result.errors.length === 0) {
    console.log();
    console.log(` ✅  Completed cleanly.`);
    console.log(`     ${result.inserted_master_count} new master row(s),`);
    console.log(`     ${result.inserted_alias_count} new alias row(s),`);
    console.log(`     ${result.skipped_alias_count} alias(es) already present (skipped).`);
    console.log();
    console.log(`     Next step: run reportUnknownIngredients.ts or`);
    console.log(`     debugLearningCandidates.ts to confirm resolution.`);
  } else {
    console.log();
    console.log(` ⚠️   Completed with ${result.errors.length} error(s). Review above.`);
  }

  console.log();
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
