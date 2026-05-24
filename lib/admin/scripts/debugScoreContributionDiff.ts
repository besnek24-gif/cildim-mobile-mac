/**
 * debugScoreContributionDiff.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual verification script: fetches 5 real products from Supabase and prints
 * a per-ingredient score contribution diff (legacy local-registry path vs
 * V4 Supabase+local adapted path).
 *
 * PURPOSE:
 *   Reveal whether identical final scores hide a mapping bug, and pinpoint
 *   which specific ingredients are responsible for any score changes.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/debugScoreContributionDiff.ts
 *
 * WHAT THIS PRINTS PER PRODUCT:
 *   - Final score: legacy vs V4 (same / changed)
 *   - Summary diff: total, high/med/low/safe/unknown per path
 *   - Coverage comparison
 *   - All ingredients where bucket, flags, or category changed
 *   - Adapter warning if Supabase entries still map to "unknown" bucket
 *
 * GLOBAL SUMMARY:
 *   - How many products had score changes
 *   - How many products had mapping changes even with same final score
 *   - Any products with adapter warnings
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT change any live score or resolver
 *   - Does NOT write to any Supabase table (PATH 3 queue is suppressed)
 *   - Does NOT run automatically — manual execution only
 *
 * NODE.JS SAFETY:
 *   Uses createLeanSupabase + resolveIngredientNodeSafe (never supabaseClient.ts).
 *   Imports from ingredientIntelligence (pure TS, no Expo deps).
 *   Imports adaptV4InputToIntelligenceResult from scoreInputAdapter (import type only).
 */

import { createLeanSupabase, resolveIngredientNodeSafe } from "../nodeResolver";
import { analyzeProduct }                from "@/lib/ingredientIntelligence/analyzeProduct";
import { calculateIngredientScore }      from "@/lib/ingredientIntelligence/scoreEngine";
import { parseIngredients }              from "@/lib/ingredientIntelligence/parser";
import { adaptV4InputToIntelligenceResult } from "@/lib/ingredientEngineV4/scoreInputAdapter";
import type { AnalyzedItem }             from "@/lib/ingredientIntelligence/analyzeProduct";
import type { RiskBucket, DecisionSource } from "@/lib/ingredientIntelligence/riskEngine";

// ── Supabase client (lean Node.js client, not supabaseClient.ts) ──────────────

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

interface IngredientDiff {
  raw_name:        string;
  legacy_bucket:   RiskBucket;
  v4_bucket:       RiskBucket;
  legacy_flags:    string[];
  v4_flags:        string[];
  legacy_category: string | null;
  v4_category:     string | null;
  decision_source: DecisionSource;
  v4_source:       "supabase" | "local" | "unknown";
}

interface ContribSummary {
  total_ingredients: number;
  safe_count:        number;
  low_risk_count:    number;
  medium_risk_count: number;
  high_risk_count:   number;
  unknown_count:     number;
  coverage_pct:      number;
  flags:             string[];
  categories:        string[];
}

interface ProductDiffResult {
  product_id:    string;
  product_name:  string;
  brand:         string | null;
  final_score_legacy: number;
  final_score_v4:     number;
  same_final_score:   boolean;
  legacy_summary:     ContribSummary;
  v4_summary:         ContribSummary;
  ingredients_with_different_mapping: IngredientDiff[];
  adapter_warning?: string;
}

// ── Ingredient parser ─────────────────────────────────────────────────────────

function rawToString(raw: ProductRow["ingredients"]): string {
  if (typeof raw === "string")  return raw;
  if (Array.isArray(raw))       return raw.filter(Boolean).join(", ");
  return "";
}

function extractTokens(raw: ProductRow["ingredients"]): string[] {
  const str = rawToString(raw);
  return parseIngredients(str);   // same tokeniser the legacy analyzeProduct uses
}

// ── V4 resolver (node-safe mirror of buildResolvedIngredientScoreInputV4) ──────

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

function buildV4Payload(entries: ResolvedEntry[], rawText: string) {
  const supabaseCount = entries.filter((e) => e.source === "supabase").length;
  const localCount    = entries.filter((e) => e.source === "local").length;
  const unknownCount  = entries.filter ((e) => e.source === "unknown").length;
  const total         = entries.length;

  // Shape mirrors ResolvedScoreInputV4 (structural typing — no import needed)
  const v4Payload = {
    total_count:          total,
    resolved_count:       supabaseCount + localCount,
    supabase_count:       supabaseCount,
    local_count:          localCount,
    unknown_count:        unknownCount,
    coverage_ratio:       total > 0 ? (supabaseCount + localCount) / total : 0,
    resolved_ingredients: entries,
    unknown_ingredients:  entries.filter((e) => e.source === "unknown"),
  };

  // adaptV4InputToIntelligenceResult accepts structural type — works here
  return { v4Payload, v4Analysis: adaptV4InputToIntelligenceResult(v4Payload as any, rawText) };
}

