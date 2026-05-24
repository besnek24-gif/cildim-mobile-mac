/**
 * fastUnknownReport.ts — READ-ONLY DIAGNOSTIC
 * Pre-fetches ingredient_aliases (active), ingredients_master,
 * ingredient_unknown_queue, and products in bulk; resolves locally.
 * Mirrors PATH 1/1b/2/2b ordering of the production resolver.
 *
 * Does NOT write to any table. Does NOT change UI/scoring.
 */
import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";
import { matchV4Ingredient } from "@/lib/ingredientEngineV4/registry";
import { buildParentheticalCandidates } from "@/lib/ingredientEngineV4/resolver/parentheticalPreProcessor";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

const sb = createLeanSupabase();

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
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
  if (typeof p.ingredients === "string") {
    return parseIngredientString(p.ingredients);
  }
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
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" fastUnknownReport — READ-ONLY DIAGNOSTIC");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  console.log("Pre-fetching reference tables …");
  const [aliases, masters, queue, products] = await Promise.all([
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
    fetchAll<{
      raw_name: string;
      normalized_name: string;
      seen_count: number;
      resolution_status: string;
      source_product_name: string | null;
    }>(
      "ingredient_unknown_queue",
      "raw_name, normalized_name, seen_count, resolution_status, source_product_name"
    ),
    fetchAll<ProductRow>("products", "id, name, brand, ingredients", (q) =>
      q.not("ingredients", "is", null).order("name")
    ),
  ]);

  console.log(`  ingredient_aliases (active) : ${aliases.length}`);
  console.log(`  ingredients_master (active) : ${masters.length}`);
  console.log(`  ingredient_unknown_queue    : ${queue.length}`);
  console.log(`  products (with ingredients) : ${products.length}\n`);

  const aliasSet = new Set(aliases.map((a) => a.normalized_alias));
  const canonicalSet = new Set(masters.map((m) => m.canonical_name.toLowerCase()));

  // ── Walk products, classify each ingredient locally ───────────────────────
  let totalIngredients = 0;
  let resolvedCount = 0;
  let unknownCount = 0;
  let pathCounts = { alias: 0, alias_stripped: 0, registry: 0, registry_stripped: 0, canonical: 0 };

  const unknownByNorm = new Map<string, { raw: string; products: Set<string> }>();
  const productUnknownCounts: { id: string; name: string; brand: string | null; total: number; unknown: number }[] = [];

  function tryResolve(raw: string): keyof typeof pathCounts | null {
    const norm = normalizeForLookup(raw);
    if (!norm) return null;
    if (aliasSet.has(norm)) return "alias";
    if (canonicalSet.has(norm)) return "canonical";

    const cands = buildParentheticalCandidates(raw);
    if (cands.hasParentheticals && cands.stripped) {
      const sNorm = normalizeForLookup(cands.stripped);
      if (sNorm && sNorm !== norm) {
        if (aliasSet.has(sNorm)) return "alias_stripped";
        if (canonicalSet.has(sNorm)) return "alias_stripped";
      }
    }

    if (matchV4Ingredient(raw).matched) return "registry";
    if (cands.hasParentheticals && cands.stripped && cands.stripped !== raw) {
      if (matchV4Ingredient(cands.stripped).matched) return "registry_stripped";
    }
    return null;
  }

  for (const p of products) {
    const list = extractIngredients(p);
    if (list.length < 2) continue;
    let pUnknown = 0;
    for (const raw of list) {
      totalIngredients++;
      const path = tryResolve(raw);
      if (path) {
        resolvedCount++;
        pathCounts[path]++;
        continue;
      }
      unknownCount++;
      pUnknown++;
      const norm = normalizeForLookup(raw);
      const key = norm || raw.toLowerCase().trim();
      if (!unknownByNorm.has(key)) {
        unknownByNorm.set(key, { raw, products: new Set() });
      }
      unknownByNorm.get(key)!.products.add(p.name);
    }
    if (pUnknown > 0) {
      productUnknownCounts.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        total: list.length,
        unknown: pUnknown,
      });
    }
  }

  const sortedUnknowns = [...unknownByNorm.entries()]
    .map(([norm, v]) => ({ norm, raw: v.raw, count: v.products.size, products: [...v.products] }))
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw));

  const productsByUnknownDesc = [...productUnknownCounts].sort(
    (a, b) => b.unknown - a.unknown
  );

  const coverage =
    totalIngredients > 0 ? ((resolvedCount / totalIngredients) * 100).toFixed(2) : "100.00";

  console.log("═════════════════════════════════════════════════════════════");
  console.log(" SUMMARY");
  console.log("═════════════════════════════════════════════════════════════");
  console.log(`  products_scanned          : ${products.length}`);
  console.log(`  products_with_unknowns    : ${productUnknownCounts.length}`);
  console.log(`  total_ingredient_instances: ${totalIngredients}`);
  console.log(`  resolved_instances        : ${resolvedCount}`);
  console.log(`  unknown_instances         : ${unknownCount}`);
  console.log(`  unique_unknown_tokens     : ${sortedUnknowns.length}`);
  console.log(`  coverage_percent          : ${coverage}%`);
  console.log();
  console.log(" Resolution paths used:");
  console.log(`   PATH 1  alias            : ${pathCounts.alias}`);
  console.log(`   PATH 1c canonical_master : ${pathCounts.canonical}`);
  console.log(`   PATH 1b alias_stripped   : ${pathCounts.alias_stripped}`);
  console.log(`   PATH 2  registry         : ${pathCounts.registry}`);
  console.log(`   PATH 2b registry_stripped: ${pathCounts.registry_stripped}`);
  console.log();

  // Configurable top-N (env: TOP_UNKNOWNS, default 50). Read-only diagnostic only.
  const TOP_UNKNOWNS    = Math.max(1, Number(process.env.TOP_UNKNOWNS    ?? 50));
  const PRODUCT_EXAMPLES = Math.max(0, Number(process.env.PRODUCT_EXAMPLES ?? 3));

  console.log("─────────────────────────────────────────────────────────────");
  console.log(` TOP ${TOP_UNKNOWNS} UNKNOWN INGREDIENTS (by # products containing them)`);
  console.log("─────────────────────────────────────────────────────────────");
  const topN = sortedUnknowns.slice(0, TOP_UNKNOWNS);
  for (let i = 0; i < topN.length; i++) {
    const u = topN[i];
    const idx = String(i + 1).padStart(3, " ");
    console.log(`  ${idx}. [${String(u.count).padStart(4, " ")} prods] "${u.raw}"`);
    console.log(`        normalized: "${u.norm}"`);
    if (PRODUCT_EXAMPLES > 0 && u.products.length > 0) {
      const examples = u.products.slice(0, PRODUCT_EXAMPLES);
      for (const ex of examples) console.log(`        e.g. → ${ex}`);
    }
  }
  console.log();

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" TOP 25 PRODUCTS WITH MOST UNKNOWN INGREDIENTS");
  console.log("─────────────────────────────────────────────────────────────");
  for (const p of productsByUnknownDesc.slice(0, 25)) {
    const brand = p.brand ? ` (${p.brand})` : "";
    const pct = ((p.unknown / p.total) * 100).toFixed(0);
    console.log(`  • ${p.unknown}/${p.total} (${pct}%)  ${p.name}${brand}`);
    console.log(`     id=${p.id}`);
  }
  console.log();

  // ── Unknown queue snapshot ────────────────────────────────────────────────
  const pending = queue.filter((q) => q.resolution_status === "pending");
  const resolved = queue.filter((q) => q.resolution_status === "resolved");
  const otherStatus = queue.length - pending.length - resolved.length;

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" ingredient_unknown_queue — STATUS BREAKDOWN");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  pending  : ${pending.length}`);
  console.log(`  resolved : ${resolved.length}`);
  console.log(`  other    : ${otherStatus}`);
  console.log();

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" UNKNOWN_QUEUE — TOP 30 PENDING BY seen_count");
  console.log("─────────────────────────────────────────────────────────────");
  const sortedQueue = pending
    .map((q) => ({ ...q, seen_count: Number(q.seen_count ?? 0) }))
    .sort((a, b) => b.seen_count - a.seen_count || a.raw_name.localeCompare(b.raw_name));
  for (const q of sortedQueue.slice(0, 30)) {
    console.log(
      `  • [${String(q.seen_count).padStart(4, " ")} seen] "${q.raw_name}"  norm="${q.normalized_name}"`
    );
  }
  console.log();

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Read-only. No data was written.");
  console.log("─────────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
