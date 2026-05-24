/**
 * batchInsertLibraryGapsV6.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: Dalga A high-impact real INCI unknowns.
 * Source: fastUnknownReport.ts run — 2026-05-07
 *   (1254 products scanned, 27 889 ingredient instances, 3 854 unknown,
 *   1 589 unique unknown tokens, coverage 86.18 %).
 *
 * SELECTION CRITERIA (Dalga A):
 *   • Real INCI ingredient (not a parser artifact)
 *   • Highest-frequency unknowns from the latest report (≥ 7 products typical)
 *   • Direct value to scoring / safety / pregnancy verdicts
 *   • Conservative classification — `unknown` flags preferred over guesses
 *
 * EXPLICITLY EXCLUDED (left for separate batches):
 *   • Parser artifacts:
 *       "Water (Aqua", "Aqua (Water", "BIOCOMPLEX B11 (URTICA URENS LEAF EXTRACT",
 *       "EQUISETUM ARVENSE LEAF EXTRACT)" trailing-paren orphan,
 *       "2-Oleamido-1" + "3-Octadecanediol"  (single INCI split by comma)
 *     Reason: should be fixed by parser (Dalga E), not by canonical insert.
 *   • Fragrance allergens (Butylphenyl Methylpropional, Linalyl Acetate,
 *     Tetramethyl Acetyloctahydronaphthalenes) — belong in the
 *     batchInsertFragranceAllergensPhase1C.ts pattern (Dalga B), needs
 *     allergy_flag + 26-list metadata that script handles specifically.
 *   • CI colourants (CI 16035, CI 47005, CI 75470, CI 77007, ...) — a
 *     dedicated colourant batch is more appropriate (Dalga C).
 *   • Single-word fragments that may themselves be parser issues:
 *       "Pca"  (very likely truncation of "Sodium PCA")
 *       "Mel"  (Latin INCI for honey — kept out until reviewed)
 *   • Ambiguous "Zinc" — INCI accepts elemental "Zinc", but the 9 occurrences
 *     in the DB sit in oral supplement tablets where "Zinc" is the labelled
 *     mineral, not a topical INCI. Held back pending review of source rows.
 *
 * NOT INCLUDED FROM USER LIST (with reason):
 *   • cocos nucifera oil       — already inserted by V4 (will be `reused_master`).
 *                                V6 still adds extra slash/parenthetical aliases.
 *   • mentha piperita leaf water — distinct from "mentha piperita oil"; V3 has
 *                                  the *water* canonical. V6 adds the *oil*.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory) — DO NOT auto-run:
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertLibraryGapsV6.ts
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
 *   - Does NOT remove or overwrite any existing ingredients_master row
 *   - Does NOT run automatically — manual execution only
 *   - Does NOT change UI, Home, Search, ProductCard, ProductImage, navigation,
 *     auth, scan flow, or any other application code
 *
 * Sources: CosIng EU, EWG Skin Deep, INCI official, peer-reviewed literature,
 *          PubChem, manufacturer SDS sheets.
 */

