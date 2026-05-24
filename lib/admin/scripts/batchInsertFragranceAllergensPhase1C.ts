/**
 * batchInsertFragranceAllergensPhase1C.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1C — Pure-compound EU-26 fragrance allergens.
 *
 * SCOPE — Phase 1C includes ONLY:
 *   The pure single-compound entries from EU Cosmetics Regulation
 *   1223/2009 Annex III "List of substances which cosmetic products must not
 *   contain except subject to the restrictions laid down" — specifically the
 *   classic "26 fragrance allergens" subset that requires on-label
 *   declaration above 0.001 % (leave-on) / 0.01 % (rinse-off).
 *
 * EXPLICITLY EXCLUDED FROM PHASE 1C:
 *   • Botanical / mixture entries from the same list (deferred to Phase 1E):
 *       - Evernia prunastri (oakmoss) extract
 *       - Evernia furfuracea (treemoss) extract
 *   • Substances banned for use in cosmetics in the EU (no longer found in
 *     compliant formulations, so adding them as plain "allergens" would be
 *     misleading — they need a separate "banned" classification handled
 *     elsewhere):
 *       - Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde (HICC / Lyral),
 *         banned EU 2021
 *       - Butylphenyl Methylpropional (Lilial), banned EU 2022
 *   • Non-Annex-III sensory ingredients that occasionally show up as
 *     "allergens" colloquially but are NOT on the EU-26 list (Menthol,
 *     Phenethyl Alcohol). These can be revisited in a separate phase if
 *     required by the safety policy.
 *
 * SAFETY GUARANTEES (identical to Phase 1A / 1B):
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually write)
 *   - Idempotent: re-running is safe (uses applyUnknownResolutionCandidates,
 *     which checks for existing rows before INSERT)
 *   - Does NOT touch the live score engine, V4 registry, resolver, or UI
 *   - Does NOT modify any existing row
 *   - Does NOT delete or update any product
 *   - Does NOT write to ingredient_unknown_queue (separate cleanup script
 *     `cleanupResolvedUnknownQueuePhase1C.ts` will flip statuses later)
 *
 * RISK PROFILE (mandated by Phase 1C policy):
 *     risk_level         = "medium"
 *     pregnancy_flag     = "caution"
 *     breastfeeding_flag = "caution"   (conservative; matches preg policy)
 *     allergy_flag       = "moderate"  (EU-26 inclusion criterion is
 *                                       documented contact-allergen risk)
 *     concern_flags      = ["allergen", "eu_fragrance_allergen"]
 *
 *   The single deviation from the default profile is Benzyl Alcohol, which is
 *   ALSO commonly used as a preservative — its function_tags reflect both
 *   roles, but its risk profile remains the Phase 1C policy.
 *
 * ALIAS MAPPING LOGIC:
 *   For each candidate we register the canonical INCI form plus:
 *     1. Common chemistry-name synonyms ONLY when they unambiguously map to
 *        the same single chemical entity
 *        (e.g. Cinnamal → "cinnamaldehyde", "cinnamic aldehyde";
 *         Hexyl Cinnamal → "hexyl cinnamaldehyde";
 *         Anise Alcohol → "anisyl alcohol";
 *         Methyl 2-Octynoate → "methyl heptine carbonate")
 *     2. Common stereochemistry / "alpha-" variants where the labelling
 *        convention varies (Limonene → "d-limonene"; Alpha-Isomethyl Ionone →
 *        "isomethyl ionone")
 *     3. Production typo / punctuation variants are NOT explicitly authored
 *        because `normalizeForLookup` strips characters outside [a-z0-9 -],
 *        so e.g. "Citral." (production typo, 26 prods) normalizes to "citral"
 *        and is matched by the canonical alias automatically.
 *     4. Hyphen-stripped forms are NOT explicitly authored because the
 *        runtime resolver runs PATH 1b (alias_stripped) and PATH 2b
 *        (registry_stripped) fallbacks.
 *
 *   Ambiguous synonyms are intentionally skipped (Limonene → "l-limonene"
 *   is rare and might cause false matches in other products; Geraniol →
 *   "trans-3,7-dimethyl-2,6-octadien-1-ol" is too verbose / non-INCI).
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertFragranceAllergensPhase1C.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertFragranceAllergensPhase1C.ts
 *
 * Sources used: EU Cosmetics Regulation 1223/2009 Annex III, CosIng (EU),
 * SCCS opinions on fragrance allergens, INCI database.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Phase 1C — 22 EU-26 pure-compound fragrance allergens ─────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Limonene (Annex III #84 — d-Limonene) ───────────────────────────────
  // Citrus-peel terpene; one of the most prevalent EU-26 allergens. The
  // d-isomer (R-limonene) is the cosmetic INCI form.
  {
    suggested_canonical_name: "limonene",
    aliases: ["limonene", "d-limonene"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen (d-Limonene); citrus-peel terpene.",
  },

  // ── 2. Linalool (Annex III #87) ────────────────────────────────────────────
  // Floral / lavender terpene alcohol. Oxidises in air to allergenic
  // hydroperoxides — the oxidised form is the actual sensitiser.
  {
    suggested_canonical_name: "linalool",
    aliases: ["linalool"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; floral terpene alcohol prone to oxidation.",
  },

  // ── 3. Citral (Annex III #75) ──────────────────────────────────────────────
  // Lemon-grass aldehyde mixture (geranial + neral); strong sensitiser.
  // Production raw_name "Citral." (with trailing period) normalises to
  // "citral" via normalizeForLookup, so no extra alias is needed.
  {
    suggested_canonical_name: "citral",
    aliases: ["citral"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; mixed cis/trans citral aldehydes (lemongrass).",
  },

  // ── 4. Geraniol (Annex III #79) ────────────────────────────────────────────
  // Rose / geranium terpene alcohol; common in essential oils.
  {
    suggested_canonical_name: "geraniol",
    aliases: ["geraniol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; rose-/geranium-type terpene alcohol.",
  },

  // ── 5. Eugenol (Annex III #76) ─────────────────────────────────────────────
  // Clove-bud phenol; one of the stronger EU-26 sensitisers but kept at the
  // policy default ("moderate") for consistency.
  {
    suggested_canonical_name: "eugenol",
    aliases: ["eugenol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; clove-bud phenol.",
  },

  // ── 6. Citronellol (Annex III #77) ─────────────────────────────────────────
  // Rose / geranium acyclic terpene alcohol.
  {
    suggested_canonical_name: "citronellol",
    aliases: ["citronellol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; rose-type acyclic terpene alcohol.",
  },

  // ── 7. Coumarin (Annex III #78) ────────────────────────────────────────────
  // Sweet-hay tonka-bean lactone.
  {
    suggested_canonical_name: "coumarin",
    aliases: ["coumarin"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; sweet-hay-type lactone (tonka).",
  },

  // ── 8. Farnesol (Annex III #88) ────────────────────────────────────────────
  // Lily-of-the-valley sesquiterpene alcohol.
  {
    suggested_canonical_name: "farnesol",
    aliases: ["farnesol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; lily-of-the-valley sesquiterpene alcohol.",
  },

  // ── 9. Cinnamal (Annex III #74) ────────────────────────────────────────────
  // Cinnamon aldehyde; a strong sensitiser. Common synonyms include
  // "cinnamaldehyde" (chemistry literature) and "cinnamic aldehyde".
  {
    suggested_canonical_name: "cinnamal",
    aliases: ["cinnamal", "cinnamaldehyde", "cinnamic aldehyde"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; cinnamon-type aldehyde (Cinnamaldehyde).",
  },

  // ── 10. Cinnamyl Alcohol (Annex III #73) ───────────────────────────────────
  // Cinnamon-type alcohol (often co-occurs with Cinnamal).
  {
    suggested_canonical_name: "cinnamyl alcohol",
    aliases: ["cinnamyl alcohol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; cinnamon-type alcohol.",
  },

  // ── 11. Isoeugenol (Annex III #82) ─────────────────────────────────────────
  // Carnation / clove allyl phenol; a strong sensitiser.
  {
    suggested_canonical_name: "isoeugenol",
    aliases: ["isoeugenol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; carnation/clove allyl phenol.",
  },

  // ── 12. Hexyl Cinnamal (Annex III #80) ─────────────────────────────────────
  // Jasmine-type higher alkyl cinnamic aldehyde.
  {
    suggested_canonical_name: "hexyl cinnamal",
    aliases: ["hexyl cinnamal", "hexyl cinnamaldehyde"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; jasmine-type cinnamic aldehyde.",
  },

  // ── 13. Amyl Cinnamal (Annex III #67) ──────────────────────────────────────
  // Amyl-substituted cinnamic aldehyde.
  {
    suggested_canonical_name: "amyl cinnamal",
    aliases: ["amyl cinnamal", "amyl cinnamaldehyde"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; amyl-cinnamic aldehyde.",
  },

  // ── 14. Amylcinnamyl Alcohol (Annex III #68) ───────────────────────────────
  // Amyl-substituted cinnamic alcohol.
  {
    suggested_canonical_name: "amylcinnamyl alcohol",
    aliases: ["amylcinnamyl alcohol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; amyl-cinnamic alcohol.",
  },

  // ── 15. Benzyl Alcohol (Annex III #69) ─────────────────────────────────────
  // DUAL FUNCTION: EU-26 fragrance allergen AND a widely used preservative
  // (effective at <1 %). function_tags reflect both roles; risk profile
  // remains the Phase 1C policy.
  {
    suggested_canonical_name: "benzyl alcohol",
    aliases: ["benzyl alcohol"],
    risk_level:         "medium",
    function_tags:      ["fragrance", "preservative"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; also used as a broad-spectrum preservative.",
  },

  // ── 16. Benzyl Salicylate (Annex III #72) ──────────────────────────────────
  // Floral fixative + UV-A absorber benefit. Top of post-Phase-1B by-products
  // ranking (49 prods).
  {
    suggested_canonical_name: "benzyl salicylate",
    aliases: ["benzyl salicylate"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; floral fixative ester.",
  },

  // ── 17. Benzyl Benzoate (Annex III #70) ────────────────────────────────────
  // Heavy floral / balsamic fragrance and solvent for resinous fixatives.
  {
    suggested_canonical_name: "benzyl benzoate",
    aliases: ["benzyl benzoate"],
    risk_level:         "medium",
    function_tags:      ["fragrance", "solvent"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; balsamic ester / fragrance solvent.",
  },

  // ── 18. Benzyl Cinnamate (Annex III #71) ───────────────────────────────────
  // Balsam-of-Peru-type ester; strong sensitiser.
  {
    suggested_canonical_name: "benzyl cinnamate",
    aliases: ["benzyl cinnamate"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; balsam-of-Peru-type ester.",
  },

  // ── 19. Hydroxycitronellal (Annex III #81) ─────────────────────────────────
  // Lily-of-the-valley type aldehyde.
  {
    suggested_canonical_name: "hydroxycitronellal",
    aliases: ["hydroxycitronellal"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; lily-of-the-valley aldehyde.",
  },

  // ── 20. Anise Alcohol (Annex III #66) ──────────────────────────────────────
  // Anise / liquorice ether-alcohol. Synonym "anisyl alcohol" is common in
  // the chemistry literature.
  {
    suggested_canonical_name: "anise alcohol",
    aliases: ["anise alcohol", "anisyl alcohol"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; anise-type ether alcohol.",
  },

  // ── 21. Methyl 2-Octynoate (Annex III #86) ─────────────────────────────────
  // Violet-leaf nitrile-like alkynic ester. Common synonym in older
  // literature: "methyl heptine carbonate".
  {
    suggested_canonical_name: "methyl 2-octynoate",
    aliases: ["methyl 2-octynoate", "methyl heptine carbonate"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; violet-leaf alkynic ester.",
  },

  // ── 22. Alpha-Isomethyl Ionone (Annex III #65) ─────────────────────────────
  // Iris / orris-root ionone. Often labelled simply as "Isomethyl Ionone";
  // both forms are aliased.
  {
    suggested_canonical_name: "alpha-isomethyl ionone",
    aliases: ["alpha-isomethyl ionone", "isomethyl ionone"],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:        "EU-26 fragrance allergen; iris/orris-root ionone.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertFragranceAllergensPhase1C");
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
