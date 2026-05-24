/**
 * analyzeTop200UnknownByInstance.ts — READ-ONLY DIAGNOSTIC
 *
 * Mirrors the resolution logic of fastUnknownReport.ts but ranks unknowns by
 * RAW INSTANCE FREQUENCY (every occurrence across every product) instead of
 * by the number of unique products containing them.
 *
 * Used as input data for Phase-1C+ "Top 100" candidate selection. Writes
 * nothing.
 *
 * Usage (from artifacts/ciltbakim-mobile):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/analyzeTop200UnknownByInstance.ts
 */

import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import { matchV4Ingredient } from "@/lib/ingredientEngineV4/registry";
import { buildParentheticalCandidates } from "@/lib/ingredientEngineV4/resolver/parentheticalPreProcessor";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

const sb = createLeanSupabase();

interface ProductRow {
  id:          string;
  name:        string;
  brand:       string | null;
  ingredients: string | string[] | null;
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
  if (typeof p.ingredients === "string") return parseIngredientString(p.ingredients);
  return [];
}

async function fetchAll<T>(
  table: string,
  cols: string,
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

async function main() {
  const [aliases, masters, products] = await Promise.all([
    fetchAll<{ normalized_alias: string; ingredient_id: string; is_active: boolean }>(
      "ingredient_aliases",
      "normalized_alias, ingredient_id, is_active",
      (q) => q.eq("is_active", true)
    ),
    fetchAll<{ id: string; canonical_name: string }>(
      "ingredients_master",
      "id, canonical_name",
      (q) => q.eq("is_active", true)
    ),
    fetchAll<ProductRow>("products", "id, name, brand, ingredients", (q) =>
      q.not("ingredients", "is", null).order("name")
    ),
  ]);

  const aliasSet     = new Set(aliases.map((a) => a.normalized_alias));
  const canonicalSet = new Set(masters.map((m) => m.canonical_name.toLowerCase()));

  function tryResolve(raw: string): boolean {
    const norm = normalizeForLookup(raw);
    if (!norm) return true; // empty/punctuation only — treat as not-an-unknown
    if (aliasSet.has(norm)) return true;
    if (canonicalSet.has(norm)) return true;

    const cands = buildParentheticalCandidates(raw);
    if (cands.hasParentheticals && cands.stripped) {
      const sNorm = normalizeForLookup(cands.stripped);
      if (sNorm && sNorm !== norm) {
        if (aliasSet.has(sNorm)) return true;
        if (canonicalSet.has(sNorm)) return true;
      }
    }
    if (matchV4Ingredient(raw).matched) return true;
    if (cands.hasParentheticals && cands.stripped && cands.stripped !== raw) {
      if (matchV4Ingredient(cands.stripped).matched) return true;
    }
    return false;
  }

  // norm → { sample raw forms, instance count, product set }
  const acc = new Map<
    string,
    { rawSamples: Map<string, number>; instances: number; products: Set<string> }
  >();

  let totalInstances = 0;
  let unknownInstances = 0;
  for (const p of products) {
    const list = extractIngredients(p);
    if (list.length < 2) continue;
    for (const raw of list) {
      totalInstances++;
      if (tryResolve(raw)) continue;
      unknownInstances++;
      const norm = normalizeForLookup(raw) || raw.toLowerCase().trim();
      if (!acc.has(norm)) {
        acc.set(norm, { rawSamples: new Map(), instances: 0, products: new Set() });
      }
      const slot = acc.get(norm)!;
      slot.instances++;
      slot.products.add(p.id);
      slot.rawSamples.set(raw, (slot.rawSamples.get(raw) ?? 0) + 1);
    }
  }

  const sorted = [...acc.entries()]
    .map(([norm, v]) => {
      const topRaw = [...v.rawSamples.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return {
        norm,
        topRaw,
        instances: v.instances,
        products:  v.products.size,
      };
    })
    .sort((a, b) => b.instances - a.instances || b.products - a.products || a.norm.localeCompare(b.norm));

  const coverage = totalInstances > 0
    ? (((totalInstances - unknownInstances) / totalInstances) * 100).toFixed(2)
    : "100.00";

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" analyzeTop200UnknownByInstance — READ-ONLY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  total_ingredient_instances : ${totalInstances}`);
  console.log(`  unknown_instances          : ${unknownInstances}`);
  console.log(`  coverage_percent           : ${coverage}%`);
  console.log(`  unique_unknown_tokens      : ${sorted.length}`);
  console.log();

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" TOP 200 UNKNOWN — by INSTANCE FREQUENCY  (also showing #prods)");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" rank | inst | prod | normalized | top raw");
  console.log("─────────────────────────────────────────────────────────────");
  for (let i = 0; i < Math.min(200, sorted.length); i++) {
    const u = sorted[i];
    console.log(
      `${String(i + 1).padStart(4, " ")} | ${String(u.instances).padStart(4, " ")} | ${String(u.products).padStart(4, " ")} | "${u.norm}" | "${u.topRaw}"`
    );
  }
  console.log();
  console.log(" Cumulative coverage gain projection if top-N resolved:");
  let cum = 0;
  for (const N of [25, 50, 75, 100, 125, 150, 200]) {
    cum = sorted.slice(0, N).reduce((s, x) => s + x.instances, 0);
    const newUnknown = unknownInstances - cum;
    const newCov = totalInstances > 0
      ? (((totalInstances - newUnknown) / totalInstances) * 100).toFixed(2)
      : "100.00";
    console.log(`   if top ${String(N).padStart(3)} resolved → unknown_instances ${unknownInstances} → ${newUnknown}   coverage → ${newCov}%`);
  }
  console.log();
  console.log(" Read-only. No data was written.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
