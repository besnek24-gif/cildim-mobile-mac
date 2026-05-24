/**
 * matcher.ts — ingredientIntelligence
 *
 * Resolves individual ingredient tokens against the canonical library.
 * Uses three-tier matching: exact → normalized → soft-variant.
 * No silent fallback to "safe" — unresolved tokens return matched: false.
 */

import { GENERATED_MOBILE_LIBRARY } from "../ingredientLibraryGenerator";
import { normalizeToken, flattenKey } from "./aliasNormalizer";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MatchResult {
  raw:            string;
  normalized:     string;
  canonical_name: string | null;
  category:       string | null;
  risk_level:     string | null;
  flags:          string[];
  matched:        boolean;
  match_tier:     "exact" | "normalized" | "soft" | "none";
}

// ── Index build ────────────────────────────────────────────────────────────────

interface IndexedEntry {
  canonical_name:    string;
  category:          string;
  risk_level:        string;
  flags:             string[];
  normalizedAliases: string[];
  flatAliases:       string[];
}

const LIBRARY_INDEX: IndexedEntry[] = GENERATED_MOBILE_LIBRARY.map((entry) => {
  const normalizedAliases = (entry.aliases as string[]).map(normalizeToken);
  return {
    canonical_name:    entry.canonical_name,
    category:          entry.category,
    risk_level:        entry.risk_level,
    flags:             entry.flags as string[],
    normalizedAliases,
    flatAliases:       normalizedAliases.map(flattenKey),
  };
});

// ── Match helper ───────────────────────────────────────────────────────────────

function buildResult(
  raw: string,
  normalized: string,
  entry: IndexedEntry,
  tier: "exact" | "normalized" | "soft"
): MatchResult {
  return {
    raw,
    normalized,
    canonical_name: entry.canonical_name,
    category:       entry.category,
    risk_level:     entry.risk_level,
    flags:          entry.flags,
    matched:        true,
    match_tier:     tier,
  };
}

// ── Core matcher ───────────────────────────────────────────────────────────────

/**
 * Resolves a single raw ingredient token against the canonical library.
 *
 * Matching strategy (in priority order):
 * 1. Exact normalized alias match
 * 2. Flat-key match (removes spaces/slashes — catches hyphen variants)
 * 3. Substring soft match (min 6 chars each — conservative)
 *
 * Returns matched: false if none of the above succeed.
 */
export function matchIngredient(raw: string): MatchResult {
  const normalized = normalizeToken(raw);
  const flatNorm   = flattenKey(normalized);

  // Tier 1: exact normalized match
  for (const entry of LIBRARY_INDEX) {
    if (entry.normalizedAliases.includes(normalized)) {
      return buildResult(raw, normalized, entry, "exact");
    }
  }

  // Tier 2: flat-key match (hyphen/space variants)
  if (flatNorm.length >= 4) {
    for (const entry of LIBRARY_INDEX) {
      if (entry.flatAliases.includes(flatNorm)) {
        return buildResult(raw, normalized, entry, "normalized");
      }
    }
  }

  // Tier 3: substring soft match — conservative (both sides min 6 chars)
  if (normalized.length >= 6) {
    for (const entry of LIBRARY_INDEX) {
      for (const alias of entry.normalizedAliases) {
        if (
          alias.length >= 6 &&
          (normalized.includes(alias) || alias.includes(normalized))
        ) {
          return buildResult(raw, normalized, entry, "soft");
        }
      }
    }
  }

  // No match
  return {
    raw,
    normalized,
    canonical_name: null,
    category:       null,
    risk_level:     null,
    flags:          [],
    matched:        false,
    match_tier:     "none",
  };
}

/**
 * Resolves a batch of tokens and returns all match results.
 */
export function matchBatch(tokens: string[]): MatchResult[] {
  return tokens.map(matchIngredient);
}

/**
 * Returns summary statistics for a batch of match results.
 */
export function batchStats(results: MatchResult[]): {
  total: number;
  matched: number;
  unmatched: number;
  coverage_pct: number;
  by_tier: Record<string, number>;
} {
  const total     = results.length;
  const matched   = results.filter((r) => r.matched).length;
  const unmatched = total - matched;

  const by_tier: Record<string, number> = { exact: 0, normalized: 0, soft: 0, none: 0 };
  for (const r of results) {
    by_tier[r.match_tier]++;
  }

  return {
    total,
    matched,
    unmatched,
    coverage_pct: total > 0 ? Math.round((matched / total) * 100) : 0,
    by_tier,
  };
}
