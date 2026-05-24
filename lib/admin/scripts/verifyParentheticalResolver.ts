/**
 * verifyParentheticalResolver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual verification script for the parenthetical pre-processor.
 * Tests the 4 known problem cases from the report and prints detailed output
 * showing original vs stripped form, PATH taken, and canonical name.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/verifyParentheticalResolver.ts
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to any table
 *   - Does NOT enqueue unknowns (PATH 3 suppressed)
 *   - Does NOT run automatically — manual execution only
 *   - Does NOT modify the live score engine
 *
 * RESOLUTION PATH: shared nodeResolver — mirrors real resolveIngredientV4 exactly
 */

import {
  createLeanSupabase,
  resolveIngredientNodeSafe,
  type NodeResolveResult,
  type NodeResolvePath,
} from "../nodeResolver";
import { stripParentheticals } from "@/lib/ingredientEngineV4/resolver/parentheticalPreProcessor";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── Display helpers ───────────────────────────────────────────────────────────

type DisplaySource =
  | "PATH 1 — Supabase (original)"
  | "PATH 1b — Supabase (stripped)"
  | "PATH 2 — Local (original)"
  | "PATH 2b — Local (stripped)"
  | "unknown";

function pathToDisplay(path: NodeResolvePath): DisplaySource {
  switch (path) {
    case "supabase_original": return "PATH 1 — Supabase (original)";
    case "supabase_stripped": return "PATH 1b — Supabase (stripped)";
    case "local_original":    return "PATH 2 — Local (original)";
    case "local_stripped":    return "PATH 2b — Local (stripped)";
    default:                  return "unknown";
  }
}

function sourceIcon(path: NodeResolvePath): string {
  if (path.startsWith("supabase")) return "✅";
  if (path.startsWith("local"))    return "⚡";
  return "❌";
}

// ── Row type (view layer only) ────────────────────────────────────────────────

interface VerificationRow {
  raw_input:           string;
  original_normalized: string;
  stripped_raw:        string;
  stripped_normalized: string;
  has_parentheticals:  boolean;
  display_source:      DisplaySource;
  path:                NodeResolvePath;
  canonical_name:      string | null;
}

function toVerificationRow(raw: string, r: NodeResolveResult): VerificationRow {
  return {
    raw_input:           raw,
    original_normalized: r.original_norm,
    stripped_raw:        r.stripped_raw,
    stripped_normalized: r.stripped_norm,
    has_parentheticals:  r.has_parenthetical,
    display_source:      pathToDisplay(r.path),
    path:                r.path,
    canonical_name:      r.canonical_name,
  };
}

function printRow(r: VerificationRow, idx: number): void {
  const icon = sourceIcon(r.path);
  console.log(`┌─ Test ${idx + 1}: "${r.raw_input}"`);
  console.log(`│  has_parentheticals : ${r.has_parentheticals}`);
  console.log(`│  original_normalized: "${r.original_normalized}"`);
  if (r.has_parentheticals) {
    console.log(`│  stripped_raw       : "${r.stripped_raw}"`);
    console.log(`│  stripped_normalized: "${r.stripped_normalized}"`);
  }
  console.log(`│`);
  console.log(`│  resolved_source    : ${icon}  ${r.display_source}`);
  console.log(`│  canonical_name     : ${r.canonical_name ? `"${r.canonical_name}"` : "—  (still unknown)"}`);
  console.log(`└${"─".repeat(63)}`);
  console.log();
}

// ── Test cases ────────────────────────────────────────────────────────────────

const TEST_CASES: string[] = [
  // 4 known problem cases from reportUnknownIngredients
  "Water (Aqua)",
  "Avene Thermal Spring Water (Avene Aqua)",
  "Oryza Sativa (Rice) Starch (Oryza Sativa Starch)",
  "Zea Mays (Corn) Starch (Zea Mays Starch)",
  // Control cases — already resolving, should not regress
  "Niacinamide",
  "Glycerin",
  "Tocopherol",
  "Sodium Hyaluronate",
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" verifyParentheticalResolver — Pre-processor Verification");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(" Read-only. PATH 3 suppressed. No writes.");
  console.log(" Resolution: shared nodeResolver (PATH 1/1b/2/2b)");
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  // ── Unit tests for stripParentheticals (pure, no I/O) ──────────────────────
  console.log("── Strip unit tests (pure string) ───────────────────────────");
  const stripCases: Array<[string, string]> = [
    ["Water (Aqua)",                                           "Water"],
    ["Avene Thermal Spring Water (Avene Aqua)",               "Avene Thermal Spring Water"],
    ["Oryza Sativa (Rice) Starch (Oryza Sativa Starch)",     "Oryza Sativa Starch"],
    ["Zea Mays (Corn) Starch (Zea Mays Starch)",             "Zea Mays Starch"],
    ["Niacinamide",                                           "Niacinamide"],
    ["PPG-1-PEG-9 Lauryl Glycol Ether",                      "PPG-1-PEG-9 Lauryl Glycol Ether"],
  ];

  let allPass = true;
  for (const [input, expected] of stripCases) {
    const result = stripParentheticals(input);
    const pass   = result === expected;
    if (!pass) allPass = false;
    const badge = pass ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${badge}  "${input}"`);
    console.log(`           → "${result}"${pass ? "" : `  (expected "${expected}")`}`);
  }
  console.log();
  console.log(`  Strip unit tests: ${allPass ? "ALL PASSED ✅" : "SOME FAILED ❌"}`);
  console.log();

  // ── Full resolution tests (shared nodeResolver) ────────────────────────────
  console.log("── Resolution tests (shared nodeResolver) ────────────────────");
  console.log();

  const results: VerificationRow[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`Resolving: "${tc}" … `);
    const r   = await resolveIngredientNodeSafe(tc, sb);
    const row = toVerificationRow(tc, r);
    results.push(row);
    console.log(sourceIcon(r.path));
  }

  console.log();

  for (let i = 0; i < results.length; i++) {
    printRow(results[i], i);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const resolved   = results.filter((r) => r.path !== "unknown");
  const unknown    = results.filter((r) => r.path === "unknown");
  const viaStrip   = results.filter((r) => r.path.includes("stripped"));
  const regression = results
    .slice(4)  // control cases
    .filter((r) => r.path === "unknown");

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" VERIFICATION SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  total tested             : ${results.length}`);
  console.log(`  resolved                 : ${resolved.length}`);
  console.log(`  still unknown            : ${unknown.length}`);
  console.log(`  resolved via stripped    : ${viaStrip.length}   ← parenthetical pre-processor`);
  console.log(`  control regressions      : ${regression.length} ${ regression.length === 0 ? "(none — safe ✅)" : "(REGRESSIONS FOUND ❌)"}`);
  console.log();

  if (viaStrip.length > 0) {
    console.log("  Ingredients fixed by pre-processor:");
    for (const r of viaStrip) {
      console.log(`    "${r.raw_input}" → "${r.canonical_name}"`);
    }
    console.log();
  }

  if (unknown.length > 0) {
    console.log("  Still unknown (not in Supabase or local registry):");
    for (const r of unknown) {
      console.log(`    "${r.raw_input}"  (stripped: "${r.stripped_raw}")`);
    }
    console.log();
  }

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" Read-only. No data written. Live engine unchanged.");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
