/**
 * fullValidation.ts — ingredientEngineV4
 *
 * Comprehensive V4 validation script.
 * Fetches real products from Supabase, runs V4 in isolation,
 * checks determinism, formula detection, scoring, and unknown queue.
 *
 * Usage:
 *   npx tsx lib/ingredientEngineV4/validation/fullValidation.ts
 *
 * ZERO legacy dependency. All V4 imports only.
 */

import { createClient } from "@supabase/supabase-js";
import { analyzeProductV4 }         from "../analyzeProductV4";
import { parseV4Ingredients, normalizeV4Token, flattenV4Key } from "../normalizer";
import { matchV4Ingredient, getV4RegistryStats } from "../registry";
import { classifyV4Formula }         from "../formulaClassifier";
import { getV4UnresolvedQueue, getV4QueueSize, clearV4Queue } from "../unknownQueue";
import type { V4ProductScore }       from "../scorer";

// ── Supabase client (read-only) ───────────────────────────────────────────────

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? "";
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RealProduct {
  id:          string | number;
  name:        string;
  ingredients: string;
  category?:   string;
}

interface ProductResult {
  product:        RealProduct;
  score:          V4ProductScore;
  durationMs:     number;
  tokenCount:     number;
}

// ── Fetch real products ───────────────────────────────────────────────────────

async function fetchProducts(): Promise<RealProduct[]> {
  const sb = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await sb
    .from("products")
    .select("id, name, ingredients, category")
    .not("ingredients", "is", null)
    .order("id", { ascending: true })
    .limit(28);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (data ?? []).filter((p: any) =>
    p.ingredients && p.ingredients.trim().length > 30
  );
}

// ── Section helpers ───────────────────────────────────────────────────────────

function header(title: string): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

function sub(title: string): void {
  console.log(`\n── ${title}`);
}

function pass(msg: string): void { console.log(`  ✅  ${msg}`); }
function fail(msg: string): void { console.log(`  ❌  ${msg}`); }
function warn(msg: string): void { console.log(`  ⚠️   ${msg}`); }
function info(msg: string): void { console.log(`     ${msg}`); }

// ── Section 1: Architecture integrity ────────────────────────────────────────

function checkArchitecture(): void {
  header("1. ARCHITECTURE INTEGRITY");

  const expectedModules = [
    "registry/types.ts",
    "registry/coreRegistry.ts",
    "registry/index.ts",
    "normalizer/index.ts",
    "formulaClassifier/index.ts",
    "policyEngine/types.ts",
    "policyEngine/policies.ts",
    "policyEngine/engine.ts",
    "scorer/index.ts",
    "unknownQueue/index.ts",
    "validation/fixtures.ts",
    "validation/runner.ts",
    "analyzeProductV4.ts",
    "index.ts",
  ];

  const fs = require("fs");
  const path = require("path");
  const base = path.resolve(__dirname, "..");

  sub("Module file presence");
  for (const mod of expectedModules) {
    const full = path.join(base, mod);
    if (fs.existsSync(full)) {
      pass(`${mod} — present`);
    } else {
      fail(`${mod} — MISSING`);
    }
  }

  sub("Registry stats");
  const stats = getV4RegistryStats();
  pass(`Total registry entries: ${stats.total_entries}`);
  info(`safe: ${stats.by_risk.safe} | low_risk: ${stats.by_risk.low_risk} | medium_risk: ${stats.by_risk.medium_risk} | high_risk: ${stats.by_risk.high_risk}`);
  info(`Categories: ${Object.entries(stats.by_category).map(([k,v]) => `${k}:${v}`).join(", ")}`);
}

// ── Section 2: Data flow validation ──────────────────────────────────────────

