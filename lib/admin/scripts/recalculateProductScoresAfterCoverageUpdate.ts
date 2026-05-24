/**
 * recalculateProductScoresAfterCoverageUpdate.ts
 *
 * SCOPE:
 *   Recompute the **current V4 product score** for every product in Supabase
 *   using the updated ingredient library (ingredients_master + ingredient_aliases),
 *   and — when allowed — persist the result back to a score column on the
 *   `products` table.
 *
 * STRICT SAFETY RULES (enforced in code below):
 *   1. Score engine is NOT modified.       (we only read scoreV4Product et al.)
 *   2. Resolver is NOT modified.           (we mirror nodeResolver paths but never call write APIs)
 *   3. UI is NOT modified.
 *   4. Product names / images / ingredients / descriptions / categories are NEVER touched.
 *      Only score-related fields may be written.
 *   5. Score-related fields are written ONLY IF they already exist on the table.
 *   6. If no score column exists, this script does NOT create migrations — it
 *      reports the missing column(s) and exits cleanly.
 *   7. DRY_RUN defaults to true. Live writes require an explicit DRY_RUN=false
 *      AND a confirmed score-column target.
 *
 * ENV:
 *   DRY_RUN          (default "true")  — "false" to actually apply UPDATEs.
 *   SCORE_COLUMN     (default "")      — pin a specific score column to write to.
 *                                        If empty, the script auto-picks one from
 *                                        the probe (preferring v4_score > dermo_score).
 *   PRODUCT_LIMIT    (default 0)       — debugging hard cap on products processed.
 *   BATCH_SIZE       (default 50)      — UPDATE batch size when DRY_RUN=false.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/recalculateProductScoresAfterCoverageUpdate.ts
 *
 *   # later, when a column exists and you want to actually persist:
 *   #   DRY_RUN=false SCORE_COLUMN=dermo_score ... <same command>
 *
 * V4 PIPELINE FAITHFULNESS (parity with auditProductScoresAfterCoverageUpdate):
 *   This script reuses the same priority-aware resolver pipeline that the audit
 *   script established (PATH 1 → 1b → 2 → 2b), and the same V4-native scoring
 *   chain (assessV4Risk → classifyV4Formula → scoreV4Product). Aliases are
 *   loaded with `order priority asc` so first-seen-wins is identical to
 *   nodeResolver.lookupSupabase. PATH 3 (unknown-queue persistence) is NOT
 *   triggered — synthesis happens in-memory only.
 */

import { createClient } from "@supabase/supabase-js";
import * as path        from "path";
import * as fs          from "fs";

import { matchV4Ingredient }           from "../../ingredientEngineV4";
import { parseV4Ingredients }          from "../../ingredientEngineV4";
import { assessV4Risk }                from "../../ingredientEngineV4/policyEngine/engine";
import { classifyV4Formula }           from "../../ingredientEngineV4/formulaClassifier";
import { scoreV4Product }              from "../../ingredientEngineV4/scorer";
import { normalizeForLookup }          from "../nodeResolver";
import { buildParentheticalCandidates } from "../../ingredientEngineV4/resolver/parentheticalPreProcessor";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

import type { V4MatchResult, V4RiskLevel, IngredientCategory, IngredientFlag }
  from "../../ingredientEngineV4/registry/types";
import type { V4ProductScore, V4AnalysisItem }
  from "../../ingredientEngineV4/scorer";

// ── Config / env ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const DRY_RUN       = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const SCORE_COLUMN  = (process.env.SCORE_COLUMN ?? "").trim();
const PRODUCT_LIMIT = Math.max(0, Number(process.env.PRODUCT_LIMIT ?? 0));
const BATCH_SIZE    = Math.max(1, Number(process.env.BATCH_SIZE ?? 50));

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars (EXPO_PUBLIC_SUPABASE_URL + key).");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Candidate score columns to probe (ordered by write-preference) ────────────

