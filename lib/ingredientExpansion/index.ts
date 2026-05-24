/**
 * ingredientExpansion/index.ts
 *
 * Public API for the Unknown Ingredient Expansion System.
 *
 * Pipeline:
 *   V3 results
 *     → collectUnknownsFromBatch()   (unknownCollector)
 *     → analyzeUnknowns()            (unknownAnalyzer)
 *     → generateDraftEntries()       (draftEntryGenerator)
 *     → formatAsTsSnippet()          (for manual promotion)
 *
 * Nothing here auto-merges into production. All draft entries
 * carry `needs_validation: true` and require human review.
 */

export {
  collectUnknowns,
  collectUnknownsFromBatch,
} from "./unknownCollector";
export type { UnknownEntry, UnknownCollection } from "./unknownCollector";

export {
  analyzeUnknowns,
  groupByCategory,
} from "./unknownAnalyzer";
export type {
  AnalyzedUnknown,
  SuggestedCategory,
  DefaultRiskLevel,
} from "./unknownAnalyzer";

export {
  generateDraftEntries,
  formatAsTsSnippet,
} from "./draftEntryGenerator";
export type { DraftCanonicalEntry, DraftReport } from "./draftEntryGenerator";

// ── Convenience: run full pipeline in one call ─────────────────────────────────

import { collectUnknownsFromBatch } from "./unknownCollector";
import { analyzeUnknowns }          from "./unknownAnalyzer";
import { generateDraftEntries }     from "./draftEntryGenerator";
import type { ProductAnalysisV3 }   from "../productAnalysisV3/analyzeProductIngredients";

export interface ExpansionPipelineResult {
  collection: ReturnType<typeof collectUnknownsFromBatch>;
  analyzed:   ReturnType<typeof analyzeUnknowns>;
  drafts:     ReturnType<typeof generateDraftEntries>;
  coverage_improvement_estimate_pct: number;
}

/**
 * Runs the full expansion pipeline on a batch of V3 analysis results.
 *
 * @param batch         Array of { productName, analysis } pairs
 * @param minFrequency  Only generate drafts for tokens seen >= N times
 */
export function runExpansionPipeline(
  batch: Array<{ productName?: string; analysis: ProductAnalysisV3 }>,
  options: { minFrequency?: number; includeOther?: boolean } = {}
): ExpansionPipelineResult {
  const { minFrequency = 1, includeOther = false } = options;

  const collection = collectUnknownsFromBatch(batch);
  const analyzed   = analyzeUnknowns(collection.entries);
  const drafts     = generateDraftEntries(analyzed, { minFrequency, includeOther });

  // Estimate: how much of the unknown % would be covered if drafts were promoted
  const potentiallyCovered = analyzed.filter(
    (a) => a.confidence !== "low" || a.suggested_category !== "other"
  ).reduce((sum, a) => sum + a.frequency, 0);

  const coverage_improvement_estimate_pct =
    collection.total_tokens > 0
      ? Math.round((potentiallyCovered / collection.total_tokens) * 100)
      : 0;

  return {
    collection,
    analyzed,
    drafts,
    coverage_improvement_estimate_pct,
  };
}
