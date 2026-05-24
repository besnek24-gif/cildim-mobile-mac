/**
 * ingredientIntelligence/index.ts
 *
 * Public API for the Ingredient Intelligence System v1.1.
 *
 * Architecture:
 *   raw ingredient text
 *     → parser            (tokenize INCI string)
 *     → matcher           (resolve against 317-entry canonical library)
 *     → riskPolicies      (declarative policy tables — single source of truth)
 *     → riskEngine        (A: canonical_override → B: flag_policy → C: category_policy → D: fallback)
 *     → analyzeProduct    (assemble pipeline result + decision_source per item)
 *     → scoreEngine       (0-100 score + confidence + warnings)
 *     → validationProfiles (expected bucket ranges per formula type)
 *     → profileValidator  (validate analysis against formula profile)
 *     → unresolvedQueue   (capture unknowns for expansion)
 *     → corpusBuilder     (build corpus from product batch)
 *
 * Rules:
 * - Does NOT replace existing UI or scoring
 * - Does NOT delete old ingredient logic
 * - Built as a parallel backbone — ready to become single source of truth
 */

// ── Parser ────────────────────────────────────────────────────────────────────
export { parseIngredients, countIngredients } from "./parser";

// ── Normalizer ────────────────────────────────────────────────────────────────
export {
  normalizeToken,
  normalizeRaw,
  applyAliasMap,
  flattenKey,
  softMatch,
  PRE_NORM_MAP,
} from "./aliasNormalizer";

// ── Matcher ───────────────────────────────────────────────────────────────────
export { matchIngredient, matchBatch, batchStats } from "./matcher";
export type { MatchResult } from "./matcher";

// ── Risk Policies (single source of truth for all risk decisions) ─────────────
export {
  CANONICAL_OVERRIDES,
  FLAG_PRIORITY_POLICY,
  CATEGORY_BASE_POLICY,
  BUCKET_MAPPING,
  normalizeCategory,
} from "./riskPolicies";
export type { RiskPolicy } from "./riskPolicies";

// ── Risk Engine ───────────────────────────────────────────────────────────────
export { assessRisk } from "./riskEngine";
export type { RiskLevel, RiskBucket, DecisionSource, RiskAssessment } from "./riskEngine";

// ── Product Analyzer ──────────────────────────────────────────────────────────
export { analyzeProduct, extractWarnings } from "./analyzeProduct";
export type {
  AnalyzedItem,
  IngredientIntelligenceSummary,
  IngredientIntelligenceResult,
} from "./analyzeProduct";

// ── Score Engine ──────────────────────────────────────────────────────────────
export { calculateIngredientScore, scoreLabel } from "./scoreEngine";
export type { IngredientScore, ScoreConfidence } from "./scoreEngine";

// ── Validation Profiles ───────────────────────────────────────────────────────
export { VALIDATION_PROFILES, detectFormulaType } from "./validationProfiles";
export type { FormulaType, ValidationProfile, BucketRange } from "./validationProfiles";

// ── Profile Validator ─────────────────────────────────────────────────────────
export { validateAnalysisProfile, findMatchingProfiles } from "./profileValidator";
export type { BucketValidation, ProfileValidationResult } from "./profileValidator";

// ── Unresolved Queue ──────────────────────────────────────────────────────────
export {
  enqueueUnresolved,
  getUnresolvedQueue,
  getHighFrequencyUnresolved,
  getQueueSize,
  clearQueue,
  exportQueueSnapshot,
  importQueueSnapshot,
} from "./unresolvedQueue";
export type { UnresolvedEntry } from "./unresolvedQueue";

// ── Corpus Builder ────────────────────────────────────────────────────────────
export { buildCorpus, printCorpusReport } from "./corpusBuilder";
export type { ProductInput, CorpusToken, CorpusBuildResult } from "./corpusBuilder";

// ── Corpus data ───────────────────────────────────────────────────────────────
export { MASTER_CORPUS, CORPUS_META } from "./data/masterCorpus";
export type { CorpusEntry } from "./data/masterCorpus";

// ── Convenience: analyze one product end-to-end ───────────────────────────────

import { analyzeProduct }            from "./analyzeProduct";
import { calculateIngredientScore }  from "./scoreEngine";
import type { IngredientIntelligenceResult } from "./analyzeProduct";
import type { IngredientScore }      from "./scoreEngine";

export interface FullProductAnalysis {
  analysis: IngredientIntelligenceResult;
  score:    IngredientScore;
}

/**
 * One-call convenience: parse → match → risk → score.
 * Automatically enqueues unresolved tokens.
 *
 * @param rawText    Raw INCI ingredient string
 * @param productId  Optional product name/ID for queue tracking
 */
export function analyzeProductFull(
  rawText: string,
  productId?: string
): FullProductAnalysis {
  const analysis = analyzeProduct(rawText, productId);
  const score    = calculateIngredientScore(analysis);
  return { analysis, score };
}
