/**
 * batchInsertBotanicalExtractsPhase1A.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1A — Dalga D botanical extracts / plant oils / algae / gums / clays.
 *
 * SCOPE — Phase 1A (Dalga D) adds sixteen high-frequency botanical / plant /
 * mineral-absorbent canonicals surfaced by the post-V6-phase1A-CI unknown
 * report (`/.local/reports/post-phase1A-CI.log`):
 *
 *   ALGAE / SEAWEED EXTRACTS
 *     1. Chondrus Crispus Extract        (Irish moss; "Chondrus Crispus" alias)
 *     2. Ascophyllum Nodosum Extract     (knotted wrack)
 *     3. Asparagopsis Armata Extract     (red marine algae)
 *
 *   FRUIT / LEAF / ROOT EXTRACTS
 *     4. Silybum Marianum Fruit Extract  (milk thistle FRUIT — distinct from
 *                                         the existing milk thistle SEED
 *                                         canonical inserted by
 *                                         batchInsertUnknownCandidates.ts)
 *     5. Vaccinium Myrtillus Fruit Extract  (bilberry)
 *     6. Beta Vulgaris Root Extract         (beetroot)
 *     7. Andrographis Paniculata Leaf Extract
 *     8. Urtica Urens Leaf Extract          (small-nettle leaf — distinct
 *                                            from the V6 urtica dioica root
 *                                            canonical)
 *
 *   FLOWER WATER / FLOWER OIL
 *     9. Rosa Damascena Flower Water     (low-risk botanical water)
 *    10. Rosa Damascena Flower Oil       (essential oil — Tier C profile)
 *
 *   GUM
 *    11. Acacia Senegal Gum              (gum arabic; film-former / thickener)
 *
 *   PLANT OILS
 *    12. Ricinus Communis Seed Oil       (castor oil)
 *    13. Butyrospermum Parkii Shea Oil   (shea oil — distinct from the
 *                                         already-supported Butyrospermum
 *                                         Parkii BUTTER form)
 *
 *   ANIMAL-DERIVED HUMECTANT
 *    14. Mel                             (honey; valid INCI / CosIng entry)
 *
 *   MINERAL ABSORBENTS
 *    15. Charcoal Powder
 *    16. Bentonite
 *
 * RELATIONSHIP TO V6 / PRIOR BATCHES — CANONICALS REUSED, NOT RE-INSERTED:
 *   The Dalga D brief listed the following 10 canonicals that ALREADY exist
 *   in ingredients_master from earlier batches; they are intentionally
 *   EXCLUDED from this script's REVIEWED_CANDIDATES list because their alias
 *   coverage is already complete and re-listing them only generates noise:
 *     • argania spinosa kernel oil       (V6 line 174  — has "argan oil",
 *                                         "argan kernel oil")
 *     • persea gratissima oil            (V6 line 192  — has "avocado oil",
 *                                         "persea gratissima oil*",
 *                                         "persea americana oil")
 *     • achillea millefolium extract     (V6 line 212  — has "yarrow extract")
 *     • cocos nucifera oil               (V4 + V6 line 233 — has slash forms,
 *                                         "coconut oil",
 *                                         "cocos nucifera (coconut) oil")
 *     • equisetum arvense leaf extract   (V6 line 254  — has "horsetail
 *                                         extract")
 *     • ceratonia siliqua fruit extract  (V6 line 272  — has "carob fruit
 *                                         extract")
 *     • glycine soja oil                 (V6 line 294  — has "soybean oil",
 *                                         all slash variants, "glycine max")
 *     • urtica dioica root extract       (V6 line 403  — has "nettle root
 *                                         extract", "stinging nettle ...")
 *     • mentha piperita oil              (V6 line 473  — Tier C essential-
 *                                         oil profile)
 *     • vitis vinifera seed extract      (V6 line 589  — has "grape seed
 *                                         extract")
 *
 * EXPLICITLY EXCLUDED FROM PHASE 1A (Dalga D):
 *   • CI colorants — handled by batchInsertCIColorantsPhase1A.
 *   • Fragrance allergens — handled by Phase 1C / 1D.
 *   • Unrelated actives (Alpha-Arbutin, Piroctone Olamine, Aluminum
 *     Chlorohydrate, Chlorhexidine Digluconate) — different phase.
 *   • Parser artifacts — these tokens are PRODUCTION GARBAGE produced by an
 *     incomplete INCI splitter and MUST NOT be promoted to canonical
 *     ingredients:
 *         "Water (Aqua"                                  (truncated paren)
 *         "Aqua (Water"                                  (truncated paren)
 *         "BIOCOMPLEX B11 (URTICA URENS LEAF EXTRACT"    (10 prods — partial)
 *         "EQUISETUM ARVENSE LEAF EXTRACT)"              (closing-paren only)
 *     Real cleanup is a parser pass, not an ingredient-library row.
 *   • "Carrageenan" as an alias of chondrus crispus extract — carrageenan
 *     is a SEPARATE downstream polysaccharide INCI entity; aliasing it to
 *     the source-organism extract risks false equivalences in scoring. Add
 *     it as its own canonical in a future phase if needed.
 *   • "Iso E Super" / trade names — not canonical INCI.
 *
 * MEL (HONEY) — INCLUDED:
 *   "Mel" IS the canonical INCI / CosIng monograph name for honey (CAS
 *   8001-82-9). It appears in 9 products in the post-phase1A-CI report and
 *   is unambiguously safe for topical cosmetic use. Classified as a low-
 *   risk humectant / skin-conditioner. Bee-pollen / propolis allergens are
 *   tracked separately and are NOT this entity.
 *
 * SAFETY GUARANTEES (identical to Phase 1C / 1D / V6 / CI Phase 1A):
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually write)
 *   - Idempotent: re-running is safe (uses applyUnknownResolutionCandidates,
 *     which checks for existing rows before INSERT)
 *   - Does NOT touch the live score engine, V4 registry, resolver, or UI
 *   - Does NOT modify any existing row
 *   - Does NOT delete or update any product
 *   - Does NOT write to ingredient_unknown_queue
 *   - Does NOT alter enums / types / schema
 *   - Does NOT create new tables
 *
 * RISK PROFILE TIERS (all values use existing function_tags / concern_flags
 * vocabularies confirmed present in prior scripts):
 *
 *   Tier A — Mineral absorbents (charcoal powder, bentonite):
 *     risk=low, preg=safe, bf=safe, allergy=low
 *     fn_tags=["absorbent", ...]   concerns=[]
 *
 *   Tier B — Plant oils / fixed oils (ricinus, butyrospermum shea oil):
 *     risk=low, preg=safe, bf=safe, allergy=low
 *     fn_tags=["emollient","botanical_oil","skin_conditioning"]
 *     concerns=[]
 *
 *   Tier C — Essential oil (rosa damascena flower OIL):
 *     risk=medium, preg=caution, bf=caution, allergy=moderate
 *     fn_tags=["fragrance","essential_oil"]   concerns=["essential_oil"]
 *     (mirrors V6 mentha piperita oil profile)
 *
 *   Tier D — Botanical waters / flower waters (rosa damascena flower water):
 *     risk=low, preg=safe, bf=safe, allergy=low
 *     fn_tags=["botanical_water","soothing","skin_conditioning"]
 *     concerns=[]
 *
 *   Tier E — Botanical extracts (algae + fruit/leaf/root extracts):
 *     risk=low, preg=unknown, bf=unknown, allergy=low
 *     fn_tags=["botanical_extract","skin_conditioning"]  (per item)
 *     concerns=[]
 *
 *   Tier F — Honey (mel):
 *     risk=low, preg=safe, bf=safe, allergy=low
 *     fn_tags=["humectant","skin_conditioning"]   concerns=[]
 *
 *   Tier G — Plant gum (acacia senegal gum):
 *     risk=low, preg=safe, bf=safe, allergy=low
 *     fn_tags=["film_former","thickener","botanical_extract"]
 *     concerns=[]
 *
 * ALIAS MAPPING LOGIC:
 *   `normalizeForLookup` lower-cases, trims, and strips characters outside
 *   [a-z0-9 -]. Therefore casing variants (e.g. "CHONDRUS CRISPUS EXTRACT")
 *   collapse to the same normalised key as the lowercase canonical. They
 *   are listed for self-documentation per the Dalga D brief but the
 *   in-script aliasPlan dedup collapses them to a single row.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertBotanicalExtractsPhase1A.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertBotanicalExtractsPhase1A.ts
 *
 * Sources used: CosIng (EU), INCI Dictionary (PCPC), EU Cosmetics
 * Regulation 1223/2009, post-phase1A-CI unknown report.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Phase 1A (Dalga D) — 16 botanical / plant / mineral canonicals ───────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Chondrus Crispus Extract — Tier E (algae) ──────────────────────────
  // Irish moss red-algae extract. The unknown report shows BOTH "Chondrus
  // Crispus" (36 seen) and "CHONDRUS CRISPUS EXTRACT" (7 prods); the bare
  // genus+species form is aliased to the same canonical because the
  // cosmetic INCI usage is the extract.
  {
    suggested_canonical_name: "chondrus crispus extract",
    aliases: [
      "chondrus crispus extract",
      "CHONDRUS CRISPUS EXTRACT",
      "chondrus crispus",
      "Chondrus Crispus",
      "irish moss extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Irish moss (Chondrus crispus) red-algae extract; mild humectant / " +
      "skin-conditioning agent. Distinct from the downstream polysaccharide " +
      "carrageenan, which is a separate INCI entity.",
  },

  // ── 2. Ascophyllum Nodosum Extract — Tier E (algae) ───────────────────────
  // Knotted wrack brown-algae extract.
  {
    suggested_canonical_name: "ascophyllum nodosum extract",
    aliases: [
      "ascophyllum nodosum extract",
      "ASCOPHYLLUM NODOSUM EXTRACT",
      "knotted wrack extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Knotted wrack (Ascophyllum nodosum) brown-algae extract; mineral- " +
      "and amino-acid-rich skin-conditioning agent.",
  },

  // ── 3. Asparagopsis Armata Extract — Tier E (algae) ───────────────────────
  // Harpoon-weed red-algae extract.
  {
    suggested_canonical_name: "asparagopsis armata extract",
    aliases: [
      "asparagopsis armata extract",
      "ASPARAGOPSIS ARMATA EXTRACT",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Harpoon-weed (Asparagopsis armata) red-algae extract; halogenated " +
      "metabolite-rich skin-conditioning agent.",
  },

  // ── 4. Silybum Marianum Fruit Extract — Tier E (botanical) ────────────────
  // Milk thistle FRUIT extract. NOTE: a separate "silybum marianum SEED
  // extract" canonical already exists from batchInsertUnknownCandidates.ts;
  // the FRUIT and SEED forms are kept distinct because INCI / CosIng
  // monographs treat them as separate ingredients.
  {
    suggested_canonical_name: "silybum marianum fruit extract",
    aliases: [
      "silybum marianum fruit extract",
      "SILYBUM MARIANUM FRUIT EXTRACT",
      "milk thistle fruit extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Milk thistle (Silybum marianum) fruit extract; silymarin-bearing " +
      "antioxidant-rich extract. Distinct from the seed-extract canonical.",
  },

  // ── 5. Vaccinium Myrtillus Fruit Extract — Tier E (botanical) ─────────────
  // Bilberry fruit extract. Anthocyanin-rich antioxidant.
  {
    suggested_canonical_name: "vaccinium myrtillus fruit extract",
    aliases: [
      "vaccinium myrtillus fruit extract",
      "VACCINIUM MYRTILLUS FRUIT EXTRACT",
      "bilberry fruit extract",
      "bilberry extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "antioxidant"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Bilberry (Vaccinium myrtillus) fruit extract; anthocyanin-rich " +
      "antioxidant.",
  },

  // ── 6. Beta Vulgaris Root Extract — Tier E (botanical) ────────────────────
  // Beetroot extract. Pigment + skin-conditioning agent.
  {
    suggested_canonical_name: "beta vulgaris root extract",
    aliases: [
      "beta vulgaris root extract",
      "BETA VULGARIS ROOT EXTRACT",
      "beet root extract",
      "beetroot extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Beetroot (Beta vulgaris) root extract; betalain-bearing skin- " +
      "conditioning agent.",
  },

  // ── 7. Andrographis Paniculata Leaf Extract — Tier E (botanical) ──────────
  // "King of bitters" leaf extract.
  {
    suggested_canonical_name: "andrographis paniculata leaf extract",
    aliases: [
      "andrographis paniculata leaf extract",
      "ANDROGRAPHIS PANICULATA LEAF EXTRACT",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "soothing"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Andrographis paniculata leaf extract (king of bitters); andrographolide-" +
      "bearing soothing botanical extract.",
  },

  // ── 8. Urtica Urens Leaf Extract — Tier E (botanical) ─────────────────────
  // Small / dwarf nettle (Urtica URENS, distinct from Urtica DIOICA).
  // Note: V6 already has urtica DIOICA root extract; this is a different
  // species AND a different organ part (leaf). Kept as a separate canonical.
  {
    suggested_canonical_name: "urtica urens leaf extract",
    aliases: [
      "urtica urens leaf extract",
      "URTICA URENS LEAF EXTRACT",
      "small nettle leaf extract",
      "dwarf nettle leaf extract",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_extract", "soothing"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Small / dwarf nettle (Urtica urens) leaf extract; soothing botanical. " +
      "Distinct from Urtica dioica root extract (V6).",
  },

  // ── 9. Rosa Damascena Flower Water — Tier D (botanical water) ─────────────
  // Damask rose hydrosol; aqueous distillation byproduct of rose oil
  // production. Low risk, safe in pregnancy / breastfeeding.
  {
    suggested_canonical_name: "rosa damascena flower water",
    aliases: [
      "rosa damascena flower water",
      "ROSA DAMASCENA FLOWER WATER",
      "rose water",
      "rose flower water",
      "rosa damascena water",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_water", "soothing", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Damask rose (Rosa damascena) hydrosol / flower water; aqueous " +
      "byproduct of rose oil distillation. Mild soothing skin-conditioning " +
      "agent.",
  },

  // ── 10. Rosa Damascena Flower Oil — Tier C (essential oil) ────────────────
  // Damask rose absolute / essential oil. Mirrors V6 mentha piperita oil
  // Tier C profile because essential oils contain reactive monoterpenes
  // (citronellol, geraniol, eugenol) and are conservative-flagged.
  {
    suggested_canonical_name: "rosa damascena flower oil",
    aliases: [
      "rosa damascena flower oil",
      "ROSA DAMASCENA FLOWER OIL",
      "rose oil",
      "rose flower oil",
      "rosa damascena oil",
      "rose absolute",
    ],
    risk_level:         "medium",
    function_tags:      ["fragrance", "essential_oil"],
    concern_flags:      ["essential_oil"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:
      "Damask rose (Rosa damascena) essential oil; concentrated monoterpene " +
      "fraction (citronellol, geraniol, etc.). Conservative essential-oil " +
      "profile to flag fragrance-allergen sensitivity.",
  },

  // ── 11. Acacia Senegal Gum — Tier G (plant gum) ───────────────────────────
  // Gum arabic. Film-former / thickener / suspension aid.
  {
    suggested_canonical_name: "acacia senegal gum",
    aliases: [
      "acacia senegal gum",
      "ACACIA SENEGAL GUM",
      "acacia gum",
      "gum arabic",
      "gum acacia",
    ],
    risk_level:         "low",
    function_tags:      ["film_former", "thickener", "botanical_extract"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Gum arabic (Acacia senegal); polysaccharide film-former / thickener / " +
      "suspension aid.",
  },

  // ── 12. Ricinus Communis Seed Oil — Tier B (plant oil) ────────────────────
  // Castor oil. Emollient with characteristic high-viscosity feel.
  {
    suggested_canonical_name: "ricinus communis seed oil",
    aliases: [
      "ricinus communis seed oil",
      "RICINUS COMMUNIS SEED OIL",
      "ricinus communis (castor) seed oil",
      "castor oil",
      "castor seed oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "botanical_oil", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Castor (Ricinus communis) seed oil; high-viscosity ricinoleic-acid- " +
      "rich emollient.",
  },

  // ── 13. Butyrospermum Parkii Shea Oil — Tier B (plant oil) ────────────────
  // Shea OIL — the liquid fraction of shea butter (distinct from the more
  // commonly used Butyrospermum Parkii BUTTER form).
  {
    suggested_canonical_name: "butyrospermum parkii shea oil",
    aliases: [
      "butyrospermum parkii shea oil",
      "BUTYROSPERMUM PARKII SHEA OIL",
      "butyrospermum parkii (shea) oil",
      "BUTYROSPERMUM PARKII (SHEA) OIL",
      "shea oil",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "botanical_oil", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Shea oil — the liquid fraction of Butyrospermum parkii (shea) seed " +
      "butter. Distinct from the (already-supported) butter form.",
  },

  // ── 14. Mel — Tier F (honey humectant) ────────────────────────────────────
  // INCI / CosIng canonical for honey. CAS 8001-82-9. Mild humectant.
  // Bee-pollen / propolis allergens are SEPARATE entities, not this row.
  {
    suggested_canonical_name: "mel",
    aliases: [
      "mel",
      "Mel",
      "MEL",
      "honey",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Honey (INCI: Mel; CAS 8001-82-9); humectant / skin-conditioning " +
      "agent. Distinct from propolis and bee-pollen (separate INCI entities).",
  },

  // ── 15. Charcoal Powder — Tier A (mineral absorbent) ──────────────────────
  // Activated charcoal absorbent (cleansing masks).
  {
    suggested_canonical_name: "charcoal powder",
    aliases: [
      "charcoal powder",
      "CHARCOAL POWDER",
      "Charcoal Powder",
      "activated charcoal",
      "charcoal",
    ],
    risk_level:         "low",
    function_tags:      ["absorbent"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Activated charcoal powder; high-surface-area absorbent commonly " +
      "used in cleansing masks and detox formulations.",
  },

  // ── 16. Bentonite — Tier A (mineral clay) ─────────────────────────────────
  // Aluminium phyllosilicate clay; absorbent / mineral filler.
  {
    suggested_canonical_name: "bentonite",
    aliases: [
      "bentonite",
      "BENTONITE",
      "Bentonite",
      "bentonite clay",
    ],
    risk_level:         "low",
    function_tags:      ["absorbent", "mineral_filler"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Bentonite — aluminium phyllosilicate clay; absorbent / mineral " +
      "filler used in masks and oil-control formulations.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertBotanicalExtractsPhase1A");
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
