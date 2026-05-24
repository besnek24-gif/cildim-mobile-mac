/**
 * policyEngine/engine.ts — ingredientEngineV4
 *
 * V4 risk policy executor.
 * Consumes policies.ts as the single source of truth.
 *
 * Decision order:
 *   A. CANONICAL_OVERRIDES_V4   → decision_source: "canonical_override"
 *   B. FLAG_PRIORITY_POLICY_V4  → decision_source: "flag_policy"
 *   C. CATEGORY_BASE_POLICY_V4  → decision_source: "category_policy"
 *   D. Library fallback         → decision_source: "library_fallback"
 *   E. Unknown                  → decision_source: "unknown_fallback"
 *
 *   + Formula modifier applied post-assessment to adjust bucket
 *     based on formula type context.
 *
 * engine.ts is the executor.
 * policies.ts is the author of all decisions.
 */

import type { V4MatchResult } from "../registry/types";
import type { V4RiskAssessment, V4RiskBucket } from "./types";
import type { V4FormulaType } from "../formulaClassifier";
import {
  CANONICAL_OVERRIDES_V4,
  FLAG_PRIORITY_POLICY_V4,
  CATEGORY_BASE_POLICY_V4,
  FORMULA_PENALTY_MODIFIERS,
} from "./policies";

// ── Core risk assessor ─────────────────────────────────────────────────────────

/**
 * Assesses risk for a single matched ingredient.
 *
 * @param match         Match result from V4 registry
 * @param formulaType   Optional: pass formula type for context-aware modifier
 */
export function assessV4Risk(
  match:       V4MatchResult,
  formulaType: V4FormulaType = "other"
): V4RiskAssessment {

  // ── Unmatched: immediate unknown ────────────────────────────────────────────
  if (!match.matched || !match.canonical_name) {
    return {
      risk_level:      "medium_risk",
      bucket:          "unknown",
      reasons:         ["Ingredient not found in V4 canonical registry"],
      decision_source: "unknown_fallback",
    };
  }

  const cname    = match.canonical_name;
  const flags    = match.flags;
  const category = match.category;

  // ── A. Canonical override ──────────────────────────────────────────────────
  const override = CANONICAL_OVERRIDES_V4[cname];
  if (override) {
    const base: V4RiskAssessment = {
      risk_level:      override.risk_level,
      bucket:          override.bucket,
      reasons:         [override.reason],
      decision_source: "canonical_override",
    };
    return _applyFormulaModifier(base, flags, formulaType);
  }

  // ── B. Flag priority policy ────────────────────────────────────────────────
  for (const policy of FLAG_PRIORITY_POLICY_V4) {
    if (flags.includes(policy.flag)) {
      const base: V4RiskAssessment = {
        risk_level:      policy.risk_level,
        bucket:          policy.bucket,
        reasons:         [policy.reason],
        decision_source: "flag_policy",
      };
      return _applyFormulaModifier(base, flags, formulaType);
    }
  }

  // ── C. Category base policy ────────────────────────────────────────────────
  if (category) {
    const catPolicy = CATEGORY_BASE_POLICY_V4[category];
    if (catPolicy) {
      const base: V4RiskAssessment = {
        risk_level:      catPolicy.risk_level,
        bucket:          catPolicy.bucket,
        reasons:         [catPolicy.reason],
        decision_source: "category_policy",
      };
      return _applyFormulaModifier(base, flags, formulaType);
    }
  }

  // ── D. Library risk_level fallback ────────────────────────────────────────
  if (match.risk_level) {
    const bucketMap: Record<string, V4RiskBucket> = {
      safe:        "safe",
      low_risk:    "low_risk",
      medium_risk: "medium_risk",
      high_risk:   "high_risk",
    };
    const bucket = bucketMap[match.risk_level] ?? "unknown";
    const base: V4RiskAssessment = {
      risk_level:      match.risk_level,
      bucket,
      reasons:         [`Library risk_level: ${match.risk_level}`],
      decision_source: "library_fallback",
    };
    return _applyFormulaModifier(base, flags, formulaType);
  }

  // ── E. Final fallback ──────────────────────────────────────────────────────
  return {
    risk_level:      "medium_risk",
    bucket:          "unknown",
    reasons:         ["No policy matched — risk undetermined"],
    decision_source: "unknown_fallback",
  };
}

// ── Formula modifier helper ────────────────────────────────────────────────────

/**
 * Applies formula-type-aware bucket override if applicable.
 * Only modifies `bucket`; does NOT change `risk_level` or `reasons`.
 * Adds modifier reason to the reasons array.
 */
function _applyFormulaModifier(
  base:        V4RiskAssessment,
  flags:       readonly string[],
  formulaType: V4FormulaType
): V4RiskAssessment {
  for (const modifier of FORMULA_PENALTY_MODIFIERS) {
    if (
      flags.includes(modifier.flag) &&
      modifier.formulaTypes.includes(formulaType)
    ) {
      return {
        ...base,
        bucket:  modifier.bucketOverride,
        reasons: [...base.reasons, `[formula:${formulaType}] ${modifier.reason}`],
      };
    }
  }
  return base;
}
