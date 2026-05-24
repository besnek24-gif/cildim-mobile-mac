/**
 * debugAveneTokens.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only debug script: inspects the exact raw ingredient tokens that would
 * reach buildResolvedIngredientScoreInputV4 for the Avène Cleanance SPF 50+
 * product, focusing on entries still appearing unknown after the parenthetical
 * pre-processor was added.
 *
 * GOAL:
 *   Determine whether "Water (Aqua)" and "Avene Thermal Spring Water (Avene Aqua)"
 *   are failing due to a tokenization / parsing mismatch or a resolver mismatch.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/debugAveneTokens.ts
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to any table
 *   - Does NOT enqueue unknowns (PATH 3 suppressed)
 *   - Does NOT modify score engine, resolver, or UI
 *   - Does NOT run automatically — manual execution only
 *
 * RESOLUTION PATH: shared nodeResolver — mirrors real resolveIngredientV4 exactly
 */

import {
  createLeanSupabase,
  normalizeForLookup,
  resolveIngredientNodeSafe,
  type NodeResolveResult,
  type NodeResolvePath,
}                                       from "../nodeResolver";
import { buildParentheticalCandidates } from "@/lib/ingredientEngineV4/resolver/parentheticalPreProcessor";
import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Token parser ──────────────────────────────────────────────────────────────

function parseIngredientString(raw: string): string[] {
  // Dalga E1 / Phase 1.b — delegate to shared safe INCI tokenizer.
  return tokenizeInciList(raw);
}

function extractIngredients(raw: string | string[] | null): string[] {
  if (Array.isArray(raw))        return (raw as string[]).filter((s) => typeof s === "string" && s.trim());
  if (typeof raw === "string")   return parseIngredientString(raw);
  return [];
}

// ── Display helpers ───────────────────────────────────────────────────────────

function pathLabel(path: NodeResolvePath): string {
  switch (path) {
    case "supabase_original": return "PATH 1  — Supabase (original)";
    case "supabase_stripped": return "PATH 1b — Supabase (stripped)";
    case "local_original":    return "PATH 2  — Local   (original)";
    case "local_stripped":    return "PATH 2b — Local   (stripped)";
    default:                  return "UNKNOWN";
  }
}

function pathIcon(path: NodeResolvePath): string {
  if (path.startsWith("supabase")) return "✅";
  if (path.startsWith("local"))    return "⚡";
  return "❌";
}

/** Returns true when token is "interesting" for this debug run */
function isInterestingToken(raw: string): boolean {
  const lower = raw.toLowerCase();
  return lower.includes("water") || lower.includes("aqua") || lower.includes("avene") || lower.includes("avène");
}

/** Show invisible characters as escape sequences */
function safeJson(s: string): string {
  return JSON.stringify(s);
}