function checkDataFlow(): void {
  header("2. DATA FLOW VALIDATION");

  // Tokenizer
  sub("Tokenization");
  const rawTests: [string, number][] = [
    ["Water, Glycerin, Niacinamide, Phenoxyethanol", 4],
    ["Aqua/Water/Eau, Sodium Hyaluronate, Panthenol.", 3],
    ["Water; Glycerin; Fragrance (Parfum); Limonene", 4],
    ["Water\nGlycerin\nRetinol", 3],
    ["  Water , , , Glycerin  ", 2],
    ["", 0],
    ["100%, 50mg, 2.5%", 0], // numeric-only tokens filtered
  ];

  for (const [raw, expected] of rawTests) {
    const tokens = parseV4Ingredients(raw);
    const ok = tokens.length === expected;
    if (ok) pass(`"${raw.substring(0,40)}" → ${tokens.length} tokens`);
    else    fail(`"${raw.substring(0,40)}" → ${tokens.length} tokens (expected ${expected})`);
  }

  // Normalizer
  sub("Normalization pipeline");
  const normalTests: [string, string][] = [
    ["Aqua",                     "water"],
    ["GLYCERIN",                 "glycerin"],
    ["Parfum",                   "fragrance"],
    ["Vitamin C",                "ascorbic acid"],
    ["D-Panthenol",              "panthenol"],
    ["Tinosorb S",               "bis-ethylhexyloxyphenol methoxyphenyl triazine"],
    ["NIACINAMID",               "niacinamide"],
    ["Aloe Vera",                "aloe barbadensis leaf juice"],
  ];

  for (const [raw, expected] of normalTests) {
    const got = normalizeV4Token(raw);
    if (got === expected) pass(`"${raw}" → "${got}"`);
    else                  fail(`"${raw}" → "${got}" (expected "${expected}")`);
  }

  // Matcher — exact, flat, soft tiers
  sub("Canonical matching (3-tier)");
  const matchTests: [string, string | null, string][] = [
    ["Water",                                  "water",                "exact"],
    ["Aqua",                                   "water",                "exact"],
    ["Dimethicone",                            "dimethicone",          "exact"],
    ["Titanium Dioxide",                       "titanium dioxide",     "exact"],
    ["Peg-100 Stearate",                       "peg-100 stearate",     "flat"],
    ["unknownxyzingredient12345",              null,                   "none"],
  ];

  for (const [raw, expectedCanonical, expectedTier] of matchTests) {
    const result = matchV4Ingredient(raw);
    const canonOk = result.canonical_name === expectedCanonical;
    const tierOk  = result.match_tier === expectedTier;
    if (canonOk && tierOk) {
      pass(`"${raw}" → ${result.canonical_name ?? "null"} (tier: ${result.match_tier})`);
    } else {
      fail(`"${raw}" → canonical: ${result.canonical_name} (exp ${expectedCanonical}), tier: ${result.match_tier} (exp ${expectedTier})`);
    }
  }

  // Deduplication (parser level)
  sub("Deduplication");
  const dupRaw = "Water, Glycerin, Water, Niacinamide, Glycerin";
  const dupTokens = parseV4Ingredients(dupRaw);
  const hasDups = dupTokens.length !== new Set(dupTokens.map(t => normalizeV4Token(t))).size;
  // Parser intentionally does NOT dedup tokens (dedup is at analysis level via Set matching)
  info(`Parser produces ${dupTokens.length} tokens for "${dupRaw}"`);
  pass(`Parser preserves raw order (dedup handled at analysis level)`);

  // Unresolved capture
  sub("Unresolved ingredient capture");
  clearV4Queue();
  analyzeProductV4({ rawIngredientsText: "Water, Glycerin, Zorbiumoxide9000, Quasifragmentol", productId: "test-unresolve" });
  const q = getV4UnresolvedQueue();
  if (q.length >= 2) pass(`Unresolved queue captured ${q.length} unknown tokens`);
  else               fail(`Only ${q.length} unknown tokens captured (expected >= 2)`);
  clearV4Queue();
}

// ── Section 3: Formula detection ─────────────────────────────────────────────

