/**
 * validation/runner.ts — ingredientEngineV4
 *
 * Deterministic V4 fixture validation runner.
 *
 * Runs all (or selected) fixtures from fixtures.ts against the live V4 engine
 * and reports pass/fail with assertion details.
 *
 * Usage (tsx):
 *   npx tsx lib/ingredientEngineV4/validation/runner.ts
 *   npx tsx lib/ingredientEngineV4/validation/runner.ts --id sunscreen-ducray-spf50
 *   npx tsx lib/ingredientEngineV4/validation/runner.ts --verbose
 *
 * ZERO imports from legacy/V3 systems.
 */

import { analyzeProductV4 }     from "../analyzeProductV4";
import { getV4RegistryStats }    from "../registry";
import { getV4QueueSize }        from "../unknownQueue";
import { V4_FIXTURES }          from "./fixtures";
import type { V4ProductScore }   from "../scorer";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AssertionResult {
  assertion: string;
  passed:    boolean;
  expected:  string;
  actual:    string;
}

interface FixtureResult {
  id:          string;
  product:     string;
  passed:      boolean;
  assertions:  AssertionResult[];
  score:       V4ProductScore;
  durationMs:  number;
}

interface RunResult {
  total:     number;
  passed:    number;
  failed:    number;
  fixtures:  FixtureResult[];
  durationMs: number;
}

// ── Assertion helpers ──────────────────────────────────────────────────────────

function assertEq(label: string, expected: string, actual: string): AssertionResult {
  return { assertion: label, passed: expected === actual, expected, actual };
}

function assertGte(label: string, expected: number, actual: number): AssertionResult {
  return {
    assertion: label,
    passed:    actual >= expected,
    expected:  `>= ${expected}`,
    actual:    String(actual),
  };
}

function assertLte(label: string, expected: number, actual: number): AssertionResult {
  return {
    assertion: label,
    passed:    actual <= expected,
    expected:  `<= ${expected}`,
    actual:    String(actual),
  };
}

function assertHasWarning(code: string, score: V4ProductScore): AssertionResult {
  const has = score.warnings.some((w) => w.code === code);
  return {
    assertion: `hasWarning:${code}`,
    passed:    has,
    expected:  `warning "${code}" present`,
    actual:    has ? "present" : "absent",
  };
}

function assertNoWarning(code: string, score: V4ProductScore): AssertionResult {
  const has = score.warnings.some((w) => w.code === code);
  return {
    assertion: `hasNoWarning:${code}`,
    passed:    !has,
    expected:  `warning "${code}" absent`,
    actual:    has ? "present" : "absent",
  };
}

// ── Run single fixture ─────────────────────────────────────────────────────────

function runFixture(fixture: (typeof V4_FIXTURES)[0]): FixtureResult {
  const start = Date.now();

  const score = analyzeProductV4({
    rawIngredientsText: fixture.rawText,
    productId:          fixture.id,
  });

  const assertions: AssertionResult[] = [];

  // Formula type
  assertions.push(assertEq(
    "formulaType",
    fixture.expected.formulaType,
    score.formulaType
  ));

  // Score range
  if (fixture.expected.minScore !== undefined) {
    assertions.push(assertGte("minScore", fixture.expected.minScore, score.finalScore));
  }
  if (fixture.expected.maxScore !== undefined) {
    assertions.push(assertLte("maxScore", fixture.expected.maxScore, score.finalScore));
  }

  // Coverage
  if (fixture.expected.minCoverage !== undefined) {
    assertions.push(assertGte("minCoverage", fixture.expected.minCoverage, score.coveragePct));
  }

  // Matched count
  if (fixture.expected.minMatched !== undefined) {
    assertions.push(assertGte("minMatched", fixture.expected.minMatched, score.matchedIngredients));
  }

  // Warnings
  for (const code of fixture.expected.hasWarning ?? []) {
    assertions.push(assertHasWarning(code, score));
  }
  for (const code of fixture.expected.hasNoWarning ?? []) {
    assertions.push(assertNoWarning(code, score));
  }

  const passed = assertions.every((a) => a.passed);

  return {
    id:         fixture.id,
    product:    fixture.product_name,
    passed,
    assertions,
    score,
    durationMs: Date.now() - start,
  };
}

// ── Run all / selected ────────────────────────────────────────────────────────

function runAll(opts: { filterId?: string; verbose?: boolean }): RunResult {
  const fixtures = opts.filterId
    ? V4_FIXTURES.filter((f) => f.id === opts.filterId)
    : V4_FIXTURES;

  if (fixtures.length === 0) {
    console.warn(`⚠️  No fixtures found${opts.filterId ? ` for id: ${opts.filterId}` : ""}`);
  }

  const start   = Date.now();
  const results = fixtures.map(runFixture);

  return {
    total:     results.length,
    passed:    results.filter((r) => r.passed).length,
    failed:    results.filter((r) => !r.passed).length,
    fixtures:  results,
    durationMs: Date.now() - start,
  };
}

// ── Console reporter ──────────────────────────────────────────────────────────

function report(result: RunResult, verbose: boolean): void {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  ingredientEngineV4 — Validation Runner");
  console.log("══════════════════════════════════════════════════");

  const stats = getV4RegistryStats();
  console.log(`\nRegistry: ${stats.total_entries} entries | Unknown queue: ${getV4QueueSize()} tokens`);
  console.log(`\n▶  ${result.total} fixture(s) run in ${result.durationMs}ms`);

  for (const f of result.fixtures) {
    const icon = f.passed ? "✅" : "❌";
    console.log(`\n${icon} [${f.id}] ${f.product} — ${f.durationMs}ms`);
    console.log(
      `   Score: ${f.score.finalScore}/100 (${f.score.scoreLabel}) | ` +
      `Formula: ${f.score.formulaType} (${f.score.formulaConfidence}) | ` +
      `Coverage: ${f.score.coveragePct}% (${f.score.matchedIngredients}/${f.score.totalIngredients} matched) | ` +
      `Confidence: ${f.score.confidence}`
    );

    if (f.score.warnings.length > 0) {
      console.log(`   Warnings: ${f.score.warnings.map((w) => w.code).join(", ")}`);
    }

    const failedAssertions = f.assertions.filter((a) => !a.passed);

    if (failedAssertions.length > 0 || verbose) {
      for (const a of f.assertions) {
        const aIcon = a.passed ? "  ✓" : "  ✗";
        if (!a.passed || verbose) {
          console.log(`${aIcon} ${a.assertion}: expected ${a.expected}, got ${a.actual}`);
        }
      }
    }

    if (verbose && !f.passed) {
      console.log(`   Breakdown: ${JSON.stringify(f.score.breakdown)}`);
      console.log(`   Unresolved: ${f.score.unresolvedIngredients} tokens`);
    }
  }

  console.log("\n══════════════════════════════════════════════════");
  const passIcon = result.failed === 0 ? "🎉" : "⚠️ ";
  console.log(
    `${passIcon}  ${result.passed}/${result.total} passed` +
    (result.failed > 0 ? ` | ${result.failed} FAILED` : "")
  );
  console.log("══════════════════════════════════════════════════\n");
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args    = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const idIdx   = args.indexOf("--id");
  const filterId = idIdx !== -1 ? args[idIdx + 1] : undefined;

  const result = runAll({ filterId, verbose });
  report(result, verbose);

  process.exit(result.failed > 0 ? 1 : 0);
}

export { runAll, report };
export type { RunResult, FixtureResult };
