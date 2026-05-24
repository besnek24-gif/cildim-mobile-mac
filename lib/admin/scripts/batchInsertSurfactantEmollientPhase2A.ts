/**
 * batchInsertSurfactantEmollientPhase2A.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2A — Dalga E2a surfactant / emulsifier / emollient canonicals.
 *
 * SCOPE — Phase 2A (Dalga E2a) adds 31 high-frequency surfactant, emulsifier
 * and emollient canonicals surfaced by the post-E1 / Phase-1.b unknown
 * report (`/.local/reports/post-E1-phase1b-unknowns.log`).
 *
 *   SURFACTANTS / SOLUBILIZERS (10)
 *      1. PEG-6                          (hexaethylene glycol — bare polymer,
 *                                         distinct from V6 Steareth-6 which is
 *                                         the stearyl-ether form)
 *      2. Laureth-3                      (PEG-3 lauryl ether)
 *      3. Laureth-4                      (PEG-4 lauryl ether)
 *      4. Laureth-23                     (PEG-23 lauryl ether — solubilizer)
 *      5. Isoceteth-20                   (PEG-20 isocetyl ether — solubilizer)
 *      6. PPG-26-Buteth-26               (PPG/PEG butyl ether — solubilizer)
 *      7. Sodium Myreth Sulfate          (mild myristyl ether-sulfate; SLES/
 *                                         SLMS family. NOTE on classification
 *                                         below)
 *      8. Sodium Cocoyl Glutamate        (amino-acid surfactant; mild)
 *      9. Disodium 2-Sulfolaurate        (mild anionic surfactant)
 *     10. Ceteareth-33                   (PEG-33 cetearyl ether — emulsifier/
 *                                         solubilizer)
 *
 *   EMULSIFIERS (10)
 *     11. Glyceryl Isostearate           (non-ionic W/O emulsifier)
 *     12. Sorbitan Tristearate           (sorbitan ester; W/O emulsifier;
 *                                         distinct from V6 Sorbitan
 *                                         Sesquioleate)
 *     13. Sorbitan Palmitate             (sorbitan ester; W/O emulsifier)
 *     14. Polyglyceryl-10 Stearate       (polyglyceryl ester; O/W emulsifier)
 *     15. Polyglyceryl-10 Laurate        (polyglyceryl ester; mild O/W)
 *     16. Polyglyceryl-3 Polyricinoleate (PGPR; W/O emulsifier)
 *     17. Polyglyceryl-3 Diisostearate   (W/O emulsifier — colour cosmetics)
 *     18. Polyglyceryl-6 Distearate      (mild O/W emulsifier)
 *     19. PEG-30 Dipolyhydroxystearate   (sun-care W/O emulsifier — Arlacel
 *                                         P135 / Cithrol DPHS family)
 *     20. PEG-200 Hydrogenated Glyceryl  (PEG-glyceryl-palmate emulsifier)
 *         Palmate
 *
 *   EMOLLIENTS / ESTERS (11)
 *     21. PPG-15 Stearyl Ether           (light emollient / silicone-replacer)
 *     22. Caprylic/Capric Glycerides     (medium-chain triglyceride blend)
 *     23. Hydrogenated Polydecene        (synthetic emollient hydrocarbon)
 *     24. Isoamyl Laurate                (light dry-touch ester)
 *     25. Isoamyl Cocoate                (light dry-touch ester)
 *     26. Isocetyl Stearoyl Stearate     (heavy emollient ester)
 *     27. Diethylhexyl Sebacate          (light spreading ester)
 *     28. Ethylhexyl Hydroxystearate     (skin-conditioning ester)
 *     29. Dipentaerythrityl              (heavy emollient polyester — common in
 *         Tetrahydroxystearate /          colour cosmetics)
 *         Tetraisostearate
 *     30. Myreth-3 Myristate             (myristate ether-ester emollient)
 *     31. Coconut Acid                   (mixed coconut fatty-acid blend —
 *                                         soap / surfactant precursor)
 *
 * SODIUM MYRETH SULFATE — CLASSIFICATION NOTE:
 *   Sodium Myreth Sulfate (SMS) is an ether-sulfate of the SLES family
 *   (myristyl rather than lauryl chain). It is GENERALLY MILDER than SLS
 *   and considered low-risk for rinse-off products, which dominate its
 *   in-vivo usage in this dataset (shampoos, cleansing wipes). The brief
 *   instructed: "consider medium or caution only if existing policy supports
 *   it". A search of prior batches shows NO existing concern_flag value for
 *   ether-sulfate surfactants — the current policy precedents are
 *   "antiperspirant", "aluminum_salt", "antimicrobial", "comedogenic_potential",
 *   "sulfite", "essential_oil", "allergen", "eu_fragrance_allergen". Inventing
 *   a new "ether_sulfate" or "anionic_surfactant" concern_flag would extend
 *   the vocabulary and is OUT OF SCOPE for an additive Phase-2A pack.
 *   Therefore this script keeps risk_level=low / concern_flags=[] for SMS,
 *   matching V6 Steareth-6 conservatism. A future dedicated surfactant-
 *   policy phase can introduce a new concern_flag and reclassify in one shot.
 *
 * EXPLICITLY EXCLUDED FROM PHASE 2A (Dalga E2a):
 *   • Parser artifacts — these tokens are PRODUCTION GARBAGE produced by an
 *     incomplete INCI splitter and MUST NOT be promoted to canonical
 *     ingredients:
 *         "2-Oleamido-1"        (truncated — comma split inside compound name)
 *         "3-Octadecanediol"    (truncated — second half of same compound)
 *         "Pca"                 (truncated — should be "Sodium PCA" / "PCA")
 *         "qua (Water)"         (truncated paren — Aqua/Water artefact)
 *         "Water (Aqua"         (truncated paren)
 *         "Aqua (Water"         (truncated paren)
 *     Real cleanup is the upstream parser pass (LIVE in Dalga E1 Phase 1)
 *     PLUS canonical "2-oleamido-1,3-octadecanediol" which is a CONDITIONING-
 *     LIPID canonical, not a surfactant — belongs to a future skin-conditioning
 *     pack, not this surfactant/emulsifier/emollient phase.
 *   • CI colorants — handled by batchInsertCIColorantsPhase1A.
 *   • Fragrance allergens — handled by Phase 1C / 1D.
 *   • Botanical extracts — handled by Phase 1A (Dalga D).
 *   • Actives (Alpha-Arbutin, Papain, Asiatic Acid) — different phase.
 *   • Preservatives (Benzalkonium Chloride, Iodopropynyl Butylcarbamate) —
 *     dedicated preservative pack.
 *   • Supplement / oral ingredients (Zinc, Copper, Leucine, Hydrolyzed
 *     Keratin tablets, Hydrolyzed Soy Protein supplements) — out of scope
 *     for topical-cosmetic ingredient_master.
 *   • Hydrolyzed Keratin / Hydrolyzed Soy Protein — when used topically these
 *     are conditioning proteins, not surfactants/emulsifiers/emollients;
 *     belong to a future skin-conditioning / hair-conditioning pack.
 *   • Cellulose Acetate — film-former / polymer, not a surfactant or
 *     emulsifier; belongs to a future film-former pack.
 *
 * RELATIONSHIP TO V6 / PRIOR BATCHES — CANONICALS REUSED, NOT RE-INSERTED:
 *   The following surfactant/emulsifier/emollient canonicals already exist
 *   in ingredients_master from V6 and earlier batches and are intentionally
 *   EXCLUDED from this script's REVIEWED_CANDIDATES:
 *     • sorbitan sesquioleate  (V6 #23 — distinct ester from tristearate /
 *                                palmitate added here)
 *     • steareth-6             (V6 #24 — PEG-6 stearyl ether, distinct from
 *                                bare PEG-6 polymer added here as #1)
 *     • trideceth-3            (V6 #27)
 *     • triisostearin          (V6 #28)
 *
 * SAFETY GUARANTEES (identical to Phase 1A / 1C / 1D / V6):
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually write)
 *   - Idempotent: re-running is safe (uses applyUnknownResolutionCandidates,
 *     which checks for existing rows before INSERT)
 *   - Does NOT touch the live score engine, V4 registry, resolver, or UI
 *   - Does NOT modify any existing row
 *   - Does NOT delete or update any product
 *   - Does NOT write to ingredient_unknown_queue
 *   - Does NOT alter enums / types / schema
 *   - Does NOT create new tables
 *   - Does NOT invent new function_tags or concern_flags vocabulary —
 *     all values reuse the precedents established by V6 / Phase 1A / 1D
 *     (function_tags: surfactant, emulsifier, emollient, solubilizer,
 *      skin_conditioning, occlusive, fatty_acid, solvent, cleansing,
 *      humectant, fragrance, mineral, antioxidant; concern_flags: [] for
 *      this entire pack — see SODIUM MYRETH SULFATE note above).
 *
 * RISK PROFILE:
 *   The entire pack is risk_level="low", pregnancy_flag="safe",
 *   breastfeeding_flag="safe", allergy_flag="low", concern_flags=[],
 *   matching V6 conservatism for non-ionic surfactants, sorbitan/poly-
 *   glyceryl emulsifiers, PEG/PPG ethers and synthetic emollient esters.
 *   The single mild-anionic ether-sulfate (Sodium Myreth Sulfate) is held
 *   to the same low classification per the explicit policy note above.
 *
 * ALIAS MAPPING LOGIC:
 *   `normalizeForLookup` lower-cases, trims, and strips characters outside
 *   [a-z0-9 -]. Therefore casing variants (e.g. "PEG-6" vs "peg-6"),
 *   slash variants (e.g. "Caprylic/Capric Glycerides" vs "caprylic capric
 *   glycerides") and spacing variants (e.g. "PEG 6" vs "peg-6") collapse
 *   to the SAME normalised key after the regex strip. They are listed here
 *   for self-documentation per the Dalga E2a brief, and the in-script
 *   aliasPlan dedup collapses them to a single row at write time.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertSurfactantEmollientPhase2A.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertSurfactantEmollientPhase2A.ts
 *
 * Sources used: CosIng (EU), INCI Dictionary (PCPC), EU Cosmetics
 * Regulation 1223/2009, post-E1-phase1b-unknowns.log.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Phase 2A (Dalga E2a) — 31 surfactant / emulsifier / emollient canonicals ─

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ─────────────────────────────────────────────────────────────────────────
  //  SURFACTANTS / SOLUBILIZERS (10)
  // ─────────────────────────────────────────────────────────────────────────

  // ── 1. PEG-6 — bare hexaethylene-glycol polymer ──────────────────────────
  // Distinct from V6 Steareth-6 (which is "PEG-6 stearyl ether"). PEG-6
  // alone is the polyethylene-glycol polymer used as humectant / solvent.
  {
    suggested_canonical_name: "peg-6",
    aliases: [
      "peg-6",
      "PEG-6",
      "Peg-6",
      "peg 6",
      "PEG 6",
      "polyethylene glycol 6",
      "polyethylene glycol-6",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "solvent", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "PEG-6 — hexaethylene-glycol polymer; humectant / solvent / viscosity " +
      "controller. Distinct from Steareth-6 (PEG-6 stearyl ether).",
  },

  // ── 2. Laureth-3 ─────────────────────────────────────────────────────────
  {
    suggested_canonical_name: "laureth-3",
    aliases: [
      "laureth-3",
      "LAURETH-3",
      "Laureth-3",
      "laureth 3",
      "peg-3 lauryl ether",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Laureth-3 — PEG-3 lauryl ether; non-ionic surfactant / emulsifier.",
  },

  // ── 3. Laureth-4 ─────────────────────────────────────────────────────────
  {
    suggested_canonical_name: "laureth-4",
    aliases: [
      "laureth-4",
      "LAURETH-4",
      "Laureth-4",
      "laureth 4",
      "peg-4 lauryl ether",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Laureth-4 — PEG-4 lauryl ether; non-ionic surfactant / emulsifier.",
  },

  // ── 4. Laureth-23 ────────────────────────────────────────────────────────
  {
    suggested_canonical_name: "laureth-23",
    aliases: [
      "laureth-23",
      "LAURETH-23",
      "Laureth-23",
      "laureth 23",
      "peg-23 lauryl ether",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Laureth-23 — PEG-23 lauryl ether; high-EO non-ionic solubilizer / " +
      "emulsifier (water-soluble).",
  },

  // ── 5. Isoceteth-20 ──────────────────────────────────────────────────────
  {
    suggested_canonical_name: "isoceteth-20",
    aliases: [
      "isoceteth-20",
      "ISOCETETH-20",
      "Isoceteth-20",
      "isoceteth 20",
      "peg-20 isocetyl ether",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Isoceteth-20 — PEG-20 isocetyl ether; non-ionic surfactant / " +
      "solubilizer.",
  },

  // ── 6. PPG-26-Buteth-26 ──────────────────────────────────────────────────
  {
    suggested_canonical_name: "ppg-26-buteth-26",
    aliases: [
      "ppg-26-buteth-26",
      "PPG-26-BUTETH-26",
      "Ppg-26-Buteth-26",
      "ppg 26 buteth 26",
      "ppg-26/buteth-26",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "PPG-26-Buteth-26 — propylene-glycol/butyl-ether copolymer; non-ionic " +
      "surfactant / solubilizer commonly used with PEG-40 hydrogenated " +
      "castor oil.",
  },

  // ── 7. Sodium Myreth Sulfate — see classification note in header ────────
  {
    suggested_canonical_name: "sodium myreth sulfate",
    aliases: [
      "sodium myreth sulfate",
      "SODIUM MYRETH SULFATE",
      "Sodium Myreth Sulfate",
      "sodium myreth sulphate",
      "SODIUM MYRETH SULPHATE",
      "sms",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Sodium Myreth Sulfate — myristyl ether-sulfate (SLES family, milder " +
      "than SLS). Anionic cleansing surfactant for rinse-off use. " +
      "Classification kept at low pending dedicated ether-sulfate policy " +
      "phase (see header).",
  },

  // ── 8. Sodium Cocoyl Glutamate ───────────────────────────────────────────
  {
    suggested_canonical_name: "sodium cocoyl glutamate",
    aliases: [
      "sodium cocoyl glutamate",
      "SODIUM COCOYL GLUTAMATE",
      "Sodium Cocoyl Glutamate",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Sodium Cocoyl Glutamate — amino-acid (glutamate) surfactant from " +
      "coconut fatty acids; mild anionic cleanser, common in low-irritation " +
      "facial cleansers.",
  },

  // ── 9. Disodium 2-Sulfolaurate ───────────────────────────────────────────
  {
    suggested_canonical_name: "disodium 2-sulfolaurate",
    aliases: [
      "disodium 2-sulfolaurate",
      "DISODIUM 2-SULFOLAURATE",
      "Disodium 2-Sulfolaurate",
      "disodium 2 sulfolaurate",
      "disodium sulfolaurate",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Disodium 2-Sulfolaurate — mild anionic alpha-sulfo fatty-acid " +
      "surfactant; rinse-off cleanser.",
  },

  // ── 10. Ceteareth-33 ─────────────────────────────────────────────────────
  {
    suggested_canonical_name: "ceteareth-33",
    aliases: [
      "ceteareth-33",
      "CETEARETH-33",
      "Ceteareth-33",
      "ceteareth 33",
      "peg-33 cetearyl ether",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Ceteareth-33 — PEG-33 cetearyl ether; non-ionic O/W emulsifier / " +
      "solubilizer.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  EMULSIFIERS (10)
  // ─────────────────────────────────────────────────────────────────────────

  // ── 11. Glyceryl Isostearate ─────────────────────────────────────────────
  {
    suggested_canonical_name: "glyceryl isostearate",
    aliases: [
      "glyceryl isostearate",
      "GLYCERYL ISOSTEARATE",
      "Glyceryl Isostearate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Glyceryl Isostearate — non-ionic W/O co-emulsifier and emollient ester.",
  },

  // ── 12. Sorbitan Tristearate ─────────────────────────────────────────────
  // Distinct from V6 Sorbitan Sesquioleate (different fatty-acid chain).
  {
    suggested_canonical_name: "sorbitan tristearate",
    aliases: [
      "sorbitan tristearate",
      "SORBITAN TRISTEARATE",
      "Sorbitan Tristearate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Sorbitan Tristearate — non-ionic sorbitan-ester W/O emulsifier. " +
      "Distinct from Sorbitan Sesquioleate (V6).",
  },

  // ── 13. Sorbitan Palmitate ───────────────────────────────────────────────
  {
    suggested_canonical_name: "sorbitan palmitate",
    aliases: [
      "sorbitan palmitate",
      "SORBITAN PALMITATE",
      "Sorbitan Palmitate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Sorbitan Palmitate — non-ionic sorbitan-ester W/O emulsifier (palmitic " +
      "acid form).",
  },

  // ── 14. Polyglyceryl-10 Stearate ─────────────────────────────────────────
  {
    suggested_canonical_name: "polyglyceryl-10 stearate",
    aliases: [
      "polyglyceryl-10 stearate",
      "POLYGLYCERYL-10 STEARATE",
      "Polyglyceryl-10 Stearate",
      "polyglyceryl 10 stearate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Polyglyceryl-10 Stearate — polyglycerol ester; mild non-ionic O/W " +
      "emulsifier.",
  },

  // ── 15. Polyglyceryl-10 Laurate ──────────────────────────────────────────
  {
    suggested_canonical_name: "polyglyceryl-10 laurate",
    aliases: [
      "polyglyceryl-10 laurate",
      "POLYGLYCERYL-10 LAURATE",
      "Polyglyceryl-10 Laurate",
      "polyglyceryl 10 laurate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Polyglyceryl-10 Laurate — polyglycerol-laurate ester; mild non-ionic " +
      "O/W emulsifier / solubilizer.",
  },

  // ── 16. Polyglyceryl-3 Polyricinoleate ───────────────────────────────────
  {
    suggested_canonical_name: "polyglyceryl-3 polyricinoleate",
    aliases: [
      "polyglyceryl-3 polyricinoleate",
      "POLYGLYCERYL-3 POLYRICINOLEATE",
      "Polyglyceryl-3 Polyricinoleate",
      "polyglyceryl 3 polyricinoleate",
      "pgpr",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Polyglyceryl-3 Polyricinoleate (PGPR) — polyricinoleate-polyglycerol " +
      "ester; W/O emulsifier widely used in colour cosmetics.",
  },

  // ── 17. Polyglyceryl-3 Diisostearate ─────────────────────────────────────
  {
    suggested_canonical_name: "polyglyceryl-3 diisostearate",
    aliases: [
      "polyglyceryl-3 diisostearate",
      "POLYGLYCERYL-3 DIISOSTEARATE",
      "Polyglyceryl-3 Diisostearate",
      "polyglyceryl 3 diisostearate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Polyglyceryl-3 Diisostearate — polyglycerol-diester; W/O emulsifier " +
      "common in lipsticks and colour cosmetics.",
  },

  // ── 18. Polyglyceryl-6 Distearate ────────────────────────────────────────
  {
    suggested_canonical_name: "polyglyceryl-6 distearate",
    aliases: [
      "polyglyceryl-6 distearate",
      "POLYGLYCERYL-6 DISTEARATE",
      "Polyglyceryl-6 Distearate",
      "polyglyceryl 6 distearate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Polyglyceryl-6 Distearate — polyglycerol-distearate ester; mild " +
      "non-ionic O/W emulsifier.",
  },

  // ── 19. PEG-30 Dipolyhydroxystearate ─────────────────────────────────────
  {
    suggested_canonical_name: "peg-30 dipolyhydroxystearate",
    aliases: [
      "peg-30 dipolyhydroxystearate",
      "PEG-30 DIPOLYHYDROXYSTEARATE",
      "Peg-30 Dipolyhydroxystearate",
      "peg 30 dipolyhydroxystearate",
      "peg-30-dipolyhydroxystearate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "PEG-30 Dipolyhydroxystearate — PEG-polyhydroxystearate W/O emulsifier " +
      "(Arlacel P135 / Cithrol DPHS family); standard in sun-care and " +
      "long-wear emulsions.",
  },

  // ── 20. PEG-200 Hydrogenated Glyceryl Palmate ────────────────────────────
  {
    suggested_canonical_name: "peg-200 hydrogenated glyceryl palmate",
    aliases: [
      "peg-200 hydrogenated glyceryl palmate",
      "PEG-200 HYDROGENATED GLYCERYL PALMATE",
      "Peg-200 Hydrogenated Glyceryl Palmate",
      "peg 200 hydrogenated glyceryl palmate",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "PEG-200 Hydrogenated Glyceryl Palmate — PEG-glyceryl-palmitate " +
      "non-ionic emulsifier / refatting agent for cleansers.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  EMOLLIENTS / ESTERS (11)
  // ─────────────────────────────────────────────────────────────────────────

  // ── 21. PPG-15 Stearyl Ether ─────────────────────────────────────────────
  {
    suggested_canonical_name: "ppg-15 stearyl ether",
    aliases: [
      "ppg-15 stearyl ether",
      "PPG-15 STEARYL ETHER",
      "Ppg-15 Stearyl Ether",
      "ppg 15 stearyl ether",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "PPG-15 Stearyl Ether — light emollient ether; common silicone-feel " +
      "replacer in deodorants and roll-ons.",
  },

  // ── 22. Caprylic/Capric Glycerides ───────────────────────────────────────
  // The slash collapses to a space under normalizeForLookup, so the
  // canonical key is "caprylic capric glycerides".
  {
    suggested_canonical_name: "caprylic/capric glycerides",
    aliases: [
      "caprylic/capric glycerides",
      "CAPRYLIC/CAPRIC GLYCERIDES",
      "Caprylic/Capric Glycerides",
      "caprylic capric glycerides",
      "CAPRYLIC CAPRIC GLYCERIDES",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Caprylic/Capric Glycerides — medium-chain triglyceride blend of C8/C10 " +
      "fatty acids with glycerin; light emollient.",
  },

  // ── 23. Hydrogenated Polydecene ──────────────────────────────────────────
  {
    suggested_canonical_name: "hydrogenated polydecene",
    aliases: [
      "hydrogenated polydecene",
      "HYDROGENATED POLYDECENE",
      "Hydrogenated Polydecene",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Hydrogenated Polydecene — synthetic saturated hydrocarbon; light " +
      "non-occlusive emollient.",
  },

  // ── 24. Isoamyl Laurate ──────────────────────────────────────────────────
  {
    suggested_canonical_name: "isoamyl laurate",
    aliases: [
      "isoamyl laurate",
      "ISOAMYL LAURATE",
      "Isoamyl Laurate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Isoamyl Laurate — light dry-touch ester; volatile-silicone alternative.",
  },

  // ── 25. Isoamyl Cocoate ──────────────────────────────────────────────────
  {
    suggested_canonical_name: "isoamyl cocoate",
    aliases: [
      "isoamyl cocoate",
      "ISOAMYL COCOATE",
      "Isoamyl Cocoate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Isoamyl Cocoate — coconut-derived fatty-acid isoamyl ester; light " +
      "dry-touch emollient.",
  },

  // ── 26. Isocetyl Stearoyl Stearate ───────────────────────────────────────
  {
    suggested_canonical_name: "isocetyl stearoyl stearate",
    aliases: [
      "isocetyl stearoyl stearate",
      "ISOCETYL STEAROYL STEARATE",
      "Isocetyl Stearoyl Stearate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Isocetyl Stearoyl Stearate — heavy emollient ester; long-wear feel " +
      "modifier in moisturisers.",
  },

  // ── 27. Diethylhexyl Sebacate ────────────────────────────────────────────
  {
    suggested_canonical_name: "diethylhexyl sebacate",
    aliases: [
      "diethylhexyl sebacate",
      "DIETHYLHEXYL SEBACATE",
      "Diethylhexyl Sebacate",
      "dioctyl sebacate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Diethylhexyl Sebacate — light spreading sebacic-acid diester; " +
      "low-viscosity emollient.",
  },

  // ── 28. Ethylhexyl Hydroxystearate ───────────────────────────────────────
  {
    suggested_canonical_name: "ethylhexyl hydroxystearate",
    aliases: [
      "ethylhexyl hydroxystearate",
      "ETHYLHEXYL HYDROXYSTEARATE",
      "Ethylhexyl Hydroxystearate",
      "octyl hydroxystearate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Ethylhexyl Hydroxystearate — hydroxystearic-acid 2-ethylhexyl ester; " +
      "skin-conditioning emollient.",
  },

  // ── 29. Dipentaerythrityl Tetrahydroxystearate / Tetraisostearate ────────
  // Slash collapses to space under normalizeForLookup → canonical key
  // becomes "dipentaerythrityl tetrahydroxystearate tetraisostearate".
  {
    suggested_canonical_name:
      "dipentaerythrityl tetrahydroxystearate/tetraisostearate",
    aliases: [
      "dipentaerythrityl tetrahydroxystearate/tetraisostearate",
      "DIPENTAERYTHRITYL TETRAHYDROXYSTEARATE/TETRAISOSTEARATE",
      "Dipentaerythrityl Tetrahydroxystearate/Tetraisostearate",
      "dipentaerythrityl tetrahydroxystearate tetraisostearate",
      "DIPENTAERYTHRITYL TETRAHYDROXYSTEARATE TETRAISOSTEARATE",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Dipentaerythrityl Tetrahydroxystearate/Tetraisostearate — heavy " +
      "polyester emollient; structuring / cushion agent in colour cosmetics.",
  },

  // ── 30. Myreth-3 Myristate ───────────────────────────────────────────────
  {
    suggested_canonical_name: "myreth-3 myristate",
    aliases: [
      "myreth-3 myristate",
      "MYRETH-3 MYRISTATE",
      "Myreth-3 Myristate",
      "myreth 3 myristate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Myreth-3 Myristate — myristic-acid PEG-3 myristyl-ether ester; light " +
      "emollient.",
  },

  // ── 31. Coconut Acid ─────────────────────────────────────────────────────
  // Mixed coconut fatty-acid blend (C8–C18) used as soap precursor and
  // surfactant feedstock.
  {
    suggested_canonical_name: "coconut acid",
    aliases: [
      "coconut acid",
      "COCONUT ACID",
      "Coconut Acid",
      "cocos nucifera fatty acid",
    ],
    risk_level:         "low",
    function_tags:      ["surfactant", "fatty_acid", "cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Coconut Acid — mixed coconut-derived fatty acids (C8–C18); soap " +
      "precursor / surfactant feedstock.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertSurfactantEmollientPhase2A");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` MODE    : ${DRY_RUN ? "DRY-RUN  (no writes)" : "LIVE  (writes enabled)"}`);
  console.log(` CANDIDATES: ${REVIEWED_CANDIDATES.length}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  const sb = createLeanSupabase();

  // ── Sanity check: surface duplicates inside the batch itself ──────────────
  const seen = new Set<string>();
  for (const c of REVIEWED_CANDIDATES) {
    const k = normalizeForLookup(c.suggested_canonical_name);
    if (seen.has(k)) {
      console.warn(`  WARN: duplicate canonical inside batch → "${c.suggested_canonical_name}"`);
    }
    seen.add(k);
  }

  if (DRY_RUN) {
    console.log("=============================================================");
    console.log(" PLANNED INSERTS (DRY-RUN)");
    console.log("=============================================================");
    console.log(" For each candidate the script will, when run live:");
    console.log("   1. Lookup ingredients_master.canonical_name → if exists, REUSE id.");
    console.log("   2. Else INSERT a new ingredients_master row.");
    console.log("   3. For each alias: lookup ingredient_aliases.normalized_alias.");
    console.log("      If exists → SKIP. Else INSERT new alias row.");
    console.log();

    let willInsertMaster      = 0;
    let willReuseMaster       = 0;
    let willInsertAliases     = 0;
    let willSkipAliases       = 0;

    const allCanonicals: string[] = [];
    const aliasNorms              = new Set<string>();

    for (const c of REVIEWED_CANDIDATES) {
      const cn = normalizeForLookup(c.suggested_canonical_name);
      allCanonicals.push(cn);
      aliasNorms.add(cn);
      for (const a of c.aliases) {
        const an = normalizeForLookup(a);
        if (an) aliasNorms.add(an);
      }
    }

    const { data: existingMasters } = await sb
      .from("ingredients_master")
      .select("canonical_name")
      .in("canonical_name", allCanonicals);

    const existingMasterSet = new Set(
      (existingMasters ?? []).map((r: { canonical_name: string }) => String(r.canonical_name))
    );

    const aliasArr = [...aliasNorms];
    const existingAliases: { normalized_alias: string }[] = [];
    const PAGE = 200;
    for (let i = 0; i < aliasArr.length; i += PAGE) {
      const slice = aliasArr.slice(i, i + PAGE);
      const { data } = await sb
        .from("ingredient_aliases")
        .select("normalized_alias")
        .in("normalized_alias", slice);
      if (data) existingAliases.push(...(data as { normalized_alias: string }[]));
    }
    const existingAliasSet = new Set(existingAliases.map((r) => r.normalized_alias));

    let idx = 0;
    for (const c of REVIEWED_CANDIDATES) {
      idx++;
      const cn        = normalizeForLookup(c.suggested_canonical_name);
      const reused    = existingMasterSet.has(cn);
      const masterTag = reused ? "REUSE" : "INSERT";
      if (reused) willReuseMaster++; else willInsertMaster++;

      console.log(`${String(idx).padStart(2, " ")}. [${masterTag}] master="${cn}"`);
      console.log(`     display="${c.display_name ?? c.suggested_canonical_name}"`);
      console.log(`     risk=${c.risk_level}  preg=${c.pregnancy_flag}  bf=${c.breastfeeding_flag}  allergy=${c.allergy_flag}`);
      console.log(`     fn_tags=${JSON.stringify(c.function_tags ?? [])}`);
      console.log(`     concerns=${JSON.stringify(c.concern_flags ?? [])}`);
      if (c.description) console.log(`     desc: ${c.description}`);

      const aliasPlan: { raw: string; norm: string; type: "exact" | "synonym" }[] = [
        { raw: c.suggested_canonical_name, norm: cn, type: "exact" },
      ];
      for (const a of c.aliases) {
        const an = normalizeForLookup(a);
        if (!an || an === cn) continue;
        if (aliasPlan.some((x) => x.norm === an)) continue;
        aliasPlan.push({ raw: a, norm: an, type: "synonym" });
      }

      for (const a of aliasPlan) {
        const exists = existingAliasSet.has(a.norm);
        const tag    = exists ? "SKIP  " : "INSERT";
        if (exists) willSkipAliases++; else willInsertAliases++;
        console.log(`       └─ [${tag}] alias(${a.type})="${a.norm}"`);
      }
      console.log();
    }

    console.log("─────────────────────────────────────────────────────────────");
    console.log(" DRY-RUN SUMMARY");
    console.log("─────────────────────────────────────────────────────────────");
    console.log(`   ingredients_master  → INSERT new : ${willInsertMaster}`);
    console.log(`   ingredients_master  → REUSE      : ${willReuseMaster}`);
    console.log(`   ingredient_aliases  → INSERT new : ${willInsertAliases}`);
    console.log(`   ingredient_aliases  → SKIP exist : ${willSkipAliases}`);
    console.log("─────────────────────────────────────────────────────────────");
    console.log(" No data was written. Re-run with DRY_RUN=false to apply.");
    return;
  }

  // ── LIVE write path (only when DRY_RUN=false) ─────────────────────────────
  console.log(" Applying candidates via applyUnknownResolutionCandidates() …\n");
  const result = await applyUnknownResolutionCandidates(REVIEWED_CANDIDATES, sb);

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" LIVE RESULT");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`   inserted_master_count : ${result.inserted_master_count}`);
  console.log(`   reused_master_count   : ${result.reused_master_count}`);
  console.log(`   inserted_alias_count  : ${result.inserted_alias_count}`);
  console.log(`   skipped_alias_count   : ${result.skipped_alias_count}`);
  console.log(`   errors                : ${result.errors.length}`);
  for (const e of result.errors) {
    console.log(`     • ${e.candidate_canonical}${e.alias ? ` [alias=${e.alias}]` : ""}: ${e.message}`);
  }
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Done. ingredient_unknown_queue rows are NOT updated by this script.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