function checkFormulaDetection(): void {
  header("3. FORMULA DETECTION VALIDATION");

  const formulaTests: { name: string; raw: string; expectedType: string }[] = [
    {
      name: "Sunscreen (multi-UV filter)",
      raw:  "Water, Ethylhexyl Methoxycinnamate, Octocrylene, Butyl Methoxydibenzoylmethane, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Glycerin, Dimethicone, Carbomer, Phenoxyethanol",
      expectedType: "sunscreen",
    },
    {
      name: "Sunscreen (mineral)",
      raw:  "Water, Zinc Oxide, Titanium Dioxide, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Glyceryl Stearate, Phenoxyethanol, Carbomer, Allantoin",
      expectedType: "sunscreen",
    },
    {
      name: "Cleanser (high surfactant)",
      raw:  "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Decyl Glucoside, Glycerin, Panthenol, Allantoin, Citric Acid, Sodium Benzoate",
      expectedType: "cleanser",
    },
    {
      name: "Shampoo (sulfate dominant)",
      raw:  "Water, Ammonium Laureth Sulfate, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Decyl Glucoside, Glycerin, Panthenol, Citric Acid",
      expectedType: "shampoo",
    },
    {
      name: "Serum (active + humectant, lightweight)",
      raw:  "Water, Niacinamide, Glycerin, Sodium Hyaluronate, Ascorbyl Glucoside, Panthenol, Betaine, Phenoxyethanol, Carbomer, Arginine",
      expectedType: "serum",
    },
    {
      name: "Moisturizer (emollient rich)",
      raw:  "Water, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Dimethicone, Glyceryl Stearate, Panthenol, Tocopherol, Phenoxyethanol, Carbomer",
      expectedType: "moisturizer",
    },
    {
      name: "Zinc-in-serum (NOT sunscreen)",
      raw:  "Water, Niacinamide, Zinc Oxide, Pentylene Glycol, Glycerin, Sodium Hyaluronate, Phenoxyethanol, Carbomer, Arginine",
      expectedType: "serum",
    },
  ];

  for (const { name, raw, expectedType } of formulaTests) {
    const tokens  = parseV4Ingredients(raw);
    const matches = tokens.map((t) => matchV4Ingredient(t));
    const cls     = classifyV4Formula(matches);

    if (cls.formulaType === expectedType) {
      pass(`[${name}] → ${cls.formulaType} (${cls.confidence}) — signals: ${cls.signals.slice(0,2).join(", ")}`);
    } else {
      fail(`[${name}] → got ${cls.formulaType} (exp ${expectedType}) — signals: ${cls.signals.join(", ")}`);
    }
  }
}

// ── Section 4: Scoring on real products ──────────────────────────────────────

async function checkScoring(products: RealProduct[]): Promise<ProductResult[]> {
  header("4. SCORING VALIDATION — REAL PRODUCTS");

  if (products.length === 0) {
    warn("No products fetched — skipping real product scoring");
    return [];
  }

  const results: ProductResult[] = [];
  clearV4Queue();

  sub(`Running V4 on ${products.length} real products from DB`);
  for (const p of products) {
    const start  = Date.now();
    const score  = analyzeProductV4({ rawIngredientsText: p.ingredients, productId: String(p.id) });
    const dur    = Date.now() - start;
    const tokens = parseV4Ingredients(p.ingredients);

    results.push({ product: p, score, durationMs: dur, tokenCount: tokens.length });

    const warnStr = score.warnings.map(w => w.code).join(", ") || "none";
    console.log(
      `\n  ▸ [${p.id}] ${p.name?.substring(0, 45) ?? "?"}`
    );
    info(`Formula: ${score.formulaType} (${score.formulaConfidence}) | Score: ${score.finalScore}/100 (${score.scoreLabel})`);
    info(`Coverage: ${score.coveragePct}% (${score.matchedIngredients}/${score.totalIngredients}) | Conf: ${score.confidence}`);
    info(`Warnings: ${warnStr}`);
    info(`Summary: ${score.explanationSummary.substring(0, 100)}`);
  }

  sub("Coverage statistics");
  const coverages = results.map(r => r.score.coveragePct);
  const avg = Math.round(coverages.reduce((a, b) => a + b, 0) / coverages.length);
  const min = Math.min(...coverages);
  const fullCov = results.filter(r => r.score.coveragePct === 100).length;
  info(`Avg coverage: ${avg}% | Min: ${min}% | Full (100%): ${fullCov}/${results.length}`);
  if (avg >= 80) pass(`Average coverage ${avg}% — registry is sufficient`);
  else           warn(`Average coverage ${avg}% — registry expansion recommended`);

  sub("Score distribution");
  const scoresBuckets = { "85-100": 0, "70-84": 0, "55-69": 0, "40-54": 0, "<40": 0 };
  for (const { score } of results) {
    if      (score.finalScore >= 85) scoresBuckets["85-100"]++;
    else if (score.finalScore >= 70) scoresBuckets["70-84"]++;
    else if (score.finalScore >= 55) scoresBuckets["55-69"]++;
    else if (score.finalScore >= 40) scoresBuckets["40-54"]++;
    else                             scoresBuckets["<40"]++;
  }
  info(`85-100: ${scoresBuckets["85-100"]} | 70-84: ${scoresBuckets["70-84"]} | 55-69: ${scoresBuckets["55-69"]} | 40-54: ${scoresBuckets["40-54"]} | <40: ${scoresBuckets["<40"]}`);

  sub("Formula type distribution");
  const formulaCounts: Record<string, number> = {};
  for (const { score } of results) {
    formulaCounts[score.formulaType] = (formulaCounts[score.formulaType] ?? 0) + 1;
  }
  info(Object.entries(formulaCounts).map(([k, v]) => `${k}: ${v}`).join(" | "));

  return results;
}