/** Hex dump of first N chars — surfaces hidden chars, BOM, NBSP, etc. */
function hexDump(s: string, maxChars = 80): string {
  const slice = s.slice(0, maxChars);
  return Array.from(slice)
    .map((c) => c.codePointAt(0)!.toString(16).padStart(4, "0"))
    .join(" ");
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" debugAveneTokens — Token & Resolver Inspection");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(" Read-only. PATH 3 suppressed. No writes.");
  console.log(" Resolution: shared nodeResolver (PATH 1/1b/2/2b)");
  console.log("─────────────────────────────────────────────────────────────\n");

  // ── 1. Fetch the product ──────────────────────────────────────────────────
  console.log("Step 1: Fetching Avène Cleanance SPF 50+ …\n");

  const { data: rows, error } = await sb
    .from("products")
    .select("id, name, brand, ingredients")
    .ilike("name", "%cleanance%spf%")
    .limit(5);

  if (error || !rows || rows.length === 0) {
    console.error("Product not found:", error?.message ?? "no rows");
    process.exit(1);
  }

  const product = rows[0] as {
    id:          string;
    name:        string;
    brand:       string | null;
    ingredients: string | string[] | null;
  };

  console.log(`  product_id   : ${product.id}`);
  console.log(`  product_name : ${product.name}`);
  console.log(`  brand        : ${product.brand ?? "—"}`);
  console.log();

  // ── 2. Inspect raw ingredients field ─────────────────────────────────────
  console.log("Step 2: Raw ingredients field\n");

  if (product.ingredients === null) {
    console.error("  ingredients field is NULL — nothing to inspect.");
    process.exit(1);
  }

  const isArray  = Array.isArray(product.ingredients);
  const isString = typeof product.ingredients === "string";

  console.log(`  field type   : ${isArray ? "array" : isString ? "string" : typeof product.ingredients}`);

  if (isString) {
    const raw = product.ingredients as string;
    console.log(`  char length  : ${raw.length}`);
    console.log(`  first 300ch  : ${raw.slice(0, 300)}`);
    console.log(`  hex (first 40 chars):`);
    console.log(`    ${hexDump(raw, 40)}`);
  } else if (isArray) {
    const arr = product.ingredients as string[];
    console.log(`  array length : ${arr.length}`);
    console.log(`  first 5 items:`);
    arr.slice(0, 5).forEach((item, i) => console.log(`    [${i}] ${safeJson(item)}`));
  }

  console.log();

  // ── 3. Parse tokens ───────────────────────────────────────────────────────
  const tokens = extractIngredients(product.ingredients);

  console.log(`Step 3: Parsed tokens (${tokens.length} total)\n`);
  tokens.forEach((t, i) => {
    const mark = isInterestingToken(t) ? "  ← INTERESTING" : "";
    console.log(`  [${String(i).padStart(2, "0")}] ${safeJson(t)}${mark}`);
  });
  console.log();

  // ── 4. Deep inspection of interesting tokens ──────────────────────────────
  const interesting = tokens.filter(isInterestingToken);

  console.log(`Step 4: Deep inspection — ${interesting.length} interesting token(s)\n`);

  for (const raw of interesting) {
    const candidates  = buildParentheticalCandidates(raw);
    const origNorm    = normalizeForLookup(raw);
    const stripNorm   = candidates.hasParentheticals ? normalizeForLookup(candidates.stripped) : origNorm;

    console.log(`  ┌─ raw token`);
    console.log(`  │  raw            : ${safeJson(raw)}`);
    console.log(`  │  char_length    : ${raw.length}`);
    console.log(`  │  hex dump       : ${hexDump(raw)}`);
    console.log(`  │  has_parens     : ${candidates.hasParentheticals}`);
    console.log(`  │`);
    console.log(`  │  original_norm  : ${safeJson(origNorm)}`);

    if (candidates.hasParentheticals) {
      console.log(`  │  stripped_raw   : ${safeJson(candidates.stripped)}`);
      console.log(`  │  stripped_norm  : ${safeJson(stripNorm)}`);
      console.log(`  │`);
      console.log(`  │  norm_differs   : ${stripNorm !== origNorm}`);
    }

    console.log(`  └─`);
    console.log();
  }

  // ── 5. Resolve interesting tokens via shared nodeResolver ─────────────────
  console.log(`Step 5: Resolving ${interesting.length} interesting token(s) via nodeResolver …\n`);

  for (const raw of interesting) {
    process.stdout.write(`  Resolving: ${safeJson(raw)} … `);
    const result: NodeResolveResult = await resolveIngredientNodeSafe(raw, sb);
    const icon = pathIcon(result.path);
    console.log(icon);

    console.log(`    source         : ${pathLabel(result.path)}`);
    console.log(`    canonical_name : ${result.canonical_name ? safeJson(result.canonical_name) : "—"}`);

    if (result.path === "unknown" && result.has_parenthetical) {
      console.log();
      console.log(`    ── PATH TRACE (why both attempts failed) ─────────────────`);
      console.log(`    PATH 1  looked up : ${safeJson(result.original_norm)}`);
      console.log(`    PATH 1b looked up : ${safeJson(result.stripped_norm)}`);
      console.log(`    PATH 2  tried raw : ${safeJson(raw)}`);
      console.log(`    PATH 2b tried raw : ${safeJson(result.stripped_raw)}`);
      console.log();

      // Direct alias probe to confirm what's in ingredient_aliases
      console.log(`    ── Supabase alias probe ──────────────────────────────────`);
      for (const probe of [result.original_norm, result.stripped_norm]) {
        const { data: found } = await sb
          .from("ingredient_aliases")
          .select("normalized_alias, alias_type, ingredient_id")
          .eq("normalized_alias", probe)
          .limit(3);
        const status = found && found.length > 0 ? `FOUND (${found.length} row)` : "NOT FOUND";
        console.log(`    "${probe}" → ${status}`);
      }
    }

    console.log();
  }

  // ── 6. All tokens — full resolution summary ───────────────────────────────
  console.log("Step 6: Full token resolution summary (all tokens)\n");
  console.log("  Resolving all tokens …");

  const allResults = await Promise.all(
    tokens.map((raw) => resolveIngredientNodeSafe(raw, sb))
  );

  const supabaseCount = allResults.filter((r) => r.source === "supabase").length;
  const localCount    = allResults.filter((r) => r.source === "local").length;
  const unknownCount  = allResults.filter((r) => r.source === "unknown").length;

  console.log();
  console.log(`  total tokens    : ${tokens.length}`);
  console.log(`  supabase hits   : ${supabaseCount}`);
  console.log(`  local hits      : ${localCount}`);
  console.log(`  unknown         : ${unknownCount}`);
  console.log(`  coverage        : ${(((supabaseCount + localCount) / tokens.length) * 100).toFixed(1)}%`);
  console.log();

  const unknownEntries = allResults
    .map((r, i) => ({ r, raw: tokens[i] }))
    .filter(({ r }) => r.source === "unknown");

  if (unknownEntries.length > 0) {
    console.log("  Unknown tokens:");
    for (const { r, raw } of unknownEntries) {
      const stripped = r.has_parenthetical ? `\n     stripped: ${safeJson(r.stripped_raw)}` : "";
      console.log(`    "${raw}"${stripped}`);
    }
    console.log();
  }

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Diagnosis complete. No data written.");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
