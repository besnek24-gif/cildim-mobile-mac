/**
 * index.ts — productAnalysisV3
 *
 * Public re-exports for the V3 ingredient analysis pipeline.
 */

export { parseIngredients } from "./parser";
export { resolveIngredient } from "./resolver";
export type { ResolvedIngredient } from "./resolver";
export { getIngredientRisk } from "./riskEngine";
export type { IngredientRisk, RiskLevel, RiskBucket } from "./riskEngine";
export { buildIngredientSummary } from "./summary";
export type { IngredientSummary } from "./summary";
export { analyzeProductIngredients } from "./analyzeProductIngredients";
export type { AnalyzedIngredient, ProductAnalysisV3 } from "./analyzeProductIngredients";
