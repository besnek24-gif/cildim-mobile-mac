/**
 * batchInsertLibraryGapsV1.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: writes 7 reviewed V4 library gap ingredients into the
 * Supabase ingredient library (ingredients_master + ingredient_aliases) so
 * they resolve via PATH 1 on future requests.
 *
 * These 7 candidates were identified as genuine library gaps by
 * reportUnknownIngredients.ts and debugAveneTokens.ts — confirmed to have no
 * matching entry in either Supabase or the local V4 registry after parenthetical
 * stripping.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertLibraryGapsV1.ts
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

import { createLeanSupabase }                  from "../nodeResolver";
import { applyUnknownResolutionCandidates }     from "../batchResolverNodeSafe";
import type { BatchResolutionCandidate }        from "../batchResolverNodeSafe";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Reviewed candidates ───────────────────────────────────────────────────────
//
// These 7 entries are the remaining genuine V4 library gaps after parenthetical
// pre-processor fixes. Each was verified:
//   - Not present in ingredient_aliases (Supabase PATH 1)
//   - Not present in local V4 registry  (Local   PATH 2)
//   - Stripped form also confirmed absent
//
// RISK + FLAG SOURCES: INCI/CosIng database, EWG Skin Deep, EU cosmetics annex.
// All are reviewed candidates — no automated queue processing.
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [
  // ── 1. Oryza Sativa Starch ───────────────────────────────────────────────
  // Confirmed unknown: raw "Oryza Sativa (Rice) Starch (Oryza Sativa Starch)"
  // Stripped form "Oryza Sativa Starch" also absent from library.
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

  // ── 2. Zea Mays Starch ───────────────────────────────────────────────────
  // Confirmed unknown: raw "Zea Mays (Corn) Starch (Zea Mays Starch)"
  // Stripped form "Zea Mays Starch" also absent from library.
  {
    suggested_canonical_name: "zea mays starch",
    aliases: [
      "zea mays starch",
      "corn starch",
    ],
    risk_level:         "low",
    function_tags:      ["absorbent", "texture", "starch"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 3. Tapioca Starch ────────────────────────────────────────────────────
  // Confirmed unknown: raw "Tapioca Starch" — no parenthetical notation.
  {
    suggested_canonical_name: "tapioca starch",
    aliases: [
      "tapioca starch",
    ],
    risk_level:         "low",
    function_tags:      ["absorbent", "texture", "starch"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 4. PPG-1-PEG-9 Lauryl Glycol Ether ──────────────────────────────────
  // Confirmed unknown: raw "PPG-1-PEG-9 Lauryl Glycol Ether"
  // No parenthetical. Normalized: "ppg-1-peg-9 lauryl glycol ether"
  {
    suggested_canonical_name: "ppg-1-peg-9 lauryl glycol ether",
    aliases: [
      "ppg-1-peg-9 lauryl glycol ether",
    ],
    risk_level:         "medium",
    function_tags:      ["solvent", "texture", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 5. Red 33 / CI 17200 ────────────────────────────────────────────────
  // Confirmed unknown: raw "Red 33 (Ci 17200)"
  // Stripped form "Red 33" also absent.
  // Alias "red 33 (ci 17200)" normalized → "red 33 ci 17200"
  {
    suggested_canonical_name: "red 33",
    aliases: [
      "red 33",
      "ci 17200",
      "red 33 (ci 17200)",
    ],
    risk_level:         "medium",
    function_tags:      ["colorant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "moderate",
  },

  // ── 6. Tocopheryl Glucoside ──────────────────────────────────────────────
  // Confirmed unknown: raw "Tocopheryl Glucoside" — distinct from Tocopherol
  // and Tocopheryl Acetate which are already in the library.
  {
    suggested_canonical_name: "tocopheryl glucoside",
    aliases: [
      "tocopheryl glucoside",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "skin_conditioning", "vitamin_e_derivative"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 7. Zinc Gluconate ────────────────────────────────────────────────────
  // Confirmed unknown: raw "Zinc Gluconate" — no parenthetical notation.
  {
    suggested_canonical_name: "zinc gluconate",
    aliases: [
      "zinc gluconate",
    ],
    risk_level:         "low",
    function_tags:      ["skin_conditioning", "sebum_support", "mineral"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertLibraryGapsV1 — Reviewed Candidate Insert");
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
    console.log(` these 7 entries no longer appear as unknowns.`);
  } else {
    console.log();
    console.log(` ⚠️  Completed with ${result.errors.length} error(s). Review above.`);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
