/**
 * riskEngine.ts — ingredientIntelligence
 *
 * Policy-driven risk classifier. Consumes riskPolicies.ts as the single
 * source of truth. Decision order is strict and auditable:
 *
 *   A. CANONICAL_OVERRIDES   → decision_source: "canonical_override"
 *   B. FLAG_PRIORITY_POLICY  → decision_source: "flag_policy"
 *   C. CATEGORY_BASE_POLICY  → decision_source: "category_policy"
 *   D. BUCKET_MAPPING        → decision_source: "library_fallback"
 *   E. Unknown               → decision_source: "fallback_unknown"
 *
 * riskEngine.ts is the executor.
 * riskPolicies.ts is the author of all decisions.
 */

import type { MatchResult } from "./matcher";
import {
  CANONICAL_OVERRIDES,
  FLAG_PRIORITY_POLICY,
  CATEGORY_BASE_POLICY,
  BUCKET_MAPPING,
  normalizeCategory,
} from "./riskPolicies";

// ── Types (exported — consumed by analyzeProduct.ts) ──────────────────────────

export type RiskLevel  = "low" | "medium" | "high" | "unknown";
export type RiskBucket = "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown";
export type DecisionSource =
  | "canonical_override"
  | "flag_policy"
  | "category_policy"
  | "library_fallback"
  | "fallback_unknown";

export interface RiskAssessment {
  risk_level:      RiskLevel;
  bucket:          RiskBucket;
  reasons:         string[];
  decision_source: DecisionSource;
}

// ── Core engine ────────────────────────────────────────────────────────────────

/**
 * Classifies a resolved ingredient's risk using the policy tables.
 * Returns a full RiskAssessment including the decision_source for auditability.
 */
export function assessRisk(match: MatchResult): RiskAssessment {
  // ── Unmatched ingredient → unknown ────────────────────────────────────────
  if (!match.matched || !match.canonical_name) {
    return {
      risk_level:      "unknown",
      bucket:          "unknown",
      reasons:         ["Ingredient not found in canonical library"],
      decision_source: "fallback_unknown",
    };
  }

  const { flags, canonical_name: cname } = match;
  const category = normalizeCategory(match.category);

  // ── A. Canonical override ─────────────────────────────────────────────────
  const override = CANONICAL_OVERRIDES[cname];
  if (override) {
    return {
      risk_level:      override.risk_level,
      bucket:          override.bucket,
      reasons:         [override.reason],
      decision_source: "canonical_override",
    };
  }

  // ── B. Flag priority policy ───────────────────────────────────────────────
  // Iterate in priority order (highest first). First match wins.
  for (const policy of FLAG_PRIORITY_POLICY) {
    if (flags.includes(policy.flag)) {
      return {
        risk_level:      policy.risk_level,
        bucket:          policy.bucket,
        reasons:         [policy.reason],
        decision_source: "flag_policy",
      };
    }
  }

  // ── C. Category base policy ───────────────────────────────────────────────
  if (category) {
    const catPolicy = CATEGORY_BASE_POLICY[category];
    if (catPolicy) {
      return {
        risk_level:      catPolicy.risk_level,
        bucket:          catPolicy.bucket,
        reasons:         [catPolicy.reason],
        decision_source: "category_policy",
      };
    }
  }

  // ── D. Library risk_level → BUCKET_MAPPING fallback ───────────────────────
  if (match.risk_level) {
    const bucket = BUCKET_MAPPING[match.risk_level] as RiskBucket | undefined;
    if (bucket) {
      return {
        risk_level:      match.risk_level as RiskLevel,
        bucket,
        reasons:         [`Library risk_level: ${match.risk_level} (no category/flag match)`],
        decision_source: "library_fallback",
      };
    }
  }

  // ── E. Final fallback ─────────────────────────────────────────────────────
  return {
    risk_level:      "unknown",
    bucket:          "unknown",
    reasons:         ["No policy matched — risk undetermined"],
    decision_source: "fallback_unknown",
  };
}
