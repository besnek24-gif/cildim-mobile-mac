/**
 * profileValidator.ts — ingredientIntelligence
 *
 * Validates an ingredient analysis summary against expected profile ranges
 * for a given formula type.
 *
 * Uses VALIDATION_PROFILES from validationProfiles.ts as the source of truth.
 * Pure function — no side effects.
 */

import {
  VALIDATION_PROFILES,
  detectFormulaType,
  type FormulaType,
} from "./validationProfiles";
import type { IngredientIntelligenceSummary } from "./analyzeProduct";
import type { AnalyzedItem }                   from "./analyzeProduct";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BucketValidation {
  bucket:          string;
  actual_pct:      number;
  expected_min:    number;
  expected_max:    number;
  within_range:    boolean;
  deviation:       string | null;
}

export interface ProfileValidationResult {
  profile_type:    FormulaType;
  auto_detected:   boolean;
  overall_fit:     boolean;
  buckets:         BucketValidation[];
  deviations:      string[];
  verdict:         "fits" | "partial" | "mismatch";
  verdict_label:   string;
}

// ── Validator ──────────────────────────────────────────────────────────────────

/**
 * Validates an analysis summary against a formula profile.
 *
 * @param summary     IngredientIntelligenceSummary from analyzeProduct()
 * @param profileType Which formula profile to validate against.
 *                    Pass "auto" to use detectFormulaType().
 * @param items       Required when profileType === "auto"
 */
export function validateAnalysisProfile(
  summary:     IngredientIntelligenceSummary,
  profileType: FormulaType | "auto",
  items?:      AnalyzedItem[]
): ProfileValidationResult {
  const { total } = summary;
  let resolvedType: FormulaType;
  let autoDetected = false;

  if (profileType === "auto") {
    if (!items?.length) {
      resolvedType = "moisturizer"; // safe default
    } else {
      resolvedType = detectFormulaType(items);
    }
    autoDetected = true;
  } else {
    resolvedType = profileType;
  }

  const profile = VALIDATION_PROFILES[resolvedType];
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const bucketData: Array<{ key: keyof typeof profile; actual: number }> = [
    { key: "safe",        actual: summary.safe },
    { key: "low_risk",    actual: summary.low_risk },
    { key: "medium_risk", actual: summary.medium_risk },
    { key: "high_risk",   actual: summary.high_risk },
    { key: "unknown",     actual: summary.unknown },
  ];

  const deviations: string[] = [];
  const buckets: BucketValidation[] = bucketData.map(({ key, actual }) => {
    const range     = profile[key] as { min: number; max: number };
    const actualPct = pct(actual);
    const within    = actualPct >= range.min && actualPct <= range.max;
    let deviation: string | null = null;

    if (!within) {
      if (actualPct < range.min) {
        deviation = `${key}: ${actualPct}% < expected ≥${range.min}%`;
      } else {
        deviation = `${key}: ${actualPct}% > expected ≤${range.max}%`;
      }
      deviations.push(deviation);
    }

    return {
      bucket:       key,
      actual_pct:   actualPct,
      expected_min: range.min,
      expected_max: range.max,
      within_range: within,
      deviation,
    };
  });

  const passing      = buckets.filter((b) => b.within_range).length;
  const total_checks = buckets.length;
  const overall_fit  = deviations.length === 0;

  let verdict: "fits" | "partial" | "mismatch";
  let verdict_label: string;

  if (overall_fit) {
    verdict       = "fits";
    verdict_label = `Tüm kontroller geçti — "${resolvedType}" profiline uygun`;
  } else if (passing >= 3) {
    verdict       = "partial";
    verdict_label = `${passing}/${total_checks} kontrol geçti — kısmi uyum`;
  } else {
    verdict       = "mismatch";
    verdict_label = `${passing}/${total_checks} kontrol geçti — profil uyuşmuyor`;
  }

  return {
    profile_type:  resolvedType,
    auto_detected: autoDetected,
    overall_fit,
    buckets,
    deviations,
    verdict,
    verdict_label,
  };
}

/**
 * Runs validation against ALL formula types and returns which profiles fit.
 * Useful for formula-type identification from ingredient list alone.
 */
export function findMatchingProfiles(
  summary: IngredientIntelligenceSummary,
  items:   AnalyzedItem[]
): ProfileValidationResult[] {
  const types: FormulaType[] = [
    "sunscreen", "moisturizer", "cleanser", "serum",
    "fragrance_alcohol_formula", "tinted_product",
  ];
  return types
    .map((t) => validateAnalysisProfile(summary, t, items))
    .filter((r) => r.verdict !== "mismatch")
    .sort((a, b) => b.buckets.filter((x) => x.within_range).length
                  - a.buckets.filter((x) => x.within_range).length);
}
