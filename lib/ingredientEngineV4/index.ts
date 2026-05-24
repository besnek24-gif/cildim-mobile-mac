/**
 * index.ts — ingredientEngineV4
 *
 * Public API for the V4 ingredient analysis engine.
 *
 * This is the ONLY file consumers should import from.
 * Internal modules (registry, normalizer, etc.) are NOT public.
 *
 * ⚠️  NOT CONNECTED TO UI — V4 is isolated.
 *     Connect only after full validation passes.
 *
 * Usage:
 *   import { analyzeV4, V4_REGISTRY, getV4RegistryStats } from "lib/ingredientEngineV4";
 *
 *   const result = analyzeV4({ rawIngredientsText: "Water, Glycerin, Niacinamide..." });
 *   console.log(result.finalScore, result.formulaType, result.warnings);
 */

// ── Primary pipeline ───────────────────────────────────────────────────────────

export { analyzeProductV4 } from "./analyzeProductV4";
export type { V4AnalysisInput }    from "./analyzeProductV4";

// Convenience alias (named re-export)
export { analyzeProductV4 as analyzeV4 } from "./analyzeProductV4";

// ── Score types ────────────────────────────────────────────────────────────────

export type {
  V4ProductScore,
  V4ScoredIngredient,
  V4Warning,
  V4ScoreBreakdown,
  V4ScoreConfidence,
  V4ScoreLabel,
  V4AnalysisItem,
} from "./scorer";

export { getV4ScoreLabel }        from "./scorer";

// ── Registry ───────────────────────────────────────────────────────────────────

export { V4_REGISTRY, matchV4Ingredient, getV4RegistryStats } from "./registry";
export type { V4RegistryEntry, V4MatchResult }                 from "./registry/types";

// ── Normalizer ─────────────────────────────────────────────────────────────────

export { parseV4Ingredients, normalizeV4Token, flattenV4Key } from "./normalizer";

// ── Formula classifier ────────────────────────────────────────────────────────

export { classifyV4Formula }             from "./formulaClassifier";
export type { V4FormulaType, FormulaClassification } from "./formulaClassifier";

// ── Unknown queue ──────────────────────────────────────────────────────────────

export {
  getV4UnresolvedQueue,
  getV4HighFrequencyUnresolved,
  getV4QueueSize,
  clearV4Queue,
  exportV4QueueSnapshot,
  importV4QueueSnapshot,
  mergeV4QueueSnapshot,
} from "./unknownQueue";
export type { V4UnresolvedEntry } from "./unknownQueue";

// ── Policy engine types ────────────────────────────────────────────────────────

export type { V4RiskBucket, V4RiskAssessment, V4DecisionSource } from "./policyEngine/types";
