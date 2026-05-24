/**
 * scoreEngineGate.ts — ingredientEngineV4
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature-flag-gated score engine entry point.
 *
 * Provides `analyzeProductFullV4Gate` — a drop-in alternative to
 * `analyzeProductFull` (ingredientIntelligence/index.ts) that routes to either
 * the legacy local-registry pipeline or the new V4 Supabase-resolved pipeline
 * based on `USE_V4_SCORE_INPUT`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  USE_V4_SCORE_INPUT = false  (DEFAULT / PRODUCTION)                     │
 * │                                                                         │
 * │  analyzeProductFullV4Gate(rawText, rawIngredients, options)             │
 * │    → analyzeProduct(rawText)          [sync, local registry only]       │
 * │    → calculateIngredientScore(result) [unchanged formula]               │
 * │    → { analysis, score, _mode: "legacy" }                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  USE_V4_SCORE_INPUT = true   (OPT-IN / TESTING)                         │
 * │                                                                         │
 * │  analyzeProductFullV4Gate(rawText, rawIngredients, options)             │
 * │    → buildResolvedIngredientScoreInputV4(rawIngredients) [async, SB+L] │
 * │    → adaptV4InputToIntelligenceResult(v4Payload, rawText) [pure map]   │
 * │    → calculateIngredientScore(adapted)                  [same formula]  │
 * │    → { analysis, score, _mode: "v4", _v4Meta: {...} }                   │
 * │                                                                         │
 * │  On error: falls back to legacy path automatically.                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * SCORING FORMULA:
 *   Unchanged in both modes. The formula in scoreEngine.ts is not modified.
 *   Only the INPUT SOURCE changes when the flag is enabled.
 *
 * STRICT RULES:
 *   - Does NOT modify scoreEngine.ts, analyzeProduct.ts, or any existing file
 *   - Does NOT enable V4 path automatically (flag default is false)
 *   - Does NOT break if buildResolvedIngredientScoreInputV4 throws
 *   - Fully type-safe — no `any`
 *
 * USAGE:
 *   import { analyzeProductFullV4Gate } from
 *     "@/lib/ingredientEngineV4/scoreEngineGate";
 *
 *   const result = await analyzeProductFullV4Gate(
 *     product.rawText,
 *     product.ingredientsList,
 *     { productId: product.id, productName: product.name }
 *   );
 *   // result._mode === "legacy" when flag is false (production)
 *   // result._mode === "v4"     when flag is true  (testing)
 */

import { analyzeProduct }                     from "@/lib/ingredientIntelligence/analyzeProduct";
import { calculateIngredientScore }           from "@/lib/ingredientIntelligence/scoreEngine";
import { buildResolvedIngredientScoreInputV4 } from "@/lib/ingredientEngineV4/scoreInputBuilder";
import {
  adaptV4InputToIntelligenceResult,
  extractV4Meta,
  type V4InputMeta,
} from "@/lib/ingredientEngineV4/scoreInputAdapter";
import { USE_V4_SCORE_INPUT }                 from "@/lib/ingredientEngineV4/featureFlags";
import type { IngredientIntelligenceResult }  from "@/lib/ingredientIntelligence/analyzeProduct";
import type { IngredientScore }               from "@/lib/ingredientIntelligence/scoreEngine";

// ── Public types ──────────────────────────────────────────────────────────────

export interface GateOptions {
  /** Product ID — passed to Supabase queue for PATH 3 tracking */
  productId?:   string;
  /** Product name — used in debug logging */
  productName?: string;
  /** Suppress all console output (useful in tests) */
  silent?:      boolean;
}

export type GateMode = "legacy" | "v4";

export interface GateResult {
  /** Full ingredient analysis (shape identical in both modes) */
  analysis: IngredientIntelligenceResult;
  /** 0–100 score + confidence + breakdown (formula unchanged in both modes) */
  score:    IngredientScore;
  /**
   * Which input path was used.
   * "legacy" → local-registry-only pipeline (current production).
   * "v4"     → Supabase+local resolved pipeline (feature-flag opt-in).
   */
  _mode: GateMode;
  /**
   * V4 resolution metadata (only present when _mode === "v4").
   * Useful for logging, debug UI, or A/B comparison.
   */
  _v4Meta?: V4InputMeta;
}

// ── Legacy path (synchronous, unchanged) ─────────────────────────────────────

