/**
 * reportUnknownIngredients.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only reporting script: fetches all Supabase products that have an
 * ingredient list, runs each through the V4 comparison flow, and prints every
 * still_unknown_in_v4 item grouped by product — plus a deduplicated aggregate
 * list across all products, suitable for preparing the next library batch.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/reportUnknownIngredients.ts
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to any table
 *   - Does NOT enqueue to ingredient_unknown_queue (PATH 3 suppressed)
 *   - Does NOT modify score engine, resolver, or UI
 *   - Does NOT run automatically — manual execution only
 *
 * RESOLUTION PATH: uses shared nodeResolver (PATH 1/1b/2/2b — mirrors real V4)
 */

import { createLeanSupabase, resolveIngredientNodeSafe } from "../nodeResolver";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Token parser ──────────────────────────────────────────────────────────────

function parseIngredientString(raw: string): string[] {
  // Dalga E1 / Phase 1.b — delegate to shared safe INCI tokenizer.
  return tokenizeInciList(raw);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  id:          string;
  name:        string;
  brand:       string | null;
  ingredients: string | string[] | null;
}

interface UnknownItem {
  raw_name:     string;
  normalized:   string;
  product_id:   string;
  product_name: string;
  brand:        string | null;
}

// ── Product helpers ───────────────────────────────────────────────────────────

function extractIngredients(p: ProductRow): string[] {
  if (Array.isArray(p.ingredients)) {
    return (p.ingredients as string[]).filter((s) => typeof s === "string" && s.trim());
  }
  if (typeof p.ingredients === "string") {
    return parseIngredientString(p.ingredients);
  }
  return [];
}

async function fetchAllProducts(): Promise<ProductRow[]> {
  const PAGE = 100;
  const all: ProductRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from("products")
      .select("id, name, brand, ingredients")
      .not("ingredients", "is", null)
      .order("name", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    all.push(...(data as ProductRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all.filter((p) => {
    const list = extractIngredients(p);
    return list.length >= 2;
  });
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" reportUnknownIngredients — Read-only Report");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(" No writes. PATH 3 suppressed.");
  console.log(" Resolution: shared nodeResolver (PATH 1/1b/2/2b)");
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  console.log("Fetching all products …");
  const products = await fetchAllProducts();
  console.log(`Found ${products.length} product(s) with ingredient lists.\n`);

  // ── Per-product unknown collection ───────────────────────────────────────
  const allUnknowns: UnknownItem[] = [];
  let totalIngredients    = 0;
  let productsWithUnknowns = 0;

  for (const p of products) {
    const list = extractIngredients(p);
    if (list.length === 0) continue;

    totalIngredients += list.length;

    const unknownItems: UnknownItem[] = [];

    for (const raw of list) {
      const result = await resolveIngredientNodeSafe(raw, sb);
      if (result.source === "unknown") {
        unknownItems.push({
          raw_name:     raw,
          normalized:   result.original_norm,
          product_id:   p.id,
          product_name: p.name,
          brand:        p.brand,
        });
      }
    }

    if (unknownItems.length === 0) continue;

    productsWithUnknowns++;
    allUnknowns.push(...unknownItems);

    // ── Per-product block ─────────────────────────────────────────────────
    const brand = p.brand ? ` (${p.brand})` : "";
    console.log(`┌─ ${p.name}${brand}`);
    console.log(`│  ID: ${p.id}`);
    console.log(`│  Ingredients total: ${list.length}  |  Unknown: ${unknownItems.length}`);
    console.log("│");

    for (const u of unknownItems) {
      console.log(`│  raw_name  : "${u.raw_name}"`);
      console.log(`│  → normalized: "${u.normalized}"`);
      console.log("│");
    }

    console.log("└" + "─".repeat(63));
    console.log();
  }

  // ── Deduplicated aggregate list ───────────────────────────────────────────
  const uniqueMap = new Map<string, { raw_name: string; normalized: string; products: string[] }>();

  for (const u of allUnknowns) {
    const key = u.normalized || u.raw_name.toLowerCase().trim();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { raw_name: u.raw_name, normalized: u.normalized, products: [] });
    }
    const entry = uniqueMap.get(key)!;
    if (!entry.products.includes(u.product_name)) {
      entry.products.push(u.product_name);
    }
  }

  const sortedUnique = [...uniqueMap.values()].sort((a, b) =>
    b.products.length - a.products.length || a.raw_name.localeCompare(b.raw_name)
  );

  console.log("═════════════════════════════════════════════════════════════");
  console.log(" DEDUPLICATED AGGREGATE — NEXT BATCH CANDIDATES");
  console.log(" (sorted by occurrence count across products, descending)");
  console.log("═════════════════════════════════════════════════════════════");
  console.log();

  if (sortedUnique.length === 0) {
    console.log("  No unknowns found across all products — full coverage!");
  } else {
    const countWidth  = String(sortedUnique.length).length;
    for (let i = 0; i < sortedUnique.length; i++) {
      const { raw_name, normalized, products } = sortedUnique[i];
      const idx       = String(i + 1).padStart(countWidth, " ");
      const inProds   = products.length === 1
        ? `(in 1 product)`
        : `(in ${products.length} products)`;
      console.log(`  ${idx}. "${raw_name}"  ${inProds}`);
      console.log(`      normalized: "${normalized}"`);
      if (products.length > 0) {
        const prodList = products.slice(0, 3).join(", ");
        const more     = products.length > 3 ? ` +${products.length - 3} more` : "";
        console.log(`      product(s): ${prodList}${more}`);
      }
      console.log();
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const totalInstances = allUnknowns.length;
  const totalUnique    = sortedUnique.length;
  const overallCov     = totalIngredients > 0
    ? (((totalIngredients - totalInstances) / totalIngredients) * 100).toFixed(1)
    : "100.0";

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" FINAL SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  products_scanned          : ${products.length}`);
  console.log(`  products_with_unknowns    : ${productsWithUnknowns}`);
  console.log(`  total_ingredients_scanned : ${totalIngredients}`);
  console.log(`  total_unknown_instances   : ${totalInstances}`);
  console.log(`  total_unique_unknowns     : ${totalUnique}`);
  console.log(`  overall_v4_coverage       : ${overallCov}%`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Read-only. No data was written.");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
