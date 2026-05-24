/**
 * batchInsertLibraryGapsV5.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: top-5 remaining unknown ingredients after V3 + V4.
 * Source: remaining-unknowns scan — 2026-04-13 (28 products, 105 unknowns after
 * V3 scope; V3+V4 candidates excluded below).
 *
 * SELECTION CRITERIA:
 *   • ≥ 2 distinct products  OR  high-impact category (solvent, buffer, active)
 *   • High expected future prevalence across new product additions
 *
 * SELECTED 5:
 *   1. aluminum starch octenylsuccinate  — 2 products (2 spelling variants bridged)
 *   2. c9-12 alkane                      — isoalkane solvent; common in fluid SPF
 *   3. sodium citrate                    — pH buffer/chelating; near-universal future
 *   4. c14-22 alcohols                   — fatty alcohol co-emulsifier class
 *   5. caffeic acid                      — antioxidant active (Heliocare Fernblock)
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertLibraryGapsV5.ts
 *
 * IDEMPOTENT — safe to re-run.
 *   reused_master_count → canonical already in ingredients_master (no overwrite)
 *   skipped_alias_count → normalized_alias already in ingredient_aliases
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT touch the live score engine (V4 or any other)
 *   - Does NOT modify the local V4 registry (coreRegistry.ts or expansions)
 *   - Does NOT touch resolver/index.ts behaviour
 *   - Does NOT write to ingredient_unknown_queue
 *   - Does NOT remove or overwrite any existing row
 *   - Does NOT run automatically — manual execution only
 *
 * Sources: CosIng EU, EWG Skin Deep, INCI official, peer-reviewed literature.
 */

import { createLeanSupabase }              from "../nodeResolver";
import { applyUnknownResolutionCandidates } from "../batchResolverNodeSafe";
import type { BatchResolutionCandidate }   from "../batchResolverNodeSafe";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── 5 candidates ──────────────────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Aluminum Starch Octenylsuccinate  ─────────────────────────────────────
  // Modified starch (octenyl succinate anhydride-treated) used as an absorbent,
  // anti-caking agent and texture modifier in mineral and hybrid SPF formulas.
  // Appears in 2 products under different spellings:
  //   "Aluminium Starch Octenylsuccinate"  (La Roche-Posay Anthelios Age Correct)
  //   "aluminum starch octenylsuccinate"   (Bionike Defence Sun Fluid)
  // normalizeForLookup produces different strings for each:
  //   "aluminium starch octenylsuccinate"  → synonym alias (British spelling)
  //   "aluminum starch octenylsuccinate"   → canonical (INCI standard)
  // Both are registered so either spelling resolves correctly.
  {
    suggested_canonical_name: "aluminum starch octenylsuccinate",
    aliases: [
      "aluminum starch octenylsuccinate",
      "aluminium starch octenylsuccinate",
    ],
    risk_level:         "low",
    function_tags:      ["absorbent", "texture", "anti_caking"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 2. C9-12 Alkane  ─────────────────────────────────────────────────────────
  // Branched isoalkane blend (C9–C12 range); functions as a lightweight, volatile
  // spreading solvent giving a dry, fluid skin feel.  Used in Avène Ultra Fluid
  // Invisible SPF50+.  Increasingly common as the "dry-touch" solvent of choice in
  // fluid mineral and hybrid SPF formulations — very high future prevalence.
  {
    suggested_canonical_name: "c9-12 alkane",
    aliases: [
      "c9-12 alkane",
      "c9-c12 alkane",
    ],
    risk_level:         "low",
    function_tags:      ["solvent", "texture", "emollient"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 3. Sodium Citrate  ────────────────────────────────────────────────────────
  // Trisodium salt of citric acid.  Acts as a pH buffer, chelating agent and mild
  // preservative booster.  Near-universal across all cosmetic categories — appears
  // in emulsions, serums, gels and sun-care products.  Present in La Roche-Posay
  // Anthelios UVmune 400.  Almost every new product added to the library will
  // contain it; highest future-coverage utility of this batch.
  {
    suggested_canonical_name: "sodium citrate",
    aliases: [
      "sodium citrate",
      "trisodium citrate",
    ],
    risk_level:         "low",
    function_tags:      ["chelating", "ph_adjuster", "preservative_booster"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 4. C14-22 Alcohols  ──────────────────────────────────────────────────────
  // Long-chain fatty alcohol blend (C14–C22).  Used as a co-emulsifier alongside
  // alkyl glucoside surfactants (e.g. C12-20 alkyl glucoside) in the Cosmedia Gel
  // CC system.  Present in Heliocare 360 Gel Oil-Free SPF50.  Common as a texture
  // modifier and emollient in modern gel-cream and fluid SPF formats.
  {
    suggested_canonical_name: "c14-22 alcohols",
    aliases: [
      "c14-22 alcohols",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "emulsifier", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 5. Caffeic Acid  ──────────────────────────────────────────────────────────
  // Natural hydroxycinnamic acid phenolic antioxidant.  Found in coffee, olive oil
  // and many plant extracts.  Core constituent of Heliocare 360's Fernblock XT
  // (Polypodium leucotomos) antioxidant system.  Directly affects antioxidant-active
  // scoring.  Growing prevalence in anti-aging and photoprotection formulations.
  {
    suggested_canonical_name: "caffeic acid",
    aliases: [
      "caffeic acid",
      "3,4-dihydroxycinnamic acid",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "botanical_extract", "skin_conditioning"],
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
  console.log(" batchInsertLibraryGapsV5 — Top-5 Remaining Unknown Insert");
  console.log(` Supabase  : ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Candidates: ${REVIEWED_CANDIDATES.length}`);
  console.log(" Source    : remaining-unknowns scan — 2026-04-13");
  console.log(" Scope     : post-V3 + post-V4 exclusions");
  console.log(" IDEMPOTENT — safe to re-run.");
  console.log(" Does NOT touch score engine, resolver, UI, or local registry.");
  console.log(HR);
  console.log();

  console.log("Candidates:");
  for (const c of REVIEWED_CANDIDATES) {
    const aliases = c.aliases.join(", ");
    const tags    = (c.function_tags ?? []).join(", ");
    console.log(`  • "${c.suggested_canonical_name}"  [risk: ${c.risk_level ?? "?"}]`);
    console.log(`    aliases : ${aliases}`);
    console.log(`    tags    : ${tags}`);
    console.log(`    preg    : ${c.pregnancy_flag ?? "?"}  /  breast: ${c.breastfeeding_flag ?? "?"}`);
  }
  console.log();

  console.log("Applying …");
  const result = await applyUnknownResolutionCandidates(REVIEWED_CANDIDATES, sb);
  console.log();

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