const CANDIDATE_SCORE_COLUMNS = [
  "v4_score",
  "score_v4",
  "dermo_score",
  "current_score",
  "final_score",
  "score",
  "risk_score",
] as const;
type CandidateScoreColumn = (typeof CANDIDATE_SCORE_COLUMNS)[number];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  id:          string;
  name:        string | null;
  brand:       string | null;
  ingredients: string[] | string | null;
  // Persisted score columns (probed dynamically, populated only when present):
  [key: string]: any;
}

interface MasterRow {
  id:                 string;
  canonical_name:     string;
  display_name:       string | null;
  risk_level:         string | null;
  concern_flags:      string[] | null;
  function_tags:      string[] | null;
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
}

interface AliasRow {
  normalized_alias: string;
  ingredient_id:    string;
  is_active:        boolean;
  priority:         number | null;
}

interface ScoreColumnProbe {
  column:   CandidateScoreColumn;
  exists:   boolean;
  nonNullSampleCount: number;  // out of the first 1000 rows
  sampleNonNullValues: number[]; // up to 5 non-null observed values, for sanity
}

interface PerProductRecalc {
  id:                  string;
  name:                string;
  brand:               string;
  recognized_count:    number;
  unknown_count:       number;
  total_count:         number;
  coverage_pct:        number;
  current_score:       number;          // V4-computed
  persisted_score:     number | null;   // from chosen score column (null if column absent or row null)
  delta:               number | null;   // current − persisted (null if persisted null)
  would_update:        boolean;         // current !== persisted (and column exists)
  warnings:            string[];
}

// ── Helpers (parity with audit script — see header note above) ────────────────

function parseIngredientString(raw: string): string[] {
  // Dalga E1 / Phase 1.b — delegate to shared safe INCI tokenizer.
  return tokenizeInciList(raw);
}

function extractIngredients(p: ProductRow): string[] {
  if (Array.isArray(p.ingredients)) {
    return (p.ingredients as string[]).filter(
      (s) => typeof s === "string" && s.trim()
    );
  }
  if (typeof p.ingredients === "string") {
    return parseIngredientString(p.ingredients);
  }
  return [];
}

