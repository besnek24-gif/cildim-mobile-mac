/**
 * corpusBuilder.ts — ingredientIntelligence
 *
 * Builds the master ingredient corpus from a batch of raw product data.
 * Input: array of { id, name, ingredients } product objects
 * Output: CorpusBuildResult (sorted by frequency, with match status)
 *
 * Used to:
 * 1. Bootstrap the canonical library from real product data
 * 2. Identify gaps (unknown tokens) for library expansion
 * 3. Track frequency per ingredient across the product catalog
 *
 * Design: pure functions, no DB access. DB querying is handled outside.
 */

import { parseIngredients }             from "./parser";
import { matchIngredient, batchStats }  from "./matcher";
import { normalizeToken }               from "./aliasNormalizer";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProductInput {
  id?:          string;
  name:         string;
  ingredients?: string | null;
}

export interface CorpusToken {
  raw:            string;
  normalized:     string;
  frequency:      number;
  matched:        boolean;
  canonical:      string | null;
  category:       string | null;
  seen_in:        string[];    // product names
}

export interface CorpusBuildResult {
  products_scanned:       number;
  products_with_data:     number;
  total_raw_tokens:       number;
  total_observations:     number;
  unique_matched:         number;
  unique_unknown:         number;
  coverage_pct:           number;
  tokens:                 CorpusToken[];
  top_50_frequent:        CorpusToken[];
  top_50_unknown:         CorpusToken[];
  ready_for_production:   boolean;
}

// ── Corpus builder ─────────────────────────────────────────────────────────────

/**
 * Builds the master ingredient corpus from an array of products.
 */
export function buildCorpus(products: ProductInput[]): CorpusBuildResult {
  const tokenMap = new Map<
    string,
    {
      raw:       string;
      normalized: string;
      frequency: number;
      matched:   boolean;
      canonical: string | null;
      category:  string | null;
      seen_in:   Set<string>;
    }
  >();

  let products_with_data = 0;
  let total_observations = 0;

  for (const product of products) {
    const rawText = product.ingredients ?? "";
    if (!rawText.trim()) continue;

    products_with_data++;
    const tokens = parseIngredients(rawText);

    for (const rawToken of tokens) {
      total_observations++;
      const normalized = normalizeToken(rawToken);
      const existing   = tokenMap.get(normalized);

      if (existing) {
        existing.frequency++;
        existing.seen_in.add(product.name);
        // Keep the most common raw form
      } else {
        const match = matchIngredient(rawToken);
        tokenMap.set(normalized, {
          raw:       rawToken,
          normalized,
          frequency: 1,
          matched:   match.matched,
          canonical: match.canonical_name,
          category:  match.category,
          seen_in:   new Set([product.name]),
        });
      }
    }
  }

  // Convert to sorted array
  const tokens: CorpusToken[] = Array.from(tokenMap.values())
    .map(({ raw, normalized, frequency, matched, canonical, category, seen_in }) => ({
      raw,
      normalized,
      frequency,
      matched,
      canonical,
      category,
      seen_in: Array.from(seen_in),
    }))
    .sort((a, b) => b.frequency - a.frequency);

  const matched_tokens = tokens.filter((t) => t.matched);
  const unknown_tokens = tokens.filter((t) => !t.matched);
  const matched_obs    = matched_tokens.reduce((s, t) => s + t.frequency, 0);
  const coverage_pct   = total_observations > 0
    ? Math.round((matched_obs / total_observations) * 100)
    : 0;

  return {
    products_scanned:     products.length,
    products_with_data,
    total_raw_tokens:     tokens.length,
    total_observations,
    unique_matched:       matched_tokens.length,
    unique_unknown:       unknown_tokens.length,
    coverage_pct,
    tokens,
    top_50_frequent:      tokens.slice(0, 50),
    top_50_unknown:       unknown_tokens.slice(0, 50),
    ready_for_production: coverage_pct >= 80 && unknown_tokens.length <= 60,
  };
}

/**
 * Prints a human-readable corpus report to the console.
 * Use in dev/admin flows only.
 */
export function printCorpusReport(result: CorpusBuildResult): void {
  console.log("══ INGREDIENT INTELLIGENCE — CORPUS REPORT ════════════════");
  console.log(`  Products scanned        : ${result.products_scanned}`);
  console.log(`  Products with data      : ${result.products_with_data}`);
  console.log(`  Total unique tokens     : ${result.total_raw_tokens}`);
  console.log(`  Total observations      : ${result.total_observations}`);
  console.log(`  Matched tokens          : ${result.unique_matched}`);
  console.log(`  Unknown tokens          : ${result.unique_unknown}`);
  console.log(`  Coverage                : ${result.coverage_pct}%`);
  console.log(`  Ready for production    : ${result.ready_for_production ? "YES" : "NO"}`);
  console.log();
  console.log("── TOP 20 MOST FREQUENT ────────────────────────────────────");
  result.top_50_frequent.slice(0, 20).forEach((t) => {
    const tag = t.matched ? `→ ${t.canonical}` : "→ UNKNOWN";
    console.log(`  [${String(t.frequency).padStart(2)}x] ${t.raw.padEnd(45)} ${tag}`);
  });
  console.log();
  console.log("── TOP 20 UNRESOLVED ───────────────────────────────────────");
  result.top_50_unknown.slice(0, 20).forEach((t) => {
    console.log(`  [${String(t.frequency).padStart(2)}x] ${t.raw}`);
  });
  console.log();
}
