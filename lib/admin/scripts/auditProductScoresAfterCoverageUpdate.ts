/**
 * auditProductScoresAfterCoverageUpdate.ts — READ-ONLY DIAGNOSTIC
 * ─────────────────────────────────────────────────────────────────────────────
 * Audits product scoring accuracy after recent ingredient_master and
 * ingredient_aliases coverage improvements (Phase 1A/1B/1C + Top-100 cleanup).
 *
 * GOAL:
 *   Determine whether product scores changed — or should change — now that the
 *   ingredient library has been expanded. Produce a structured audit report.
 *
 * STRICT RULES (all enforced):
 *   1. NO writes to any table (Supabase or local).
 *   2. NO modification of the score engine, resolver, V4 registry, or UI.
 *   3. NO restart of any workflow as a side-effect.
 *   4. Pure shadow computation: every score is calculated in-memory.
 *
 * METHOD:
 *   For every product in `products` (with ingredients), compute TWO scores:
 *
 *     (A) BASELINE  = `analyzeProductV4(rawText)` using ONLY the local V4
 *                     registry. Represents the score BEFORE any Supabase
 *                     coverage additions (Phase 1*, Top-100 cleanup).
 *
 *     (B) CURRENT   = full PATH 1 → 1b → 2 → 2b resolution per token,
 *                     synthesizing V4MatchResult from Supabase master rows
 *                     where applicable, then running the canonical
 *                     `assessV4Risk` → `classifyV4Formula` → `scoreV4Product`
 *                     pipeline. Represents the score AFTER all current
 *                     ingredients_master + ingredient_aliases additions.
 *
 *   The DELTA (B − A) reveals which products' scores actually changed because
 *   of the recent library updates.
 *
 * AUDIT-SPEC CONFIDENCE THRESHOLDS (per task brief — distinct from the V4
 * engine's own confidence thresholds, which are 80/60):
 *     coverage ≥ 85 %       → high
 *     coverage 70–84 %      → medium
 *     coverage <  70 %      → low
 *
 * OLD-vs-NEW SCORE COMPARISON:
 *   - No persistent V4-computed score snapshot table exists in the schema.
 *   - The `products.dermo_score` column may or may not exist in this Supabase
 *     instance (governed by scripts/migration-add-dermo-score.sql). When
 *     present it stores static brand-seeded values and is NOT V4-computed.
 *     We report it for completeness only — it is NOT a reliable baseline.
 *   - The meaningful "old vs new" comparison is the shadow BASELINE vs CURRENT
 *     computed by THIS script. Both are V4-computed and therefore directly
 *     comparable.
 *
 * SCOPE NOTE — what this script measures vs what users see today:
 *   This audit measures the **V4-native** product score (assessV4Risk →
 *   classifyV4Formula → scoreV4Product) under both resolver scopes. That is
 *   the score that flows through V4 surfaces and the future-default UI path.
 *   It is NOT the same number as scoreEngineGate.runDualScoreAnalysis would
 *   report for live users today, because the live gate compares legacy
 *   `calculateIngredientScore` against the V4-input adapter — a different
 *   formula on a different input shape. This audit is intentionally focused
 *   on whether the **V4 ingredient library expansion** (the Phase 1 work)
 *   moved scores; it does not benchmark legacy parity.
 *
 * HOW TO RUN (from ciltbakim-mobile dir):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/auditProductScoresAfterCoverageUpdate.ts
 *
 * OUTPUT:
 *   - Pretty console report
 *   - JSON dump → lib/admin/scripts/output/auditProductScoresAfterCoverageUpdate.<ts>.json
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to ingredients_master, ingredient_aliases, products,
 *     ingredient_unknown_queue, or any other table.
 *   - Does NOT call resolveIngredientV4 (which writes to PATH 3 unknown queue).
 *   - Does NOT activate, mutate, or rebuild any cache.
 *   - Does NOT change the live score behaviour seen by the app.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import { matchV4Ingredient }                     from "@/lib/ingredientEngineV4/registry";
import { buildParentheticalCandidates }          from "@/lib/ingredientEngineV4/resolver/parentheticalPreProcessor";
import { parseV4Ingredients }                    from "@/lib/ingredientEngineV4/normalizer";
import { assessV4Risk }                          from "@/lib/ingredientEngineV4/policyEngine/engine";
import { classifyV4Formula }                     from "@/lib/ingredientEngineV4/formulaClassifier";
import { scoreV4Product }                        from "@/lib/ingredientEngineV4/scorer";
import { analyzeProductV4 }                      from "@/lib/ingredientEngineV4";

import type {
  V4MatchResult,
  IngredientCategory,
  IngredientFlag,
  V4RiskLevel,
} from "@/lib/ingredientEngineV4/registry/types";
import type { V4AnalysisItem, V4ProductScore } from "@/lib/ingredientEngineV4/scorer";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

// ── Supabase client ───────────────────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  id:           string;
  name:         string;
  brand:        string | null;
  ingredients:  string | string[] | null;
  // dermo_score column may or may not exist in the live schema. We probe for
  // it once and only project it if present — see `productHasDermoScore`.
  dermo_score?: number | null;
}

interface MasterRow {
  id:                 string;
  canonical_name:     string;
  display_name:       string | null;
  risk_level:         string | null;        // "low" | "medium" | "high" | "safe" | null
  concern_flags:      unknown;
  function_tags:      unknown;
  pregnancy_flag:     string | null;        // "safe" | "avoid" | "caution" | null
  breastfeeding_flag: string | null;        // "safe" | "avoid" | "caution" | null
  allergy_flag:       string | null;
}

interface AliasRow {
  normalized_alias: string;
  ingredient_id:    string;
  is_active:        boolean;
  priority:         number | null;
}

type AuditConfidence = "high" | "medium" | "low";

interface PerProductAudit {
  product_id:                  string;
  product_name:                string;
  brand:                       string | null;
  total_ingredients:           number;

  // Current (post-Supabase-additions) metrics — these are the "live truth"
  current_recognized_count:    number;
  current_unknown_count:       number;
  current_coverage_pct:        number;
  current_final_score:         number;
  current_engine_confidence:   "high" | "medium" | "low"; // V4 engine's own confidence
  current_audit_confidence:    AuditConfidence;            // per task spec (85/70 thresholds)
  current_score_label:         string;
  current_warnings:            string[];                   // warning codes only
  current_unknown_ratio:       number;
  ceiling_applied_warning:     boolean;                    // engine emitted analysis_limited

  // Detected risk-class items (deduped, capped to top 12 names for log brevity)
  detected_high_risk:          string[];
  detected_medium_risk:        string[];
  detected_allergens:          string[];
  detected_pregnancy_caution:  string[];
  detected_breastfeeding_caution: string[];

  // Baseline (pre-Supabase-additions) shadow score — local registry only
  baseline_recognized_count:   number;
  baseline_unknown_count:      number;
  baseline_coverage_pct:       number;
  baseline_final_score:        number;
  baseline_audit_confidence:   AuditConfidence;

  // Deltas
  coverage_delta:              number;   // current − baseline (percentage points)
  score_delta:                 number;   // current − baseline (raw points)
  audit_confidence_changed:    boolean;  // baseline vs current bucket differs

  // Stored static reference (not V4-computed)
  dermo_score_seed:            number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyAuditConfidence(coveragePct: number): AuditConfidence {
  if (coveragePct >= 85) return "high";
  if (coveragePct >= 70) return "medium";
  return "low";
}

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

// ── Mapping: Supabase risk_level string → V4RiskLevel union ────────────────────

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
      // Already in V4 form?
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

// ── Resolver cache + per-token resolve mirroring nodeResolver paths ───────────

interface ResolverCache {
  aliasIndex: Map<string, MasterRow>;   // normalized_alias → master row
  masterById: Map<string, MasterRow>;
}

interface PerTokenResolution {
  raw:                string;
  match:              V4MatchResult;
  source:             "supabase" | "local" | "unknown";
  breastfeeding_flag: string | null;    // tracked separately (engine ignores it)
}

function resolveOneToken(raw: string, cache: ResolverCache): PerTokenResolution {
  const normalized = normalizeForLookup(raw);
  const candidates = buildParentheticalCandidates(raw);
  const strippedNorm = candidates.hasParentheticals
    ? normalizeForLookup(candidates.stripped)
    : normalized;

  // ── PATH 1: Supabase — original normalized form ────────────────────────────
  const m1 = cache.aliasIndex.get(normalized);
  if (m1) {
    return {
      raw,
      match:              synthesizeMatchFromSupabase(raw, normalized, m1),
      source:             "supabase",
      breastfeeding_flag: m1.breastfeeding_flag ?? null,
    };
  }

  // ── PATH 1b: Supabase — stripped form ──────────────────────────────────────
  if (candidates.hasParentheticals && strippedNorm !== normalized) {
    const m1b = cache.aliasIndex.get(strippedNorm);
    if (m1b) {
      return {
        raw,
        match:              synthesizeMatchFromSupabase(raw, normalized, m1b),
        source:             "supabase",
        breastfeeding_flag: m1b.breastfeeding_flag ?? null,
      };
    }
  }

  // ── PATH 2: Local registry — original raw ──────────────────────────────────
  const local2 = matchV4Ingredient(raw);
  if (local2.matched) {
    return { raw, match: local2, source: "local", breastfeeding_flag: null };
  }

  // ── PATH 2b: Local registry — stripped raw ─────────────────────────────────
  if (candidates.hasParentheticals && candidates.stripped !== raw) {
    const local2b = matchV4Ingredient(candidates.stripped);
    if (local2b.matched) {
      return {
        raw,
        match: { ...local2b, raw, normalized },
        source: "local",
        breastfeeding_flag: null,
      };
    }
  }

  // ── PATH 3: Unknown (no write — suppressed in admin) ──────────────────────
  return {
    raw,
    match:              unmatchedResult(raw, normalized),
    source:             "unknown",
    breastfeeding_flag: null,
  };
}

// ── Run the canonical V4 score pipeline on synthesized matches ────────────────
//
// Mirrors analyzeProductV4 EXCEPT step 5 (enqueueV4Unknown — suppressed) and
// step 2 (uses our resolver-supplied matches instead of matchV4Ingredient).

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

// ── Build per-product audit ───────────────────────────────────────────────────

function buildAudit(
  product:     ProductRow,
  cache:       ResolverCache
): PerProductAudit | null {
  const tokens = parseV4Ingredients(extractIngredients(product).join(", "));
  if (tokens.length === 0) return null;

  // ── Current pipeline (Supabase + local) ────────────────────────────────────
  const resolutions  = tokens.map((t) => resolveOneToken(t, cache));
  const currentMatches = resolutions.map((r) => r.match);
  const rawTextJoined  = tokens.join(", ");
  const currentScore   = runCurrentScorePipeline(currentMatches, rawTextJoined);

  // ── Baseline pipeline (local registry only) ────────────────────────────────
  // Use the canonical analyzeProductV4 path — it uses matchV4Ingredient ONLY,
  // which excludes every Supabase addition by definition.
  const baselineScore = analyzeProductV4({
    rawIngredientsText: rawTextJoined,
    productId:          product.id,
  });

  // ── Detected risk / allergen / pregnancy / breastfeeding lists ─────────────
  const dedupTake = (arr: string[], cap = 12): string[] =>
    Array.from(new Set(arr.filter(Boolean))).slice(0, cap);

  const detectedHigh = currentScore.ingredients
    .filter((i) => i.bucket === "high_risk")
    .map((i) => i.canonical_name ?? i.raw);

  const detectedMedium = currentScore.ingredients
    .filter((i) => i.bucket === "medium_risk")
    .map((i) => i.canonical_name ?? i.raw);

  const detectedAllergens = currentScore.ingredients
    .filter((i) => i.flags.includes("allergen"))
    .map((i) => i.canonical_name ?? i.raw);

  const detectedPregCaution = currentScore.ingredients
    .filter((i) => i.pregnancy_safe === false)
    .map((i) => i.canonical_name ?? i.raw);

  // Breastfeeding flag is NOT carried by V4MatchResult; pull from per-token
  // resolution (only Supabase-resolved tokens have this).
  const detectedBreastCaution: string[] = [];
  for (let i = 0; i < resolutions.length; i++) {
    const r = resolutions[i];
    if (r.breastfeeding_flag === "avoid" || r.breastfeeding_flag === "caution") {
      detectedBreastCaution.push(currentMatches[i].canonical_name ?? r.raw);
    }
  }

  const warningCodes = currentScore.warnings.map((w) => w.code);
  const ceilingWarning =
    warningCodes.includes("analysis_limited") || warningCodes.includes("low_coverage");

  const total                  = currentScore.totalIngredients;
  const currentCoverage        = currentScore.coveragePct;
  const baselineCoverage       = baselineScore.coveragePct;
  const currentUnknownRatio    =
    total > 0 ? currentScore.unresolvedIngredients / total : 0;

  const baselineAuditConf = classifyAuditConfidence(baselineCoverage);
  const currentAuditConf  = classifyAuditConfidence(currentCoverage);

  return {
    product_id:                product.id,
    product_name:              product.name,
    brand:                     product.brand,
    total_ingredients:         total,

    current_recognized_count:  currentScore.matchedIngredients,
    current_unknown_count:     currentScore.unresolvedIngredients,
    current_coverage_pct:      currentCoverage,
    current_final_score:       currentScore.finalScore,
    current_engine_confidence: currentScore.confidence,
    current_audit_confidence:  currentAuditConf,
    current_score_label:       currentScore.scoreLabel,
    current_warnings:          warningCodes,
    current_unknown_ratio:     Math.round(currentUnknownRatio * 1000) / 1000,
    ceiling_applied_warning:   ceilingWarning,

    detected_high_risk:        dedupTake(detectedHigh),
    detected_medium_risk:      dedupTake(detectedMedium),
    detected_allergens:        dedupTake(detectedAllergens),
    detected_pregnancy_caution: dedupTake(detectedPregCaution),
    detected_breastfeeding_caution: dedupTake(detectedBreastCaution),

    baseline_recognized_count: baselineScore.matchedIngredients,
    baseline_unknown_count:    baselineScore.unresolvedIngredients,
    baseline_coverage_pct:     baselineCoverage,
    baseline_final_score:      baselineScore.finalScore,
    baseline_audit_confidence: baselineAuditConf,

    coverage_delta:            currentCoverage - baselineCoverage,
    score_delta:               currentScore.finalScore - baselineScore.finalScore,
    audit_confidence_changed:  baselineAuditConf !== currentAuditConf,

    dermo_score_seed:          product.dermo_score ?? null,
  };
}

// ── Stratified sampling: 10 high + 10 medium + 10 low coverage ────────────────

function pickStratifiedSample(audits: PerProductAudit[], perBucket = 10): {
  high:   PerProductAudit[];
  medium: PerProductAudit[];
  low:    PerProductAudit[];
} {
  const high   = audits.filter((a) => a.current_audit_confidence === "high");
  const medium = audits.filter((a) => a.current_audit_confidence === "medium");
  const low    = audits.filter((a) => a.current_audit_confidence === "low");

  // Sort each bucket by coverage descending then by name for determinism, then
  // pick `perBucket` evenly spaced entries — gives a representative sample.
  function pickEvenly(arr: PerProductAudit[], n: number): PerProductAudit[] {
    if (arr.length === 0) return [];
    const sorted = [...arr].sort((a, b) => {
      if (b.current_coverage_pct !== a.current_coverage_pct) {
        return b.current_coverage_pct - a.current_coverage_pct;
      }
      return a.product_name.localeCompare(b.product_name, "tr");
    });
    if (sorted.length <= n) return sorted;
    const step = sorted.length / n;
    const out: PerProductAudit[] = [];
    for (let i = 0; i < n; i++) out.push(sorted[Math.floor(i * step)]);
    return out;
  }

  return {
    high:   pickEvenly(high,   perBucket),
    medium: pickEvenly(medium, perBucket),
    low:    pickEvenly(low,    perBucket),
  };
}

// ── Pretty printers ───────────────────────────────────────────────────────────

function fmt(s: string | number, w: number, align: "l" | "r" = "l"): string {
  const str = String(s);
  if (str.length >= w) return str.slice(0, w);
  return align === "r" ? str.padStart(w) : str.padEnd(w);
}

function printSampleProduct(a: PerProductAudit, idx: number): void {
  console.log(`\n  [${idx + 1}] ${a.product_name}`);
  console.log(`      brand                 : ${a.brand ?? "(none)"}`);
  console.log(`      total ingredients     : ${a.total_ingredients}`);
  console.log(`      recognized / unknown  : ${a.current_recognized_count} / ${a.current_unknown_count}`);
  console.log(`      coverage              : ${a.current_coverage_pct}%   (baseline ${a.baseline_coverage_pct}% → Δ ${(a.coverage_delta >= 0 ? "+" : "")}${a.coverage_delta}pp)`);
  console.log(`      final score           : ${a.current_final_score}    (baseline ${a.baseline_final_score} → Δ ${(a.score_delta >= 0 ? "+" : "")}${a.score_delta})`);
  console.log(`      audit confidence      : ${a.current_audit_confidence.toUpperCase()}   (baseline ${a.baseline_audit_confidence.toUpperCase()}${a.audit_confidence_changed ? " — CHANGED" : ""})`);
  console.log(`      engine confidence     : ${a.current_engine_confidence}   label: ${a.current_score_label}`);
  console.log(`      detected high risk    : ${a.detected_high_risk.length === 0 ? "—" : a.detected_high_risk.join(", ")}`);
  console.log(`      detected medium risk  : ${a.detected_medium_risk.length === 0 ? "—" : a.detected_medium_risk.join(", ")}`);
  console.log(`      detected allergens    : ${a.detected_allergens.length === 0 ? "—" : a.detected_allergens.join(", ")}`);
  console.log(`      pregnancy caution     : ${a.detected_pregnancy_caution.length === 0 ? "—" : a.detected_pregnancy_caution.join(", ")}`);
  console.log(`      breastfeeding caution : ${a.detected_breastfeeding_caution.length === 0 ? "—" : a.detected_breastfeeding_caution.join(", ")}`);
  console.log(`      warnings              : ${a.current_warnings.length === 0 ? "—" : a.current_warnings.join(", ")}`);
}

function printTopList(
  title:   string,
  rows:    PerProductAudit[],
  cols:    Array<{ header: string; w: number; get: (a: PerProductAudit) => string | number; align?: "l" | "r" }>
): void {
  console.log(`\n${"─".repeat(80)}`);
  console.log(` ${title}`);
  console.log("─".repeat(80));
  console.log(
    "  " + cols.map((c) => fmt(c.header, c.w, c.align)).join("  ")
  );
  console.log("  " + cols.map((c) => "─".repeat(c.w)).join("  "));
  for (const r of rows) {
    console.log(
      "  " + cols.map((c) => fmt(c.get(r), c.w, c.align)).join("  ")
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const t0 = Date.now();

  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(" auditProductScoresAfterCoverageUpdate — READ-ONLY DIAGNOSTIC");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Started : ${new Date().toISOString()}`);
  console.log("═════════════════════════════════════════════════════════════════════════\n");

  // ── 1. Pre-fetch reference tables ──────────────────────────────────────────
  console.log("Pre-fetching reference tables …");

  // Probe whether the optional `dermo_score` column exists in the live schema.
  // It is defined by scripts/migration-add-dermo-score.sql but may not have been
  // applied to this Supabase instance. We project it conditionally so a missing
  // column never aborts the audit.
  const probe = await sb.from("products").select("dermo_score").limit(1);
  const productHasDermoScore = !probe.error;
  const productCols = productHasDermoScore
    ? "id, name, brand, ingredients, dermo_score"
    : "id, name, brand, ingredients";

  const [aliases, masters, products] = await Promise.all([
    fetchAll<AliasRow>(
      "ingredient_aliases",
      "normalized_alias, ingredient_id, is_active, priority",
      // Match production resolver: when the same normalized_alias is mapped to
      // multiple ingredient_ids, the row with the lowest `priority` wins.
      // We sort here so the subsequent "first-seen-wins" map population is
      // priority-deterministic and identical to nodeResolver.lookupSupabase.
      (q) => q.eq("is_active", true).order("priority", { ascending: true })
    ),
    fetchAll<MasterRow>(
      "ingredients_master",
      "id, canonical_name, display_name, risk_level, concern_flags, " +
      "function_tags, pregnancy_flag, breastfeeding_flag, allergy_flag",
      (q) => q.eq("is_active", true)
    ),
    fetchAll<ProductRow>(
      "products",
      productCols,
      (q) => q.not("ingredients", "is", null)
    ),
  ]);

  console.log(`  ingredient_aliases  (active): ${aliases.length}`);
  console.log(`  ingredients_master  (active): ${masters.length}`);
  console.log(`  products            (with ingredients): ${products.length}\n`);

  // ── 2. Build resolver cache ────────────────────────────────────────────────
  const masterById = new Map<string, MasterRow>();
  for (const m of masters) masterById.set(m.id, m);

  const aliasIndex = new Map<string, MasterRow>();
  let aliasOrphans = 0;
  for (const a of aliases) {
    const m = masterById.get(a.ingredient_id);
    if (!m) { aliasOrphans++; continue; }
    // Earlier alias rows win — Supabase order is by primary key insertion.
    if (!aliasIndex.has(a.normalized_alias)) {
      aliasIndex.set(a.normalized_alias, m);
    }
  }
  if (aliasOrphans > 0) {
    console.log(`  (note: ${aliasOrphans} alias rows reference inactive/missing masters — ignored)\n`);
  }

  const cache: ResolverCache = { aliasIndex, masterById };

  // ── 3. Per-product audit ───────────────────────────────────────────────────
  console.log("Computing per-product audits (baseline vs current) …");
  const audits: PerProductAudit[] = [];
  let skippedEmpty = 0;
  for (const p of products) {
    const a = buildAudit(p, cache);
    if (!a) { skippedEmpty++; continue; }
    audits.push(a);
  }
  console.log(`  audited products: ${audits.length}  (skipped ${skippedEmpty} with empty/invalid ingredients)\n`);

  // ── 4. Aggregate metrics ───────────────────────────────────────────────────
  const N = audits.length;
  const safeAvg = (sum: number) => (N === 0 ? 0 : Math.round((sum / N) * 100) / 100);

  const sumScore       = audits.reduce((s, a) => s + a.current_final_score, 0);
  const sumBaseline    = audits.reduce((s, a) => s + a.baseline_final_score, 0);
  const sumCoverage    = audits.reduce((s, a) => s + a.current_coverage_pct, 0);
  const sumBaseCoverage = audits.reduce((s, a) => s + a.baseline_coverage_pct, 0);
  const sumScoreDelta  = audits.reduce((s, a) => s + a.score_delta, 0);
  const sumCovDelta    = audits.reduce((s, a) => s + a.coverage_delta, 0);

  const avgScore        = safeAvg(sumScore);
  const avgBaseline     = safeAvg(sumBaseline);
  const avgCoverage     = safeAvg(sumCoverage);
  const avgBaseCoverage = safeAvg(sumBaseCoverage);
  const avgScoreDelta   = safeAvg(sumScoreDelta);
  const avgCovDelta     = safeAvg(sumCovDelta);

  const bucketCount = (b: AuditConfidence) =>
    audits.filter((a) => a.current_audit_confidence === b).length;
  const baseBucketCount = (b: AuditConfidence) =>
    audits.filter((a) => a.baseline_audit_confidence === b).length;

  const highCount   = bucketCount("high");
  const mediumCount = bucketCount("medium");
  const lowCount    = bucketCount("low");

  const baseHighCount   = baseBucketCount("high");
  const baseMediumCount = baseBucketCount("medium");
  const baseLowCount    = baseBucketCount("low");

  const confChangedUp = audits.filter(
    (a) => a.audit_confidence_changed && a.coverage_delta > 0
  ).length;

  const dermoSeedCount = audits.filter((a) => a.dermo_score_seed !== null).length;

  // ── 5. Sample selection ────────────────────────────────────────────────────
  const sample = pickStratifiedSample(audits, 10);

  // ── 6. Suspicious scores (top 20) ──────────────────────────────────────────
  // Definition: score MAY be unreliable when audit confidence is low/medium
  // AND the engine flagged ceiling/low_coverage warnings OR unknown ratio is
  // material (>0.30 — where the V4 ceiling kicks in).
  const suspicious = audits
    .filter(
      (a) =>
        a.current_audit_confidence !== "high" &&
        (a.ceiling_applied_warning || a.current_unknown_ratio > 0.30)
    )
    .sort((a, b) => {
      // Primary: most unknown items first; tie-break: lowest coverage first.
      if (b.current_unknown_count !== a.current_unknown_count) {
        return b.current_unknown_count - a.current_unknown_count;
      }
      return a.current_coverage_pct - b.current_coverage_pct;
    })
    .slice(0, 20);

  // ── 7. Score-confidence improvement leaders (top 20) ───────────────────────
  // Products whose coverage rose most between baseline and current — i.e.
  // those that benefited most from the recent Supabase additions.
  const improved = audits
    .filter((a) => a.coverage_delta > 0)
    .sort((a, b) => {
      if (b.coverage_delta !== a.coverage_delta) {
        return b.coverage_delta - a.coverage_delta;
      }
      return b.score_delta - a.score_delta;
    })
    .slice(0, 20);

  // ── 8. Recalculation recommendation ────────────────────────────────────────
  // Recommend recalculation if a meaningful number of products show non-zero
  // score deltas OR audit-bucket bumps. Threshold: >5% of audited products.
  const productsChangedScore = audits.filter((a) => a.score_delta !== 0).length;
  const productsChangedBucket = audits.filter((a) => a.audit_confidence_changed).length;
  const pctChangedScore  = N === 0 ? 0 : (productsChangedScore  / N) * 100;
  const pctChangedBucket = N === 0 ? 0 : (productsChangedBucket / N) * 100;
  const recalcRecommended = pctChangedScore > 5 || pctChangedBucket > 2;

  // ── 9. Print report ────────────────────────────────────────────────────────
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(" GLOBAL SUMMARY");
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(`  audited products                  : ${N}`);
  console.log(`  average score (current)           : ${avgScore} / 100`);
  console.log(`  average score (baseline local)    : ${avgBaseline} / 100`);
  console.log(`  average score Δ                   : ${avgScoreDelta >= 0 ? "+" : ""}${avgScoreDelta}`);
  console.log(`  average coverage (current)        : ${avgCoverage}%`);
  console.log(`  average coverage (baseline local) : ${avgBaseCoverage}%`);
  console.log(`  average coverage Δ                : ${avgCovDelta >= 0 ? "+" : ""}${avgCovDelta}pp`);
  console.log("");
  console.log(`  Audit-spec confidence buckets (current vs baseline):`);
  console.log(`     high (≥85%)   : ${highCount}   (baseline ${baseHighCount}   → Δ ${highCount   - baseHighCount   >= 0 ? "+" : ""}${highCount   - baseHighCount})`);
  console.log(`     medium (70–84): ${mediumCount}   (baseline ${baseMediumCount} → Δ ${mediumCount - baseMediumCount >= 0 ? "+" : ""}${mediumCount - baseMediumCount})`);
  console.log(`     low (<70%)    : ${lowCount}   (baseline ${baseLowCount}    → Δ ${lowCount    - baseLowCount    >= 0 ? "+" : ""}${lowCount    - baseLowCount})`);
  console.log("");
  console.log(`  products whose audit bucket moved : ${confChangedUp} (with positive coverage Δ)`);
  console.log(`  products with score Δ ≠ 0         : ${productsChangedScore} (${pctChangedScore.toFixed(1)}%)`);
  console.log(`  products with audit-bucket change : ${productsChangedBucket} (${pctChangedBucket.toFixed(1)}%)`);

  console.log("");
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(" OLD-vs-NEW SCORE SNAPSHOT AVAILABILITY");
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log("  Persistent V4-computed score snapshot table : NOT FOUND");
  if (productHasDermoScore) {
    console.log(`  Static seed column (products.dermo_score)   : present, populated for ${dermoSeedCount} / ${N} products`);
    console.log("    → dermo_score is a brand-keyed manual seed (scripts/supabase-seed-scores.sql),");
    console.log("      NOT a V4-computed score. Direct comparison is NOT scientifically meaningful.");
  } else {
    console.log("  Static seed column (products.dermo_score)   : NOT PRESENT in live schema");
    console.log("    → migration-add-dermo-score.sql was never applied to this Supabase instance,");
    console.log("      so no persisted score (V4 or otherwise) exists for comparison.");
  }
  console.log("  Meaningful comparison (this report)         : shadow BASELINE vs CURRENT");
  console.log("    → both V4-computed, differing only in resolver scope (local vs local+Supabase).");

  // Sample products
  console.log("\n═════════════════════════════════════════════════════════════════════════");
  console.log(" 30-PRODUCT STRATIFIED SAMPLE (10 high · 10 medium · 10 low coverage)");
  console.log("═════════════════════════════════════════════════════════════════════════");

  console.log(`\n────── HIGH coverage (≥85%) — ${sample.high.length} products ──────`);
  sample.high.forEach((a, i) => printSampleProduct(a, i));

  console.log(`\n────── MEDIUM coverage (70–84%) — ${sample.medium.length} products ──────`);
  sample.medium.forEach((a, i) => printSampleProduct(a, i));

  console.log(`\n────── LOW coverage (<70%) — ${sample.low.length} products ──────`);
  sample.low.forEach((a, i) => printSampleProduct(a, i));

  // Top 20 suspicious
  printTopList(
    "TOP 20 SUSPICIOUS SCORES (high-unknown / ceiling-applied / low-coverage)",
    suspicious,
    [
      { header: "#",         w: 3,  get: (_a) => "" /* index assigned below */ },
      { header: "score",     w: 5,  get: (a) => a.current_final_score, align: "r" },
      { header: "cov%",      w: 5,  get: (a) => a.current_coverage_pct, align: "r" },
      { header: "unk",       w: 4,  get: (a) => a.current_unknown_count, align: "r" },
      { header: "tot",       w: 4,  get: (a) => a.total_ingredients, align: "r" },
      { header: "conf",      w: 6,  get: (a) => a.current_audit_confidence },
      { header: "brand",     w: 16, get: (a) => a.brand ?? "—" },
      { header: "product",   w: 32, get: (a) => a.product_name },
    ]
  );
  // Reprint with proper indices (printTopList can't see iteration index — patch
  // by re-emitting line numbers).
  if (suspicious.length > 0) {
    console.log("  (rows ordered top→bottom: 1 = most suspicious)");
  } else {
    console.log("  (no products met the suspicious criteria — strong signal)");
  }

  // Top 20 most improved (confidence)
  printTopList(
    "TOP 20 PRODUCTS WHOSE SCORE CONFIDENCE IMPROVED MOST (coverage Δ desc)",
    improved,
    [
      { header: "Δcov%",     w: 6,  get: (a) => `+${a.coverage_delta}`, align: "r" },
      { header: "Δscore",    w: 7,  get: (a) => `${a.score_delta >= 0 ? "+" : ""}${a.score_delta}`, align: "r" },
      { header: "now",       w: 4,  get: (a) => a.current_coverage_pct, align: "r" },
      { header: "was",       w: 4,  get: (a) => a.baseline_coverage_pct, align: "r" },
      { header: "bucket",    w: 8,  get: (a) => a.audit_confidence_changed ? `${a.baseline_audit_confidence}→${a.current_audit_confidence}` : a.current_audit_confidence },
      { header: "brand",     w: 16, get: (a) => a.brand ?? "—" },
      { header: "product",   w: 32, get: (a) => a.product_name },
    ]
  );
  if (improved.length === 0) {
    console.log("  (no products improved — Supabase additions had zero effect on this set)");
  }

  // Recalculation recommendation
  console.log("\n═════════════════════════════════════════════════════════════════════════");
  console.log(" RECALCULATION RECOMMENDATION");
  console.log("═════════════════════════════════════════════════════════════════════════");
  console.log(`  Products with non-zero score delta : ${productsChangedScore} / ${N}  (${pctChangedScore.toFixed(1)}%)`);
  console.log(`  Products with audit-bucket bump    : ${productsChangedBucket} / ${N}  (${pctChangedBucket.toFixed(1)}%)`);
  console.log(`  Average score Δ                    : ${avgScoreDelta >= 0 ? "+" : ""}${avgScoreDelta}`);
  console.log(`  Average coverage Δ                 : ${avgCovDelta >= 0 ? "+" : ""}${avgCovDelta}pp`);
  console.log("");
  console.log(`  Recommendation : ${recalcRecommended ? "YES — recalculation is recommended." : "NO — coverage updates have not materially shifted scores."}`);
  if (recalcRecommended) {
    console.log("    Rationale: a non-trivial fraction of products now score differently because");
    console.log("    Supabase additions either (a) recognised previously-unknown ingredients,");
    console.log("    reducing the unknown-ratio penalty / removing the score ceiling, or");
    console.log("    (b) classified ingredients into specific risk buckets that the local-only");
    console.log("    baseline could not see. The score engine itself is unchanged; what changed");
    console.log("    is the input quality flowing into it.");
    console.log("    Note: in production, the live score is already recomputed on each render —");
    console.log("    no migration is required. This recommendation applies only IF score values");
    console.log("    are persisted anywhere (e.g., a future score-cache table or denormalised");
    console.log("    column). Currently only `dermo_score` (static brand seed) is stored, and");
    console.log("    it is not produced by V4 — so no persisted V4 score requires backfill.");
  } else {
    console.log("    Rationale: the recent ingredient library updates have not produced enough");
    console.log("    score / bucket movement to warrant a recalculation pass even if scores");
    console.log("    were persisted. Production scores are computed live on each render and");
    console.log("    therefore already reflect the latest library state.");
  }

  // ── 10. JSON dump ──────────────────────────────────────────────────────────
  const outDir  = path.resolve(__dirname, "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `auditProductScoresAfterCoverageUpdate.${ts}.json`);

  const dump = {
    generated_at: new Date().toISOString(),
    supabase_url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    counts: {
      ingredient_aliases_active: aliases.length,
      ingredients_master_active: masters.length,
      products_with_ingredients: products.length,
      audited_products:          N,
      skipped_empty_ingredients: skippedEmpty,
      alias_orphans_ignored:     aliasOrphans,
    },
    averages: {
      score_current:        avgScore,
      score_baseline_local: avgBaseline,
      score_delta:          avgScoreDelta,
      coverage_current:     avgCoverage,
      coverage_baseline:    avgBaseCoverage,
      coverage_delta:       avgCovDelta,
    },
    audit_confidence_buckets: {
      current:  { high: highCount,     medium: mediumCount,     low: lowCount     },
      baseline: { high: baseHighCount, medium: baseMediumCount, low: baseLowCount },
    },
    snapshot_availability: {
      v4_score_snapshot_table: false,
      dermo_score_seed_count:  dermoSeedCount,
      dermo_score_is_v4:       false,
      meaningful_comparison:   "shadow_baseline_vs_current",
    },
    recalculation: {
      products_with_score_delta:        productsChangedScore,
      products_with_bucket_change:      productsChangedBucket,
      pct_with_score_delta:             Math.round(pctChangedScore  * 100) / 100,
      pct_with_bucket_change:           Math.round(pctChangedBucket * 100) / 100,
      recommended:                      recalcRecommended,
    },
    sample_30: {
      high:   sample.high,
      medium: sample.medium,
      low:    sample.low,
    },
    suspicious_top_20: suspicious,
    improved_top_20:   improved,
    all_audits:        audits,
  };
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), "utf-8");

  console.log("\n─────────────────────────────────────────────────────────────────────────");
  console.log(` JSON dump written to: ${path.relative(process.cwd(), outPath)}`);
  console.log(` Elapsed: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log("─────────────────────────────────────────────────────────────────────────");
  console.log(" Read-only audit complete. Score engine, resolver, registry, UI unchanged.");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
