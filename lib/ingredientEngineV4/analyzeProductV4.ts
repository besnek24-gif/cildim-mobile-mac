/**
 * analyzeProductV4.ts — ingredientEngineV4
 *
 * Full V4 analysis pipeline.
 * Orchestrates: parse → normalize → match → assess risk → classify → score
 *
 * Entry point for all V4 analyses.
 * This is the ONLY file that wires all V4 modules together.
 *
 * ZERO imports from legacy/V3 systems.
 */

import { parseV4Ingredients }  from "./normalizer";
import { matchV4Ingredient }   from "./registry";
import { assessV4Risk }        from "./policyEngine/engine";
import { classifyV4Formula }   from "./formulaClassifier";
import { scoreV4Product }      from "./scorer";
import { enqueueV4Unknown }    from "./unknownQueue";

import type { V4ProductScore, V4AnalysisItem } from "./scorer";

// ── Public input type ──────────────────────────────────────────────────────────

export interface V4AnalysisInput {
  /** Raw INCI ingredient string from product packaging / database */
  rawIngredientsText: string;
  /** Optional product ID for unknown queue tracking */
  productId?: string;
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

/**
 * analyzeProductV4
 *
 * Full V4 analysis pipeline. Steps:
 *   1. Parse: rawText → string[]
 *   2. Match: string → V4MatchResult (registry lookup)
 *   3. Classify: V4MatchResult[] → FormulaClassification
 *   4. Assess: V4MatchResult + formulaType → V4RiskAssessment (with formula modifier)
 *   5. Score: V4AnalysisItem[] → V4ProductScore
 *   6. Side-effect: enqueue unknowns into V4 unknown queue
 *
 * Deterministic for a given rawIngredientsText + registry state.
 * Side-effect: enqueueV4Unknown() records unknown tokens (in-memory).
 */
export function analyzeProductV4(input: V4AnalysisInput): V4ProductScore {
  const { rawIngredientsText, productId = "unknown" } = input;

  // ── Step 1: Parse ────────────────────────────────────────────────────────────
  const tokens = parseV4Ingredients(rawIngredientsText);

  if (tokens.length === 0) {
    const emptyClass = classifyV4Formula([]);
    return scoreV4Product([], emptyClass, rawIngredientsText);
  }

  // ── Step 2: Match ────────────────────────────────────────────────────────────
  const matches = tokens.map((token) => matchV4Ingredient(token));

  // ── Step 3: Formula classify ─────────────────────────────────────────────────
  const classification = classifyV4Formula(matches);
  const { formulaType } = classification;

  // ── Step 4: Risk assess (formula-type-aware) ──────────────────────────────────
  const items: V4AnalysisItem[] = matches.map((match) => ({
    match,
    assessment: assessV4Risk(match, formulaType),
  }));

  // ── Step 5: Queue unknowns ────────────────────────────────────────────────────
  for (const { match } of items) {
    if (!match.matched) {
      enqueueV4Unknown(match.normalized, match.raw, productId);
    }
  }

  // ── Step 6: Score ─────────────────────────────────────────────────────────────
  return scoreV4Product(items, classification, rawIngredientsText);
}