// ── Summary builder ───────────────────────────────────────────────────────────

function buildSummary(items: AnalyzedItem[]): ContribSummary {
  const total = items.length;
  let safe = 0, low = 0, med = 0, high = 0, unknown = 0, matched = 0;
  const flags:      Set<string> = new Set();
  const categories: Set<string> = new Set();

  for (const item of items) {
    if (item.matched) matched++;
    switch (item.bucket) {
      case "safe":        safe++;    break;
      case "low_risk":    low++;     break;
      case "medium_risk": med++;     break;
      case "high_risk":   high++;    break;
      default:            unknown++; break;
    }
    for (const f of item.flags) flags.add(f);
    if (item.category)           categories.add(item.category);
  }

  return {
    total_ingredients: total,
    safe_count:        safe,
    low_risk_count:    low,
    medium_risk_count: med,
    high_risk_count:   high,
    unknown_count:     unknown,
    coverage_pct:      total > 0 ? Math.round((matched / total) * 100) : 0,
    flags:             [...flags].sort(),
    categories:        [...categories].sort(),
  };
}

// ── Diff logic ────────────────────────────────────────────────────────────────

function computeDiff(
  legacyItems: AnalyzedItem[],
  v4Items:     AnalyzedItem[],
  v4Entries:   ResolvedEntry[]
): IngredientDiff[] {
  const legacyByRaw = new Map(legacyItems.map((i) => [i.raw, i]));
  const v4ByRaw     = new Map(v4Items.map((i) => [i.raw, i]));
  const sourceByRaw = new Map(v4Entries.map((e) => [e.raw_name, e.source]));

  const diffs: IngredientDiff[] = [];

  for (const [raw, v4item] of v4ByRaw) {
    const legItem = legacyByRaw.get(raw);
    if (!legItem) continue;

    const bucketSame   = legItem.bucket   === v4item.bucket;
    const categorySame = legItem.category === v4item.category;
    const flagsSorted  = (a: string[]) => [...a].sort().join(",");
    const flagsSame    = flagsSorted(legItem.flags) === flagsSorted(v4item.flags);

    if (!bucketSame || !categorySame || !flagsSame) {
      diffs.push({
        raw_name:        raw,
        legacy_bucket:   legItem.bucket,
        v4_bucket:       v4item.bucket,
        legacy_flags:    legItem.flags,
        v4_flags:        v4item.flags,
        legacy_category: legItem.category,
        v4_category:     v4item.category,
        decision_source: v4item.decision_source,
        v4_source:       (sourceByRaw.get(raw) ?? "unknown") as "supabase" | "local" | "unknown",
      });
    }
  }
  return diffs;
}

// ── Adapter warning ───────────────────────────────────────────────────────────

function detectAdapterWarning(v4Entries: ResolvedEntry[]): string | undefined {
  const supabaseNullRisk = v4Entries.filter(
    (e) => e.source === "supabase" && e.risk_level === null
  );
  if (supabaseNullRisk.length === 0) return undefined;

  const names = supabaseNullRisk
    .map((e) => e.canonical_name ?? e.raw_name)
    .slice(0, 5)
    .join(", ");
  const extra = supabaseNullRisk.length > 5
    ? ` +${supabaseNullRisk.length - 5} more` : "";
  return (
    `${supabaseNullRisk.length} Supabase-resolved ingredient(s) have NULL risk_level ` +
    `→ still map to 'unknown' bucket. Check ingredients_master: ${names}${extra}`
  );
}

// ── Product fetcher ───────────────────────────────────────────────────────────

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
    const str = rawToString(p.ingredients);
    return str.trim().length > 30;
  });

  return valid.slice(0, count);
}

// ── Per-product analysis ──────────────────────────────────────────────────────

async function analyzeProductDiff(product: ProductRow): Promise<ProductDiffResult> {
  const rawText = rawToString(product.ingredients);
  const tokens  = extractTokens(product.ingredients);

  // Legacy path
  const legacyAnalysis = analyzeProduct(rawText, product.id);
  const legacyScore    = calculateIngredientScore(legacyAnalysis);

  // V4 path (node-safe: resolveIngredientNodeSafe)
  const v4Entries              = await Promise.all(tokens.map(resolveOne));
  const { v4Analysis }         = buildV4Payload(v4Entries, rawText);
  const v4Score                = calculateIngredientScore(v4Analysis);

  const diffs          = computeDiff(legacyAnalysis.items, v4Analysis.items, v4Entries);
  const adapterWarning = detectAdapterWarning(v4Entries);

  return {
    product_id:    product.id,
    product_name:  product.name,
    brand:         product.brand,
    final_score_legacy: legacyScore.score_0_100,
    final_score_v4:     v4Score.score_0_100,
    same_final_score:   legacyScore.score_0_100 === v4Score.score_0_100,
    legacy_summary:     buildSummary(legacyAnalysis.items),
    v4_summary:         buildSummary(v4Analysis.items),
    ingredients_with_different_mapping: diffs,
    adapter_warning: adapterWarning,
  };
}

