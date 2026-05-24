/**
 * unknownCollector.ts — ingredientExpansion
 *
 * Reads V3 pipeline output and collects all unmatched ingredient tokens.
 * Does NOT modify V3 logic. Accepts ProductAnalysisV3 as read-only input.
 *
 * Usage:
 *   const result = analyzeProductIngredients(rawText);
 *   const unknowns = collectUnknowns(result);
 */

import type { ProductAnalysisV3 } from "../productAnalysisV3/analyzeProductIngredients";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UnknownEntry {
  raw:        string;
  normalized: string;
  frequency:  number;
}

export interface UnknownCollection {
  total_products: number;
  total_tokens:   number;
  total_unknowns: number;
  unique_unknowns: number;
  entries:        UnknownEntry[];
}

// ── Normalizer (mirrors resolver.ts normalizeKey — standalone copy) ────────────

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9 /]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Single-product collector ───────────────────────────────────────────────────

/**
 * Returns normalized strings of every unmatched item in one V3 analysis result.
 */
export function collectUnknowns(result: ProductAnalysisV3): string[] {
  return result.items
    .filter((item) => !item.matched)
    .map((item) => item.normalized);
}

// ── Batch collector ────────────────────────────────────────────────────────────

/**
 * Processes multiple V3 results and returns a deduplicated, frequency-ranked
 * collection of unknown ingredient tokens.
 */
export function collectUnknownsFromBatch(
  results: Array<{ productName?: string; analysis: ProductAnalysisV3 }>
): UnknownCollection {
  const freq: Map<string, { raw: string; normalized: string; count: number }> =
    new Map();

  let total_tokens   = 0;
  let total_unknowns = 0;

  for (const { analysis } of results) {
    total_tokens += analysis.items.length;

    for (const item of analysis.items) {
      if (!item.matched) {
        total_unknowns++;
        const key = item.normalized;
        const existing = freq.get(key);
        if (existing) {
          existing.count++;
        } else {
          freq.set(key, { raw: item.raw, normalized: item.normalized, count: 1 });
        }
      }
    }
  }

  const entries: UnknownEntry[] = Array.from(freq.values())
    .map(({ raw, normalized, count }) => ({
      raw,
      normalized,
      frequency: count,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  return {
    total_products:  results.length,
    total_tokens,
    total_unknowns,
    unique_unknowns: entries.length,
    entries,
  };
}
