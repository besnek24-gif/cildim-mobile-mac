/**
 * batchInsertProductionUnknownsPhase1A.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1A — Conservative LOW-RISK subset of the top 30 pending entries
 *            from production `ingredient_unknown_queue`.
 *
 * SOURCE OF TRUTH:
 *   `ingredient_unknown_queue` snapshot taken on 2026-04-26.
 *   Initial selection: resolution_status = "pending", ordered by seen_count
 *   desc, raw_name asc, LIMIT 30.
 *
 *   Phase 1A then narrows that list to ONLY the safest LOW-risk cosmetic
 *   support / texture / mild-surfactant / vitamin ingredients. Excluded from
 *   Phase 1A (will be reviewed in a later phase):
 *     - medium / unknown risk_level
 *     - uncertain pregnancy data
 *     - fragrance allergens (e.g. Citral, Undecyl Alcohol)
 *     - antimicrobial / anti-dandruff actives (Piroctone Olamine,
 *       Zinc Pyrithione, Sodium Shale Oil Sulfonate)
 *     - botanical extracts with limited topical safety literature
 *       (Juniperus Oxycedrus, Zanthoxylum Bungeanum, Lentinus Edodes,
 *        Scenedesmus Rubescens, Calophyllum Inophyllum)
 *     - drug-like / regulated cosmetic actives (Aluminum Chlorohydrate,
 *       Cetrimonium Bromide)
 *     - chemistries with insufficient topical safety data
 *       (Sodium Polynaphthalenesulfonate)
 *
 * GOAL:
 *   Reduce production-observed unknown ingredients by adding canonical entries
 *   to `ingredients_master` and exact aliases to `ingredient_aliases`.
 *
 * SAFETY GUARANTEES:
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false in env to actually write)
 *   - Idempotent: re-running is safe (uses applyUnknownResolutionCandidates,
 *     which checks for existing rows before INSERT)
 *   - Does NOT touch the live score engine, V4 registry, resolver, or UI
 *   - Does NOT modify any existing row
 *   - Does NOT delete or update any product
 *   - Does NOT write to ingredient_unknown_queue
 *
 * UNCERTAINTY HANDLING:
 *   The schema has no `needs_review` column. Where a property is uncertain we
 *   use the conservative enum values defined in BatchResolutionCandidate:
 *     pregnancy_flag    = "unknown"  (unverified)
 *     breastfeeding_flag = "unknown"
 *     allergy_flag      = "unknown" or "moderate" when documented allergen
 *     risk_level        = "unknown" when literature is mixed
 *   Each candidate's source rationale is documented inline.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertProductionUnknownsPhase1A.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertProductionUnknownsPhase1A.ts
 *
 * Sources used: CosIng (EU), INCI database, EWG Skin Deep, peer-reviewed
 * dermatology and toxicology references where available.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── 30 production-observed candidates (top of unknown_queue) ──────────────────
//
// Ordering preserved from the unknown_queue snapshot (seen_count desc).
// Each entry includes a brief rationale and the property choices.

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Perlite (seen_count: 20) ────────────────────────────────────────────
  // Inert volcanic-glass mineral; absorbent / anti-caking texture modifier.
  // Inert, non-bioavailable, broadly safe.
  {
    suggested_canonical_name: "perlite",
    aliases: ["perlite"],
    risk_level:         "low",
    function_tags:      ["absorbent", "anti_caking", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Expanded volcanic glass used as an inert absorbent and texture modifier.",
  },

  // ── 2. Sodium Citrate (seen_count: 19) ─────────────────────────────────────
  // pH buffer and chelating agent. NOTE: already inserted by batchInsertLibraryGapsV5
  // — re-run is safe (idempotent: master will be reused, alias skipped).
  {
    suggested_canonical_name: "sodium citrate",
    aliases: ["sodium citrate", "trisodium citrate"],
    risk_level:         "low",
    function_tags:      ["chelating", "ph_adjuster", "preservative_booster"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Trisodium salt of citric acid — pH buffer and chelating agent.",
  },

  // ── 3. Methyl Methacrylate Crosspolymer (seen_count: 13) ───────────────────
  // PMMA-derived crosslinked polymer microspheres; soft-focus / optical-blur
  // and absorbent texture filler. Particle size matters; rinse-off and skin
  // applications are considered low risk.
  {
    suggested_canonical_name: "methyl methacrylate crosspolymer",
    aliases: ["methyl methacrylate crosspolymer", "pmma crosspolymer"],
    risk_level:         "low",
    function_tags:      ["texture", "absorbent", "optical_blur"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Crosslinked PMMA polymer powder used for soft-focus / mattifying effect.",
  },

  // ── 4. Laureth-2 (seen_count: 11) ──────────────────────────────────────────
  // Polyethylene-glycol ether of lauryl alcohol; mild non-ionic surfactant /
  // emulsifier. Like other PEG ethers, residual 1,4-dioxane is a manufacturing
  // concern that is addressed by purification — we mark allergy as low.
  {
    suggested_canonical_name: "laureth-2",
    aliases: ["laureth-2", "laureth 2"],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier"],
    concern_flags:      ["peg_compound"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Ethoxylated lauryl alcohol (PEG ether) used as a mild non-ionic surfactant.",
  },

  // ── 5. PEG-90 Glyceryl Isostearate (seen_count: 9) ─────────────────────────
  // PEG ester emulsifier. Similar profile to other PEG-glyceryl emulsifiers.
  {
    suggested_canonical_name: "peg-90 glyceryl isostearate",
    aliases: ["peg-90 glyceryl isostearate", "peg 90 glyceryl isostearate"],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant"],
    concern_flags:      ["peg_compound"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Ethoxylated glyceryl isostearate used as a non-ionic emulsifier.",
  },

  // ── 6. Polyquaternium-10 (seen_count: 9) ───────────────────────────────────
  // Cationic cellulose conditioner. Wide use in shampoos and conditioners;
  // possible mild eye irritation at high concentrations.
  {
    suggested_canonical_name: "polyquaternium-10",
    aliases: ["polyquaternium-10", "polyquaternium 10"],
    risk_level:         "low",
    function_tags:      ["conditioning", "antistatic", "film_former"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Quaternized hydroxyethyl cellulose; cationic conditioning polymer for hair.",
  },

  // ── 7. Sodium Acetate (seen_count: 9) ──────────────────────────────────────
  // Sodium salt of acetic acid; pH buffer.
  {
    suggested_canonical_name: "sodium acetate",
    aliases: ["sodium acetate"],
    risk_level:         "low",
    function_tags:      ["ph_adjuster", "buffer"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Sodium salt of acetic acid; used as a pH buffer.",
  },

  // ── 8. Steareth-100/PEG-136/HDI Copolymer (seen_count: 9) ──────────────────
  // PEG-based associative thickener (urethane crosslinker). The raw_name in
  // production includes slashes which the normalizer collapses to a single
  // token "steareth-100peg-136hdi copolymer" — we register both the cleanly
  // spaced INCI form and the production token as aliases.
  {
    suggested_canonical_name: "steareth-100/peg-136/hdi copolymer",
    aliases: [
      "steareth-100/peg-136/hdi copolymer",
      "steareth-100 peg-136 hdi copolymer",
      "steareth-100peg-136hdi copolymer",
    ],
    risk_level:         "low",
    function_tags:      ["thickener", "rheology_modifier"],
    concern_flags:      ["peg_compound"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Associative urethane thickener built on PEG / steareth chemistry.",
  },

  // ── 9. Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine (seen_count: 8) ──────
  // INCI for Tinosorb S (BEMT) — broad-spectrum UVA/UVB filter. Production
  // raw_name has a typo ("Phnol" instead of "Phenol"); we register both
  // canonical INCI and the typo form as aliases for forward compatibility.
  {
    suggested_canonical_name: "bis-ethylhexyloxyphenol methoxyphenyl triazine",
    aliases: [
      "bis-ethylhexyloxyphenol methoxyphenyl triazine",
      "bis-ethylhexyloxyphnol methoxyphenyl triazine",
      "tinosorb s",
      "bemt",
    ],
    risk_level:         "low",
    function_tags:      ["uv_filter", "uva_filter", "uvb_filter"],
    concern_flags:      ["sunscreen_active"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Broad-spectrum organic UV filter (Tinosorb S / BEMT).",
  },

  // ── 10. Phytosphingosine (seen_count: 8) ───────────────────────────────────
  // Sphingolipid component of skin barrier; widely used as a barrier-support
  // and anti-microbial assist ingredient. Strong safety profile.
  {
    suggested_canonical_name: "phytosphingosine",
    aliases: ["phytosphingosine"],
    risk_level:         "low",
    function_tags:      ["barrier_support", "soothing", "antimicrobial"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Sphingolipid skin barrier component; supports barrier function.",
  },

  // ── 11. Polyacrylate Crosspolymer-6 (seen_count: 8) ────────────────────────
  // Synthetic crosslinked polyacrylate thickener / rheology modifier.
  {
    suggested_canonical_name: "polyacrylate crosspolymer-6",
    aliases: ["polyacrylate crosspolymer-6", "polyacrylate crosspolymer 6"],
    risk_level:         "low",
    function_tags:      ["thickener", "rheology_modifier", "film_former"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Crosslinked polyacrylate; used as a high-clarity thickener.",
  },

  // ── 12. Sodium Lauroyl Lactylate (seen_count: 8) ───────────────────────────
  // Mild anionic surfactant / emulsifier derived from lactic acid + lauric.
  // Well tolerated; widely used in mild cleansers.
  {
    suggested_canonical_name: "sodium lauroyl lactylate",
    aliases: ["sodium lauroyl lactylate"],
    risk_level:         "low",
    function_tags:      ["surfactant", "emulsifier", "mild_cleansing"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Lactic-acid-based mild anionic surfactant.",
  },

  // ── 13. Hydroxyacetophenone (seen_count: 7) ────────────────────────────────
  // Antioxidant and preservative-booster; commonly used to extend the
  // efficacy of phenoxyethanol-based preservation systems.
  {
    suggested_canonical_name: "hydroxyacetophenone",
    aliases: ["hydroxyacetophenone", "4-hydroxyacetophenone"],
    risk_level:         "low",
    function_tags:      ["antioxidant", "preservative_booster"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Antioxidant + preservative booster used with phenoxyethanol systems.",
  },

  // ── 14. PEG-6 Caprylic/Capric Glycerides (seen_count: 7) ───────────────────
  // PEG ester emulsifier / solubilizer. Production raw_name appears with both
  // a stray space and a Unicode invisible separator ("Peg-6 Caprylic/ Capric
  // Glycerides"). We register the canonical form plus the slash/space variants
  // as aliases.
  {
    suggested_canonical_name: "peg-6 caprylic/capric glycerides",
    aliases: [
      "peg-6 caprylic/capric glycerides",
      "peg-6 caprylic capric glycerides",
      "peg 6 caprylic capric glycerides",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant", "solubilizer"],
    concern_flags:      ["peg_compound"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "PEG-modified caprylic/capric glycerides used as solubilizer / emulsifier.",
  },

  // ── 15. PEG-60 Almond Glycerides (seen_count: 7) ───────────────────────────
  // PEG ester emulsifier of sweet-almond glycerides; mild surfactant, used
  // in micellar and rinse-off cleansers.
  {
    suggested_canonical_name: "peg-60 almond glycerides",
    aliases: ["peg-60 almond glycerides", "peg 60 almond glycerides"],
    risk_level:         "low",
    function_tags:      ["emulsifier", "surfactant", "solubilizer"],
    concern_flags:      ["peg_compound"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Ethoxylated almond glyceride; mild non-ionic emulsifier.",
  },

  // ── 16. Pyridoxine HCl (seen_count: 7) ─────────────────────────────────────
  // Vitamin B6 (HCl salt). Used as a skin-conditioning vitamin / antioxidant.
  // NOTE: the broad "vitamin b6" alias is intentionally NOT registered here —
  // the B6 family includes pyridoxal and pyridoxamine, which are distinct
  // compounds. Only the unambiguous chemical name + HCl salt form are aliased.
  {
    suggested_canonical_name: "pyridoxine hcl",
    aliases: ["pyridoxine hcl", "pyridoxine hydrochloride"],
    risk_level:         "low",
    function_tags:      ["vitamin", "antioxidant", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Vitamin B6 (HCl form); skin-conditioning vitamin / antioxidant.",
  },

  // ── 17. Behentrimonium Methosulfate (seen_count: 6) ────────────────────────
  // Cationic conditioner derived from rapeseed/canola. Considered one of the
  // mildest "quat" conditioners; well tolerated.
  {
    suggested_canonical_name: "behentrimonium methosulfate",
    aliases: ["behentrimonium methosulfate", "btms"],
    risk_level:         "low",
    function_tags:      ["conditioning", "antistatic", "emulsifier"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:        "Mild cationic conditioning quat derived from rapeseed.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertProductionUnknownsPhase1A");
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
