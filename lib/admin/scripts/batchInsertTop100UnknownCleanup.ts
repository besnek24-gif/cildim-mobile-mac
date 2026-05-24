/**
 * batchInsertTop100UnknownCleanup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Top-100 Unknown Cleanup" — one-time batch.
 *
 * GOAL:
 *   Lift overall ingredient coverage from ~78 % toward ~85 % by resolving the
 *   most-frequent unknown tokens that are clean, well-defined, single-chemical
 *   cosmetic-support ingredients.
 *
 * SOURCE OF CANDIDATES:
 *   `lib/admin/scripts/analyzeTop200UnknownByInstance.ts` (read-only) was run
 *   against current production. The top-200 unknowns by instance frequency
 *   were classified manually using the strict filter below. The 100 entries
 *   in REVIEWED_CANDIDATES are the ones that PASSED every filter.
 *
 * FILTER APPLIED (rejected from this batch — handled in dedicated phases):
 *   ✗ Fragrance allergens / fragrance compounds  (Phase 1C / 1F deferral)
 *       - menthol, phenethyl alcohol, linalyl acetate,
 *         vanillyl butyl ether, Iso E Super
 *   ✗ Antimicrobial / preservative / drug-like actives  (Phase 1D)
 *       - piroctone olamine, cetrimonium-* / behentrimonium-* / myrtrimonium-*
 *         quats, benzalkonium chloride, chlorhexidine digluconate,
 *         aluminum chlorohydrate, copper salts, sorbic acid, propyl gallate,
 *         p-anisic acid, sodium metabisulfite, TEA-dodecylbenzenesulfonate,
 *         1-methylhydantoin-2-imide
 *   ✗ Botanical / animal extracts & oils  (Phase 1E)
 *       - all "*-extract" / "*-oil" / "*-ferment lysate" entries,
 *         hydrolyzed proteins (silk / keratin / rice / soy),
 *         mel (honey), candelilla cera, copernicia cerifera,
 *         CI 75470 (carmine — animal cochineal pigment)
 *   ✗ Ambiguous / parse-artifact tokens
 *       - "2-oleamido-1" / "3-octadecanediol" (truncated by comma split),
 *         "biocomplex b11 …" (proprietary mixture, malformed parse),
 *         bare "zinc" (multi-meaning), bare "pca" (multi-meaning)
 *
 * KEPT — single-entity, well-defined INCI ingredients across:
 *     surfactants & emulsifiers · emollients & esters · waxes · alkanes ·
 *     humectants · polysaccharides · polymers & film formers · buffers ·
 *     pH adjusters & chelators · amino acids & peptides · color additives ·
 *     vitamin actives · propellant
 *
 * RISK PROFILE POLICY (applied across this batch):
 *   Default for cosmetic-support ingredient:
 *     risk_level = "low"
 *     pregnancy_flag = "safe"
 *     breastfeeding_flag = "safe"
 *     allergy_flag = "low"
 *     concern_flags = []
 *
 *   Single deviation:
 *     • Synthesised signal peptides (palmitoyl tripeptide-1, palmitoyl
 *       tetrapeptide-7, acetyl dipeptide-1 cetyl ester, acetyl hexapeptide-8)
 *       have limited pregnancy / breastfeeding safety data → both flags set
 *       to "caution" (conservative, matches Phase 1C peptide policy spirit).
 *
 * ALIAS POLICY (DO NOT generate fake synonyms):
 *   For each candidate the alias list contains:
 *     1. The canonical normalized form itself
 *        (so PATH 1 alias lookup finds it directly).
 *     2. ONLY observed alternate normalized forms found in production data
 *        (e.g. CI 19140 also appears as "CI 19140 / YELLOW 5" → the
 *        normalized "ci 19140 yellow 5" is added so the same canonical is
 *        used for both forms).
 *   We deliberately do NOT add:
 *     - INCI common-name "synonyms" not seen in production
 *       (e.g. "yellow 5" alone, "blue 1" alone)
 *     - Hyphen-stripped forms — the runtime resolver runs PATH 1b/2b stripped
 *       fallbacks, so these are matched without explicit aliases.
 *     - Punctuation/spacing variants — `normalizeForLookup` strips slashes,
 *       parens, periods, etc. before lookup, so e.g. "Citral." and
 *       "CI 42090." already collapse to the canonical normalized form.
 *
 * SAFETY GUARANTEES:
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually write).
 *   - Idempotent: re-running is safe — applyUnknownResolutionCandidates()
 *     looks up each canonical in ingredients_master and each normalized
 *     alias in ingredient_aliases before INSERT.
 *   - Writes ONLY to ingredients_master and ingredient_aliases.
 *   - Does NOT modify products, ingredient_unknown_queue, the resolver,
 *     the score engine, the V4 registry, or the UI.
 *
 * EXPECTED IMPACT (from analyzeTop200UnknownByInstance.ts projection):
 *   Pre-cleanup  : coverage 78.13 %, unknown_instances 5,884.
 *   The selected 100 candidates collectively cover ≈1,790 instances; the
 *   exact gain depends on how many candidates are already present in master
 *   and how many resolver paths re-classify them post-insert. The realistic
 *   upper bound is ≈ 84.5 – 85.0 % coverage with unknown_instances ≈ 4,100,
 *   matching the user's 78 % → 85 % target.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertTop100UnknownCleanup.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertTop100UnknownCleanup.ts
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
  aliases: string[],
  function_tags: string[],
  description: string
): BatchResolutionCandidate {
  return {
    suggested_canonical_name: canonical,
    aliases,
    risk_level:         "low",
    function_tags,
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description,
  };
}

// Synthetic signal peptides — conservative pregnancy/bf flags.
function peptide(
  canonical: string,
  aliases: string[],
  description: string
): BatchResolutionCandidate {
  return {
    suggested_canonical_name: canonical,
    aliases,
    risk_level:         "low",
    function_tags:      ["peptide", "active"],
    concern_flags:      [],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "low",
    description,
  };
}

// ── 100 reviewed candidates ───────────────────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [
  // ── Surfactants & emulsifiers (mild, well-defined) ─────────────────────────
  low("disodium laureth sulfosuccinate", ["disodium laureth sulfosuccinate"],
      ["surfactant"], "Mild anionic sulfosuccinate surfactant for sensitive cleansers."),
  low("peg-7 glyceryl cocoate", ["peg-7 glyceryl cocoate"],
      ["surfactant", "emollient"], "Mild PEG-glyceryl ester surfactant / re-fatting agent."),
  low("sodium c14-16 olefin sulfonate", ["sodium c14-16 olefin sulfonate"],
      ["surfactant"], "Anionic foaming surfactant common in shampoos and body washes."),
  low("disodium cocoamphodiacetate", ["disodium cocoamphodiacetate"],
      ["surfactant"], "Mild amphoteric coconut-derived surfactant."),
  low("cocamide mea", ["cocamide mea"],
      ["surfactant", "foam_booster"], "Coconut-derived monoethanolamide foam booster."),
  low("sodium lauroyl glutamate", ["sodium lauroyl glutamate"],
      ["surfactant"], "Mild amino-acid–based anionic surfactant."),
  low("caprylyl/capryl glucoside", ["caprylylcapryl glucoside"],
      ["surfactant"], "Mild non-ionic alkyl polyglucoside surfactant."),
  low("sodium methyl cocoyl taurate", ["sodium methyl cocoyl taurate"],
      ["surfactant"], "Mild taurate surfactant for facial cleansers."),
  low("sodium cocoyl isethionate", ["sodium cocoyl isethionate"],
      ["surfactant"], "Mild isethionate surfactant (SCI) for syndet bars and cleansers."),
  low("sucrose stearate", ["sucrose stearate"],
      ["emulsifier"], "Sugar-ester non-ionic emulsifier."),
  low("peg-150 distearate", ["peg-150 distearate"],
      ["thickener", "emulsifier"], "PEG distearate viscosity builder for surfactant systems."),
  low("sorbitan oleate", ["sorbitan oleate"],
      ["emulsifier"], "Non-ionic sorbitan-ester W/O emulsifier."),
  low("polyglyceryl-2 dipolyhydroxystearate", ["polyglyceryl-2 dipolyhydroxystearate"],
      ["emulsifier"], "Polyglyceryl W/O emulsifier for sunscreens and creams."),
  low("poloxamer 184", ["poloxamer 184"],
      ["surfactant", "emulsifier"], "Non-ionic block-copolymer surfactant / mild solubiliser."),
  low("trideceth-6", ["trideceth-6"],
      ["emulsifier", "surfactant"], "Non-ionic ethoxylated tridecyl alcohol emulsifier."),
  low("trideceth-10", ["trideceth-10"],
      ["emulsifier", "surfactant"], "Non-ionic ethoxylated tridecyl alcohol emulsifier."),
  low("polyglyceryl-6 behenate", ["polyglyceryl-6 behenate"],
      ["emulsifier"], "Polyglyceryl behenate O/W emulsifier."),
  low("polyglyceryl-6 stearate", ["polyglyceryl-6 stearate"],
      ["emulsifier"], "Polyglyceryl stearate O/W emulsifier."),
  low("methyl gluceth-20", ["methyl gluceth-20"],
      ["humectant", "emulsifier"], "Methyl glucose ether humectant / mild surfactant."),
  low("sodium xylenesulfonate", ["sodium xylenesulfonate"],
      ["solvent", "hydrotrope"], "Hydrotrope solubiliser for surfactant blends."),
  low("magnesium stearate", ["magnesium stearate"],
      ["anti_caking", "lubricant"], "Anti-caking and slip agent in powders."),

  // ── Emollients · esters · alkanes · waxes ──────────────────────────────────
  low("hydrogenated coco-glycerides", ["hydrogenated coco-glycerides"],
      ["emollient"], "Hydrogenated coconut glycerides emollient wax."),
  low("synthetic wax", ["synthetic wax"],
      ["wax", "emollient"], "Synthesised hydrocarbon wax (Fischer-Tropsch type)."),
  low("hexyl laurate", ["hexyl laurate"],
      ["emollient"], "Light dry-touch ester emollient."),
  low("bis-diglyceryl polyacyladipate-2", ["bis-diglyceryl polyacyladipate-2"],
      ["emollient"], "Polyglyceryl ester emollient (Softisan)."),
  low("isostearyl isostearate", ["isostearyl isostearate"],
      ["emollient"], "Branched-chain ester emollient with high spreadability."),
  low("propylheptyl caprylate", ["propylheptyl caprylate"],
      ["emollient"], "Light, fast-spreading ester emollient."),
  low("cetyl esters", ["cetyl esters"],
      ["wax", "emollient"], "Synthetic spermaceti substitute (cetyl/myristyl ester wax)."),
  low("tridecane", ["tridecane"],
      ["emollient", "solvent"], "Light volatile alkane emollient."),
  low("undecane", ["undecane"],
      ["emollient", "solvent"], "Light volatile alkane emollient (paired with tridecane)."),
  low("c15-19 alkane", ["c15-19 alkane"],
      ["emollient", "solvent"], "Plant-derived volatile alkane emollient blend."),
  low("arachidyl alcohol", ["arachidyl alcohol"],
      ["emollient", "thickener"], "C20 fatty alcohol thickener / emollient."),
  low("pentaerythrityl tetraisostearate", ["pentaerythrityl tetraisostearate"],
      ["emollient"], "Polyol-tetraester emollient for high-coverage textures."),
  low("pentaerythrityl tetraethylhexanoate", ["pentaerythrityl tetraethylhexanoate"],
      ["emollient"], "Polyol-tetraester emollient for makeup textures."),
  low("decyl oleate", ["decyl oleate"],
      ["emollient"], "Branched-chain oleate ester emollient."),
  low("hydrogenated palm glycerides", ["hydrogenated palm glycerides"],
      ["emollient"], "Hydrogenated palm-derived glycerides emollient."),
  low("hydrogenated palm glycerides citrate", ["hydrogenated palm glycerides citrate"],
      ["emollient", "emulsifier"], "Citrate-modified palm glycerides emollient/co-emulsifier."),
  low("hydrogenated castor oil", ["hydrogenated castor oil"],
      ["wax", "emollient"], "Hydrogenated triglyceride wax (defined chemical entity)."),
  low("ozokerite", ["ozokerite"],
      ["wax"], "Naturally occurring mineral wax."),
  low("polybutene", ["polybutene"],
      ["film_former", "emollient"], "Liquid polyolefin film former / lip-product binder."),
  low("glyceryl linolenate", ["glyceryl linolenate"],
      ["emollient"], "Glyceryl mono-ester of α-linolenic acid (omega-3)."),
  low("isopropyl lauroyl sarcosinate", ["isopropyl lauroyl sarcosinate"],
      ["emollient", "skin_conditioning"], "Sarcosinate-derived emollient with skin-feel benefits."),

  // ── Humectants · polysaccharides · sugars ──────────────────────────────────
  low("saccharide isomerate", ["saccharide isomerate"],
      ["humectant", "skin_conditioning"], "Plant-derived 5-sugar moisturising complex."),
  low("glucomannan", ["glucomannan"],
      ["humectant", "film_former"], "Konjac-derived defined polysaccharide; texture & humectant."),
  low("zinc pca", ["zinc pca"],
      ["humectant", "skin_conditioning"], "Zinc–pyrrolidone-carboxylate; sebum control + humectant."),
  low("inulin", ["inulin"],
      ["humectant", "film_former", "prebiotic"], "Defined fructan polysaccharide; mild humectant / prebiotic."),
  low("biosaccharide gum-1", ["biosaccharide gum-1"],
      ["film_former", "skin_conditioning"], "Biofermentation-derived defined polysaccharide film former."),
  low("fructose", ["fructose"],
      ["humectant"], "Simple sugar humectant."),
  low("mannose", ["mannose"],
      ["humectant", "skin_conditioning"], "Simple sugar humectant; supports moisturisation."),
  low("hydroxyethyl urea", ["hydroxyethyl urea"],
      ["humectant"], "Modified urea humectant; lower irritation than urea."),
  low("distarch phosphate", ["distarch phosphate"],
      ["thickener", "absorbent"], "Modified starch texturiser / oil absorber."),
  low("zea mays starch / corn starch", ["zea mays starch corn starch"],
      ["absorbent", "thickener"], "Refined corn starch absorbent / thickener (defined polysaccharide)."),

  // ── Polymers · film formers · conditioning polymers ────────────────────────
  low("hdi/trimethylol hexyllactone crosspolymer",
      ["hditrimethylol hexyllactone crosspolymer"],
      ["polymer", "film_former"], "Crosslinked HDI/hexyllactone polymer microspheres (soft-focus)."),
  low("polyacrylate-13", ["polyacrylate-13"],
      ["polymer", "thickener"], "Acrylate copolymer thickener / stabiliser."),
  low("polymethylsilsesquioxane", ["polymethylsilsesquioxane"],
      ["polymer", "soft_focus"], "Silicone resin micro-beads for soft-focus / mattifying."),
  low("acrylates copolymer", ["acrylates copolymer"],
      ["polymer", "film_former"], "Acrylate copolymer film former."),
  low("acrylamide/sodium acryloyldimethyltaurate copolymer",
      ["acrylamidesodium acryloyldimethyltaurate copolymer"],
      ["polymer", "thickener"], "AMPS-acrylamide copolymer thickener / stabiliser."),
  low("glyceryl acrylate/acrylic acid copolymer",
      ["glyceryl acrylateacrylic acid copolymer"],
      ["polymer", "humectant"], "Hygroscopic acrylate humectant film (Hydroviton/Lubrajel-type)."),
  low("sodium acrylates copolymer", ["sodium acrylates copolymer"],
      ["polymer", "thickener"], "Anionic acrylates copolymer thickener."),
  low("microcrystalline cellulose", ["microcrystalline cellulose"],
      ["thickener", "stabilizer"], "Refined cellulose texturiser / stabiliser."),
  low("guar hydroxypropyltrimonium chloride", ["guar hydroxypropyltrimonium chloride"],
      ["conditioner", "polymer"], "Cationic guar conditioning polymer (hair / skin)."),
  low("polyquaternium-7", ["polyquaternium-7"],
      ["conditioner", "polymer"], "Cationic copolymer conditioning polymer; anti-static, smoothing."),
  low("hydroxypropyl guar hydroxypropyltrimonium chloride",
      ["hydroxypropyl guar hydroxypropyltrimonium chloride"],
      ["conditioner", "polymer"], "Modified cationic guar conditioning polymer."),
  low("hydroxypropyl oxidized starch pg-trimonium chloride",
      ["hydroxypropyl oxidized starch pg-trimonium chloride"],
      ["conditioner", "polymer"], "Cationic starch-based conditioning polymer."),
  low("stearamidopropyl dimethylamine", ["stearamidopropyl dimethylamine"],
      ["conditioner"], "pH-dependent cationic amido-amine hair conditioner."),
  low("isopropyl titanium triisostearate", ["isopropyl titanium triisostearate"],
      ["pigment_dispersant"], "Surface-treatment / dispersant for TiO2 in colour cosmetics."),

  // ── Buffers · pH adjusters · chelators · electrolytes ──────────────────────
  low("magnesium nitrate", ["magnesium nitrate"],
      ["buffer", "electrolyte"], "Mineral salt; carrier for clay-modified rheology systems."),
  low("potassium hydroxide", ["potassium hydroxide"],
      ["ph_adjuster"], "Strong base; spent to neutral pH in formulation."),
  low("zinc sulfate", ["zinc sulfate"],
      ["astringent", "skin_conditioning"], "Zinc mineral salt; mild astringent."),
  low("potassium phosphate", ["potassium phosphate"],
      ["buffer"], "Monopotassium phosphate buffering salt."),
  low("dipotassium phosphate", ["dipotassium phosphate"],
      ["buffer"], "Dipotassium phosphate buffering salt."),
  low("disodium phosphate", ["disodium phosphate"],
      ["buffer"], "Disodium hydrogen phosphate buffering salt."),
  low("tartaric acid", ["tartaric acid"],
      ["ph_adjuster", "chelator"], "Mild AHA / chelator / pH adjuster."),
  low("malic acid", ["malic acid"],
      ["ph_adjuster"], "Mild AHA / pH adjuster."),
  low("gluconolactone", ["gluconolactone"],
      ["chelator", "ph_adjuster"], "PHA (polyhydroxy acid); mild exfoliant / chelator."),
  low("triethyl citrate", ["triethyl citrate"],
      ["solvent", "plasticizer"], "Citrate triester solvent / film plasticiser."),

  // ── Amino acids ────────────────────────────────────────────────────────────
  low("lysine", ["lysine"],
      ["amino_acid", "skin_conditioning"], "Essential amino acid; conditioning / NMF component."),
  low("glutamic acid", ["glutamic acid"],
      ["amino_acid", "ph_adjuster"], "Amino acid; pH adjuster / NMF component."),
  low("serine", ["serine"],
      ["amino_acid", "humectant"], "Amino acid humectant / NMF component."),
  low("alanine", ["alanine"],
      ["amino_acid", "humectant"], "Amino acid humectant / NMF component."),
  low("proline", ["proline"],
      ["amino_acid", "humectant"], "Amino acid humectant / NMF component."),
  low("threonine", ["threonine"],
      ["amino_acid", "humectant"], "Amino acid humectant / NMF component."),
  low("aspartic acid", ["aspartic acid"],
      ["amino_acid", "humectant"], "Amino acid humectant / NMF component."),
  low("isoleucine", ["isoleucine"],
      ["amino_acid", "skin_conditioning"], "Branched-chain amino acid skin conditioner."),
  low("valine", ["valine"],
      ["amino_acid", "skin_conditioning"], "Branched-chain amino acid skin conditioner."),

  // ── Peptides (synthesised signal peptides — caution policy) ────────────────
  peptide("palmitoyl tripeptide-1", ["palmitoyl tripeptide-1"],
      "Synthesised lipopeptide signal molecule; collagen-related claim."),
  peptide("palmitoyl tetrapeptide-7", ["palmitoyl tetrapeptide-7"],
      "Synthesised lipopeptide signal molecule; soothing / firming claim."),
  peptide("acetyl dipeptide-1 cetyl ester", ["acetyl dipeptide-1 cetyl ester"],
      "Synthesised acetylated dipeptide ester; soothing claim."),
  peptide("acetyl hexapeptide-8", ["acetyl hexapeptide-8"],
      "Synthesised hexapeptide (Argireline-type) signal molecule."),

  // ── Color additives · CI numbers ───────────────────────────────────────────
  low("ci 42090", ["ci 42090"],
      ["colorant"], "FD&C Blue 1 (Brilliant Blue FCF) — water-soluble triarylmethane dye."),
  low("ci 42090 blue 1 lake", ["ci 42090 blue 1 lake"],
      ["colorant"], "Aluminium-lake (insoluble) form of CI 42090 / Blue 1."),
  // CI 19140 has been observed both bare ("ci 19140") and with the Yellow 5
  // common-name suffix ("ci 19140 yellow 5"). Both forms map to the same
  // substance, so the second observed form is registered as an alias.
  low("ci 19140", ["ci 19140", "ci 19140 yellow 5"],
      ["colorant"], "FD&C Yellow 5 (Tartrazine) — water-soluble azo dye."),
  low("ci 19140 yellow 5 lake", ["ci 19140 yellow 5 lake"],
      ["colorant"], "Aluminium-lake (insoluble) form of CI 19140 / Yellow 5."),
  low("caramel", ["caramel"],
      ["colorant"], "Brown food/cosmetic-grade colourant (caramelised carbohydrate)."),

  // ── Vitamins · soothers · misc actives (low-risk) ──────────────────────────
  low("cyanocobalamin", ["cyanocobalamin"],
      ["vitamin", "skin_conditioning"], "Vitamin B12; pink chromophore + conditioning."),
  low("dipotassium glycyrrhizate", ["dipotassium glycyrrhizate"],
      ["soothing", "skin_conditioning"], "Defined dipotassium salt of glycyrrhizic acid; soothing."),
  low("pantolactone", ["pantolactone"],
      ["humectant", "skin_conditioning"], "D-pantolactone; precursor / conditioning humectant."),

  // ── Solvents · propellants ─────────────────────────────────────────────────
  low("isobutane", ["isobutane"],
      ["propellant"], "Aerosol propellant gas (n-butane isomer)."),
  low("ethoxydiglycol", ["ethoxydiglycol"],
      ["solvent"], "Diethylene-glycol monoethyl ether; high-power cosmetic solvent."),

  // ── Sclerotium / sclerotium-type defined polysaccharides ───────────────────
  low("sclerotium gum", ["sclerotium gum"],
      ["thickener", "film_former"], "Defined polysaccharide gum (Sclerotium rolfsii biofermentation)."),
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertTop100UnknownCleanup");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` MODE    : ${DRY_RUN ? "DRY-RUN  (no writes)" : "LIVE  (writes enabled)"}`);
  console.log(` CANDIDATES: ${REVIEWED_CANDIDATES.length}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  const sb = createLeanSupabase();

  // ── Sanity: surface duplicates inside the batch itself ────────────────────
  {
    const seenC = new Set<string>();
    const seenA = new Set<string>();
    for (const c of REVIEWED_CANDIDATES) {
      const k = normalizeForLookup(c.suggested_canonical_name);
      if (seenC.has(k)) {
        console.warn(`  WARN: duplicate canonical inside batch → "${c.suggested_canonical_name}"`);
      }
      seenC.add(k);
      for (const a of c.aliases) {
        const ka = normalizeForLookup(a);
        if (!ka) continue;
        if (seenA.has(ka)) {
          console.warn(`  WARN: duplicate alias inside batch → "${a}" (norm "${ka}")`);
        }
        seenA.add(ka);
      }
    }
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