function runLegacyPath(
  rawText:  string,
  options:  GateOptions
): GateResult {
  if (!options.silent) {
    console.log(
      `[ScoreEngineGate] mode=legacy` +
      (options.productName ? ` | product="${options.productName}"` : "") +
      ` | USE_V4_SCORE_INPUT=false`
    );
  }

  const analysis = analyzeProduct(rawText, options.productId ?? "unknown");
  const score    = calculateIngredientScore(analysis);

  if (!options.silent) {
    const s = analysis.summary;
    console.log(
      `[ScoreEngineGate] legacy result | total=${s.total}` +
      ` safe=${s.safe} low=${s.low_risk} med=${s.medium_risk}` +
      ` high=${s.high_risk} unknown=${s.unknown}` +
      ` coverage=${s.coverage_pct}%` +
      ` score=${score.score_0_100} confidence=${score.confidence}`
    );
  }

  return { analysis, score, _mode: "legacy" };
}

// ── V4 path (async, Supabase + local) ────────────────────────────────────────

async function runV4Path(
  rawText:        string,
  rawIngredients: string[],
  options:        GateOptions
): Promise<GateResult> {
  if (!options.silent) {
    console.log(
      `[ScoreEngineGate] mode=v4` +
      (options.productName ? ` | product="${options.productName}"` : "") +
      ` | ingredients=${rawIngredients.length}` +
      ` | USE_V4_SCORE_INPUT=true`
    );
  }

  const v4Input = await buildResolvedIngredientScoreInputV4(rawIngredients, {
    productId:   options.productId,
    productName: options.productName,
  });

  const v4Meta  = extractV4Meta(v4Input);

  if (!options.silent) {
    const covPct = (v4Meta.coverage_ratio * 100).toFixed(1);
    console.log(
      `[ScoreEngineGate] v4 resolved | total=${v4Meta.total_count}` +
      ` supabase=${v4Meta.supabase_count} local=${v4Meta.local_count}` +
      ` unknown=${v4Meta.unknown_count} coverage=${covPct}%`
    );
  }

  const analysis = adaptV4InputToIntelligenceResult(v4Input, rawText);
  const score    = calculateIngredientScore(analysis);

  if (!options.silent) {
    console.log(
      `[ScoreEngineGate] v4 score | score=${score.score_0_100}` +
      ` confidence=${score.confidence}` +
      (score.warnings.length > 0 ? ` warnings=[${score.warnings.join(",")}]` : "")
    );
  }

  return { analysis, score, _mode: "v4", _v4Meta: v4Meta };
}

// ── Gate (feature-flag switch) ────────────────────────────────────────────────

/**
 * analyzeProductFullV4Gate
 *
 * Feature-flag-gated score calculation entry point.
 *
 * - When USE_V4_SCORE_INPUT is false (default):
 *     Delegates to the sync legacy pipeline. Identical to analyzeProductFull().
 *
 * - When USE_V4_SCORE_INPUT is true (opt-in):
 *     Calls buildResolvedIngredientScoreInputV4 → adapter → score.
 *     Falls back to legacy path if V4 resolution throws an error.
 *
 * Always returns a GateResult with `.analysis`, `.score`, `._mode`.
 *
 * @param rawText         Raw INCI ingredient string (for legacy + raw_text field)
 * @param rawIngredients  Tokenised ingredient array (for V4 path)
 * @param options         Optional product context + logging control
 */
export async function analyzeProductFullV4Gate(
  rawText:        string,
  rawIngredients: string[],
  options:        GateOptions = {}
): Promise<GateResult> {
  // ── Legacy path (default) ──────────────────────────────────────────────────
  if (!USE_V4_SCORE_INPUT) {
    return runLegacyPath(rawText, options);
  }

  // ── V4 path (opt-in) — with automatic fallback on error ───────────────────
  try {
    return await runV4Path(rawText, rawIngredients, options);
  } catch (err) {
    if (!options.silent) {
      console.warn(
        `[ScoreEngineGate] V4 path failed — falling back to legacy.`,
        err instanceof Error ? err.message : String(err)
      );
    }
    return runLegacyPath(rawText, options);
  }
}

// ── Convenience: check which mode is active ───────────────────────────────────

/**
 * Returns the mode that analyzeProductFullV4Gate will use.
 * Useful for debug UI or logging without running a full analysis.
 */
export function getActiveGateMode(): GateMode {
  return USE_V4_SCORE_INPUT ? "v4" : "legacy";
}

// ── Dual-path analysis (admin/debug only) ─────────────────────────────────────

/**
 * DualScoreResult
 *
 * Returned by runDualScoreAnalysis. Always contains the legacy score (this IS
 * the production score). The V4 fields are null when V4 fails or is unavailable.
 *
 * ADMIN/DEBUG USE ONLY — do not use in production UI or scoring flows.
 */