async function fetchAll<T>(
  table: string,
  cols:  string,
  filter?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) {
      console.error(`Fetch error on ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Mapping: Supabase → V4 type unions ────────────────────────────────────────

const VALID_V4_RISK: ReadonlySet<V4RiskLevel> = new Set([
  "safe", "low_risk", "medium_risk", "high_risk",
]);

function mapSupabaseRiskToV4(rl: string | null): V4RiskLevel | null {
  if (!rl) return null;
  switch (rl) {
    case "low":    return "low_risk";
    case "medium": return "medium_risk";
    case "high":   return "high_risk";
    case "safe":   return "safe";
    default:
      return VALID_V4_RISK.has(rl as V4RiskLevel) ? (rl as V4RiskLevel) : null;
  }
}

const VALID_CATEGORIES: ReadonlySet<IngredientCategory> = new Set([
  "solvent", "humectant", "emollient", "occlusive", "barrier", "soothing",
  "active", "antioxidant", "surfactant", "preservative", "emulsifier",
  "thickener", "chelating", "fragrance", "uv_filter", "absorbent",
  "ph_adjuster", "film_former", "silicone", "botanical", "colorant",
  "polymer", "unknown",
]);

function pickCategory(tags: string[]): IngredientCategory | null {
  for (const t of tags) {
    if (VALID_CATEGORIES.has(t as IngredientCategory)) return t as IngredientCategory;
  }
  return null;
}

const VALID_FLAGS: ReadonlySet<IngredientFlag> = new Set([
  "fragrance", "allergen", "drying_alcohol", "uv_filter", "preservative",
  "surfactant", "active", "barrier_support", "silicone", "polymer", "paraben",
  "formaldehyde_releaser", "endocrine_disruptor", "eu_restricted", "mineral_filter",
]);

function filterFlags(raw: unknown): IngredientFlag[] {
  if (!Array.isArray(raw)) return [];
  return (raw as string[]).filter((f) => VALID_FLAGS.has(f as IngredientFlag)) as IngredientFlag[];
}

function pregnancySafeFromFlag(flag: string | null): V4MatchResult["pregnancy_safe"] {
  if (flag === "safe")    return true;
  if (flag === "avoid")   return false;
  if (flag === "caution") return "uncertain";
  return null;
}

// ── Synthesize V4MatchResult from a Supabase master row ───────────────────────

function synthesizeMatchFromSupabase(
  raw:        string,
  normalized: string,
  master:     MasterRow
): V4MatchResult {
  const flags    = filterFlags(master.concern_flags);
  const tags     = Array.isArray(master.function_tags) ? (master.function_tags as string[]) : [];
  const category = pickCategory(tags);

  return {
    raw,
    normalized,
    canonical_name: master.canonical_name,
    category,
    risk_level:     mapSupabaseRiskToV4(master.risk_level),
    flags,
    pregnancy_safe: pregnancySafeFromFlag(master.pregnancy_flag),
    matched:        true,
    match_tier:     "exact",
    confidence:     "high",
  };
}

function unmatchedResult(raw: string, normalized: string): V4MatchResult {
  return {
    raw,
    normalized,
    canonical_name: null,
    category:       null,
    risk_level:     null,
    flags:          [],
    pregnancy_safe: null,
    matched:        false,
    match_tier:     "none",
    confidence:     null,
  };
}

// ── Resolver cache + per-token resolution mirroring nodeResolver paths ────────

interface ResolverCache {
  aliasIndex: Map<string, MasterRow>;
  masterById: Map<string, MasterRow>;
}

interface PerTokenResolution {
  raw:    string;
  match:  V4MatchResult;
  source: "supabase" | "local" | "unknown";
}

function resolveOneToken(raw: string, cache: ResolverCache): PerTokenResolution {
  const normalized   = normalizeForLookup(raw);
  const candidates   = buildParentheticalCandidates(raw);
  const strippedNorm = candidates.hasParentheticals
    ? normalizeForLookup(candidates.stripped)
    : normalized;

  // PATH 1: Supabase exact normalized
  const m1 = cache.aliasIndex.get(normalized);
  if (m1) {
    return { raw, match: synthesizeMatchFromSupabase(raw, normalized, m1), source: "supabase" };
  }
  // PATH 1b: Supabase parenthetical-stripped
  if (candidates.hasParentheticals && strippedNorm !== normalized) {
    const m1b = cache.aliasIndex.get(strippedNorm);
    if (m1b) {
      return { raw, match: synthesizeMatchFromSupabase(raw, normalized, m1b), source: "supabase" };
    }
  }
  // PATH 2: local registry on raw
  const local2 = matchV4Ingredient(raw);
  if (local2.matched) {
    return { raw, match: local2, source: "local" };
  }
  // PATH 2b: local registry on stripped raw
  if (candidates.hasParentheticals && candidates.stripped !== raw) {
    const local2b = matchV4Ingredient(candidates.stripped);
    if (local2b.matched) {
      return { raw, match: { ...local2b, raw, normalized }, source: "local" };
    }
  }
  return { raw, match: unmatchedResult(raw, normalized), source: "unknown" };
}

// ── Score pipeline (mirrors analyzeProductV4 minus enqueueV4Unknown) ──────────

function runCurrentScorePipeline(
  matches: V4MatchResult[],
  rawText: string
): V4ProductScore {
  if (matches.length === 0) {
    return scoreV4Product([], classifyV4Formula([]), rawText);
  }
  const classification = classifyV4Formula(matches);
  const items: V4AnalysisItem[] = matches.map((m) => ({
    match:      m,
    assessment: assessV4Risk(m, classification.formulaType),
  }));
  return scoreV4Product(items, classification, rawText);
}

// ── Score-column probing ──────────────────────────────────────────────────────

async function probeScoreColumn(col: CandidateScoreColumn): Promise<ScoreColumnProbe> {
  // Try to select a tiny window of `col`. PostgREST returns error code "42703"
  // when the column does not exist.
  const { data, error } = await sb.from("products").select(`id, ${col}`).limit(1000);
  if (error) {
    return { column: col, exists: false, nonNullSampleCount: 0, sampleNonNullValues: [] };
  }
  const nonNull = (data ?? []).filter(
    (r: any) => r[col] !== null && r[col] !== undefined
  );
  return {
    column: col,
    exists: true,
    nonNullSampleCount: nonNull.length,
    sampleNonNullValues: nonNull
      .slice(0, 5)
      .map((r: any) => Number(r[col]))
      .filter((n: number) => Number.isFinite(n)),
  };
}

// ── Per-product recalc ────────────────────────────────────────────────────────

function buildRecalc(
  product:   ProductRow,
  cache:     ResolverCache,
  scoreCol:  CandidateScoreColumn | null
): PerProductRecalc | null {
  const tokens = parseV4Ingredients(extractIngredients(product).join(", "));
  if (tokens.length === 0) return null;

  const resolutions    = tokens.map((t) => resolveOneToken(t, cache));
  const currentMatches = resolutions.map((r) => r.match);
  const rawTextJoined  = tokens.join(", ");
  const currentScore   = runCurrentScorePipeline(currentMatches, rawTextJoined);

  const recognized = currentMatches.filter((m) => m.matched).length;
  const unknown    = currentMatches.length - recognized;
  const coveragePct = currentMatches.length === 0
    ? 0
    : Math.round((recognized / currentMatches.length) * 100);

  let persisted: number | null = null;
  if (scoreCol && product[scoreCol] !== null && product[scoreCol] !== undefined) {
    const v = Number(product[scoreCol]);
    persisted = Number.isFinite(v) ? v : null;
  }
  const delta = persisted === null ? null : currentScore.finalScore - persisted;
  const wouldUpdate = scoreCol !== null && (persisted === null || delta !== 0);

  return {
    id:               product.id,
    name:             product.name?.trim() || "(unnamed)",
    brand:            product.brand?.trim() || "(no brand)",
    recognized_count: recognized,
    unknown_count:    unknown,
    total_count:      currentMatches.length,
    coverage_pct:     coveragePct,
    current_score:    currentScore.finalScore,
    persisted_score:  persisted,
    delta,
    would_update:     wouldUpdate,
    warnings:         currentScore.warnings.map((w) => w.code),
  };
}

// ── Reporting helpers ─────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function fmtSign(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}

function printColumnAvailability(probes: ScoreColumnProbe[]): void {
  console.log();
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(" SCORE COLUMN AVAILABILITY (probed on `products`)");
  console.log("─────────────────────────────────────────────────────────────────────────");
  for (const p of probes) {
    const status = p.exists ? "PRESENT" : "absent ";
    const sample = p.exists
      ? `(${p.nonNullSampleCount} non-null in first 1000${p.sampleNonNullValues.length ? `, e.g. [${p.sampleNonNullValues.join(", ")}]` : ", all null"})`
      : "";
    console.log(`  ${pad(p.column, 16)} : ${status}  ${sample}`);
  }
}

function pickWriteTarget(
  probes:   ScoreColumnProbe[],
  pinned:   string
): CandidateScoreColumn | null {
  const present = probes.filter((p) => p.exists);
  if (present.length === 0) return null;

  if (pinned) {
    const hit = present.find((p) => p.column === pinned);
    if (!hit) {
      console.warn(`\n[warn] SCORE_COLUMN="${pinned}" was requested but does not exist on products.`);
      return null;
    }
    return hit.column;
  }
  // Preference order = CANDIDATE_SCORE_COLUMNS order
  return present[0].column;
}

function printGlobalSummary(
  recalcs:    PerProductRecalc[],
  scoreCol:   CandidateScoreColumn | null,
  totalProds: number,
  skipped:    number
): void {
  const n = recalcs.length;
  const avgCurrent  = n === 0 ? 0 : recalcs.reduce((s, r) => s + r.current_score, 0) / n;
  const avgCoverage = n === 0 ? 0 : recalcs.reduce((s, r) => s + r.coverage_pct,  0) / n;

  const wouldUpdate    = recalcs.filter((r) => r.would_update);
  const newlyScored    = recalcs.filter((r) => r.would_update && r.persisted_score === null);
  const changedScores  = recalcs.filter((r) => r.would_update && r.persisted_score !== null);
  const unchanged      = recalcs.filter((r) => !r.would_update);
  const positiveDelta  = changedScores.filter((r) => (r.delta ?? 0) > 0);
  const negativeDelta  = changedScores.filter((r) => (r.delta ?? 0) < 0);
  const meanDelta = changedScores.length === 0
    ? 0
    : changedScores.reduce((s, r) => s + (r.delta ?? 0), 0) / changedScores.length;

  console.log();
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(" RECALCULATION SUMMARY");
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(`  total products in DB              : ${totalProds}`);
  console.log(`  products processed (with tokens)  : ${n}`);
  console.log(`  skipped (empty/invalid)           : ${skipped}`);
  console.log(`  avg V4 current score              : ${avgCurrent.toFixed(2)} / 100`);
  console.log(`  avg coverage                      : ${avgCoverage.toFixed(2)}%`);
  console.log();
  console.log(`  target score column               : ${scoreCol ?? "— (none present)"}`);
  if (!scoreCol) {
    console.log(`    → No persisted score column exists. Nothing would be updated.`);
    console.log(`    → Per safety rule 6, this script does NOT create a migration.`);
    console.log(`    → To enable persistence, add a column manually (see scripts/`);
    console.log(`      migration-add-dermo-score.sql) and re-run.`);
    return;
  }

  console.log();
  console.log(`  rows that WOULD be updated        : ${wouldUpdate.length}`);
  console.log(`    └─ newly scored (was NULL)      : ${newlyScored.length}`);
  console.log(`    └─ score changed (had value)    : ${changedScores.length}`);
  console.log(`         positive delta (+)         : ${positiveDelta.length}`);
  console.log(`         negative delta (−)         : ${negativeDelta.length}`);
  console.log(`         mean delta (changed only)  : ${fmtSign(Math.round(meanDelta * 100) / 100)}`);
  console.log(`  rows that would NOT be updated    : ${unchanged.length}`);
}

function printTop20Changes(
  recalcs: PerProductRecalc[],
  scoreCol: CandidateScoreColumn | null
): void {
  console.log();
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(" TOP 20 BIGGEST SCORE CHANGES (|delta| desc; persisted-vs-current only)");
  console.log("─────────────────────────────────────────────────────────────────────────");

  if (!scoreCol) {
    console.log("  (no score column present — nothing to compare against)");
    return;
  }

  const ranked = recalcs
    .filter((r) => r.persisted_score !== null && r.delta !== null && r.delta !== 0)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    .slice(0, 20);

  if (ranked.length === 0) {
    console.log("  (no products have a non-zero delta against the persisted column)");
    return;
  }

  console.log();
  console.log(
    `  ${pad("#", 3)} ${pad("brand", 22)} ${pad("name", 50)} ${pad("was", 5)} ${pad("→ now", 6)} ${pad("Δ", 6)} ${pad("cov%", 5)}`
  );
  console.log(
    `  ${pad("", 3)} ${pad("", 22)} ${pad("", 50)} ${pad("", 5)} ${pad("", 6)} ${pad("", 6)} ${pad("", 5)}`
  );
  ranked.forEach((r, i) => {
    console.log(
      `  ${pad(String(i + 1), 3)} ${pad(r.brand, 22)} ${pad(r.name, 50)} ` +
      `${pad(String(r.persisted_score), 5)} ${pad(String(r.current_score), 6)} ` +
      `${pad(fmtSign(r.delta!), 6)} ${pad(`${r.coverage_pct}%`, 5)}`
    );
  });
}

function printNewlyScoredSample(recalcs: PerProductRecalc[], scoreCol: CandidateScoreColumn | null): void {
  if (!scoreCol) return;
  const newly = recalcs.filter((r) => r.would_update && r.persisted_score === null);
  if (newly.length === 0) return;

  console.log();
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(` SAMPLE OF NEWLY-SCORED ROWS (column was NULL → would set)`);
  console.log(`   total such rows: ${newly.length} (showing first 10)`);
  console.log("─────────────────────────────────────────────────────────────────────────");
  newly.slice(0, 10).forEach((r, i) => {
    console.log(
      `  [${i + 1}] ${pad(r.brand, 22)} ${pad(r.name, 50)}  → ${r.current_score}/100   cov ${r.coverage_pct}%`
    );
  });
}

// ── Live-write path (only runs when DRY_RUN=false) ────────────────────────────

async function applyUpdates(
  recalcs:  PerProductRecalc[],
  scoreCol: CandidateScoreColumn
): Promise<{ ok: number; failed: number }> {
  const targets = recalcs.filter((r) => r.would_update);
  let ok = 0, failed = 0;

  console.log();
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(` APPLYING UPDATES — column "${scoreCol}", ${targets.length} rows, batch ${BATCH_SIZE}`);
  console.log("═════════════════════════════════════════════════════════════════════════");

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const slice = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      slice.map(async (r) => {
        const { error } = await sb
          .from("products")
          .update({ [scoreCol]: r.current_score })
          .eq("id", r.id);
        return { id: r.id, error };
      })
    );
    for (const res of results) {
      if (res.error) {
        failed++;
        console.error(`  [fail] ${res.id}: ${res.error.message}`);
      } else {
        ok++;
      }
    }
    process.stdout.write(`  progress: ${Math.min(i + slice.length, targets.length)}/${targets.length}\r`);
  }
  console.log();
  console.log(`  done. ok=${ok}  failed=${failed}`);
  return { ok, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date();

  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(" recalculateProductScoresAfterCoverageUpdate");
  console.log(` Supabase: ${SUPABASE_URL}`);
  console.log(` Mode    : ${DRY_RUN ? "DRY-RUN (no writes)" : "LIVE (will write)"}`);
  console.log(` Started : ${startedAt.toISOString()}`);
  console.log("═════════════════════════════════════════════════════════════════════════");

  // 1) Probe candidate score columns
  console.log("\nProbing score columns on `products` …");
  const probes = await Promise.all(
    CANDIDATE_SCORE_COLUMNS.map((c) => probeScoreColumn(c))
  );
  printColumnAvailability(probes);

  const scoreCol = pickWriteTarget(probes, SCORE_COLUMN);
  if (scoreCol) {
    console.log(`\n  → write target chosen: "${scoreCol}"` +
      (SCORE_COLUMN ? "  (pinned via SCORE_COLUMN)" : "  (auto-picked from preference order)"));
  } else {
    console.log("\n  → no score column present — recalc will only compute & report.");
  }

  // 2) Bulk fetch reference tables (priority-aware aliases — parity with audit script)
  console.log("\nPre-fetching reference tables …");
  const productCols = scoreCol
    ? `id, name, brand, ingredients, ${scoreCol}`
    : "id, name, brand, ingredients";

  const [aliases, masters, products] = await Promise.all([
    fetchAll<AliasRow>(
      "ingredient_aliases",
      "normalized_alias, ingredient_id, is_active, priority",
      (q) => q.eq("is_active", true).order("priority", { ascending: true })
    ),
    fetchAll<MasterRow>(
      "ingredients_master",
      "id, canonical_name, display_name, risk_level, concern_flags, " +
      "function_tags, pregnancy_flag, breastfeeding_flag, allergy_flag",
      (q) => q.eq("is_active", true)
    ),
    fetchAll<ProductRow>("products", productCols, (q) => q.not("ingredients", "is", null)),
  ]);

  console.log(`  ingredient_aliases  (active): ${aliases.length}`);
  console.log(`  ingredients_master  (active): ${masters.length}`);
  console.log(`  products            (with ingredients): ${products.length}`);

  // 3) Build resolver cache (priority-aware: first row per normalized_alias wins)
  const masterById = new Map<string, MasterRow>();
  for (const m of masters) masterById.set(m.id, m);

  const aliasIndex = new Map<string, MasterRow>();
  for (const a of aliases) {
    if (aliasIndex.has(a.normalized_alias)) continue; // first (lowest priority) wins
    const m = masterById.get(a.ingredient_id);
    if (m) aliasIndex.set(a.normalized_alias, m);
  }
  const cache: ResolverCache = { aliasIndex, masterById };

  // 4) Recalc per product
  const productsToProcess = PRODUCT_LIMIT > 0 ? products.slice(0, PRODUCT_LIMIT) : products;
  console.log(`\nComputing V4 current score for ${productsToProcess.length} products …`);

  const recalcs: PerProductRecalc[] = [];
  let skipped = 0;
  for (const p of productsToProcess) {
    const r = buildRecalc(p, cache, scoreCol);
    if (r) recalcs.push(r);
    else   skipped++;
  }
  console.log(`  processed: ${recalcs.length}   skipped: ${skipped}`);

  // 5) Reporting
  printGlobalSummary(recalcs, scoreCol, products.length, skipped);
  printTop20Changes(recalcs, scoreCol);
  printNewlyScoredSample(recalcs, scoreCol);

  // 6) JSON dump
  const outDir  = path.resolve(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp   = startedAt.toISOString().replace(/[:.]/g, "-");
  const outFile = path.resolve(outDir, `recalculateProductScoresAfterCoverageUpdate.${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    startedAt:  startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    mode:       DRY_RUN ? "dry-run" : "live",
    scoreColumn:scoreCol,
    probes,
    counts: {
      products_total:    products.length,
      products_processed:recalcs.length,
      products_skipped:  skipped,
      would_update:      recalcs.filter((r) => r.would_update).length,
    },
    recalcs,
  }, null, 2), "utf8");
  console.log(`\nJSON dump → ${outFile}`);

  // 7) Either stop (DRY-RUN) or apply
  if (DRY_RUN) {
    console.log();
    console.log("═════════════════════════════════════════════════════════════════════════");
    console.log(" DRY-RUN: no writes performed.");
    console.log(" To apply for real, re-run with:  DRY_RUN=false" +
                (scoreCol ? `  SCORE_COLUMN=${scoreCol}` : ""));
    console.log("═════════════════════════════════════════════════════════════════════════");
    return;
  }

  if (!scoreCol) {
    console.log();
    console.log("═════════════════════════════════════════════════════════════════════════");
    console.log(" LIVE mode requested but no score column exists. Refusing to write.");
    console.log(" Add a column first (see scripts/migration-add-dermo-score.sql).");
    console.log("═════════════════════════════════════════════════════════════════════════");
    process.exit(2);
  }

  const { ok, failed } = await applyUpdates(recalcs, scoreCol);
  if (failed > 0) {
    console.error(
      `\n[exit 3] Live update completed with errors: ok=${ok} failed=${failed}. ` +
      `Inspect the per-row [fail] lines above and re-run for any rows that need retry.`
    );
    process.exit(3);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
