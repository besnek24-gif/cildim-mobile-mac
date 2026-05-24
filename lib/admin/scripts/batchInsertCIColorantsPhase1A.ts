/**
 * batchInsertCIColorantsPhase1A.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1A — Dalga C CI colorants ingredient-library additions.
 *
 * SCOPE — Phase 1A (Dalga C) adds six high-frequency CI (Colour Index)
 * colorants surfaced by the post-V6 / post-Phase1D unknown report
 * (`/.local/reports/post-V6-phase1D.log`):
 *
 *   1. CI 16035  (FD&C Red No. 40 / Allura Red AC — azo dye)         — 9 prods
 *   2. CI 47005  (D&C Yellow No. 10 / Quinoline Yellow)              — 8 prods
 *   3. CI 75470  (Carmine — animal cochineal pigment)                — 8 prods
 *   4. CI 77007  (Ultramarines — sodium aluminium silicate mineral)  — 8 prods
 *   5. CI 15850  (D&C Red No. 7 — barium lake azo)                   — 8 prods
 *   6. CI 15985  (FD&C Yellow No. 6 / Sunset Yellow FCF — azo dye)   — 7 prods
 *
 * RELATIONSHIP TO V6 / PRIOR BATCHES:
 *   batchInsertLibraryGapsV6 explicitly DEFERRED CI colourants ("a separate
 *   later phase") so that the V6 / V5 single-entity ingredient batches stayed
 *   focused on emollients, surfactants, polymers, etc. This Phase 1A picks
 *   up that deferred work for the six highest-frequency CI codes still
 *   surfacing as unknowns.
 *
 *   batchInsertLibraryGapsV1 already contains a precedent for colorant
 *   classification (Red 33 / CI 17200 → function_tags=["colorant"],
 *   risk=medium, allergy=moderate, preg/bf=unknown). This script follows the
 *   same field shape; risk profile is tuned per-pigment (see RISK PROFILE).
 *
 * EXPLICITLY EXCLUDED FROM PHASE 1A (Dalga C):
 *   • Other CI codes not in the Dalga C brief (e.g. CI 77891 TiO2,
 *     CI 77492 yellow iron oxide, CI 77019 mica) — out of scope this wave.
 *   • Fragrance allergens — handled by Phase 1C / 1D.
 *   • Plant / botanical extracts — out of scope by Dalga C brief.
 *   • Parser artifacts — slash-combined forms such as "ci 15850 red 7"
 *     are aliased to the correct CI canonical (so the existing parser-
 *     truncated tokens resolve), but the slash form is NEVER promoted to a
 *     canonical entity. Real parser cleanup belongs in a separate pass.
 *   • Trade names / lakes that are not canonical INCI (e.g. "FD&C Red 40
 *     Aluminum Lake") — only the unambiguous CI / colour-index alias is
 *     included.
 *
 * SAFETY GUARANTEES (identical to Phase 1C / 1D / V6):
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
 * RISK PROFILE (tiered — conservative; matches V1 colorant precedent):
 *
 *   Tier A — Mineral pigment (CI 77007 / Ultramarines):
 *     risk_level=low,    preg=safe,    bf=safe,    allergy=low,
 *     function_tags=["colorant"], concern_flags=["colorant"]
 *
 *   Tier B — Synthetic azo / xanthene dyes
 *           (CI 16035, CI 15850, CI 15985, CI 47005):
 *     risk_level=low,    preg=unknown, bf=unknown, allergy=low,
 *     function_tags=["colorant"], concern_flags=["colorant"]
 *     (Conservative "low / unknown" — these are FDA/EU-permitted cosmetic
 *      colorants with mild contact-allergen potential; preg/bf data are
 *      limited so we mark "unknown" rather than asserting "safe".)
 *
 *   Tier C — Animal-derived allergen (CI 75470 / Carmine):
 *     risk_level=medium, preg=unknown, bf=unknown, allergy=moderate,
 *     function_tags=["colorant"], concern_flags=["colorant", "allergen"]
 *     (Cochineal carmine is a documented contact / immediate-type allergen
 *      with case reports of anaphylaxis in sensitised individuals; we
 *      mirror the V1 Red-33 classification pattern.)
 *
 * ALIAS MAPPING LOGIC:
 *   `normalizeForLookup` lower-cases, trims, and strips characters outside
 *   [a-z0-9 -]. Therefore casing variants ("CI 16035", "ci 16035") all
 *   collapse to the same normalised key and are deduped automatically by
 *   the existing `aliasPlan.some` guard. They are still listed for
 *   self-documentation per the Dalga C brief.
 *
 *   The unknown report contains slash-combined production tokens such as
 *   "CI 15850 / RED 7" → normalised "ci 15850 red 7". To resolve THESE
 *   exact tokens without a parser change, each slash-combined form is
 *   added as a synonym alias on the corresponding CI canonical. The
 *   aliasPlan dedup guarantees no duplicate alias rows.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertCIColorantsPhase1A.ts
 *
 *   # LIVE INSERT (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/batchInsertCIColorantsPhase1A.ts
 *
 * Sources used: EU Cosmetics Regulation 1223/2009 Annex IV (allowed
 * colorants), FDA 21 CFR Parts 73 / 74 / 82, Colour Index International,
 * SCCS opinions on cochineal carmine, post-V6-phase1D unknown report.
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import {
  applyUnknownResolutionCandidates,
  type BatchResolutionCandidate,
} from "../batchResolverNodeSafe";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Phase 1A (Dalga C) — 6 CI colorants ──────────────────────────────────────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. CI 16035 — FD&C Red No. 40 / Allura Red AC ─────────────────────────
  // Synthetic monoazo dye, EU/FDA permitted cosmetic colorant. Tier B.
  {
    suggested_canonical_name: "ci 16035",
    aliases: [
      "ci 16035",
      "CI 16035",
      "red 40",
      "fd&c red 40",
      "fd&c red no 40",
      "allura red",
      "allura red ac",
    ],
    risk_level:         "low",
    function_tags:      ["colorant"],
    concern_flags:      ["colorant"],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Synthetic monoazo cosmetic colorant (Allura Red AC / FD&C Red No. 40); " +
      "EU Annex IV / FDA 21 CFR 74 permitted.",
  },

  // ── 2. CI 47005 — D&C Yellow No. 10 / Quinoline Yellow ────────────────────
  // Quinoline-based synthetic yellow dye. Tier B.
  {
    suggested_canonical_name: "ci 47005",
    aliases: [
      "ci 47005",
      "CI 47005",
      "yellow 10",
      "d&c yellow 10",
      "d&c yellow no 10",
      "quinoline yellow",
      "quinoline yellow ws",
    ],
    risk_level:         "low",
    function_tags:      ["colorant"],
    concern_flags:      ["colorant"],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Quinoline-based synthetic cosmetic colorant (D&C Yellow No. 10 / " +
      "Quinoline Yellow); EU Annex IV / FDA 21 CFR 74 permitted.",
  },

  // ── 3. CI 75470 — Carmine (cochineal) ─────────────────────────────────────
  // Animal-derived (Dactylopius coccus) anthraquinone pigment. Documented
  // contact / immediate-type allergen with rare anaphylaxis case reports.
  // Tier C — risk=medium, allergy=moderate, concern_flags include "allergen".
  {
    suggested_canonical_name: "ci 75470",
    aliases: [
      "ci 75470",
      "CI 75470",
      "carmine",
      "Carmine",
      "CARMINE",
      "cochineal",
      "ci 75470 carmine",   // slash-combined unknown-report token
      "carminic acid",
      "natural red 4",
    ],
    risk_level:         "medium",
    function_tags:      ["colorant"],
    concern_flags:      ["colorant", "allergen"],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "moderate",
    description:
      "Animal-derived anthraquinone pigment (cochineal carmine, Dactylopius " +
      "coccus); documented contact / immediate-type allergen with rare " +
      "anaphylaxis case reports. EU Annex IV permitted with declaration.",
  },

  // ── 4. CI 77007 — Ultramarines (sodium aluminium silicate) ────────────────
  // Inorganic mineral pigment (calcined clay + sulfur). Very low risk.
  // Tier A — preg/bf=safe.
  {
    suggested_canonical_name: "ci 77007",
    aliases: [
      "ci 77007",
      "CI 77007",
      "ultramarines",
      "Ultramarines",
      "ULTRAMARINES",
      "ultramarine",
      "ultramarine blue",
      "ci 77007 ultramarines",  // slash-combined unknown-report token
      "sodium aluminium silicate",
      "sodium aluminum silicate",
    ],
    risk_level:         "low",
    function_tags:      ["colorant"],
    concern_flags:      ["colorant"],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
    description:
      "Inorganic mineral pigment (sodium aluminium silicate with sulfur); " +
      "EU Annex IV permitted; rinse-off and leave-on use; very low risk.",
  },

  // ── 5. CI 15850 — D&C Red No. 7 (Lithol Rubine BCA, calcium / barium lake) ─
  // Synthetic monoazo lake pigment. Tier B.
  {
    suggested_canonical_name: "ci 15850",
    aliases: [
      "ci 15850",
      "CI 15850",
      "red 7",
      "d&c red 7",
      "d&c red no 7",
      "ci 15850 red 7",   // slash-combined unknown-report token
      "lithol rubine bca",
      "pigment red 57",
    ],
    risk_level:         "low",
    function_tags:      ["colorant"],
    concern_flags:      ["colorant"],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Synthetic monoazo lake pigment (D&C Red No. 7 / Lithol Rubine BCA); " +
      "EU Annex IV / FDA 21 CFR 74 permitted.",
  },

  // ── 6. CI 15985 — FD&C Yellow No. 6 / Sunset Yellow FCF ───────────────────
  // Synthetic monoazo dye. Tier B.
  {
    suggested_canonical_name: "ci 15985",
    aliases: [
      "ci 15985",
      "CI 15985",
      "yellow 6",
      "fd&c yellow 6",
      "fd&c yellow no 6",
      "sunset yellow",
      "sunset yellow fcf",
    ],
    risk_level:         "low",
    function_tags:      ["colorant"],
    concern_flags:      ["colorant"],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
    description:
      "Synthetic monoazo cosmetic colorant (Sunset Yellow FCF / " +
      "FD&C Yellow No. 6); EU Annex IV / FDA 21 CFR 74 permitted.",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" batchInsertCIColorantsPhase1A");
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
