/**
 * debugDualScore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin/debug script: fetches 5 real products from Supabase and prints a
 * side-by-side comparison of legacy score vs V4 score for each product.
 *
 * PURPOSE:
 *   Manual inspection before enabling USE_V4_SCORE_INPUT globally.
 *   Shows whether V4 produces better, worse, or identical scores — and WHY,
 *   via the v4_meta resolution counts.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/debugDualScore.ts
 *
 * OUTPUT PER PRODUCT:
 *   - Legacy score (0–100) + confidence + warnings
 *   - V4 score     (0–100) + confidence + warnings
 *   - Score delta (V4 − Legacy): positive = V4 higher, negative = V4 lower
 *   - V4 meta: supabase_count / local_count / unknown_count / coverage
 *   - Per-bucket counts for both paths
 *
 * GLOBAL SUMMARY:
 *   - Products with score improvement (V4 > legacy)
 *   - Products with score regression (V4 < legacy)
 *   - Products with no change
 *   - Average delta across all products
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT activate V4 globally (USE_V4_SCORE_INPUT stays false)
 *   - Does NOT change any live score
 *   - Does NOT write to any Supabase table
 *   - Does NOT run automatically — manual execution only
 *
 * NODE.JS SAFETY:
 *   Uses createLeanSupabase + resolveIngredientNodeSafe (never supabaseClient.ts).
 *   Never imports runDualScoreAnalysis (Expo Supabase client dep).
 *   Mirrors the exact dual-path logic from scoreEngineGate.runDualScoreAnalysis.
 */

import { createLeanSupabase, resolveIngredientNodeSafe } from "../nodeResolver";
import { analyzeProduct }             from "@/lib/ingredientIntelligence/analyzeProduct";
import { calculateIngredientScore }   from "@/lib/ingredientIntelligence/scoreEngine";
import { parseIngredients }           from "@/lib/ingredientIntelligence/parser";
import { adaptV4InputToIntelligenceResult }
                                      from "@/lib/ingredientEngineV4/scoreInputAdapter";
import type { IngredientScore }       from "@/lib/ingredientIntelligence/scoreEngine";

// ── Supabase client ───────────────────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  id:          string;
  name:        string;
  brand:       string | null;
  ingredients: string | string[] | null;
}

interface ResolvedEntry {
  raw_name:           string;
  source:             "supabase" | "local" | "unknown";
  canonical_name:     string | null;
  risk_level:         string | null;
  concern_flags:      string[];
  function_tags:      string[];
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
}

interface V4Meta {
  total_count:    number;
  supabase_count: number;
  local_count:    number;
  unknown_count:  number;
  coverage_ratio: number;
}

