/**
 * scoreEngine.ts — ingredientIntelligence
 *
 * Converts an IngredientIntelligenceResult into a 0–100 ingredient score.
 *
 * IMPORTANT: This score does NOT replace the visible product score in the UI.
 * It is a pure backend calculation prepared for future integration.
 *
 * Scoring philosophy:
 * - Start at 100 (assume safe)
 * - Deduct for high_risk and medium_risk ingredients
 * - Reward for safe and low_risk ingredients
 * - Apply a coverage penalty when many ingredients are unknown
 * - Return confidence based on coverage
 */

import type { IngredientIntelligenceResult } from "./analyzeProduct";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ScoreConfidence = "high" | "medium" | "low";

export interface IngredientScore {
  score_0_100: number;
  confidence:  ScoreConfidence;
  warnings:    string[];
  breakdown: {
    base_score:       number;
    high_risk_penalty: number;
    medium_penalty:    number;
    unknown_penalty:   number;
    safe_bonus:        number;
    final_score:       number;
  };
}

// ── Scoring constants ──────────────────────────────────────────────────────────

const BASE_SCORE          = 100;
const HIGH_RISK_PENALTY   = 18;   // per high_risk ingredient
const MEDIUM_PENALTY      = 6;    // per medium_risk ingredient
const UNKNOWN_PENALTY_PCT = 0.25; // 25% of unknown count as penalty points
const SAFE_BONUS          = 0.5;  // per safe ingredient (capped at 10)
const MAX_SAFE_BONUS      = 10;

// ── Score calculator ───────────────────────────────────────────────────────────

/**
 * Calculates a 0–100 ingredient safety score from V1 analysis output.
 *
 * @param analysis  IngredientIntelligenceResult from analyzeProduct()
 */
export function calculateIngredientScore(
  analysis: IngredientIntelligenceResult
): IngredientScore {
  const { summary, items } = analysis;
  const { total, safe, low_risk, medium_risk, high_risk, unknown, coverage_pct } = summary;

  if (total === 0) {
    return {
      score_0_100: 0,
      confidence:  "low",
      warnings:    ["no_ingredients_parsed"],
      breakdown: {
        base_score: 0, high_risk_penalty: 0, medium_penalty: 0,
        unknown_penalty: 0, safe_bonus: 0, final_score: 0,
      },
    };
  }

  // ── Deductions ────────────────────────────────────────────────────────────
  const high_risk_penalty  = high_risk * HIGH_RISK_PENALTY;
  const medium_penalty     = medium_risk * MEDIUM_PENALTY;
  const unknown_penalty    = Math.round(unknown * UNKNOWN_PENALTY_PCT);
  const safe_bonus         = Math.min(safe * SAFE_BONUS + low_risk * 0.25, MAX_SAFE_BONUS);

  const raw_score =
    BASE_SCORE - high_risk_penalty - medium_penalty - unknown_penalty + safe_bonus;

  const final_score = Math.max(0, Math.min(100, Math.round(raw_score)));

  // ── Confidence ────────────────────────────────────────────────────────────
  let confidence: ScoreConfidence;
  if (coverage_pct >= 85)      confidence = "high";
  else if (coverage_pct >= 60) confidence = "medium";
  else                         confidence = "low";

  // ── Warnings ──────────────────────────────────────────────────────────────
  const warnings: string[] = [];

  const hasFrag = items.some((i) => i.flags.includes("fragrance"));
  const hasAllergen = items.some((i) => i.flags.includes("allergen"));
  const hasDrying = items.some((i) => i.flags.includes("drying_alcohol"));
  const highRiskPreservative = items.some(
    (i) => i.bucket === "high_risk" && i.category === "preservative"
  );

  if (hasFrag)               warnings.push("contains_fragrance");
  if (hasAllergen)           warnings.push("contains_known_allergen");
  if (hasDrying)             warnings.push("contains_drying_alcohol");
  if (highRiskPreservative)  warnings.push("contains_high_risk_preservative");
  if (coverage_pct < 60)     warnings.push("low_coverage");
  if (unknown > total * 0.3) warnings.push("many_unknown_ingredients");

  return {
    score_0_100: final_score,
    confidence,
    warnings,
    breakdown: {
      base_score:        BASE_SCORE,
      high_risk_penalty,
      medium_penalty,
      unknown_penalty,
      safe_bonus:        Math.round(safe_bonus * 10) / 10,
      final_score,
    },
  };
}

/**
 * Returns a human-readable label for a score.
 */
export function scoreLabel(score: number): string {
  if (score >= 85) return "Çok Güvenli";
  if (score >= 70) return "Güvenli";
  if (score >= 55) return "Orta";
  if (score >= 40) return "Dikkatli";
  return "Yüksek Risk";
}