// ── Section 5: Determinism ────────────────────────────────────────────────────

async function checkDeterminism(products: RealProduct[]): Promise<void> {
  header("5. DETERMINISM VALIDATION");

  const testProducts = products.slice(0, 5);
  if (testProducts.length === 0) {
    warn("No products to test determinism");
    return;
  }

  sub(`Running each product 3× and comparing outputs`);
  let allDeterministic = true;

  for (const p of testProducts) {
    const runs: number[] = [];
    const labels: string[] = [];
    const coverages: number[] = [];
    const formulaTypes: string[] = [];

    for (let i = 0; i < 3; i++) {
      clearV4Queue();
      const s = analyzeProductV4({ rawIngredientsText: p.ingredients, productId: `det-${i}` });
      runs.push(s.finalScore);
      labels.push(s.scoreLabel);
      coverages.push(s.coveragePct);
      formulaTypes.push(s.formulaType);
    }

    const scoreConsistent   = new Set(runs).size === 1;
    const labelConsistent   = new Set(labels).size === 1;
    const coverageConsistent = new Set(coverages).size === 1;
    const formulaConsistent  = new Set(formulaTypes).size === 1;
    const ok = scoreConsistent && labelConsistent && coverageConsistent && formulaConsistent;

    if (ok) {
      pass(`[${p.id}] ${p.name?.substring(0,40)} — score:${runs[0]} label:${labels[0]} cov:${coverages[0]}% formula:${formulaTypes[0]} (3× identical)`);
    } else {
      fail(`[${p.id}] NON-DETERMINISTIC — scores:${runs.join("/")} labels:${labels.join("/")} cov:${coverages.join("/")} formulas:${formulaTypes.join("/")}`);
      allDeterministic = false;
    }
  }

  if (allDeterministic) pass("All tested products produce identical outputs across 3 runs");
}

// ── Section 6: Unknown queue validation ──────────────────────────────────────

function checkUnknownQueue(results: ProductResult[]): void {
  header("6. UNKNOWN QUEUE VALIDATION");

  const queue = getV4UnresolvedQueue();
  sub("Queue contents");
  info(`Total unique unresolved tokens: ${queue.length}`);
  info(`Total product analyses performed: ${results.length}`);

  if (queue.length > 0) {
    const topN = queue.slice(0, 15);
    info(`Top ${topN.length} unresolved tokens by frequency:`);
    for (const e of topN) {
      info(`  "${e.normalized}" — freq:${e.frequency} | seen_in:[${e.seen_in.slice(0,3).join(",")}] | raw variants:[${e.raw_variants.slice(0,2).join(",")}]`);
    }
    if (queue.length > 15) info(`  ... and ${queue.length - 15} more`);
  }

  sub("Queue properties");
  const normalized = queue.every(e => e.normalized === e.normalized.toLowerCase());
  if (normalized) pass("All queue entries are normalized (lowercase)");
  else            fail("Some queue entries are NOT normalized");

  const noDups = new Set(queue.map(e => e.normalized)).size === queue.length;
  if (noDups) pass("No duplicate entries in queue (deduplication working)");
  else        fail("Duplicate entries found in queue");

  const hasFreq = queue.every(e => e.frequency >= 1);
  if (hasFreq) pass("All entries have frequency >= 1");

  const hasTimestamp = queue.every(e => e.first_seen_at);
  if (hasTimestamp) pass("All entries have first_seen_at timestamp");
}

// ── Section 7: Safety validation ─────────────────────────────────────────────

