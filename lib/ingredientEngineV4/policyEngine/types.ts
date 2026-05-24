/**
 * policyEngine/types.ts — ingredientEngineV4
 *
 * Type contracts for V4 policy engine.
 * Policies are pure data tables — no logic lives here.
 * Engine.ts is the executor.
 */

import type { V4RiskLevel, IngredientFlag, IngredientCategory } from "../registry/types";
import type { V4FormulaType } from "../formulaClassifier";

// ── Risk bucket (scoring unit) ─────────────────────────────────────────────────

export type V4RiskBucket =
  | "safe"
  | "low_risk"
  | "medium_risk"
  | "high_risk"
  | "unknown";

// ── Decision source (audit trail) ─────────────────────────────────────────────

export type V4DecisionSource =
  | "canonical_override"
  | "flag_policy"
  | "category_policy"
  | "library_fallback"
  | "unknown_fallback";

// ── Risk policy shape ──────────────────────────────────────────────────────────

export interface V4RiskPolicy {
  risk_level: V4RiskLevel;
  bucket:     V4RiskBucket;
  reason:     string;
}

// ── Canonical override ────────────────────────────────────────────────────────

export type CanonicalOverrideMap = Record<string, V4RiskPolicy>;

// ── Flag priority policy ───────────────────────────────────────────────────────

export interface FlagPolicy extends V4RiskPolicy {
  flag: IngredientFlag;
}

// ── Category base policy ──────────────────────────────────────────────────────

export type CategoryPolicyMap = Partial<Record<IngredientCategory, V4RiskPolicy>>;

// ── Formula-type penalty modifier ─────────────────────────────────────────────
// Per-flag adjustments that activate only for certain formula types.
// positive modifier = reduce severity (less penalty)
// negative modifier = increase severity (more penalty)

export interface FormulaPenaltyModifier {
  flag:         IngredientFlag;
  formulaTypes: V4FormulaType[];
  bucketOverride: V4RiskBucket;
  reason:       string;
}

// ── Risk assessment (output of engine) ───────────────────────────────────────

export interface V4RiskAssessment {
  risk_level:      V4RiskLevel;
  bucket:          V4RiskBucket;
  reasons:         string[];
  decision_source: V4DecisionSource;
}
