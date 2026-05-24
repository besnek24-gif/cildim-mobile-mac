/**
 * batchInsertLibraryGapsV4.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: 10 impact-selected ingredient candidates.
 * Source: full remaining-unknowns scan — 2026-04-13 (28 products, 105 distinct
 * unknowns after V3 candidates are excluded).
 *
 * SELECTION CRITERIA (not frequency alone):
 *   1. Appears in ≥ 2 products OR high expected future prevalence
 *   2. Directly affects scoring: active, preservative, UV filter, antioxidant
 *   3. Widely used across European dermocosmetics / sun-care formulas
 *
 * NOTABLE ENTRIES:
 *   • 1,2-hexanediol  — "2-Hexanediol" in DB; both normalized forms registered
 *   • o-cymen-5-ol    — "0-Cymen-5-Ol" in DB (OCR artefact); zero-form alias included
 *   • ceteareth-25    — adds "ceterareth-25" (misspelling in Dermolife) as synonym;
 *                       if master row already exists (from V2) it is reused, not overwritten
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertLibraryGapsV4.ts
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

// ── 10 impact-selected candidates ─────────────────────────────────────────────
//
// Impact tier key:
//   [A] UV filter / active → direct scoring weight
//   [B] Preservative       → concern-flag / safety scoring
//   [C] High future coverage (common class, appears in many formulas globally)
//   [D] Multi-product (≥ 2 in current DB)
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Terephthalylidene Dicamphor Sulfonic Acid  [A] ───────────────────────
  // UVA filter (Mexoryl SX).  EU-approved (max 10 %).  Water-soluble photostable
  // UVA I + II absorber.  Hallmark ingredient in La Roche-Posay Anthelios line.
  // Affects UV-filter coverage scoring directly — highest scoring impact in batch.
  // 2× in current DB: LRP Anthelios Age Correct + LRP Anthelios UVmune 400.
  {
    suggested_canonical_name: "terephthalylidene dicamphor sulfonic acid",
    aliases: [
      "terephthalylidene dicamphor sulfonic acid",
      "mexoryl sx",
    ],
    risk_level:         "low",
    function_tags:      ["uv_filter", "uva_filter", "photostabiliser"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 2. 1,2-Hexanediol  [B][C] ───────────────────────────────────────────────
  // Multifunctional diol: humectant + preservative booster + antimicrobial
  // (especially at higher concentrations).  Core ingredient in paraben-free and
  // "clean" preservation systems.  Growing prevalence across all product categories.
  //
  // normalizeForLookup("1,2-hexanediol") → "12-hexanediol"   (canonical alias)
  // normalizeForLookup("2-hexanediol")   → "2-hexanediol"    (synonym alias)
  // Both forms are registered so products listing either spelling resolve correctly.
  // DB raw form: "2-Hexanediol" (in Bioderma Photoderm Aquafluide).
  {
    suggested_canonical_name: "1,2-hexanediol",
    aliases: [
      "1,2-hexanediol",
      "2-hexanediol",
      "hexanediol",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "preservative_booster", "antimicrobial"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 3. o-Cymen-5-ol  [B][C] ────────────────────────────────────────────────
  // Antimicrobial preservative (4-isopropyl-3-methylphenol / Biosol).
  // Used in Bioderma Photoderm Aquafluide at low concentration.
  // Common in combination preservative systems (often paired with 1,2-hexanediol).
  //
  // INCI correct form: "o-Cymen-5-ol" (prefix is letter o, not digit 0).
  // DB raw form:       "0-Cymen-5-Ol" — normalises to "0-cymen-5-ol" (with zero).
  // Both normalized forms are registered as aliases so both spellings resolve.
  {
    suggested_canonical_name: "o-cymen-5-ol",
    aliases: [
      "o-cymen-5-ol",
      "0-cymen-5-ol",
      "biosol",
    ],
    risk_level:         "low",
    function_tags:      ["preservative", "antimicrobial"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 4. Caprylhydroxamic Acid  [B][C] ────────────────────────────────────────
  // Chelating preservative — binds metal ions that microbes need for growth.
  // Increasingly common in "free-from" and sensitive-skin preservation systems
  // (often paired with 1,2-hexanediol or glycols).  Low irritation potential.
  // DB raw form: "caprylhydroxamic acid" (Bionike Defence Sun Fluid).
  {
    suggested_canonical_name: "caprylhydroxamic acid",
    aliases: [
      "caprylhydroxamic acid",
    ],
    risk_level:         "low",
    function_tags:      ["preservative", "chelating"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 5. Cocos Nucifera Oil  [A][C] ───────────────────────────────────────────
  // Virgin/refined coconut oil.  Rich in lauric acid (≈ 47 %) and medium-chain
  // fatty acids.  Emollient, occlusive and skin-barrier-supportive.  One of the
  // most globally prevalent cosmetic oils — near-universal future coverage.
  // Currently in baby shampoo; will appear in virtually every natural/clean formula.
  {
    suggested_canonical_name: "cocos nucifera oil",
    aliases: [
      "cocos nucifera oil",
      "coconut oil",
      "virgin coconut oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "occlusive", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 6. Ascorbyl Palmitate  [A][C] ───────────────────────────────────────────
  // Lipophilic ester of vitamin C (ascorbic acid + palmitic acid).  Antioxidant
  // that stabilises lipid-phase formulas.  Used in ISDIN Fusion Water.
  // Very common in SPF, brightening and anti-aging products — high future coverage.
  // Affects antioxidant-active scoring.
  {
    suggested_canonical_name: "ascorbyl palmitate",
    aliases: [
      "ascorbyl palmitate",
      "vitamin c palmitate",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "skin_conditioning", "vitamin_c"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 7. Ammonium Polyacryloyldimethyl Taurate  [C] ───────────────────────────
  // Anionic acrylic polymer rheology modifier (trade name: Aristoflex AVC blend).
  // Builds viscosity in high-electrolyte and UV-filter-rich systems — near-
  // universal in fluid SPF emulsions and gel-cream formulas.  LRP Anthelios Age
  // Correct uses it; expect it in the majority of future fluid sunscreen products.
  {
    suggested_canonical_name: "ammonium polyacryloyldimethyl taurate",
    aliases: [
      "ammonium polyacryloyldimethyl taurate",
    ],
    risk_level:         "low",
    function_tags:      ["rheology_modifier", "thickener", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 8. Ginkgo Biloba Leaf Extract  [A][C] ───────────────────────────────────
  // Standardised extract of Ginkgo biloba leaves.  Rich in flavone glycosides
  // (quercetin, kaempferol) and terpene lactones; antioxidant and soothing.
  // Used in Bioderma Photoderm AR.  One of the most globally common botanical
  // extracts in anti-aging, anti-redness and photoprotection formulas.
  {
    suggested_canonical_name: "ginkgo biloba leaf extract",
    aliases: [
      "ginkgo biloba leaf extract",
      "ginkgo biloba extract",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "soothing", "botanical_extract"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 9. Di-C12-13 Alkyl Malate  [D][C] ──────────────────────────────────────
  // Diester of malic acid and C12-13 fatty alcohols.  Lightweight skin-feel
  // emollient; often used in dry-touch and fast-absorbing SPF formulas.
  // 2× in current DB: Dermoskin Face Protection SPF50+ + Physiogel Daily Moisture.
  // High future coverage in fluid and dry-touch sun-care product lines.
  {
    suggested_canonical_name: "di-c12-13 alkyl malate",
    aliases: [
      "di-c12-13 alkyl malate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 10. Ceteareth-25  (misspelling alias patch)  [D] ───────────────────────
  // INCI: Ceteareth-25 — ethoxylated cetearyl alcohol emulsifier.
  // Already in ingredients_master (inserted by batchInsertLibraryGapsV2.ts).
  //
  // This entry adds "ceterareth-25" as a synonym alias to resolve the known
  // misspelling found in:  Dermolife Leke Karşıtı SPF50+ ("Ceterareth-25").
  // normalizeForLookup("ceterareth-25") → "ceterareth-25"   (new alias)
  // normalizeForLookup("ceteareth-25")  → "ceteareth-25"    (already exists)
  //
  // If the master row exists (V2 was run): reused, only new alias is inserted.
  // If the master row does not yet exist:  created with the data below.
  {
    suggested_canonical_name: "ceteareth-25",
    aliases: [
      "ceteareth-25",
      "ceterareth-25",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const HR  = "─".repeat(65);
  const HR2 = "═".repeat(65);

  console.log(HR);
  console.log(" batchInsertLibraryGapsV4 — Impact-Selected Ingredient Insert");
  console.log(` Supabase  : ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Candidates: ${REVIEWED_CANDIDATES.length}`);
  console.log(" Source    : remaining-unknowns scan — 2026-04-13 (105 items)");
  console.log(" Selection : UV filters | preservatives | high-future-coverage");
  console.log(" IDEMPOTENT — safe to re-run.");
  console.log(" Does NOT touch score engine, resolver, UI, or local registry.");
  console.log(HR);
  console.log();

  // ── Preview table ─────────────────────────────────────────────────────────

  const IMPACT_LABEL: Record<string, string> = {
    "terephthalylidene dicamphor sulfonic acid": "[A] UV filter",
    "1,2-hexanediol":                            "[B][C] preservative / humectant",
    "o-cymen-5-ol":                              "[B][C] antimicrobial preservative",
    "caprylhydroxamic acid":                     "[B][C] chelating preservative",
    "cocos nucifera oil":                        "[A][C] emollient — high future coverage",
    "ascorbyl palmitate":                        "[A][C] vitamin C active",
    "ammonium polyacryloyldimethyl taurate":     "[C] rheology — universal in SPF fluids",
    "ginkgo biloba leaf extract":                "[A][C] antioxidant extract",
    "di-c12-13 alkyl malate":                    "[D][C] emollient ester — 2× products",
    "ceteareth-25":                              "[D] misspelling alias patch",
  };

  console.log("Candidates:");
  for (const c of REVIEWED_CANDIDATES) {
    const impact  = IMPACT_LABEL[c.suggested_canonical_name] ?? "";
    const aliases = c.aliases.join(", ");
    const tags    = (c.function_tags ?? []).join(", ");
    console.log(`  • "${c.suggested_canonical_name}"`);
    console.log(`    impact  : ${impact}`);
    console.log(`    aliases : ${aliases}`);
    console.log(`    tags    : ${tags}`);
    console.log(`    preg    : ${c.pregnancy_flag ?? "?"}  /  breast: ${c.breastfeeding_flag ?? "?"}`);
  }
  console.log();

  // ── Apply ─────────────────────────────────────────────────────────────────

  console.log("Applying …");
  const result = await applyUnknownResolutionCandidates(REVIEWED_CANDIDATES, sb);
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────

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
    console.log(`     Next step: re-run the aggregate unknown scan or`);
    console.log(`     reportUnknownIngredients.ts to verify resolution.`);
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
