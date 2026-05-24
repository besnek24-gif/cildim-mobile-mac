/**
 * verifyScoreInputBuilder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual verification script: fetches 3 real products from Supabase, runs
 * the equivalent of buildResolvedIngredientScoreInputV4 on each, and prints
 * a clear resolved ingredient summary.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/verifyScoreInputBuilder.ts
 *
 * WHAT THIS DOES:
 *   - Fetches 3 real products with ingredient lists from Supabase
 *   - Resolves each ingredient via shared nodeResolver (PATH 1/1b → PATH 2/2b)
 *   - Prints a per-product resolved summary (total, supabase, local, unknown)
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT calculate a score
 *   - Does NOT modify the live score engine
 *   - Does NOT write to ingredient_unknown_queue (PATH 3 suppressed)
 *   - Does NOT run automatically — manual execution only
 *
 * RESOLUTION PATH: shared nodeResolver — mirrors real resolveIngredientV4 exactly
 */

import { createLeanSupabase, resolveIngredientNodeSafe } from "../nodeResolver";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Ingredient string parser ───────────────────────────────────────────────────

function parseIngredientString(raw: string): string[] {
  // Dalga E1 / Phase 1.b — delegate to shared safe INCI tokenizer.
  return tokenizeInciList(raw);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceType = "supabase" | "local" | "unknown";

interface ResolvedEntry {
  raw_name:           string;
  source:             SourceType;
  canonical_name:     string | null;
  risk_level:         string | null;
  concern_flags:      string[];
  function_tags:      string[];
  pregnancy_flag:     string | null;
  breastfeeding_flag: string | null;
  allergy_flag:       string | null;
}

interface ScoreInputSummary {
  total_count:          number;
  resolved_count:       number;
  supabase_count:       number;
  local_count:          number;
  unknown_count:        number;
  coverage_ratio:       number;
  resolved_ingredients: ResolvedEntry[];
  unknown_ingredients:  ResolvedEntry[];
}

// ── Shared resolver (mirrors resolveIngredientV4, PATH 3 suppressed) ──────────

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

// ── buildScoreInput (mirrors buildResolvedIngredientScoreInputV4) ──────────────

async function buildScoreInput(rawIngredients: string[]): Promise<ScoreInputSummary> {
  const entries = await Promise.all(rawIngredients.map(resolveOne));

  const supabaseCount = entries.filter((e) => e.source === "supabase").length;
  const localCount    = entries.filter((e) => e.source === "local").length;
  const unknownCount  = entries.filter((e) => e.source === "unknown").length;
  const resolvedCount = supabaseCount + localCount;
  const total         = rawIngredients.length;

  return {
    total_count:          total,
    resolved_count:       resolvedCount,
    supabase_count:       supabaseCount,
    local_count:          localCount,
    unknown_count:        unknownCount,
    coverage_ratio:       total > 0 ? resolvedCount / total : 0,
    resolved_ingredients: entries,
    unknown_ingredients:  entries.filter((e) => e.source === "unknown"),
  };
}

// ── Product fetcher ───────────────────────────────────────────────────────────

interface ProductRow {
  id:          string;
  name:        string;
  brand:       string | null;
  ingredients: string | string[] | null;
}

async function fetchSampleProducts(count: number): Promise<ProductRow[]> {
  const { data, error } = await sb
    .from("products")
    .select("id, name, brand, ingredients")
    .not("ingredients", "is", null)
    .order("name", { ascending: true })
    .limit(count * 3);

  if (error || !data) {
    console.error("Failed to fetch products:", error?.message);
    return [];
  }

  const withIngredients = data.filter((p) => {
    if (typeof p.ingredients === "string") return p.ingredients.trim().length > 30;
    if (Array.isArray(p.ingredients))      return p.ingredients.length >= 3;
    return false;
  });

  return withIngredients.slice(0, count) as ProductRow[];
}

function extractIngredients(product: ProductRow): string[] {
  if (Array.isArray(product.ingredients)) {
    return (product.ingredients as string[]).filter((s) => typeof s === "string" && s.trim());
  }
  if (typeof product.ingredients === "string") {
    return parseIngredientString(product.ingredients);
  }
  return [];
}

// ── Printer ───────────────────────────────────────────────────────────────────

function printProductResult(
  product: ProductRow,
  summary: ScoreInputSummary,
  index:   number
): void {
  const coveragePct = (summary.coverage_ratio * 100).toFixed(1);

  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(` Product ${index + 1}: ${product.name}`);
  console.log(`  Brand     : ${product.brand ?? "—"}`);
  console.log(`  ID        : ${product.id}`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log(`  total_count     : ${summary.total_count}`);
  console.log(`  resolved_count  : ${summary.resolved_count}`);
  console.log(`  supabase_count  : ${summary.supabase_count}   (PATH 1/1b ✅)`);
  console.log(`  local_count     : ${summary.local_count}   (PATH 2/2b ⚠️ )`);
  console.log(`  unknown_count   : ${summary.unknown_count}   (PATH 3 ❌)`);
  console.log(`  coverage_ratio  : ${coveragePct}%`);
  console.log();

  const supabaseHits = summary.resolved_ingredients.filter((e) => e.source === "supabase");
  const localHits    = summary.resolved_ingredients.filter((e) => e.source === "local");
  const unknownHits  = summary.unknown_ingredients;

  if (supabaseHits.length > 0) {
    console.log(`  PATH 1/1b (Supabase) — ${supabaseHits.length} ingredient(s):`);
    for (const e of supabaseHits) {
      const tags = e.function_tags.length > 0 ? ` [${e.function_tags.slice(0, 3).join(", ")}]` : "";
      console.log(`    ✅ "${e.raw_name}" → ${e.canonical_name} (${e.risk_level ?? "?"})${tags}`);
    }
    console.log();
  }

  if (localHits.length > 0) {
    console.log(`  PATH 2/2b (Local)    — ${localHits.length} ingredient(s):`);
    for (const e of localHits.slice(0, 8)) {
      console.log(`    ⚠️  "${e.raw_name}" → ${e.canonical_name ?? "—"} (${e.risk_level ?? "?"})`);
    }
    if (localHits.length > 8) {
      console.log(`    … and ${localHits.length - 8} more`);
    }
    console.log();
  }

  if (unknownHits.length > 0) {
    console.log(`  PATH 3 (Unknown)  — ${unknownHits.length} ingredient(s):`);
    for (const e of unknownHits.slice(0, 5)) {
      console.log(`    ❌ "${e.raw_name}"`);
    }
    if (unknownHits.length > 5) {
      console.log(`    … and ${unknownHits.length - 5} more`);
    }
    console.log();
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" buildResolvedIngredientScoreInputV4 — Verification Script");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(" Resolution: shared nodeResolver (PATH 1/1b/2/2b)");
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  console.log("Fetching 3 sample products from Supabase …");
  const products = await fetchSampleProducts(3);

  if (products.length === 0) {
    console.error("No products with ingredient lists found. Exiting.");
    process.exit(1);
  }

  console.log(`Found ${products.length} product(s). Resolving ingredients …\n`);

  const allSummaries: ScoreInputSummary[] = [];

  for (let i = 0; i < products.length; i++) {
    const product     = products[i];
    const ingredients = extractIngredients(product);

    if (ingredients.length === 0) {
      console.log(`  Skipping "${product.name}": no parseable ingredients`);
      continue;
    }

    console.log(`Resolving "${product.name}" (${ingredients.length} ingredients) …`);
    const summary = await buildScoreInput(ingredients);
    allSummaries.push(summary);

    printProductResult(product, summary, i);
  }

  // ── Aggregate summary ─────────────────────────────────────────────────────
  if (allSummaries.length > 1) {
    const totalIngredients = allSummaries.reduce((s, r) => s + r.total_count,    0);
    const totalSupabase    = allSummaries.reduce((s, r) => s + r.supabase_count, 0);
    const totalLocal       = allSummaries.reduce((s, r) => s + r.local_count,    0);
    const totalUnknown     = allSummaries.reduce((s, r) => s + r.unknown_count,  0);
    const totalResolved    = allSummaries.reduce((s, r) => s + r.resolved_count, 0);
    const avgCoverage      = ((totalResolved / totalIngredients) * 100).toFixed(1);

    console.log("═══════════════════════════════════════════════════════════════");
    console.log(` AGGREGATE SUMMARY (${allSummaries.length} products)`);
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Total ingredients  : ${totalIngredients}`);
    console.log(`  Resolved           : ${totalResolved}   (${avgCoverage}% coverage)`);
    console.log(`  PATH 1/1b (Supabase): ${totalSupabase}   ✅`);
    console.log(`  PATH 2/2b (Local)   : ${totalLocal}   ⚠️`);
    console.log(`  PATH 3 (Unknown)    : ${totalUnknown}   ❌`);
    console.log("───────────────────────────────────────────────────────────────");
    console.log(" Shadow payload built. Live score engine unchanged.");
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
