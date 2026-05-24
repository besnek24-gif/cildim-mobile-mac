/**
 * verifyScoreComparison.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual verification script: fetches 3 real products from Supabase and prints
 * a side-by-side comparison of old score input (local registry only) vs new
 * V4 resolved score input (Supabase + local), without touching live behaviour.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/verifyScoreComparison.ts
 *
 * WHAT THIS DOES:
 *   - Fetches 3 real products from Supabase
 *   - For each: shows old_input_summary, v4_input_summary, newly_resolved_by_v4,
 *     still_unknown_in_v4
 *   - Prints a clear side-by-side diff per product
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT calculate or change any live score
 *   - Does NOT write to ingredient_unknown_queue (PATH 3 suppressed)
 *   - Does NOT run automatically — manual execution only
 *
 * "OLD" = local V4 registry only (matchV4Ingredient)
 * "V4"  = Supabase (PATH 1/1b) + local (PATH 2/2b) via shared nodeResolver
 */

import { matchV4Ingredient }                                        from "@/lib/ingredientEngineV4/registry";
import { createLeanSupabase, resolveIngredientNodeSafe }            from "../nodeResolver";
import { tokenizeInciList }                                         from "@/lib/ingredients/inciTokenizer";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Token parser ──────────────────────────────────────────────────────────────

