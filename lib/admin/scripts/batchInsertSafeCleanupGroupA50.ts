/**
 * batchInsertSafeCleanupGroupA50.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Group A · Safe Cosmetic Support · 50-candidate batch"
 *
 * GOAL:
 *   Lift overall ingredient coverage from ~84.11 % toward ~86.24 % by
 *   resolving the 50 highest-frequency unknown tokens that are clean,
 *   well-defined, single-chemical cosmetic-support ingredients.
 *
 * SOURCE OF CANDIDATES:
 *   `lib/admin/scripts/fastUnknownReport.ts` (read-only) was re-run on
 *   2026-04-26 with TOP_UNKNOWNS=100. The top-100 unknowns by product
 *   frequency were classified into 5 buckets (A safe cosmetic support /
 *   B fragrance·allergen / C botanical·extract / D antimicrobial·drug-like /
 *   E ambiguous·parsing). The 50 entries in REVIEWED_CANDIDATES are the
 *   highest-impact subset of Group A, ordered by product frequency.
 *
 * EXCLUDED (handled in dedicated future batches):
 *   ✗ Group B — MENTHOL, Tetramethyl Acetyloctahydronaphthalenes (OTNE),
 *               Vanillyl Butyl Ether, Linalyl Acetate, Mentha Piperita Oil
 *   ✗ Group C — Argania / Achillea / Equisetum / Ceratonia / Urtica Dioica /
 *               Vitis Vinifera extracts, Cocos Nucifera Oil,
 *               Glycine Soja Oil (×3 forms), Vitreoscilla Ferment,
 *               Persea Gratissima Oil, Mel (honey),
 *               Ricinus Communis Seed Oil
 *   ✗ Group D — Piroctone Olamine, Aluminum Chlorohydrate,
 *               Chlorhexidine Digluconate, Benzalkonium Chloride
 *   ✗ Group E — Copper Sulfate / Gluconate, parsing artifacts
 *               ("2-Oleamido-1", "3-Octadecanediol",
 *               "BIOCOMPLEX B11 (URTICA URENS LEAF EXTRACT"),
 *               1-Methylhydantoin-2-Imide, Sodium Metabisulfite,
 *               bare "Pca", T-Butyl Alcohol, bare "Zinc",
 *               CI 15850 / CI 47005 / CI 75470 (Carmine) / CI 77007
 *   ✗ Lower-impact Group A tail (positions 79–100) — kept for a later batch:
 *               Sorbitan Sesquioleate, Steareth-6,
 *               Tetrasodium Glutamate Diacetate, Trideceth-3, Triisostearin,
 *               Asiatic Acid, Cellulose Acetate, Folic Acid,
 *               Hydrolyzed Keratin / Soy Protein, Laureth-4, Leucine,
 *               Methyl Trimethicone
 *
 * KEPT — single-entity, well-defined INCI ingredients across:
 *     surfactants & emulsifiers · emollients & esters · waxes ·
 *     polymers & film formers · cationic conditioning quats · silicones ·
 *     proteins & ferments · amino acids · humectants & prebiotics ·
 *     buffers & minerals · preservatives · antioxidants
 *
 * RISK PROFILE POLICY (uniform across this batch):
 *     risk_level         = "low"
 *     pregnancy_flag     = "safe"
 *     breastfeeding_flag = "safe"
 *     allergy_flag       = "low"
 *     concern_flags      = []
 *   No deviations — every candidate was screened to fit the safe-default
 *   profile. Anything that warranted a deviation was excluded into B/C/D/E.
 *
 * ALIAS POLICY (NO fake synonyms):
 *   For each candidate the alias list contains ONLY:
 *     1. The canonical INCI form (the same string that became the
 *        suggested_canonical_name) so PATH 1 alias lookup finds it directly.
 *   No additional non-observed forms are added. Slash/punctuation/casing
 *   variants observed in production already collapse to the same normalized
 *   form via `normalizeForLookup`, so the single canonical alias is enough.
 *
 * SAFETY GUARANTEES:
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually write).
 *   - Idempotent: re-running is safe — applyUnknownResolutionCandidates()
 *     looks up each canonical in ingredients_master and each normalized
 *     alias in ingredient_aliases before INSERT. Existing rows are REUSEd
 *     / SKIPped instead of duplicated.
 *   - Writes ONLY to ingredients_master and ingredient_aliases.
 *   - Does NOT modify products, ingredient_unknown_queue, the resolver,
 *     the score engine, the V4 registry, or the UI.
 *
 * EXPECTED IMPACT (from fastUnknownReport.ts 2026-04-26 projection):
 *   Pre-cleanup  : coverage 84.11 %, unknown_instances 4 277,
 *                  unique_unknown_tokens 1 617.
 *   The selected 50 candidates collectively cover ≈574 instances;
 *   the realistic upper bound is ≈86.24 % coverage with
 *   unknown_instances ≈3 703 (−13.4 %) and 50 fewer unique tokens.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertSafeCleanupGroupA50.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertSafeCleanupGroupA50.ts
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Helper: low-risk default profile ──────────────────────────────────────────
function low(
  canonical: string,
  function_tags: string[],
  description: string
): BatchResolutionCandidate {
  return {
    suggested_canonical_name: canonical,
    aliases:                  [canonical],
    risk_level:               "low",
    function_tags,
    concern_flags:            [],
    pregnancy_flag:           "safe",
    breastfeeding_flag:       "safe",
    allergy_flag:             "low",
    description,
  };
}

// ── Exactly 50 reviewed Group-A candidates ────────────────────────────────────
// Order = product-frequency descending (matches the 2026-04-26 report).

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [
  //  1. count 37
  low("Phenethyl Alcohol",
      ["preservative"],
      "Aromatic alcohol; permitted cosmetic preservative / co-preservative."),
  //  2. count 29
  low("Cetrimonium Chloride",
      ["surfactant", "conditioner"],
      "Cationic surfactant; rinse-off hair / skin conditioning."),
  //  3. count 22
  low("Behentrimonium Chloride",
      ["surfactant", "conditioner"],
      "Cationic surfactant; conditioning agent for hair masks and creams."),
  //  4. count 20
  low("Cetrimonium Bromide",
      ["surfactant", "conditioner"],
      "Cationic surfactant; conditioning agent (CTAB-type)."),
  //  5. count 18
  low("Sorbic Acid",
      ["preservative"],
      "Organic acid preservative (EU Annex V; permitted up to 0.6 %)."),
  //  6. count 15
  low("p-Anisic Acid",
      ["preservative"],
      "Anise-derived preservative booster; weak antimicrobial."),
  //  7. count 14
  low("Creatine",
      ["active", "skin_conditioning"],
      "Endogenous amino-acid derivative; cellular-energy conditioning active."),
  //  8. count 12
  low("Propyl Gallate",
      ["antioxidant", "preservative"],
      "Phenolic ester antioxidant; protects oils from oxidation."),
  //  9. count 11
  low("Alpha-Glucan Oligosaccharide",
      ["humectant", "prebiotic"],
      "Defined oligosaccharide; humectant + microbiome-prebiotic active."),
  // 10. count 11
  low("Styrene/Acrylates Copolymer",
      ["polymer", "film_former"],
      "Styrene-acrylate copolymer; opacifier / film former."),
  // 11. count 11
  low("TEA-Dodecylbenzenesulfonate",
      ["surfactant"],
      "Triethanolamine alkylbenzenesulfonate; anionic cleansing surfactant."),
  // 12. count 11
  low("Trideceth-12",
      ["surfactant", "emulsifier"],
      "Non-ionic ethoxylated tridecyl alcohol surfactant / emulsifier."),
  // 13. count 10
  low("Arachidic Acid",
      ["emollient"],
      "C20 saturated fatty acid; emollient / structurant."),
  // 14. count 10
  low("Arachidyl Glucoside",
      ["emulsifier"],
      "Glucoside-based co-emulsifier (paired with arachidyl alcohol)."),
  // 15. count 10
  low("C12-22 Alkyl Acrylate/Hydroxyethylacrylate Copolymer",
      ["polymer", "film_former"],
      "Acrylate copolymer film former; sunscreen / makeup textures."),
  // 16. count 10
  low("C18-36 Acid Triglyceride",
      ["emollient", "wax"],
      "High-melting triglyceride; emollient wax for sticks and balms."),
  // 17. count 10
  low("Ceteareth-60 Myristyl Glycol",
      ["emulsifier"],
      "Non-ionic ethoxylated cetearyl-glycol emulsifier."),
  // 18. count 10
  low("Cocoglycerides",
      ["emollient"],
      "Coconut-derived mixed glycerides; rich emollient base."),
  // 19. count 10
  low("Copernicia Cerifera Cera / Carnauba Wax",
      ["wax", "thickener"],
      "Carnauba wax (high-melting plant wax); structurant in sticks."),
  // 20. count 10
  low("Diisostearyl Malate",
      ["emollient"],
      "Branched-chain malate ester emollient for lip and color cosmetics."),
  // 21. count 10
  low("Disodium Cocoyl Glutamate",
      ["surfactant"],
      "Mild amino-acid–based anionic surfactant for facial cleansers."),
  // 22. count 10
  low("Glyceryl Linoleate",
      ["emollient"],
      "Glyceryl mono-ester of linoleic acid (omega-6); emollient."),
  // 23. count 10
  low("Hydrolyzed Silk",
      ["active", "protein"],
      "Hydrolyzed silk protein; conditioning / film-forming active."),
  // 24. count 10
  low("Hydroxypropyl Guar",
      ["thickener", "polymer"],
      "Hydroxypropyl-modified guar gum; polysaccharide thickener."),
  // 25. count 10
  low("Isopropyl Isostearate",
      ["emollient"],
      "Branched-chain isostearate ester emollient."),
  // 26. count 10
  low("Lactococcus Ferment Lysate",
      ["active", "skin_conditioning"],
      "Probiotic-derived ferment lysate; barrier / soothing active."),
  // 27. count 10
  low("PEG-150 Pentaerythrityl Tetrastearate",
      ["thickener", "emulsifier"],
      "PEG-pentaerythrityl tetraester thickener for surfactant systems."),
  // 28. count 10
  low("PEG/PPG-120/10 Trimethylolpropane Trioleate",
      ["emulsifier", "conditioner"],
      "Block-copolymer trioleate ester; emulsifier / conditioning agent."),
  // 29. count 10
  low("Phenylalanine",
      ["amino_acid", "skin_conditioning"],
      "Essential amino acid; skin / hair conditioning component."),
  // 30. count 10
  low("Polyquaternium-6",
      ["polymer", "conditioner"],
      "Cationic polymer; conditioning / film-former in hair products."),
  // 31. count 10
  low("Polysilicone-11",
      ["polymer", "film_former"],
      "Crosslinked silicone elastomer film former."),
  // 32. count 10
  low("PPG-5-Ceteth-20",
      ["surfactant", "emulsifier"],
      "Non-ionic alkoxylated cetyl ether; emulsifier / solubiliser."),
  // 33. count 10
  low("Zinc Stearate",
      ["absorbent", "lubricant"],
      "Zinc fatty-acid salt; slip / absorbent in powders and color cosmetics."),
  // 34. count 9
  low("Acetylated Glycol Stearate",
      ["emollient"],
      "Acetylated glycol-stearate emollient; light skin-feel."),
  // 35. count 9
  low("C30-45 Alkyldimethylsilyl Polypropylsilsesquioxane",
      ["wax", "polymer"],
      "Silicone-resin wax; structurant in long-wear color cosmetics."),
  // 36. count 9
  low("Calcium Gluconate",
      ["buffer", "skin_conditioning"],
      "Calcium-mineral salt; buffering and skin-conditioning agent."),
  // 37. count 9
  low("Candelilla Cera / Candelilla Wax",
      ["wax", "thickener"],
      "Candelilla wax; high-melting structurant for sticks and balms."),
  // 38. count 9
  low("Cocamidopropyl Hydroxysultaine",
      ["surfactant"],
      "Amphoteric sultaine surfactant; mild foaming / cleansing."),
  // 39. count 9
  low("Glyceryl Palmitate",
      ["emollient", "emulsifier"],
      "Glyceryl mono-ester of palmitic acid; emollient / co-emulsifier."),
  // 40. count 9
  low("Hydrogenated Lecithin",
      ["emulsifier"],
      "Hydrogenated phospholipid emulsifier; stable lamellar films."),
  // 41. count 9
  low("Hydrolyzed Rice Protein",
      ["active", "protein"],
      "Hydrolyzed rice-grain protein; conditioning active."),
  // 42. count 9
  low("Hydroxypropyl Tetrahydropyrantriol",
      ["active", "skin_conditioning"],
      "Pro-Xylane; sugar-derived skin conditioning / firming active."),
  // 43. count 9
  low("Magnesium Aspartate",
      ["skin_conditioning", "amino_acid"],
      "Magnesium–amino-acid chelate; skin conditioning / mineral source."),
  // 44. count 9
  low("Myrtrimonium Bromide",
      ["surfactant", "conditioner"],
      "Cationic surfactant; mild conditioner / antistatic agent."),
  // 45. count 9
  low("PEG-40 Stearate",
      ["emulsifier", "surfactant"],
      "PEG-stearate non-ionic O/W emulsifier."),
  // 46. count 9
  low("PEG-60 Hydrogenated Castor Oil",
      ["emulsifier", "solubilizer"],
      "Ethoxylated castor-oil derivative; non-ionic solubiliser / emulsifier."),
  // 47. count 9
  low("Polyquaternium-11",
      ["polymer", "conditioner", "film_former"],
      "Cationic copolymer; styling and conditioning film former."),
  // 48. count 9
  low("Sodium Stearate",
      ["surfactant", "thickener"],
      "Sodium fatty-acid soap; structurant in stick formats and cleansers."),
  // 49. count 9
  low("Sodium Sulfate",
      ["thickener", "electrolyte"],
      "Inorganic salt; viscosity adjuster in surfactant systems."),
  // 50. count 9
  low("Sorbitan Laurate",
      ["emulsifier"],
      "Non-ionic sorbitan-ester emulsifier (Span 20)."),
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertSafeCleanupGroupA50");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` MODE    : ${DRY_RUN ? "DRY-RUN  (no writes)" : "LIVE  (writes enabled)"}`);
  console.log(` CANDIDATES: ${REVIEWED_CANDIDATES.length}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  if (REVIEWED_CANDIDATES.length !== 50) {
    console.error(`FATAL: candidate count is ${REVIEWED_CANDIDATES.length}, expected exactly 50`);
    process.exit(2);
  }

  const sb = createLeanSupabase();

  // ── Sanity: surface duplicates inside the batch itself ────────────────────
  {
    const seenC = new Set<string>();
    const seenA = new Set<string>();
    let anyDup = false;
    for (const c of REVIEWED_CANDIDATES) {
      const k = normalizeForLookup(c.suggested_canonical_name);
      if (seenC.has(k)) {
        console.warn(`  WARN: duplicate canonical inside batch → "${c.suggested_canonical_name}"`);
        anyDup = true;
      }
      seenC.add(k);
      for (const a of c.aliases) {
        const ka = normalizeForLookup(a);
        if (!ka) continue;
        if (seenA.has(ka)) {
          if (ka !== k) {
            console.warn(`  WARN: duplicate alias inside batch → "${a}" (norm "${ka}")`);
            anyDup = true;
          }
        }
        seenA.add(ka);
      }
    }
    if (anyDup) {
      console.error("FATAL: duplicate canonical or alias detected inside batch — aborting.");
      process.exit(3);
    }
    console.log("  Sanity OK: no duplicates inside batch.\n");
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

    let willInsertMaster  = 0;
    let willReuseMaster   = 0;
    let willInsertAliases = 0;
    let willSkipAliases   = 0;

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
      (existingMasters ?? []).map((r: any) => String(r.canonical_name))
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
      if (data) existingAliases.push(...(data as any));
    }
    const existingAliasSet = new Set(existingAliases.map((r) => r.normalized_alias));

    let idx = 0;
    for (const c of REVIEWED_CANDIDATES) {
      idx++;
      const cn        = normalizeForLookup(c.suggested_canonical_name);
      const reused    = existingMasterSet.has(cn);
      const masterTag = reused ? "REUSE " : "INSERT";
      if (reused) willReuseMaster++; else willInsertMaster++;

      console.log(`${String(idx).padStart(3, " ")}. [${masterTag}] master="${cn}"`);
      console.log(`      risk=${c.risk_level}  preg=${c.pregnancy_flag}  bf=${c.breastfeeding_flag}  allergy=${c.allergy_flag}`);
      console.log(`      fn_tags=${JSON.stringify(c.function_tags ?? [])}`);

      const aliasPlan: { raw: string; norm: string; type: "exact" | "alt" }[] = [
        { raw: c.suggested_canonical_name, norm: cn, type: "exact" },
      ];
      for (const a of c.aliases) {
        const an = normalizeForLookup(a);
        if (!an || an === cn) continue;
        if (aliasPlan.some((x) => x.norm === an)) continue;
        aliasPlan.push({ raw: a, norm: an, type: "alt" });
      }

      for (const a of aliasPlan) {
        const exists = existingAliasSet.has(a.norm);
        const tag    = exists ? "SKIP  " : "INSERT";
        if (exists) willSkipAliases++; else willInsertAliases++;
        console.log(`        └─ [${tag}] alias(${a.type})="${a.norm}"`);
      }
    }

    console.log();
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
