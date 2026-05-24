/**
 * batchInsertTopUnknownPhase1B.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1B — High-frequency, well-documented LOW-RISK cosmetic-support
 *            ingredients drawn from the post-Phase-1A `fastUnknownReport`
 *            "TOP 50 UNKNOWN INGREDIENTS (by # products containing them)"
 *            ranking (snapshot taken on 2026-04-26, immediately after the
 *            Phase 1A insert + queue cleanup).
 *
 * SCOPE — Phase 1B includes ONLY:
 *   • inert mineral fillers / pigment coatings
 *   • hydrocarbon emollients
 *   • fatty-acid / glyceryl / sorbitan / PEG / polyglyceryl emulsifiers and
 *     emollient esters
 *   • polysaccharide / polyol humectants and binders
 *   • crosslinked synthetic polymers used as thickeners or film-formers
 *   • amino-acid texture modifiers and pH buffers
 *   • well-documented vitamins (B7)
 *   • a single well-documented synthetic antioxidant (Tinogard TT)
 *
 * EXPLICITLY EXCLUDED FROM PHASE 1B (deferred to later phases):
 *   • Phase 1C — fragrance / EU-26 allergens
 *       Benzyl Salicylate, Menthol, Phenethyl Alcohol, Citral / "Citral.",
 *       Sodium C14-16 Olefin Sulfonate
 *   • Phase 1D — antimicrobial / anti-dandruff / drug-like actives
 *       Piroctone Olamine, Cetrimonium Chloride, Aluminum Chlorohydrate,
 *       Copper Sulfate
 *   • Phase 1E — botanical extracts (none in current top-50-by-products)
 *   • Phase 1F — insufficient-literature items (none in current top-50)
 *
 * SAFETY GUARANTEES (identical to Phase 1A):
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually write)
 *   - Idempotent: re-running is safe (uses applyUnknownResolutionCandidates,
 *     which checks for existing rows before INSERT)
 *   - Does NOT touch the live score engine, V4 registry, resolver, or UI
 *   - Does NOT modify any existing row
 *   - Does NOT delete or update any product
 *   - Does NOT write to ingredient_unknown_queue (separate cleanup script
 *     `cleanupResolvedUnknownQueuePhase1B.ts` will flip statuses later)
 *
 * UNCERTAINTY HANDLING:
 *   The schema has no `needs_review` column. Where a property is uncertain we
 *   use the conservative enum values defined in BatchResolutionCandidate:
 *     risk_level         ∈ "low" | "medium" | "high" | "unknown"
 *     pregnancy_flag     ∈ "safe" | "caution" | "avoid" | "unknown"
 *     breastfeeding_flag ∈ "safe" | "caution" | "avoid" | "unknown"
 *     allergy_flag       ∈ "low" | "moderate" | "high" | "unknown"
 *
 *   All Phase 1B entries are well-characterized in CosIng / EWG / peer-reviewed
 *   dermatology literature with a benign topical-safety profile, so:
 *     risk_level         = "low"
 *     pregnancy_flag     = "safe"
 *     breastfeeding_flag = "safe"
 *     allergy_flag       = "low"
 *   are the defaults. Any deviation is documented inline.
 *
 * ALIAS MAPPING LOGIC:
 *   For each candidate we register the canonical INCI form plus:
 *     1. the raw production token observed in product ingredient lists
 *        (case-folded; the resolver normalizes case before lookup)
 *     2. common spacing variants where a hyphen is replaced by a space
 *        (e.g. "peg-40 …" → "peg 40 …", "polyglyceryl-4 …" → "polyglyceryl 4 …")
 *     3. well-known synonyms / trade names ONLY when they unambiguously map
 *        to the same chemical entity
 *        (e.g. Tin Oxide → "stannic oxide", Biotin → "vitamin b7" / "vitamin h",
 *         Pentaerythrityl Tetra-di-T-Butyl Hydroxyhydrocinnamate → "tinogard tt",
 *         HEPES full chemical name → "hepes" abbreviation,
 *         Magnesium Sulfate → "epsom salt")
 *     4. the resolver's stripped-form (post `normalizeForLookup`) is computed
 *        on the fly inside `applyUnknownResolutionCandidates`, so we do NOT
 *        need to hand-author hyphen-stripped variants
 *
 *   Ambiguous synonyms are intentionally skipped (e.g. Polyethylene → "pe"
 *   collides with "phosphatidyl-ethanolamine" abbreviations; Maltodextrin →
 *   "maltrin" is a trade name; Magnesium Chloride → "magnesium chloride
 *   hexahydrate" is a distinct hydrate form).
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertTopUnknownPhase1B.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertTopUnknownPhase1B.ts
 *
 * Sources used: CosIng (EU), INCI database, EWG Skin Deep, CIR Final Reports,
 * peer-reviewed dermatology and toxicology references where available.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── 30 production-observed candidates (top of by-products ranking) ────────────
//
// Ordering preserved from the post-Phase-1A fastUnknownReport snapshot
// (TOP 50 UNKNOWN INGREDIENTS by # products containing them).
// Each entry includes the observed product count and a brief rationale.

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Synthetic Fluorphlogopite (86 prods) ────────────────────────────────
  // Synthetic mica analogue (fluorinated phyllosilicate). Inert mineral filler
  // and pigment carrier. No bioavailability concerns at cosmetic particle
  // sizes. Widely used in colour cosmetics and SPF.
  {
    suggested_canonical_name: "synthetic fluorphlogopite",
    aliases: ["synthetic fluorphlogopite"],
    risk_level:         "low",
    function_tags:      ["mineral_filler", "pigment_carrier", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Synthetic mica analogue used as inert pigment carrier and pearlescent filler.",
  },

  // ── 2. Isododecane (81 prods) ──────────────────────────────────────────────
  // Branched, volatile hydrocarbon emollient/solvent. Excellent skin-feel and
  // long-wear vehicle. Non-comedogenic; very low irritation potential.
  {
    suggested_canonical_name: "isododecane",
    aliases: ["isododecane"],
    risk_level:         "low",
    function_tags:      ["emollient", "solvent", "volatile"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Branched volatile hydrocarbon used as a light emollient and solvent.",
  },

  // ── 3. Disteardimonium Hectorite (79 prods) ────────────────────────────────
  // Quaternium-modified hectorite clay; rheology modifier in anhydrous and oil-
  // continuous systems (sunscreens, foundations). Inert at use levels.
  {
    suggested_canonical_name: "disteardimonium hectorite",
    aliases: ["disteardimonium hectorite"],
    risk_level:         "low",
    function_tags:      ["rheology_modifier", "thickener", "suspending_agent"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Quaternium-modified hectorite clay used as a rheology modifier in oil systems.",
  },

  // ── 4. PEG-40 Hydrogenated Castor Oil (66 prods) ───────────────────────────
  // PEG ester of hydrogenated castor oil; one of the most widely used
  // non-ionic solubilisers for fragrances and oils in aqueous systems.
  // Well tolerated; PEG residual concern flagged generically.
  {
    suggested_canonical_name: "peg-40 hydrogenated castor oil",
    aliases: ["peg-40 hydrogenated castor oil", "peg 40 hydrogenated castor oil"],
    risk_level:         "low",
    function_tags:      ["emulsifier", "solubilizer", "surfactant"],
    concern_flags:      ["peg_compound"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Ethoxylated hydrogenated castor oil; widely used non-ionic solubiliser.",
  },

  // ── 5. Sorbitan Isostearate (61 prods) ─────────────────────────────────────
  // Sorbitan ester (Span family) — water-in-oil emulsifier. Mild, well
  // tolerated. Note: appears in production both as Title Case and ALL CAPS,
  // both normalize to the same lookup key.
  {
    suggested_canonical_name: "sorbitan isostearate",
    aliases: ["sorbitan isostearate"],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Sorbitan ester (Span) used as a mild water-in-oil emulsifier.",
  },

  // ── 6. Aluminum Hydroxide (60 prods) ───────────────────────────────────────
  // IMPORTANT: This is the inert pigment-coating / opacifier form (CI 77002),
  // NOT the antiperspirant aluminium chlorohydrate (handled in Phase 1D).
  // Aluminum hydroxide here is used to coat TiO2 / iron-oxide pigments and
  // has a benign topical safety profile.
  {
    suggested_canonical_name: "aluminum hydroxide",
    aliases: ["aluminum hydroxide", "aluminium hydroxide"],
    risk_level:         "low",
    function_tags:      ["pigment_coating", "opacifier", "filler"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Inert pigment-coating / opacifier (CI 77002 form) — not an antiperspirant active.",
  },

  // ── 7. Isohexadecane (56 prods) ────────────────────────────────────────────
  // Branched hydrocarbon emollient (longer chain than isododecane, less
  // volatile). Used for slip and water-resistance in sunscreens and primers.
  {
    suggested_canonical_name: "isohexadecane",
    aliases: ["isohexadecane"],
    risk_level:         "low",
    function_tags:      ["emollient", "solvent"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Branched hydrocarbon emollient providing slip and water-resistance.",
  },

  // ── 8. Magnesium Sulfate (50 prods) ────────────────────────────────────────
  // Inorganic salt (Epsom salt). Used as a thickener in W/O systems and as
  // an electrolyte. Benign topical safety profile.
  {
    suggested_canonical_name: "magnesium sulfate",
    aliases: ["magnesium sulfate", "magnesium sulphate", "epsom salt"],
    risk_level:         "low",
    function_tags:      ["thickener", "viscosity_controller", "mineral_salt"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Epsom salt; inorganic electrolyte / W/O viscosity controller.",
  },

  // ── 9. Pentaerythrityl Tetra-di-T-Butyl Hydroxyhydrocinnamate (44 prods) ──
  // INCI for Tinogard TT — high-performance hindered-phenol antioxidant for
  // formula stability (protects unsaturated oils and fragrances from oxidation).
  // Excellent safety profile, used at very low (≤0.5%) levels.
  {
    suggested_canonical_name: "pentaerythrityl tetra-di-t-butyl hydroxyhydrocinnamate",
    aliases: [
      "pentaerythrityl tetra-di-t-butyl hydroxyhydrocinnamate",
      "tinogard tt",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "stabilizer"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Tinogard TT — hindered-phenol antioxidant protecting formula from oxidation.",
  },

  // ── 10. Tin Oxide (44 prods) ───────────────────────────────────────────────
  // Inert inorganic pigment / lustre enhancer (CI 77861). Used at trace
  // levels in colour cosmetics. Non-bioavailable.
  {
    suggested_canonical_name: "tin oxide",
    aliases: ["tin oxide", "stannic oxide"],
    risk_level:         "low",
    function_tags:      ["pigment", "lustre_enhancer", "filler"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Inert inorganic pigment / lustre enhancer (stannic oxide, CI 77861).",
  },

  // ── 11. Disodium Stearoyl Glutamate (43 prods) ─────────────────────────────
  // Amino-acid-based mild anionic emulsifier; gentle on barrier, often used
  // in stearate-based moisturisers and cleansers.
  {
    suggested_canonical_name: "disodium stearoyl glutamate",
    aliases: ["disodium stearoyl glutamate"],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant", "mild_cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Glutamate-derived mild anionic emulsifier.",
  },

  // ── 12. Glyceryl Oleate (43 prods) ─────────────────────────────────────────
  // Monoglyceride of oleic acid; emollient and W/O co-emulsifier. Note: in
  // VERY high concentrations on damaged skin can be mildly comedogenic, but
  // at typical use levels safety is benign.
  {
    suggested_canonical_name: "glyceryl oleate",
    aliases: ["glyceryl oleate"],
    risk_level:         "low",
    function_tags:      ["emollient", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Glyceryl ester of oleic acid; emollient and co-emulsifier.",
  },

  // ── 13. Maltodextrin (42 prods) ────────────────────────────────────────────
  // Polysaccharide derived from starch. Used as a binder, film-former, and
  // carrier for botanical extracts. GRAS for ingestion; topical use benign.
  {
    suggested_canonical_name: "maltodextrin",
    aliases: ["maltodextrin"],
    risk_level:         "low",
    function_tags:      ["binder", "film_former", "carrier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Starch-derived polysaccharide; binder, film-former, and extract carrier.",
  },

  // ── 14. Myristic Acid (42 prods) ───────────────────────────────────────────
  // C14 saturated fatty acid; opacifier and surfactant precursor (forms soaps
  // with alkalis). Comedogenic at high levels in leave-on products, so we
  // keep risk = low (no toxicological concern) but note the comedogenicity
  // is a separate engine concern handled elsewhere if needed.
  {
    suggested_canonical_name: "myristic acid",
    aliases: ["myristic acid"],
    risk_level:         "low",
    function_tags:      ["fatty_acid", "opacifier", "surfactant_precursor"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "C14 saturated fatty acid; opacifier and soap-forming surfactant precursor.",
  },

  // ── 15. Biotin (39 prods) ──────────────────────────────────────────────────
  // Vitamin B7 / Vitamin H. Skin-conditioning vitamin. Topical safety profile
  // is benign; common in hair/scalp formulas.
  {
    suggested_canonical_name: "biotin",
    aliases: ["biotin", "vitamin b7", "vitamin h"],
    risk_level:         "low",
    function_tags:      ["vitamin", "skin_conditioning", "hair_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Vitamin B7 (also known as Vitamin H); skin- and hair-conditioning vitamin.",
  },

  // ── 16. Glycol Distearate (39 prods) ───────────────────────────────────────
  // Pearlising opacifier in surfactant systems (shampoos, body washes).
  // Distinct from ethylene glycol distearate (different INCI).
  {
    suggested_canonical_name: "glycol distearate",
    aliases: ["glycol distearate"],
    risk_level:         "low",
    function_tags:      ["opacifier", "pearlizer", "viscosity_controller"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Pearlising opacifier used in surfactant cleansing systems.",
  },

  // ── 17. Magnesium Chloride (37 prods) ──────────────────────────────────────
  // Inorganic salt; viscosity controller and electrolyte. Benign topical
  // safety. Hexahydrate form is a distinct INCI and is intentionally NOT
  // aliased here.
  {
    suggested_canonical_name: "magnesium chloride",
    aliases: ["magnesium chloride"],
    risk_level:         "low",
    function_tags:      ["mineral_salt", "viscosity_controller"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Inorganic magnesium salt; electrolyte / viscosity controller.",
  },

  // ── 18. Polyethylene (33 prods) ────────────────────────────────────────────
  // Inert thermoplastic polymer. Used as a wax-like thickener and (formerly)
  // exfoliant microbead. Note: microbead use is now banned in many regions,
  // but polymer use as a wax/binder remains permitted.
  {
    suggested_canonical_name: "polyethylene",
    aliases: ["polyethylene"],
    risk_level:         "low",
    function_tags:      ["polymer", "thickener", "binder"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Inert thermoplastic polymer; wax-like thickener and binder.",
  },

  // ── 19. Tridecyl Trimellitate (33 prods) ───────────────────────────────────
  // Branched-chain ester emollient; light skin feel, non-greasy.
  {
    suggested_canonical_name: "tridecyl trimellitate",
    aliases: ["tridecyl trimellitate"],
    risk_level:         "low",
    function_tags:      ["emollient", "ester"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Branched-chain ester emollient with a light, non-greasy skin feel.",
  },

  // ── 20. Panthenyl Ethyl Ether (32 prods) ───────────────────────────────────
  // Ethyl ether of panthenol (provitamin B5); skin- and hair-conditioning,
  // moisturising. Distinct INCI from "panthenyl triethyl ether".
  {
    suggested_canonical_name: "panthenyl ethyl ether",
    aliases: ["panthenyl ethyl ether"],
    risk_level:         "low",
    function_tags:      ["humectant", "skin_conditioning", "hair_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Ethyl-ether derivative of panthenol; humectant and conditioning agent.",
  },

  // ── 21. Trihydroxystearin (32 prods) ───────────────────────────────────────
  // Hydrogenated castor-derived oleogel former; thickens oil phases without
  // crystallising. Inert, well tolerated.
  {
    suggested_canonical_name: "trihydroxystearin",
    aliases: ["trihydroxystearin"],
    risk_level:         "low",
    function_tags:      ["thickener", "oleogel_former"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Castor-derived oleogel former; thickens oil phases without crystallisation.",
  },

  // ── 22. Lauroyl Lysine (31 prods) ──────────────────────────────────────────
  // Amino-acid-based powder used as a slip / dry-touch texture modifier.
  // Surface-treats pigments and improves spreadability. Inert.
  {
    suggested_canonical_name: "lauroyl lysine",
    aliases: ["lauroyl lysine"],
    risk_level:         "low",
    function_tags:      ["texture", "slip_agent", "pigment_coating"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Amino-acid powder used for slip / dry-touch in colour cosmetics.",
  },

  // ── 23. Polyglyceryl-4 Isostearate (31 prods) ──────────────────────────────
  // Polyglyceryl ester emulsifier (PEG-free), well tolerated, popular in
  // "clean beauty" formulations.
  {
    suggested_canonical_name: "polyglyceryl-4 isostearate",
    aliases: ["polyglyceryl-4 isostearate", "polyglyceryl 4 isostearate"],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "PEG-free polyglyceryl emulsifier suitable for W/O and O/W systems.",
  },

  // ── 24. Hydroxyethylpiperazine Ethane Sulfonic Acid (30 prods) ─────────────
  // Better known by its abbreviation HEPES — Good's biological buffer.
  // Used in cosmetics for tightly-controlled pH (e.g. AHA peels). Excellent
  // tolerability; the HEPES short form is the most common written form on
  // labels, so we register it as an alias.
  {
    suggested_canonical_name: "hydroxyethylpiperazine ethane sulfonic acid",
    aliases: [
      "hydroxyethylpiperazine ethane sulfonic acid",
      "hepes",
    ],
    risk_level:         "low",
    function_tags:      ["ph_adjuster", "buffer"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "HEPES — biological pH buffer; gentle and well tolerated.",
  },

  // ── 25. Histidine (29 prods) ───────────────────────────────────────────────
  // Essential amino acid; skin-conditioning / NMF-supportive. L-Histidine is
  // the biologically active enantiomer used in cosmetics.
  {
    suggested_canonical_name: "histidine",
    aliases: ["histidine", "l-histidine"],
    risk_level:         "low",
    function_tags:      ["amino_acid", "skin_conditioning", "nmf_component"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Essential amino acid; NMF-supportive skin-conditioning agent.",
  },

  // ── 26. Polyisobutene (29 prods) ───────────────────────────────────────────
  // Saturated hydrocarbon polymer; emollient and film-former with adhesive
  // skin feel. Non-comedogenic at typical use levels.
  {
    suggested_canonical_name: "polyisobutene",
    aliases: ["polyisobutene"],
    risk_level:         "low",
    function_tags:      ["polymer", "emollient", "film_former"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Saturated hydrocarbon polymer; emollient and adhesive film-former.",
  },

  // ── 27. Triethoxycaprylylsilane (27 prods) ─────────────────────────────────
  // Silane surface-treatment used to hydrophobise mineral pigments (TiO2,
  // ZnO, iron oxides) for better dispersion in sunscreens. Bound to pigment
  // surface; not bioavailable.
  {
    suggested_canonical_name: "triethoxycaprylylsilane",
    aliases: ["triethoxycaprylylsilane"],
    risk_level:         "low",
    function_tags:      ["pigment_coating", "surface_treatment"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Silane surface-treatment for hydrophobising mineral pigments.",
  },

  // ── 28. Capryloyl Glycine (26 prods) ───────────────────────────────────────
  // Amino-acid-based mild surfactant / sebum-balancing active. Well tolerated;
  // common in scalp and oily-skin formulations.
  {
    suggested_canonical_name: "capryloyl glycine",
    aliases: ["capryloyl glycine"],
    risk_level:         "low",
    function_tags:      ["surfactant", "sebum_regulating", "mild_cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Amino-acid-based mild surfactant with sebum-balancing properties.",
  },

  // ── 29. Hydrogenated Polyisobutene (26 prods) ──────────────────────────────
  // Fully saturated hydrocarbon polymer; emollient with silicone-like slip,
  // commonly used as a mineral-oil alternative.
  {
    suggested_canonical_name: "hydrogenated polyisobutene",
    aliases: ["hydrogenated polyisobutene"],
    risk_level:         "low",
    function_tags:      ["polymer", "emollient"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Fully saturated hydrocarbon polymer; silicone-like emollient.",
  },

  // ── 30. Hydrogenated Starch Hydrolysate (26 prods) ─────────────────────────
  // Polyol blend (sorbitol / maltitol / hydrogenated oligosaccharides);
  // humectant and skin-conditioning agent. GRAS for ingestion; topical use
  // is benign.
  {
    suggested_canonical_name: "hydrogenated starch hydrolysate",
    aliases: ["hydrogenated starch hydrolysate"],
    risk_level:         "low",
    function_tags:      ["humectant", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Polyol blend from hydrogenated starch; humectant and conditioning agent.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertTopUnknownPhase1B");
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

    // Build a single normalized-alias set to check existence in bulk.
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

    // Bulk fetch existing master canonicals
    const { data: existingMasters } = await sb
      .from("ingredients_master")
      .select("canonical_name")
      .in("canonical_name", allCanonicals);

    const existingMasterSet = new Set(
      (existingMasters ?? []).map((r: any) => String(r.canonical_name))
    );

    // Bulk fetch existing aliases
    const aliasArr = [...aliasNorms];
    const existingAliases: { normalized_alias: string }[] = [];
    const PAGE = 200;
    for (let i = 0; i < aliasArr.length; i += PAGE) {
      const slice = aliasArr.slice(i, i + PAGE);
      const { data } = await sb
        .from("ingredient_aliases")
        .select("normalized_alias")
        .in("normalized_alias", slice);
      if (data) existingAliases.push(...(data as any));
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

      // Alias plan (canonical first, then synonyms)
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