// ── Printer ───────────────────────────────────────────────────────────────────

function pct(n: number): string { return n + "%"; }

function deltaStr(a: number, b: number): string {
  if (b > a) return `${a} → ${b} ▲ +${b - a}`;
  if (b < a) return `${a} → ${b} ▼ -${a - b}`;
  return `${a} (no change)`;
}

function flagStr(same: boolean): string { return same ? "✅" : "⚠️"; }

function printResult(r: ProductDiffResult, idx: number): void {
  const L = r.legacy_summary;
  const V = r.v4_summary;
  const scoreIcon = r.same_final_score ? "✅" : "⚠️ CHANGED";

  console.log(`\n${"═".repeat(68)}`);
  console.log(` Product ${idx + 1}: ${r.product_name}`);
  console.log(`  Brand  : ${r.brand ?? "—"}`);
  console.log(`  ID     : ${r.product_id}`);
  console.log(`${"─".repeat(68)}`);

  // Final score
  console.log(`  FINAL SCORE   : ${scoreIcon}`);
  console.log(`    Legacy  : ${r.final_score_legacy}`);
  console.log(`    V4      : ${r.final_score_v4}`);
  console.log(`    Delta   : ${deltaStr(r.final_score_legacy, r.final_score_v4)}`);

  // Summary diff
  console.log(`${"─".repeat(68)}`);
  console.log(`  BUCKET COUNTS           Legacy     V4`);
  console.log(`    Total ingredients   : ${String(L.total_ingredients).padStart(6)}   ${String(V.total_ingredients).padStart(6)}`);
  console.log(`    safe                : ${String(L.safe_count       ).padStart(6)}   ${String(V.safe_count       ).padStart(6)}  ${flagStr(L.safe_count        === V.safe_count)}`);
  console.log(`    low_risk            : ${String(L.low_risk_count   ).padStart(6)}   ${String(V.low_risk_count   ).padStart(6)}  ${flagStr(L.low_risk_count    === V.low_risk_count)}`);
  console.log(`    medium_risk         : ${String(L.medium_risk_count).padStart(6)}   ${String(V.medium_risk_count).padStart(6)}  ${flagStr(L.medium_risk_count === V.medium_risk_count)}`);
  console.log(`    high_risk           : ${String(L.high_risk_count  ).padStart(6)}   ${String(V.high_risk_count  ).padStart(6)}  ${flagStr(L.high_risk_count   === V.high_risk_count)}`);
  console.log(`    unknown             : ${String(L.unknown_count    ).padStart(6)}   ${String(V.unknown_count    ).padStart(6)}  ${flagStr(L.unknown_count     === V.unknown_count)}`);
  console.log(`    coverage            : ${pct(L.coverage_pct).padStart(6)}   ${pct(V.coverage_pct).padStart(6)}`);

  // Flags
  const legacyFlagStr = L.flags.length > 0 ? L.flags.join(", ") : "(none)";
  const v4FlagStr     = V.flags.length > 0 ? V.flags.join(", ") : "(none)";
  console.log(`${"─".repeat(68)}`);
  console.log(`  FLAGS`);
  console.log(`    Legacy  : ${legacyFlagStr}`);
  console.log(`    V4      : ${v4FlagStr}`);

  // Changed mappings
  console.log(`${"─".repeat(68)}`);
  if (r.ingredients_with_different_mapping.length === 0) {
    console.log(`  MAPPING DIFF: none — all ingredients map identically`);
    if (r.same_final_score) {
      console.log(`  → Same final score + same mappings: paths are equivalent`);
    } else {
      console.log(`  ⚠️  Different final scores but no mapping diffs → check summary counts`);
    }
  } else {
    const count = r.ingredients_with_different_mapping.length;
    const icon = r.same_final_score ? "ℹ️" : "⚠️";
    console.log(`  MAPPING DIFF: ${icon} ${count} ingredient(s) changed`);
    if (r.same_final_score) {
      console.log(`  → Note: Mapping changes exist but final score is SAME — changes cancel out`);
    }
    for (const d of r.ingredients_with_different_mapping) {
      const bucketChanged   = d.legacy_bucket !== d.v4_bucket ? " ← BUCKET" : "";
      const flagChanged     = JSON.stringify([...d.legacy_flags].sort()) !== JSON.stringify([...d.v4_flags].sort()) ? " ← FLAGS" : "";
      const categoryChanged = d.legacy_category !== d.v4_category ? " ← CAT" : "";
      console.log(`    ┌ "${d.raw_name}"`);
      console.log(`    │  source    : ${d.v4_source} (${d.decision_source})`);
      console.log(`    │  bucket    : ${d.legacy_bucket} → ${d.v4_bucket}${bucketChanged}`);
      console.log(`    │  flags     : [${d.legacy_flags.join(",")||"—"}] → [${d.v4_flags.join(",")||"—"}]${flagChanged}`);
      console.log(`    └  category  : ${d.legacy_category ?? "null"} → ${d.v4_category ?? "null"}${categoryChanged}`);
    }
  }

  // Adapter warning
  if (r.adapter_warning) {
    console.log(`${"─".repeat(68)}`);
    console.log(`  ⚠️  ADAPTER WARNING:`);
    console.log(`  ${r.adapter_warning}`);
  }
}