interface DualResult {
  product_id:    string;
  product_name:  string;
  brand:         string | null;
  legacy_score:  IngredientScore;
  v4_score:      IngredientScore | null;
  score_delta:   number | null;
  v4_meta:       V4Meta | null;
  v4_failed:     boolean;
  legacy_summary: { total: number; safe: number; low: number; med: number; high: number; unk: number; cov: number };
  v4_summary:     { total: number; safe: number; low: number; med: number; high: number; unk: number; cov: number } | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function toRawText(ingredients: ProductRow["ingredients"]): string {
  if (typeof ingredients === "string")  return ingredients;
  if (Array.isArray(ingredients))       return (ingredients as string[]).filter(Boolean).join(", ");
  return "";
}

function toTokens(ingredients: ProductRow["ingredients"]): string[] {
  return parseIngredients(toRawText(ingredients));
}

// ── Resolver (node-safe mirror of buildResolvedIngredientScoreInputV4) ─────────

async function resolveOne(raw: string): Promise<ResolvedEntry> {
  const r = await resolveIngredientNodeSafe(raw, sb);
  return {
    raw_name:           raw,
    source:             r.source,
    canonical_name:     r.canonical_name,
    risk_level:         r.risk_level,
    concern_flags:      r.concern_flags,
    function_tags:      r.function_tags,
    pregnancy_flag:     r.pregnancy_flag,
    breastfeeding_flag: r.breastfeeding_flag,
    allergy_flag:       r.allergy_flag,
  };
}

function buildV4Meta(entries: ResolvedEntry[]): V4Meta {
  const total   = entries.length;
  const sbCount = entries.filter((e) => e.source === "supabase").length;
  const lcCount = entries.filter((e) => e.source === "local").length;
  const unkCount= entries.filter((e) => e.source === "unknown").length;
  return {
    total_count:    total,
    supabase_count: sbCount,
    local_count:    lcCount,
    unknown_count:  unkCount,
    coverage_ratio: total > 0 ? (sbCount + lcCount) / total : 0,
  };
}

type BucketSummary = { total: number; safe: number; low: number; med: number; high: number; unk: number; cov: number };

function summariseScore(_score: IngredientScore, analysis: ReturnType<typeof analyzeProduct>): BucketSummary {
  const s = analysis.summary;
  return {
    total: s.total,
    safe:  s.safe,
    low:   s.low_risk,
    med:   s.medium_risk,
    high:  s.high_risk,
    unk:   s.unknown,
    cov:   s.coverage_pct,
  };
}

// ── Per-product dual analysis ─────────────────────────────────────────────────

async function analyzeDual(product: ProductRow): Promise<DualResult> {
  const rawText = toRawText(product.ingredients);
  const tokens  = toTokens(product.ingredients);

  // ── 1. Legacy path (always — this is the production score) ──────────────────
  const legacyAnalysis = analyzeProduct(rawText, product.id);
  const legacyScore    = calculateIngredientScore(legacyAnalysis);
  const legacySummary  = summariseScore(legacyScore, legacyAnalysis);

  // ── 2. V4 path (silent failure on error) ────────────────────────────────────
  try {
    const entries = await Promise.all(tokens.map(resolveOne));
    const meta    = buildV4Meta(entries);

    // Structural shape matching ResolvedScoreInputV4 (no direct import needed)
    const v4Payload = {
      total_count:          meta.total_count,
      resolved_count:       meta.supabase_count + meta.local_count,
      supabase_count:       meta.supabase_count,
      local_count:          meta.local_count,
      unknown_count:        meta.unknown_count,
      coverage_ratio:       meta.coverage_ratio,
      resolved_ingredients: entries,
      unknown_ingredients:  entries.filter((e) => e.source === "unknown"),
    };

    const v4Analysis = adaptV4InputToIntelligenceResult(v4Payload as any, rawText);
    const v4Score    = calculateIngredientScore(v4Analysis);
    const v4Summary  = summariseScore(v4Score, v4Analysis);
    const delta      = v4Score.score_0_100 - legacyScore.score_0_100;

    return {
      product_id:   product.id,
      product_name: product.name,
      brand:        product.brand,
      legacy_score: legacyScore,
      v4_score:     v4Score,
      score_delta:  delta,
      v4_meta:      meta,
      v4_failed:    false,
      legacy_summary: legacySummary,
      v4_summary:     v4Summary,
    };
  } catch (err) {
    return {
      product_id:   product.id,
      product_name: product.name,
      brand:        product.brand,
      legacy_score: legacyScore,
      v4_score:     null,
      score_delta:  null,
      v4_meta:      null,
      v4_failed:    true,
      legacy_summary: legacySummary,
      v4_summary:     null,
    };
  }
}

// ── Fetch products ─────────────────────────────────────────────────────────────

async function fetchProducts(count: number): Promise<ProductRow[]> {
  const { data, error } = await sb
    .from("products")
    .select("id, name, brand, ingredients")
    .not("ingredients", "is", null)
    .order("name", { ascending: true })
    .limit(count * 4);

  if (error || !data) {
    console.error("Failed to fetch products:", error?.message);
    return [];
  }

  const valid = (data as ProductRow[]).filter((p) => {
    const s = toRawText(p.ingredients);
    return s.trim().length > 30;
  });

  return valid.slice(0, count);
}

// ── Printer ───────────────────────────────────────────────────────────────────

const HR  = "═".repeat(72);
const HR2 = "─".repeat(72);

function pad(s: string | number, w: number): string {
  return String(s).padStart(w);
}

function deltaLabel(d: number | null): string {
  if (d === null) return "  N/A (V4 failed)";
  if (d > 0)  return `  +${d}  ▲  V4 scores HIGHER`;
  if (d < 0)  return `  ${d}  ▼  V4 scores LOWER`;
  return "   0  ✅  Same score";
}

function confIcon(conf: string): string {
  if (conf === "high")   return "🟢";
  if (conf === "medium") return "🟡";
  return "🔴";
}

function printResult(r: DualResult, idx: number): void {
  const L  = r.legacy_summary;
  const V  = r.v4_summary;
  const lS = r.legacy_score;
  const vS = r.v4_score;
  const m  = r.v4_meta;

  console.log(`\n${HR}`);
  console.log(` #${idx + 1}  ${r.product_name}`);
  console.log(`      Brand : ${r.brand ?? "—"}   ID : ${r.product_id}`);
  console.log(HR2);

  // ── Final scores ────────────────────────────────────────────────────────────
  console.log(`  FINAL SCORE`);
  console.log(`    Legacy  : ${pad(lS.score_0_100, 3)}  ${confIcon(lS.confidence)} ${lS.confidence}`);

  if (vS) {
    console.log(`    V4      : ${pad(vS.score_0_100, 3)}  ${confIcon(vS.confidence)} ${vS.confidence}`);
    console.log(`    Delta   :${deltaLabel(r.score_delta)}`);
  } else {
    console.log(`    V4      : —   (failed)`);
    console.log(`    Delta   : N/A`);
  }

  // ── Bucket breakdown ────────────────────────────────────────────────────────
  console.log(HR2);
  console.log(`  BUCKET BREAKDOWN              Legacy     V4`);
  console.log(`    Total ingredients          : ${pad(L.total, 6)}  ${pad(V?.total ?? "—", 6)}`);
  console.log(`    safe                       : ${pad(L.safe,  6)}  ${pad(V?.safe  ?? "—", 6)}`);
  console.log(`    low_risk                   : ${pad(L.low,   6)}  ${pad(V?.low   ?? "—", 6)}`);
  console.log(`    medium_risk                : ${pad(L.med,   6)}  ${pad(V?.med   ?? "—", 6)}`);
  console.log(`    high_risk                  : ${pad(L.high,  6)}  ${pad(V?.high  ?? "—", 6)}`);
  console.log(`    unknown                    : ${pad(L.unk,   6)}  ${pad(V?.unk   ?? "—", 6)}`);
  console.log(`    coverage                   : ${pad(L.cov + "%", 6)}  ${pad(V ? V.cov + "%" : "—", 6)}`);

  // ── V4 resolution meta ──────────────────────────────────────────────────────
  if (m) {
    const covPct = (m.coverage_ratio * 100).toFixed(1);
    console.log(HR2);
    console.log(`  V4 RESOLUTION META`);
    console.log(`    Total parsed           : ${m.total_count}`);
    console.log(`    Supabase (PATH 1/1b)   : ${m.supabase_count}  ✅`);
    console.log(`    Local    (PATH 2/2b)   : ${m.local_count}  ⚪`);
    console.log(`    Unknown  (PATH 3)      : ${m.unknown_count}  ❓`);
    console.log(`    Coverage               : ${covPct}%`);
  }

  // ── Warnings ────────────────────────────────────────────────────────────────
  if (lS.warnings.length > 0 || (vS && vS.warnings.length > 0)) {
    console.log(HR2);
    console.log(`  WARNINGS`);
    console.log(`    Legacy  : ${lS.warnings.length > 0 ? lS.warnings.join(", ") : "(none)"}`);
    if (vS) {
      const newWarnings = vS.warnings.filter((w) => !lS.warnings.includes(w));
      const droppedWarnings = lS.warnings.filter((w) => !vS.warnings.includes(w));
      console.log(`    V4      : ${vS.warnings.length > 0 ? vS.warnings.join(", ") : "(none)"}`);
      if (newWarnings.length > 0)     console.log(`    ⚠️  New in V4     : ${newWarnings.join(", ")}`);
      if (droppedWarnings.length > 0) console.log(`    ✅  Dropped in V4 : ${droppedWarnings.join(", ")}`);
    }
  }

  // ── V4 failure note ─────────────────────────────────────────────────────────
  if (r.v4_failed) {
    console.log(HR2);
    console.log(`  ⚠️  V4 path failed. Legacy score is authoritative.`);
  }
}

// ── Global summary table ──────────────────────────────────────────────────────

function printSummaryTable(results: DualResult[]): void {
  const success   = results.filter((r) => !r.v4_failed);
  const improved  = success.filter((r) => (r.score_delta ?? 0) > 0);
  const regressed = success.filter ((r) => (r.score_delta ?? 0) < 0);
  const same      = success.filter((r) => r.score_delta === 0);
  const failed    = results.filter((r) => r.v4_failed);

  const deltas     = success.map((r) => r.score_delta ?? 0);
  const avgDelta   = deltas.length > 0
    ? (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1)
    : "—";

  console.log(`\n${HR}`);
  console.log(` GLOBAL SUMMARY  (${results.length} products, ${success.length} V4 successes)`);
  console.log(HR2);
  console.log(`  Score improved (V4 > legacy)  : ${improved.length}`);
  console.log(`  Score same                    : ${same.length}`);
  console.log(`  Score regressed (V4 < legacy) : ${regressed.length}`);
  console.log(`  V4 failed (legacy used)       : ${failed.length}`);
  console.log(`  Average delta                 : ${avgDelta}`);

  // ── Mini score table ─────────────────────────────────────────────────────────
  console.log(HR2);
  const col = (s: string, w: number) => s.substring(0, w).padEnd(w);
  console.log(
    `  ${col("Product", 30)} ${col("Legacy", 7)} ${col("V4", 7)} ${col("Δ", 6)} ${col("SB", 5)} ${col("Loc", 5)} ${col("Unk", 5)} ${col("Cov", 6)}`
  );
  console.log(`  ${"-".repeat(70)}`);

  for (const r of results) {
    const name    = col(r.product_name, 30);
    const leg     = col(String(r.legacy_score.score_0_100), 7);
    const v4s     = r.v4_score    ? col(String(r.v4_score.score_0_100), 7)  : col("—", 7);
    const delta   = r.score_delta !== null
      ? col((r.score_delta >= 0 ? "+" : "") + r.score_delta, 6)
      : col("—", 6);
    const sb      = r.v4_meta ? col(String(r.v4_meta.supabase_count), 5)  : col("—", 5);
    const lc      = r.v4_meta ? col(String(r.v4_meta.local_count), 5)     : col("—", 5);
    const unk     = r.v4_meta ? col(String(r.v4_meta.unknown_count), 5)   : col("—", 5);
    const cov     = r.v4_meta ? col((r.v4_meta.coverage_ratio * 100).toFixed(0) + "%", 6) : col("—", 6);
    const icon    = r.v4_failed ? "❌" : r.score_delta === 0 ? "✅" : r.score_delta! > 0 ? "▲" : "▼";
    console.log(`  ${name} ${leg} ${v4s} ${delta} ${sb} ${lc} ${unk} ${cov}  ${icon}`);
  }

  // ── Interpretation ──────────────────────────────────────────────────────────
  console.log(HR2);
  if (success.length === 0) {
    console.log(`  ⚠️  V4 failed for all products. Check Supabase connection + credentials.`);
  } else if (improved.length === 0 && regressed.length === 0) {
    console.log(`  ℹ️  All scores identical. V4 resolution may not yet add risk_level data.`);
    console.log(`     → Consider running batchInsertLibraryGaps to populate Supabase.`);
    console.log(`     → Then re-run this script to see improvement.`);
  } else {
    if (improved.length > 0) {
      console.log(`  ▲  ${improved.length} product(s) score higher with V4 (more ingredients resolved).`);
    }
    if (regressed.length > 0) {
      console.log(`  ▼  ${regressed.length} product(s) score LOWER with V4 — check per-product output.`);
      console.log(`     This may mean V4 identifies more risk than the legacy engine.`);
    }
    if (same.length > 0) {
      console.log(`  ✅ ${same.length} product(s) unchanged.`);
    }
    console.log(`\n  Ready to enable USE_V4_SCORE_INPUT? Review per-product diffs above.`);
    console.log(`  If scores look correct, set featureFlags.ts → USE_V4_SCORE_INPUT = true.`);
  }

  console.log(`${HR}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`${HR}`);
  console.log(` Dual Score Analysis — Legacy vs V4 (Admin/Debug)`);
  console.log(` USE_V4_SCORE_INPUT = false (production default — unchanged)`);
  console.log(` Fetching 5 products from Supabase…`);
  console.log(`${HR}`);

  const products = await fetchProducts(5);

  if (products.length === 0) {
    console.error("No products with ingredients found. Check Supabase connection.");
    process.exit(1);
  }

  console.log(`Fetched ${products.length} products. Running dual analysis…\n`);

  const results: DualResult[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    process.stdout.write(`  [${i + 1}/${products.length}] ${p.name}… `);
    try {
      const r = await analyzeDual(p);
      results.push(r);
      if (r.v4_failed) {
        console.log(`❌ V4 failed  legacy=${r.legacy_score.score_0_100}`);
      } else {
        const icon = r.score_delta === 0 ? "✅" : r.score_delta! > 0 ? "▲" : "▼";
        console.log(`${icon}  legacy=${r.legacy_score.score_0_100}  v4=${r.v4_score!.score_0_100}  Δ=${r.score_delta! >= 0 ? "+" : ""}${r.score_delta}`);
      }
    } catch (err) {
      console.log(`❌ FATAL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Full per-product detail
  for (let i = 0; i < results.length; i++) {
    printResult(results[i], i);
  }

  // Global summary table
  printSummaryTable(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
