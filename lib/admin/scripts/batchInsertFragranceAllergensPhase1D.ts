/**
 * batchInsertFragranceAllergensPhase1D.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1D — Dalga B fragrance allergen / perfume-compound additions.
 *
 * SCOPE — Phase 1D adds three high-frequency fragrance / perfume compounds
 * surfaced by the post-V6 unknown report (`/.local/reports/post-V6.log`):
 *
 *   1. Butylphenyl Methylpropional   (Lilial / p-BMHCA)        — 8 prods
 *   2. Linalyl Acetate                (lavender / bergamot ester) — 9 prods
 *   3. Tetramethyl Acetyloctahydronaphthalenes (OTNE)            — 14 prods
 *
 * RELATIONSHIP TO PHASE 1C:
 *   Phase 1C deliberately deferred Lilial (Butylphenyl Methylpropional) under
 *   "needs separate banned classification handled elsewhere" because it was
 *   banned in the EU as of March 2022. However the Turkish-market product
 *   catalog still contains 8 products that list it on the INCI line, so it
 *   must be classifiable for those products' detail screens. Phase 1D treats
 *   it as an EU-26-style fragrance allergen with the standard Phase 1C policy
 *   (risk=medium, preg=caution, bf=caution, allergy=moderate) plus a
 *   description note flagging the EU 2022 ban context. No new schema fields
 *   are introduced.
 *
 *   Linalyl Acetate and Tetramethyl Acetyloctahydronaphthalenes (OTNE) are
 *   NOT on the original EU-26 list but are recognised perfume-compound
 *   sensitisers in the SCCS post-2020 expanded fragrance-allergen panel and
 *   in Regulation (EU) 2023/1545 amending Annex III. Conservative
 *   classification matches Phase 1C policy.
 *
 * EXPLICITLY EXCLUDED FROM PHASE 1D:
 *   • CI colorants — out of scope by Dalga B brief.
 *   • Plant / botanical extracts — out of scope by Dalga B brief.
 *   • Parser artifacts (raw INCI fragments such as truncated tokens) — must
 *     be handled by a parser-cleanup pass, not by inventing canonicals.
 *   • Banned-substance taxonomy refactor — Lilial is included as an allergen
 *     for catalog-coverage purposes only; a future "banned" classification
 *     should be a separate phase that does NOT alter ingredients_master
 *     schema.
 *   • Other EU-26 allergens — already handled in Phase 1C.
 *   • Synonyms with ambiguous chemical identity (e.g. "Iso E Super" is a
 *     trade name for an IFF-branded mixture related to but not identical to
 *     OTNE; including it as an alias would risk false equivalences). Only
 *     unambiguous chemistry synonyms are aliased.
 *
 * SAFETY GUARANTEES (identical to Phase 1A / 1B / 1C):
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
 * RISK PROFILE (matches Phase 1C policy verbatim):
 *     risk_level         = "medium"
 *     pregnancy_flag     = "caution"
 *     breastfeeding_flag = "caution"
 *     allergy_flag       = "moderate"
 *     concern_flags      = ["allergen", "eu_fragrance_allergen"]
 *     function_tags      = ["fragrance"]
 *
 * ALIAS MAPPING LOGIC (mirrors Phase 1C):
 *   `normalizeForLookup` lower-cases, trims, and strips characters outside
 *   [a-z0-9 -]. Therefore:
 *     - "BUTYLPHENYL METHYLPROPIONAL"   → "butylphenyl methylpropional"
 *     - "Butylphenyl Methylpropional"   → "butylphenyl methylpropional"
 *     - "Tetramethyl Acetyloctahydronaphthalenes."  (trailing period from
 *        the production raw_name) → "tetramethyl acetyloctahydronaphthalenes"
 *   These casing / trailing-punctuation variants are therefore matched by
 *   the canonical alias automatically and do NOT need separate alias rows.
 *   The `aliases[]` arrays below intentionally include the lower-case
 *   canonical form and only chemistry synonyms that actually differ after
 *   normalisation. The Dalga B brief listed casing variants explicitly; they
 *   are still listed here as aliases for self-documentation, but the
 *   in-script dedup (`aliasPlan.some((x) => x.norm === an)`) collapses them
 *   so no duplicate rows are written.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertFragranceAllergensPhase1D.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertFragranceAllergensPhase1D.ts
 *
 * Sources used: EU Cosmetics Regulation 1223/2009 Annex III, Regulation
 * (EU) 2023/1545 (expanded fragrance-allergen list, in force 2026 for
 * leave-on / 2028 for rinse-off), SCCS opinions on fragrance allergens,
 * INCI database, post-V6 unknown report.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Phase 1D — 3 Dalga B fragrance / perfume compounds ───────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Butylphenyl Methylpropional (Lilial / p-BMHCA) ─────────────────────
  // Lily-of-the-valley type aldehyde; widely used as a synthetic floral
  // fragrance until classified CMR-2 by EU SCCS and BANNED in cosmetics
  // marketed in the EU as of 1 March 2022 (Reg. (EU) 2021/1902). The
  // Turkish-market catalog still contains 8 products that list it on the
  // INCI line, so we add it as a fragrance allergen for catalog coverage
  // with the EU ban context noted in the description. NOT a new schema
  // field — description is already supported by Phase 1C / V6 scripts.
  //
  // The casing variants ("BUTYLPHENYL METHYLPROPIONAL",
  // "Butylphenyl Methylpropional") all normalise to the canonical form via
  // normalizeForLookup; they are listed for self-documentation only.
  {
    suggested_canonical_name: "butylphenyl methylpropional",
    aliases: [
      "butylphenyl methylpropional",
      "BUTYLPHENYL METHYLPROPIONAL",
      "Butylphenyl Methylpropional",
      "lilial",
      "p-bmhca",
      "2-(4-tert-butylbenzyl)propionaldehyde",
    ],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:
      "Fragrance allergen (Lilial / p-BMHCA); lily-of-the-valley aldehyde. " +
      "Banned in EU cosmetics since 1 March 2022 (Reg. (EU) 2021/1902, CMR-2). " +
      "Still surfaces in Turkish-market INCI lists; classified here for catalog coverage.",
  },

  // ── 2. Linalyl Acetate ─────────────────────────────────────────────────────
  // Bergamot / lavender ester (acetate of linalool). NOT on the original
  // EU-26 list, but the SCCS post-2020 expanded fragrance-allergen panel
  // and Regulation (EU) 2023/1545 added it as a declarable allergen above
  // the same 0.001 % / 0.01 % thresholds. Oxidises in air similarly to
  // linalool to allergenic hydroperoxides — the oxidised form is the
  // actual sensitiser. Classified with the Phase 1C policy.
  {
    suggested_canonical_name: "linalyl acetate",
    aliases: [
      "linalyl acetate",
      "LINALYL ACETATE",
      "Linalyl Acetate",
    ],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:
      "Fragrance allergen (linalool acetate ester); bergamot / lavender component. " +
      "Added to EU declarable-allergen list by Reg. (EU) 2023/1545 on the same " +
      "0.001 %/0.01 % thresholds as the original EU-26.",
  },

  // ── 3. Tetramethyl Acetyloctahydronaphthalenes (OTNE) ─────────────────────
  // Synthetic woody-amber musk (Octahydro Tetramethyl Naphthalenyl Ethanone,
  // commonly abbreviated "OTNE"). Listed in Reg. (EU) 2023/1545 as a
  // declarable fragrance allergen. The production raw_name shows up with a
  // trailing period ("Tetramethyl Acetyloctahydronaphthalenes."), which
  // normalizeForLookup strips automatically — no extra alias row needed.
  // The trade name "Iso E Super" (IFF) refers to a related but NOT
  // identical mixture and is INTENTIONALLY NOT aliased to avoid false
  // equivalences across catalogs.
  {
    suggested_canonical_name: "tetramethyl acetyloctahydronaphthalenes",
    aliases: [
      "tetramethyl acetyloctahydronaphthalenes",
      "TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES",
      "Tetramethyl Acetyloctahydronaphthalenes",
      "Tetramethyl Acetyloctahydronaphthalenes.",
      "otne",
    ],
    risk_level:         "medium",
    function_tags:      ["fragrance"],
    concern_flags:      ["allergen", "eu_fragrance_allergen"],
    pregnancy_flag:     "caution",
    breastfeeding_flag: "caution",
    allergy_flag:       "moderate",
    description:
      "Fragrance allergen (OTNE; Octahydro Tetramethyl Naphthalenyl Ethanone); " +
      "synthetic woody-amber musk. Added to EU declarable-allergen list by " +
      "Reg. (EU) 2023/1545.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertFragranceAllergensPhase1D");
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
