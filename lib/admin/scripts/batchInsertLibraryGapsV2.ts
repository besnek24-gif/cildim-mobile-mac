/**
 * batchInsertLibraryGapsV2.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: writes the top 10 most frequent unknown V4 ingredients
 * into Supabase (ingredients_master + ingredient_aliases) so they resolve via
 * PATH 1 on future requests.
 *
 * These 10 candidates were identified by reportUnknownIngredients.ts as the
 * highest-occurrence unknowns across all 27 Supabase products.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertLibraryGapsV2.ts
 *
 * IDEMPOTENT: Safe to re-run — existing rows are never overwritten.
 *             skipped_alias_count shows how many were already present.
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT touch the live score engine
 *   - Does NOT touch the resolver flow (resolver/index.ts)
 *   - Does NOT modify the local V4 registry (coreRegistry.ts)
 *   - Does NOT touch UI components
 *   - Does NOT run automatically — manual execution only
 *   - Does NOT write to ingredient_unknown_queue
 */

import { createLeanSupabase }              from "../nodeResolver";
import { applyUnknownResolutionCandidates } from "../batchResolverNodeSafe";
import type { BatchResolutionCandidate }   from "../batchResolverNodeSafe";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Reviewed candidates ───────────────────────────────────────────────────────
//
// Risk/flag sources: CosIng EU database, EWG Skin Deep, INCI official.
// Aliases: only confirmed same-substance INCI synonyms are included.
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [
  // ── 1. Aloe Barbadensis Leaf Extract ─────────────────────────────────────
  // Standard INCI for aloe vera leaf extract. Widely used, well-tolerated.
  {
    suggested_canonical_name: "aloe barbadensis leaf extract",
    aliases: [
      "aloe barbadensis leaf extract",
      "aloe vera leaf extract",
      "aloe vera extract",
      "aloe barbadensis extract",
    ],
    risk_level:         "low",
    function_tags:      ["skin_conditioning", "soothing", "humectant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 2. Alumina ────────────────────────────────────────────────────────────
  // Aluminum oxide. Used as abrasive, opacifier, viscosity modifier.
  // No significant systemic absorption from topical use.
  {
    suggested_canonical_name: "alumina",
    aliases: [
      "alumina",
      "aluminum oxide",
    ],
    risk_level:         "low",
    function_tags:      ["abrasive", "opacifying", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 3. Ectoin ─────────────────────────────────────────────────────────────
  // Extremolyte / amino acid derivative. Protective, skin-conditioning.
  // Well-studied, considered safe; growing use in dermo-cosmetics.
  {
    suggested_canonical_name: "ectoin",
    aliases: [
      "ectoin",
      "ectoine",
    ],
    risk_level:         "low",
    function_tags:      ["skin_conditioning", "protective", "humectant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 4. Glycyrrhetinic Acid ────────────────────────────────────────────────
  // Licorice root aglycone. Anti-inflammatory, soothing. Used in sensitive-skin
  // and redness-reducing formulas.
  {
    suggested_canonical_name: "glycyrrhetinic acid",
    aliases: [
      "glycyrrhetinic acid",
      "glycyrrhetic acid",
      "enoxolone",
    ],
    risk_level:         "low",
    function_tags:      ["skin_conditioning", "soothing", "anti_inflammatory"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 5. Trisodium Ethylenediamine Disuccinate ──────────────────────────────
  // Biodegradable chelating agent; alternative to EDTA. Stabilises formulas.
  {
    suggested_canonical_name: "trisodium ethylenediamine disuccinate",
    aliases: [
      "trisodium ethylenediamine disuccinate",
    ],
    risk_level:         "low",
    function_tags:      ["chelating"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 6. Ceteareth-25 ───────────────────────────────────────────────────────
  // Ethoxylated fatty alcohol emulsifier (25 EO units). Used in O/W emulsions.
  // Potential for 1,4-dioxane impurities (manufacturing quality-dependent).
  {
    suggested_canonical_name: "ceteareth-25",
    aliases: [
      "ceteareth-25",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 7. Cellulose Gum ──────────────────────────────────────────────────────
  // Carboxymethylcellulose sodium (CMC); common thickener and stabiliser.
  // Widely used, considered safe.
  {
    suggested_canonical_name: "cellulose gum",
    aliases: [
      "cellulose gum",
      "carboxymethyl cellulose",
      "sodium carboxymethyl cellulose",
      "sodium cmc",
    ],
    risk_level:         "low",
    function_tags:      ["thickener", "texture", "stabiliser"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 8. C20-22 Alcohols ────────────────────────────────────────────────────
  // Long-chain fatty alcohol blend (C20–C22). Emollient and texture modifier.
  {
    suggested_canonical_name: "c20-22 alcohols",
    aliases: [
      "c20-22 alcohols",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "texture", "viscosity_modifier"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 9. C20-22 Alkyl Phosphate ─────────────────────────────────────────────
  // Phosphate ester of C20-22 alcohols. Mild emulsifier used with C20-22 alcohols.
  {
    suggested_canonical_name: "c20-22 alkyl phosphate",
    aliases: [
      "c20-22 alkyl phosphate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 10. Diisopropyl Sebacate ──────────────────────────────────────────────
  // Diisopropyl ester of sebacic acid. Lightweight emollient and solvent.
  // Good skin feel; non-comedogenic.
  {
    suggested_canonical_name: "diisopropyl sebacate",
    aliases: [
      "diisopropyl sebacate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "solvent", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertLibraryGapsV2 — Top-10 Unknown Ingredient Insert");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Candidates: ${REVIEWED_CANDIDATES.length}`);
  console.log(" IDEMPOTENT — safe to re-run.");
  console.log(" Does NOT touch score engine, resolver, UI, or local registry.");
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  console.log("Candidates to insert:");
  for (const c of REVIEWED_CANDIDATES) {
    const aliasStr = c.aliases.join(", ");
    console.log(`  • "${c.suggested_canonical_name}"  [risk: ${c.risk_level}]`);
    console.log(`    aliases : ${aliasStr}`);
    console.log(`    tags    : ${(c.function_tags ?? []).join(", ")}`);
  }
  console.log();

  console.log("Applying …");
  const result = await applyUnknownResolutionCandidates(REVIEWED_CANDIDATES, sb);
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("═════════════════════════════════════════════════════════════");
  console.log(" RESULT SUMMARY");
  console.log("═════════════════════════════════════════════════════════════");
  console.log(`  inserted_master_count : ${result.inserted_master_count}`);
  console.log(`  reused_master_count   : ${result.reused_master_count}`);
  console.log(`  inserted_alias_count  : ${result.inserted_alias_count}`);
  console.log(`  skipped_alias_count   : ${result.skipped_alias_count}`);
  console.log(`  errors                : ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log();
    console.log("  ERRORS:");
    for (const e of result.errors) {
      const alias = e.alias ? ` (alias: "${e.alias}")` : "";
      console.log(`    ❌ "${e.candidate_canonical}"${alias}: ${e.message}`);
    }
  }

  console.log("═════════════════════════════════════════════════════════════");

  if (result.errors.length === 0) {
    console.log();
    console.log(` ✅ Completed cleanly.`);
    console.log(` ${result.inserted_master_count} new master row(s),`);
    console.log(` ${result.inserted_alias_count} new alias row(s).`);
    console.log();
    console.log(` Next step: run reportUnknownIngredients.ts to confirm`);
    console.log(` these entries no longer appear as unknowns.`);
  } else {
    console.log();
    console.log(` ⚠️  Completed with ${result.errors.length} error(s). Review above.`);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
