/**
 * summary.ts — productAnalysisV3
 *
 * Aggregates per-item risk classifications into a summary object.
 */

export interface IngredientSummary {
  total: number;
  safe: number;
  low_risk: number;
  medium_risk: number;
  high_risk: number;
  unknown: number;
  coverage_pct: number;
}

interface SummaryInput {
  matched: boolean;
  bucket: string;
}

export function buildIngredientSummary(items: SummaryInput[]): IngredientSummary {
  const total = items.length;
  const matched = items.filter((i) => i.matched).length;

  const counts = { safe: 0, low_risk: 0, medium_risk: 0, high_risk: 0, unknown: 0 };
  for (const item of items) {
    const b = item.bucket as keyof typeof counts;
    if (b in counts) {
      counts[b]++;
    } else {
      counts.unknown++;
    }
  }

  const coverage_pct = total > 0 ? Math.round((matched / total) * 100) : 0;

  return { total, coverage_pct, ...counts };
}