export interface DualScoreResult {
  /** Production score — legacy local-registry path. Always present. */
  legacy_score:    IngredientScore;
  /** Full legacy ingredient analysis. Always present. */
  legacy_analysis: IngredientIntelligenceResult;

  /** V4 score — Supabase+local adapted path. Null if V4 failed. */
  v4_score:    IngredientScore | null;
  /** Full V4 ingredient analysis (after adapter). Null if V4 failed. */
  v4_analysis: IngredientIntelligenceResult | null;

  /**
   * v4_score.score_0_100 - legacy_score.score_0_100.
   * Positive = V4 scores higher, negative = V4 scores lower.
   * Null if V4 failed.
   */
  score_delta: number | null;

  /**
   * V4 resolution counts: how many ingredients came from Supabase, local
   * registry, and remained unknown. Null if V4 failed.
   */
  v4_meta: V4InputMeta | null;

  /** True when V4 threw an error and results fall back to legacy. */
  v4_failed: boolean;
}

/**
 * runDualScoreAnalysis
 *
 * ADMIN/DEBUG ONLY.
 *
 * Runs BOTH the legacy path AND the V4 path for the same product, regardless
 * of the USE_V4_SCORE_INPUT flag. Returns both scores so you can compare them
 * before deciding whether to enable V4 globally.
 *
 * - Legacy path: always runs, always succeeds.
 *   This IS the production score — identical to analyzeProductFull().
 *
 * - V4 path: runs alongside for comparison.
 *   Uses buildResolvedIngredientScoreInputV4 → adapter → calculateIngredientScore.
 *   If it throws, v4_score / v4_analysis / v4_meta are set to null and
 *   v4_failed is set to true. The legacy result is unaffected.
 *
 * Scoring formula is unchanged for both paths.
 * No writes to any table (PATH 3 queue suppressed via options.productId).
 *
 * FOR NODE.JS ADMIN SCRIPTS: do not import this function — it uses the Expo
 * Supabase client. Use debugDualScore.ts instead (node-safe equivalent).
 *
 * @param rawText         Raw INCI string (legacy tokenisation)
 * @param rawIngredients  Pre-tokenised ingredient array (V4 path)
 * @param options         Optional product context + logging control
 */
export async function runDualScoreAnalysis(
  rawText:        string,
  rawIngredients: string[],
  options:        GateOptions = {}
): Promise<DualScoreResult> {

  // ── 1. Legacy path (always — this is the production score) ────────────────
  const legacyAnalysis = analyzeProduct(rawText, options.productId ?? "unknown");
  const legacyScore    = calculateIngredientScore(legacyAnalysis);

  if (!options.silent) {
    const s = legacyAnalysis.summary;
    console.log(
      `[DualScore] legacy | score=${legacyScore.score_0_100}` +
      ` | total=${s.total} high=${s.high_risk} med=${s.medium_risk}` +
      ` low=${s.low_risk} unk=${s.unknown} cov=${s.coverage_pct}%`
    );
  }

  // ── 2. V4 path (admin/debug comparison — silent failure) ──────────────────
  try {
    const v4Input    = await buildResolvedIngredientScoreInputV4(rawIngredients, {
      productId:   options.productId,
      productName: options.productName,
    });
    const v4Meta     = extractV4Meta(v4Input);
    const v4Analysis = adaptV4InputToIntelligenceResult(v4Input, rawText);
    const v4Score    = calculateIngredientScore(v4Analysis);
    const delta      = v4Score.score_0_100 - legacyScore.score_0_100;

    if (!options.silent) {
      const covPct = (v4Meta.coverage_ratio * 100).toFixed(1);
      console.log(
        `[DualScore] v4     | score=${v4Score.score_0_100}` +
        ` | delta=${delta >= 0 ? "+" : ""}${delta}` +
        ` | sb=${v4Meta.supabase_count} local=${v4Meta.local_count}` +
        ` unk=${v4Meta.unknown_count} cov=${covPct}%`
      );
    }

    return {
      legacy_score:    legacyScore,
      legacy_analysis: legacyAnalysis,
      v4_score:        v4Score,
      v4_analysis:     v4Analysis,
      score_delta:     delta,
      v4_meta:         v4Meta,
      v4_failed:       false,
    };
  } catch (err) {
    if (!options.silent) {
      console.warn(
        `[DualScore] V4 path failed — legacy score is authoritative.`,
        err instanceof Error ? err.message : String(err)
      );
    }
    return {
      legacy_score:    legacyScore,
      legacy_analysis: legacyAnalysis,
      v4_score:        null,
      v4_analysis:     null,
      score_delta:     null,
      v4_meta:         null,
      v4_failed:       true,
    };
  }
}