import { createLeanSupabase }              from "../nodeResolver";
import { applyUnknownResolutionCandidates } from "../batchResolverNodeSafe";
import type { BatchResolutionCandidate }   from "../batchResolverNodeSafe";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Dalga A candidates ────────────────────────────────────────────────────────
//
// Frequency (# products) annotated from fastUnknownReport.ts 2026-05-07.
// Aliases include all observed raw spellings (uppercase, asterisk, slash,
// parenthetical, trailing punctuation) so a single re-run resolves them all.
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Menthol  [40 prods] ──────────────────────────────────────────────────
  // Cooling/refreshing agent (cyclic monoterpene alcohol). Common in scalp,
  // shaving and after-sun formulas. Known mild sensitiser at higher levels.
  {
    suggested_canonical_name: "menthol",
    aliases: [
      "menthol",
      "MENTHOL",
      "l-menthol",
      "dl-menthol",
    ],
    risk_level:         "low",
    function_tags:      ["cooling", "fragrance", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "moderate",
  },

  // ── 2. Piroctone Olamine  [36 prods] ────────────────────────────────────────
  // Anti-dandruff active (octopirox). Effective vs Malassezia; widespread in
  // anti-dandruff and acne-prone scalp products.
  {
    suggested_canonical_name: "piroctone olamine",
    aliases: [
      "piroctone olamine",
      "octopirox",
    ],
    risk_level:         "low",
    function_tags:      ["anti_dandruff", "antimicrobial", "scalp_care"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 3. Aluminum Chlorohydrate  [34 prods] ───────────────────────────────────
  // Antiperspirant active. Pregnancy use is debated; conservatively flagged
  // "caution" so downstream verdicts surface a notice rather than green-light it.
  {
    suggested_canonical_name: "aluminum chlorohydrate",
    aliases: [
      "aluminum chlorohydrate",
      "aluminium chlorohydrate",
      "ALUMINUM CHLOROHYDRATE",
    ],
    risk_level:         "medium",
    function_tags:      ["antiperspirant", "astringent"],
    concern_flags:      ["antiperspirant", "aluminum_salt"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "low",
  },

  // ── 4. Copper Sulfate  [23 prods] ───────────────────────────────────────────
  // Trace mineral. Cosmetic concentrations very low; used as anti-microbial
  // in body-wash and bath products (Bioderma Atoderm line).
  {
    suggested_canonical_name: "copper sulfate",
    aliases: [
      "copper sulfate",
      "COPPER SULFATE",
      "copper sulphate",
      "cupric sulfate",
    ],
    risk_level:         "low",
    function_tags:      ["mineral", "antimicrobial"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 5. Copper Gluconate  [15 prods] ─────────────────────────────────────────
  // Skin-conditioning copper salt; antioxidant cofactor. Low irritation potential.
  {
    suggested_canonical_name: "copper gluconate",
    aliases: [
      "copper gluconate",
    ],
    risk_level:         "low",
    function_tags:      ["mineral", "skin_conditioning", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 6. Argania Spinosa Kernel Oil  [19 prods] ───────────────────────────────
  // Argan oil. Rich in tocopherols, linoleic and oleic acids. Universal
  // emollient in hair-repair products.
  {
    suggested_canonical_name: "argania spinosa kernel oil",
    aliases: [
      "argania spinosa kernel oil",
      "argan oil",
      "argan kernel oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "botanical_oil", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 7. Persea Gratissima Oil  [19 prods] ────────────────────────────────────
  // Avocado oil. Asterisk suffix in DB ("Persea Gratissima Oil*") is an
  // organic-source marker — included as a literal alias so it resolves cleanly.
  {
    suggested_canonical_name: "persea gratissima oil",
    aliases: [
      "persea gratissima oil",
      "persea gratissima oil*",
      "avocado oil",
      "persea americana oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "botanical_oil", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 8. Achillea Millefolium Extract  [16 prods] ─────────────────────────────
  // Yarrow extract. Soothing botanical. Pregnancy use of *medicinal* yarrow is
  // debated (emmenagogue claims); cosmetic levels are low — conservatively
  // marked "unknown" rather than "safe".
  {
    suggested_canonical_name: "achillea millefolium extract",
    aliases: [
      "achillea millefolium extract",
      "ACHILLEA MILLEFOLIUM EXTRACT",
      "yarrow extract",
    ],
    risk_level:         "low",
    function_tags:      ["soothing", "botanical_extract", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 9. Cocos Nucifera Oil  [16 prods, slash spelling]  ──────────────────────
  // Canonical already added by V4 ("cocos nucifera oil"). This entry is
  // idempotent (master row will be REUSED) and exists only to register the
  // additional slash / Turkish-market aliases observed in the new report:
  //   "COCOS NUCIFERA OIL / COCONUT OIL"   (16 products)
  // Score engine, registry and resolver are unchanged.
  {
    suggested_canonical_name: "cocos nucifera oil",
    aliases: [
      "cocos nucifera oil",
      "coconut oil",
      "cocos nucifera oil / coconut oil",
      "cocos nucifera oil/coconut oil",
      "cocos nucifera (coconut) oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "occlusive", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 10. Equisetum Arvense Leaf Extract  [16 prods + queue] ──────────────────
  // Horsetail extract. High in silica; soothing/strengthening claim. Trailing
  // ")" in raw form ("EQUISETUM ARVENSE LEAF EXTRACT)") is a parser artifact —
  // NOT registered as alias here (will be fixed by Dalga E parser cleanup).
  {
    suggested_canonical_name: "equisetum arvense leaf extract",
    aliases: [
      "equisetum arvense leaf extract",
      "EQUISETUM ARVENSE LEAF EXTRACT",
      "equisetum arvense extract",
      "horsetail extract",
    ],
    risk_level:         "low",
    function_tags:      ["soothing", "botanical_extract", "astringent"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 11. Ceratonia Siliqua Fruit Extract  [15 prods] ─────────────────────────
  // Carob extract. Mild emollient/skin-conditioning agent.
  {
    suggested_canonical_name: "ceratonia siliqua fruit extract",
    aliases: [
      "ceratonia siliqua fruit extract",
      "CERATONIA SILIQUA FRUIT EXTRACT",
      "carob fruit extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 12. Glycine Soja Oil (Soybean Oil)  [15 + 13 + 8 prods, multi-spelling] ─
  // Soybean oil. INCI dual-name "Glycine Soja (Soybean) Oil". Single canonical
  // covers both sides of the slash and the parenthetical form so all observed
  // raw spellings resolve to one row:
  //   "Glycine Soja Oil / Soybean Oil"            (15)
  //   "Glycine Soja (Soybean) Oil"                (13)
  //   "Glycine Soja (Soybean) Oil (Glycine Soja Oil)" (8 — duplicate-wrap)
  {
    suggested_canonical_name: "glycine soja oil",
    aliases: [
      "glycine soja oil",
      "soybean oil",
      "glycine soja (soybean) oil",
      "glycine soja oil / soybean oil",
      "glycine soja oil/soybean oil",
      "glycine soja (soybean) oil (glycine soja oil)",
      "glycine max oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "botanical_oil", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 13. 1-Methylhydantoin-2-Imide  [14 prods] ───────────────────────────────
  // Beiersdorf "HMI" — patented signal molecule used in NIVEA/Eucerin
  // anti-age and barrier products. No regulatory concern in topical use.
  {
    suggested_canonical_name: "1-methylhydantoin-2-imide",
    aliases: [
      "1-methylhydantoin-2-imide",
      "methylhydantoin-2-imide",
      "hmi",
    ],
    risk_level:         "low",
    function_tags:      ["skin_conditioning", "anti_aging"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 14. Chlorhexidine Digluconate  [13 prods] ───────────────────────────────
  // Antimicrobial preservative. EU-restricted to ≤ 0.3 % in cosmetics. Low
  // irritation at use levels but conservatively flagged caution for preg/breast.
  {
    suggested_canonical_name: "chlorhexidine digluconate",
    aliases: [
      "chlorhexidine digluconate",
      "CHLORHEXIDINE DIGLUCONATE",
      "chlorhexidine gluconate",
    ],
    risk_level:         "low",
    function_tags:      ["antimicrobial", "preservative"],
    concern_flags:      ["antimicrobial"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
  },

  // ── 15. Oleic Acid  [13 prods] ──────────────────────────────────────────────
  // C18:1 fatty acid. Emollient, surfactant precursor. Slightly comedogenic
  // for acne-prone skin; surfaced via concern_flags.
  {
    suggested_canonical_name: "oleic acid",
    aliases: [
      "oleic acid",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "fatty_acid", "skin_conditioning"],
    concern_flags:      ["comedogenic_potential"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 16. Sodium Metabisulfite  [12 prods] ────────────────────────────────────
  // Antioxidant / preservative. Sulfite — known sensitiser for sulfite-allergic
  // users. Allergy flag = moderate.
  {
    suggested_canonical_name: "sodium metabisulfite",
    aliases: [
      "sodium metabisulfite",
      "SODIUM METABISULFITE",
      "sodium metabisulphite",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "preservative_booster"],
    concern_flags:      ["sulfite"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "moderate",
  },

  // ── 17. Vitreoscilla Ferment  [12 prods] ────────────────────────────────────
  // Bacterial ferment used in La Roche-Posay Lipikar and Effaclar barrier
  // products. Soothing / microbiome-friendly active.
  {
    suggested_canonical_name: "vitreoscilla ferment",
    aliases: [
      "vitreoscilla ferment",
      "vitreoscilla filiformis ferment",
      "vitreoscilla filiformis extract",
    ],
    risk_level:         "low",
    function_tags:      ["soothing", "microbiome", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 18. Urtica Dioica Root Extract  [11 prods] ──────────────────────────────
  // Stinging nettle root extract. Common in scalp/hair-loss formulas (Bioxcin).
  {
    suggested_canonical_name: "urtica dioica root extract",
    aliases: [
      "urtica dioica root extract",
      "URTICA DIOICA ROOT EXTRACT",
      "stinging nettle root extract",
      "nettle root extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "scalp_care"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 19. PEG-8  [10 prods] ───────────────────────────────────────────────────
  // Polyethylene glycol, MW ≈ 400. Humectant / solvent. Standard cosmetic
  // ingredient.
  {
    suggested_canonical_name: "peg-8",
    aliases: [
      "peg-8",
      "polyethylene glycol 400",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "solvent"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 20. Vanillyl Butyl Ether  [10 prods] ────────────────────────────────────
  // Warming sensate. Used in lip-plumping and warming-mask formulas.
  {
    suggested_canonical_name: "vanillyl butyl ether",
    aliases: [
      "vanillyl butyl ether",
    ],
    risk_level:         "low",
    function_tags:      ["sensate", "warming", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 21. Folic Acid  [9 prods] ───────────────────────────────────────────────
  // Vitamin B9. Topical use as conditioning / anti-aging. Safe in cosmetic
  // concentrations.
  {
    suggested_canonical_name: "folic acid",
    aliases: [
      "folic acid",
      "vitamin b9",
      "pteroylglutamic acid",
    ],
    risk_level:         "low",
    function_tags:      ["vitamin", "skin_conditioning", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 22. Mentha Piperita Oil  [9 prods] ──────────────────────────────────────
  // Peppermint essential oil. Known sensitiser at higher concentrations;
  // pregnancy guidance is conservative for essential oils.
  // Note: V3 already inserted "mentha piperita LEAF WATER" — different INCI.
  {
    suggested_canonical_name: "mentha piperita oil",
    aliases: [
      "mentha piperita oil",
      "peppermint oil",
      "mentha piperita (peppermint) oil",
    ],
    risk_level:         "medium",
    function_tags:      ["fragrance", "essential_oil", "cooling"],
    concern_flags:      ["essential_oil"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
  },

  // ── 23. Sorbitan Sesquioleate  [9 prods] ────────────────────────────────────
  // Non-ionic emulsifier (sorbitol ester of oleic acid). Common W/O emulsifier.
  // Known sensitiser in fragrance-allergic individuals → allergy moderate.
  {
    suggested_canonical_name: "sorbitan sesquioleate",
    aliases: [
      "sorbitan sesquioleate",
      "SORBITAN SESQUIOLEATE",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "moderate",
  },

  // ── 24. Steareth-6  [9 prods] ───────────────────────────────────────────────
  // PEG-6 stearyl ether, non-ionic emulsifier. Standard hair-care emulsifier.
  {
    suggested_canonical_name: "steareth-6",
    aliases: [
      "steareth-6",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 25. T-Butyl Alcohol  [9 prods] ──────────────────────────────────────────
  // tert-Butyl alcohol — solvent / denaturant. Used in Hydro Boost line.
  {
    suggested_canonical_name: "t-butyl alcohol",
    aliases: [
      "t-butyl alcohol",
      "tert-butyl alcohol",
      "tertiary butyl alcohol",
    ],
    risk_level:         "low",
    function_tags:      ["solvent", "denaturant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 26. Tetrasodium Glutamate Diacetate  [9 prods] ──────────────────────────
  // Biodegradable chelator (GLDA tetrasodium). Replaces EDTA in modern formulas.
  {
    suggested_canonical_name: "tetrasodium glutamate diacetate",
    aliases: [
      "tetrasodium glutamate diacetate",
      "TETRASODIUM GLUTAMATE DIACETATE",
      "tetrasodium glda",
    ],
    risk_level:         "low",
    function_tags:      ["chelating", "preservative_booster"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 27. Trideceth-3  [9 prods] ──────────────────────────────────────────────
  // PEG-3 tridecyl ether, mild non-ionic surfactant. Hair-care use.
  {
    suggested_canonical_name: "trideceth-3",
    aliases: [
      "trideceth-3",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 28. Triisostearin  [9 prods] ────────────────────────────────────────────
  // Triglyceride of isostearic acid. Heavy emollient / ester used in baby and
  // sun-care formulas (Mustela). Non-comedogenic.
  {
    suggested_canonical_name: "triisostearin",
    aliases: [
      "triisostearin",
      "TRIISOSTEARIN",
      "glyceryl triisostearate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 29. Vitis Vinifera Seed Extract  [9 prods] ──────────────────────────────
  // Grape-seed extract. Polyphenol-rich antioxidant.
  {
    suggested_canonical_name: "vitis vinifera seed extract",
    aliases: [
      "vitis vinifera seed extract",
      "grape seed extract",
      "vitis vinifera (grape) seed extract",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "botanical_extract"],
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
  console.log(" batchInsertLibraryGapsV6 — Dalga A High-Impact INCI Insert");
  console.log(` Supabase  : ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Candidates: ${REVIEWED_CANDIDATES.length}`);
  console.log(" Source    : fastUnknownReport.ts — 2026-05-07");
  console.log(" Scope     : real INCI ≥ 7 prods, no parser artifacts, no allergens");
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
    console.log(`    preg    : ${c.pregnancy_flag ?? "?"}  /  breast: ${c.breastfeeding_flag ?? "?"}  /  allergy: ${c.allergy_flag ?? "?"}`);
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
    console.log();
    console.log(`     Next step: re-run lib/admin/scripts/fastUnknownReport.ts`);
    console.log(`     and verify coverage moved up from 86.18 % toward ≈ 92 %.`);
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