function parseIngredientString(raw: string): string[] {
  // Dalga E1 / Phase 1.b — delegate to shared safe INCI tokenizer.
  return tokenizeInciList(raw);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type V4Source = "supabase" | "local" | "unknown";

interface ResolvedEntry {
  raw_name:       string;
  source:         V4Source;
  canonical_name: string | null;
}

interface ComparisonResult {
  product_id:   string;
  product_name: string;
  brand:        string | null;
  old_input_summary: {
    total_count:    number;
    known_count:    number;
    unknown_count:  number;
    coverage_ratio: number;
  };
  v4_input_summary: {
    total_count:    number;
    resolved_count: number;
    supabase_count: number;
    local_count:    number;
    unknown_count:  number;
    coverage_ratio: number;
  };
  newly_resolved_by_v4: Array<{ raw_name: string; canonical_name: string | null; source: "supabase" | "local" }>;
  still_unknown_in_v4:  string[];
}

// ── Shared resolver (mirrors resolveIngredientV4 exactly, PATH 3 suppressed) ──

async function resolveOne(raw: string): Promise<ResolvedEntry> {
  const r = await resolveIngredientNodeSafe(raw, sb);
  return { raw_name: raw, source: r.source, canonical_name: r.canonical_name };
}

// ── Comparison logic ──────────────────────────────────────────────────────────

async function compareProduct(
  id:              string,
  name:            string,
  brand:           string | null,
  ingredientsList: string[]
): Promise<ComparisonResult> {

  const total = ingredientsList.length;

  // ── Old system: local registry only ────────────────────────────────────────
  const localResults = ingredientsList.map((raw) => ({
    raw,
    matched: matchV4Ingredient(raw).matched,
  }));

  const oldKnown   = localResults.filter((r) =>  r.matched);
  const oldUnknown = localResults.filter((r) => !r.matched);

  // ── V4 resolved: Supabase (PATH 1/1b) + local (PATH 2/2b) ─────────────────
  const v4Results = await Promise.all(ingredientsList.map(resolveOne));

  const supabaseCount = v4Results.filter((r) => r.source === "supabase").length;
  const localCount    = v4Results.filter((r) => r.source === "local").length;
  const unknownCount  = v4Results.filter((r) => r.source === "unknown").length;
  const resolvedCount = supabaseCount + localCount;

  // ── Delta: what V4 gains ────────────────────────────────────────────────────
  const v4ByRaw = new Map(v4Results.map((e) => [e.raw_name, e]));

  const newlyResolved: ComparisonResult["newly_resolved_by_v4"] = [];
  const stillUnknown:  string[] = [];

  for (const { raw } of oldUnknown) {
    const v4Entry = v4ByRaw.get(raw);
    if (v4Entry && v4Entry.source !== "unknown") {
      newlyResolved.push({
        raw_name:       raw,
        canonical_name: v4Entry.canonical_name,
        source:         v4Entry.source as "supabase" | "local",
      });
    } else {
      stillUnknown.push(raw);
    }
  }

  return {
    product_id:   id,
    product_name: name,
    brand,
    old_input_summary: {
      total_count:    total,
      known_count:    oldKnown.length,
      unknown_count:  oldUnknown.length,
      coverage_ratio: total > 0 ? oldKnown.length / total : 0,
    },
    v4_input_summary: {
      total_count:    total,
      resolved_count: resolvedCount,
      supabase_count: supabaseCount,
      local_count:    localCount,
      unknown_count:  unknownCount,
      coverage_ratio: total > 0 ? resolvedCount / total : 0,
    },
    newly_resolved_by_v4: newlyResolved,
    still_unknown_in_v4:  stillUnknown,
  };
}

// ── Product fetcher ───────────────────────────────────────────────────────────

interface ProductRow {
  id:          string;
  name:        string;
  brand:       string | null;
  ingredients: string | string[] | null;
}

async function fetchProducts(count: number): Promise<ProductRow[]> {
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

  return (data as ProductRow[])
    .filter((p) => {
      if (typeof p.ingredients === "string") return p.ingredients.trim().length > 30;
      if (Array.isArray(p.ingredients))      return p.ingredients.length >= 3;
      return false;
    })
    .slice(0, count);
}

function extractIngredients(p: ProductRow): string[] {
  if (Array.isArray(p.ingredients)) {
    return (p.ingredients as string[]).filter((s) => typeof s === "string" && s.trim());
  }
  if (typeof p.ingredients === "string") {
    return parseIngredientString(p.ingredients);
  }
  return [];
}

// ── Printer ───────────────────────────────────────────────────────────────────

function pct(ratio: number): string {
  return (ratio * 100).toFixed(1) + "%";
}

function arrow(oldVal: number, newVal: number): string {
  if (newVal > oldVal) return `${oldVal} → ${newVal} ▲ (+${newVal - oldVal})`;
  if (newVal < oldVal) return `${oldVal} → ${newVal} ▼ (-${oldVal - newVal})`;
  return `${oldVal} → ${newVal} (no change)`;
}

function printComparison(r: ComparisonResult, idx: number): void {
  const o = r.old_input_summary;
  const v = r.v4_input_summary;

  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(` Product ${idx + 1}: ${r.product_name}`);
  console.log(`  Brand: ${r.brand ?? "—"}   ID: ${r.product_id}`);
  console.log("───────────────────────────────────────────────────────────────");

  console.log("  SIDE-BY-SIDE COMPARISON");
  console.log(`  ${"Field".padEnd(22)} ${"OLD (local only)".padEnd(18)} ${"V4 (Supabase+local)"}`);
  console.log(`  ${"─".repeat(60)}`);
  console.log(`  ${"total_count".padEnd(22)} ${String(o.total_count).padEnd(18)} ${v.total_count}`);
  console.log(`  ${"known / resolved".padEnd(22)} ${String(o.known_count).padEnd(18)} ${v.resolved_count}`);
  console.log(`  ${"unknown".padEnd(22)} ${String(o.unknown_count).padEnd(18)} ${v.unknown_count}`);
  console.log(`  ${"coverage".padEnd(22)} ${pct(o.coverage_ratio).padEnd(18)} ${pct(v.coverage_ratio)}`);
  console.log(`  ${"supabase (PATH 1)".padEnd(22)} ${"—".padEnd(18)} ${v.supabase_count}`);
  console.log(`  ${"local    (PATH 2)".padEnd(22)} ${String(o.known_count).padEnd(18)} ${v.local_count}`);
  console.log();

  const coverageDelta = v.coverage_ratio - o.coverage_ratio;
  const deltaSign = coverageDelta > 0 ? "▲ +" : coverageDelta < 0 ? "▼ " : "=";
  console.log(`  Coverage delta     : ${deltaSign}${(Math.abs(coverageDelta) * 100).toFixed(1)}%`);
  console.log(`  Known count delta  : ${arrow(o.known_count, v.resolved_count)}`);
  console.log(`  Unknown reduction  : ${arrow(o.unknown_count, v.unknown_count)}`);
  console.log();

  if (r.newly_resolved_by_v4.length > 0) {
    console.log(`  NEWLY RESOLVED BY V4 — ${r.newly_resolved_by_v4.length} ingredient(s):`);
    console.log(`  (were unknown in old engine, now resolved)`);
    for (const e of r.newly_resolved_by_v4) {
      const pathBadge = e.source === "supabase" ? "PATH 1 ✅" : "PATH 2 ⚠️ ";
      const canon     = e.canonical_name ? ` → ${e.canonical_name}` : "";
      console.log(`    + "${e.raw_name}"${canon}  [${pathBadge}]`);
    }
    console.log();
  } else {
    console.log(`  NEWLY RESOLVED BY V4 : none`);
    console.log();
  }

  if (r.still_unknown_in_v4.length > 0) {
    console.log(`  STILL UNKNOWN IN V4  — ${r.still_unknown_in_v4.length} ingredient(s):`);
    console.log(`  (candidates for next Supabase library batch)`);
    for (const raw of r.still_unknown_in_v4.slice(0, 6)) {
      console.log(`    ? "${raw}"`);
    }
    if (r.still_unknown_in_v4.length > 6) {
      console.log(`    … and ${r.still_unknown_in_v4.length - 6} more`);
    }
    console.log();
  } else {
    console.log(`  STILL UNKNOWN IN V4  : none — full coverage! 🎉`);
    console.log();
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" compareScoreInputsV1vsV4 — Verification Script");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(" OLD = local V4 registry only");
  console.log(" V4  = Supabase (PATH 1/1b) + local (PATH 2/2b) [shared nodeResolver]");
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  console.log("Fetching 3 sample products …");
  const products = await fetchProducts(3);

  if (products.length === 0) {
    console.error("No products with ingredient lists found. Exiting.");
    process.exit(1);
  }

  console.log(`Found ${products.length} product(s). Comparing …\n`);

  const allResults: ComparisonResult[] = [];

  for (let i = 0; i < products.length; i++) {
    const p           = products[i];
    const ingredients = extractIngredients(p);
    if (ingredients.length === 0) continue;

    console.log(`Comparing "${p.name}" (${ingredients.length} ingredients) …`);
    const result = await compareProduct(p.id, p.name, p.brand, ingredients);
    allResults.push(result);
    printComparison(result, i);
  }

  // ── Aggregate summary ─────────────────────────────────────────────────────
  if (allResults.length > 1) {
    const agg = allResults.reduce(
      (acc, r) => ({
        total:       acc.total       + r.old_input_summary.total_count,
        oldKnown:    acc.oldKnown    + r.old_input_summary.known_count,
        oldUnknown:  acc.oldUnknown  + r.old_input_summary.unknown_count,
        v4Resolved:  acc.v4Resolved  + r.v4_input_summary.resolved_count,
        v4Supabase:  acc.v4Supabase  + r.v4_input_summary.supabase_count,
        v4Local:     acc.v4Local     + r.v4_input_summary.local_count,
        v4Unknown:   acc.v4Unknown   + r.v4_input_summary.unknown_count,
        newlyRes:    acc.newlyRes    + r.newly_resolved_by_v4.length,
        stillUnk:    acc.stillUnk    + r.still_unknown_in_v4.length,
      }),
      { total: 0, oldKnown: 0, oldUnknown: 0, v4Resolved: 0, v4Supabase: 0,
        v4Local: 0, v4Unknown: 0, newlyRes: 0, stillUnk: 0 }
    );

    const oldCov = agg.total > 0 ? agg.oldKnown / agg.total : 0;
    const v4Cov  = agg.total > 0 ? agg.v4Resolved / agg.total : 0;
    const delta  = v4Cov - oldCov;

    console.log("═══════════════════════════════════════════════════════════════");
    console.log(` AGGREGATE COMPARISON (${allResults.length} products, ${agg.total} total ingredients)`);
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  ${"Field".padEnd(26)} ${"OLD".padEnd(10)} ${"V4"}`);
    console.log(`  ${"─".repeat(50)}`);
    console.log(`  ${"Total ingredients".padEnd(26)} ${String(agg.total).padEnd(10)} ${agg.total}`);
    console.log(`  ${"Known / Resolved".padEnd(26)} ${String(agg.oldKnown).padEnd(10)} ${agg.v4Resolved}`);
    console.log(`  ${"  → via Supabase (PATH 1)".padEnd(26)} ${"—".padEnd(10)} ${agg.v4Supabase}`);
    console.log(`  ${"  → via Local    (PATH 2)".padEnd(26)} ${String(agg.oldKnown).padEnd(10)} ${agg.v4Local}`);
    console.log(`  ${"Unknown".padEnd(26)} ${String(agg.oldUnknown).padEnd(10)} ${agg.v4Unknown}`);
    console.log(`  ${"Coverage".padEnd(26)} ${pct(oldCov).padEnd(10)} ${pct(v4Cov)}`);
    console.log();
    console.log(`  Coverage improvement : +${(delta * 100).toFixed(1)}% (${agg.newlyRes} ingredients newly resolved)`);
    console.log(`  Remaining unknowns   : ${agg.stillUnk} (candidates for next library batch)`);
    console.log("───────────────────────────────────────────────────────────────");
    console.log(" Live score engine unchanged. Shadow comparison complete.");
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
