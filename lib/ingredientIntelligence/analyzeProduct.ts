/**
 * analyzeProduct.ts — ingredientIntelligence
 *
 * Full ingredient intelligence pipeline:
 *   raw text → parser → matcher → riskEngine → summary → result
 *
 * Output conforms to the IngredientIntelligenceResult contract.
 * Does NOT modify any UI or scoring — pure backbone pipeline.
 *
 * v1.1: AnalyzedItem now includes decision_source from riskEngine.
 */

import { parseIngredients }                       from "./parser";
import { matchIngredient }                         from "./matcher";
import { assessRisk }                             from "./riskEngine";
import { enqueueUnresolved }                      from "./unresolvedQueue";
import type { RiskLevel, RiskBucket, DecisionSource } from "./riskEngine";

// ── Output types ───────────────────────────────────────────────────────────────

export interface AnalyzedItem {
  raw:             string;
  normalized:      string;
  canonical_name:  string | null;
  category:        string | null;
  flags:           string[];
  matched:         boolean;
  match_tier:      string;
  risk_level:      RiskLevel;
  bucket:          RiskBucket;
  reasons:         string[];
  decision_source: DecisionSource;  // NEW in v1.1 — audit trail
}

export interface IngredientIntelligenceSummary {
  total:        number;
  safe:         number;
  low_risk:     number;
  medium_risk:  number;
  high_risk:    number;
  unknown:      number;
  coverage_pct: number;
}

export interface IngredientIntelligenceResult {
  version:    "ingredient_intelligence_v1";
  raw_text:   string;
  tokens:     string[];
  items:      AnalyzedItem[];
  summary:    IngredientIntelligenceSummary;
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

/**
 * Analyzes a raw INCI ingredient string through the full pipeline.
 *
 * @param rawText    Raw ingredient text from product label
 * @param productId  Optional product identifier for unresolved queue tracking
 */
export function analyzeProduct(
  rawText: string,
  productId: string = "unknown"
): IngredientIntelligenceResult {
  // Stage 1: Parse
  const tokens = parseIngredients(rawText);

  // Stage 2 → 3: Match + Risk
  const items: AnalyzedItem[] = tokens.map((raw) => {
    const match = matchIngredient(raw);
    const risk  = assessRisk(match);

    // Stage 3.5: Enqueue unknowns for review
    if (!match.matched) {
      enqueueUnresolved(match.normalized, raw, productId);
    }

    return {
      raw:             match.raw,
      normalized:      match.normalized,
      canonical_name:  match.canonical_name,
      category:        match.category,
      flags:           match.flags,
      matched:         match.matched,
      match_tier:      match.match_tier,
      risk_level:      risk.risk_level,
      bucket:          risk.bucket,
      reasons:         risk.reasons,
      decision_source: risk.decision_source,
    };
  });

  // Stage 4: Summary
  const total    = items.length;
  const matched  = items.filter((i) => i.matched).length;
  const buckets  = { safe: 0, low_risk: 0, medium_risk: 0, high_risk: 0, unknown: 0 };

  for (const item of items) {
    const b = item.bucket as keyof typeof buckets;
    if (b in buckets) buckets[b]++;
    else              buckets.unknown++;
  }

  const summary: IngredientIntelligenceSummary = {
    total,
    ...buckets,
    coverage_pct: total > 0 ? Math.round((matched / total) * 100) : 0,
  };

  return {
    version:  "ingredient_intelligence_v1",
    raw_text: rawText,
    tokens,
    items,
    summary,
  };
}

/**
 * Returns warning flags extracted from an analysis result.
 * Useful for product safety alerts.
 */
export function extractWarnings(result: IngredientIntelligenceResult): string[] {
  const warnings: string[] = [];
  const highRisk = result.items.filter((i) => i.bucket === "high_risk");

  for (const item of highRisk) {
    if (item.flags.includes("fragrance") || item.flags.includes("allergen")) {
      warnings.push(`fragrance_allergen:${item.canonical_name ?? item.raw}`);
    } else if (item.flags.includes("drying_alcohol")) {
      warnings.push("drying_alcohol");
    } else {
      warnings.push(`high_risk:${item.canonical_name ?? item.raw}`);
    }
  }

  if (result.summary.unknown > 3) {
    warnings.push("low_coverage:many_unknowns");
  }

  return [...new Set(warnings)]; // deduplicate
}