// ── Global summary ────────────────────────────────────────────────────────────

function printGlobalSummary(results: ProductDiffResult[]): void {
  const scoreChanged     = results.filter((r) => !r.same_final_score);
  const mappingChanged   = results.filter((r) => r.ingredients_with_different_mapping.length > 0);
  const adapterWarnings  = results.filter((r) => !!r.adapter_warning);
  const sameScoreDiffMap = results.filter(
    (r) => r.same_final_score && r.ingredients_with_different_mapping.length > 0
  );

  console.log(`\n${"═".repeat(68)}`);
  console.log(` GLOBAL SUMMARY (${results.length} products)`);
  console.log(`${"─".repeat(68)}`);
  console.log(`  Final score changed     : ${scoreChanged.length}/${results.length}`);
  console.log(`  Mapping changes         : ${mappingChanged.length}/${results.length} products`);
  console.log(`  Adapter warnings        : ${adapterWarnings.length}/${results.length} products`);

  if (sameScoreDiffMap.length > 0) {
    console.log(`${"─".repeat(68)}`);
    console.log(`  ℹ️  ${sameScoreDiffMap.length} product(s) have SAME final score but DIFFERENT ingredient`);
    console.log(`     mappings — changes cancel out. This is acceptable if:`);
    console.log(`     - newly-resolved low-risk ingredients offset newly-resolved unknowns`);
    console.log(`     - no single bucket changed by a large amount`);
    for (const r of sameScoreDiffMap) {
      const n = r.ingredients_with_different_mapping.length;
      console.log(`     • ${r.product_name}: ${n} mapping change(s)`);
    }
  }

  if (adapterWarnings.length > 0) {
    console.log(`${"─".repeat(68)}`);
    console.log(`  ⚠️  Adapter warnings present: Supabase entries without risk_level data.`);
    console.log(`     These don't improve over legacy — populate risk_level in ingredients_master.`);
    for (const r of adapterWarnings) {
      console.log(`     • ${r.product_name}: ${r.adapter_warning}`);
    }
  }

  if (scoreChanged.length === 0 && mappingChanged.length === 0) {
    console.log(`\n  ✅ All ${results.length} products: identical score + identical mappings.`);
    console.log(`     The adapter produces no change yet — likely because Supabase`);
    console.log(`     risk_level data is not yet populated. This is expected at this stage.`);
  } else if (scoreChanged.length === 0) {
    console.log(`\n  ✅ Final scores: no change across all products.`);
    console.log(`  ℹ️  Some mappings differ — review per-product output above.`);
  } else {
    console.log(`\n  ⚠️  ${scoreChanged.length} product(s) have score changes. Review diffs above.`);
  }

  console.log(`${"═".repeat(68)}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`${"═".repeat(68)}`);
  console.log(` Score Contribution Diff — Legacy vs V4`);
  console.log(` Fetching 5 products from Supabase…`);
  console.log(`${"═".repeat(68)}`);

  const products = await fetchProducts(5);

  if (products.length === 0) {
    console.error("No products with ingredients found. Check Supabase connection.");
    process.exit(1);
  }

  console.log(`Fetched ${products.length} products. Running diff analysis…\n`);

  const results: ProductDiffResult[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    process.stdout.write(`  [${i + 1}/${products.length}] ${p.name}… `);
    try {
      const result = await analyzeProductDiff(p);
      results.push(result);
      const icon = result.same_final_score ? "✅" : "⚠️";
      const diffCount = result.ingredients_with_different_mapping.length;
      console.log(`${icon} score=${result.final_score_legacy}→${result.final_score_v4} diffs=${diffCount}`);
    } catch (err) {
      console.log(`❌ ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Print full report
  for (let i = 0; i < results.length; i++) {
    printResult(results[i], i);
  }

  // Print global summary
  printGlobalSummary(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