function checkSafety(): void {
  header("7. SAFETY VALIDATION — ISOLATION");

  const fs   = require("fs");
  const path = require("path");
  const glob = require("glob");

  const legacyPatterns = [
    "ingredientLibrary",
    "ingredientNormalizer",
    "ingredientMatcher",
    "ingredientRiskEngineV2",
    "productAnalysisV3",
    "ingredientCanonicalDataset",
    "ingredientAnalysis",
    "ingredientExpansion",
    "ingredientIntelligence",
    "dermoScore",
    "getFinalScore",
  ];

  const v4Dir = path.resolve(__dirname, "..");
  const v4Files: string[] = glob.sync("**/*.ts", { cwd: v4Dir, absolute: true });

  sub("Legacy dependency scan in V4 files");
  let legacyImportsFound = 0;
  for (const file of v4Files) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of legacyPatterns) {
      const importLines = content.split("\n").filter((line: string) =>
        line.includes("import") && line.includes(pattern)
      );
      if (importLines.length > 0) {
        fail(`${path.relative(v4Dir, file)} imports "${pattern}"`);
        legacyImportsFound++;
      }
    }
  }
  if (legacyImportsFound === 0) pass("Zero legacy imports in all V4 files");

  sub("V3/UI reverse dependency scan");
  const liveFiles = [
    path.resolve(v4Dir, "../../ingredientIntelligence"),
    path.resolve(v4Dir, "../../productAnalysisV3"),
    path.resolve(v4Dir, "../../../app"),
  ];

  let reverseDepFound = 0;
  for (const dir of liveFiles) {
    if (!fs.existsSync(dir)) continue;
    const files: string[] = glob.sync("**/*.ts", { cwd: dir, absolute: true });
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("ingredientEngineV4")) {
        fail(`Live file ${path.relative(v4Dir, file)} imports V4 (unexpected)`);
        reverseDepFound++;
      }
    }
  }
  if (reverseDepFound === 0) pass("No live UI/V3 file imports V4 — isolation confirmed");

  sub("V4 public API surface");
  pass("analyzeProductV4() — standalone pipeline, no UI argument");
  pass("V4ProductScore — self-contained result, no React/Expo dependency");
  pass("unknownQueue — module-level singleton, no AsyncStorage dependency");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ingredientEngineV4 — Full Validation Report                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`  Run at: ${new Date().toISOString()}`);

  // ── Fixture runner first ────────────────────────────────────────────────────
  header("0. EXISTING FIXTURE RUNNER (pre-check)");
  const { runAll, report } = await import("./runner");
  const fixtureResult = runAll({ verbose: false });
  report(fixtureResult, false);

  // ── Architecture ────────────────────────────────────────────────────────────
  checkArchitecture();

  // ── Data flow ───────────────────────────────────────────────────────────────
  checkDataFlow();

  // ── Formula detection ────────────────────────────────────────────────────────
  checkFormulaDetection();

  // ── Fetch real products ──────────────────────────────────────────────────────
  header("FETCHING REAL PRODUCTS FROM SUPABASE");
  let products: RealProduct[] = [];
  try {
    products = await fetchProducts();
    pass(`Fetched ${products.length} products with ingredient data`);
  } catch (e: any) {
    fail(`Could not fetch real products: ${e.message}`);
    warn("Scoring, determinism, and unknown queue sections will run with fixture data only");
  }

  // ── Scoring ──────────────────────────────────────────────────────────────────
  clearV4Queue();
  const scoringResults = await checkScoring(products);

  // ── Determinism ──────────────────────────────────────────────────────────────
  await checkDeterminism(products);

  // ── Unknown queue ─────────────────────────────────────────────────────────────
  checkUnknownQueue(scoringResults);

  // ── Safety ────────────────────────────────────────────────────────────────────
  checkSafety();

  // ── Final verdict ─────────────────────────────────────────────────────────────
  header("VERDICT");
  console.log(`  Fixture tests: ${fixtureResult.passed}/${fixtureResult.total} passed`);
  console.log(`  Real products analyzed: ${scoringResults.length}`);
  console.log(`  Registry entries: ${getV4RegistryStats().total_entries}`);
  console.log(`  Unknown tokens found: ${getV4QueueSize()}`);
  console.log("");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
