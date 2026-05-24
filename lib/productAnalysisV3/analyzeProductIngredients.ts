/**
 * analyzeProductIngredients.ts — productAnalysisV3
 *
 * Full pipeline: parse → resolve → risk → summary
 */

import { parseIngredients } from "./parser";
import { resolveIngredient } from "./resolver";
import { getIngredientRisk } from "./riskEngine";
import { buildIngredientSummary } from "./summary";
import type { RiskLevel, RiskBucket } from "./riskEngine";

export interface AnalyzedIngredient {
  raw: string;
  normalized: string;
  canonical_name: string | null;
  category: string | null;
  flags: string[];
  matched: boolean;
  risk_level: RiskLevel;
  bucket: RiskBucket;
  reasons: string[];
}

export interface ProductAnalysisV3 {
  version: "v3";
  raw_text: string;
  tokens: string[];
  items: AnalyzedIngredient[];
  summary: {
    total: number;
    safe: number;
    low_risk: number;
    medium_risk: number;
    high_risk: number;
    unknown: number;
    coverage_pct: number;
  };
}

export function analyzeProductIngredients(rawText: string): ProductAnalysisV3 {
  const tokens = parseIngredients(rawText);

  const items: AnalyzedIngredient[] = tokens.map((token) => {
    const resolved = resolveIngredient(token);
    const risk = getIngredientRisk(resolved);
    return {
      raw: resolved.raw,
      normalized: resolved.normalized,
      canonical_name: resolved.canonical_name,
      category: resolved.category,
      flags: resolved.flags,
      matched: resolved.matched,
      risk_level: risk.risk_level,
      bucket: risk.bucket,
      reasons: risk.reasons,
    };
  });

  const summary = buildIngredientSummary(items);

  return {
    version: "v3",
    raw_text: rawText,
    tokens,
    items,
    summary,
  };
}
