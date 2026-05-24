/**
 * resolver.ts — productAnalysisV3
 *
 * Normalizes a raw ingredient token and matches it against
 * GENERATED_MOBILE_LIBRARY (canonical dataset, 317 entries).
 *
 * Data source: ingredientLibraryGenerator → GENERATED_MOBILE_LIBRARY
 * Old source: ingredientLibrary (114 entries) — kept but no longer used here.
 *
 * V3 now uses canonical dataset: YES
 */

import { GENERATED_MOBILE_LIBRARY } from "../ingredientLibraryGenerator";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResolvedIngredient {
  raw: string;
  normalized: string;
  canonical_name: string | null;
  category: string | null;
  flags: string[];
  risk_level: "low" | "medium" | "high" | "unknown" | null;
  matched: boolean;
}

// ── Pre-normalization alias map ────────────────────────────────────────────────
// Applied BEFORE matching to handle common raw-text variations that the INCI
// system uses interchangeably. Keyed by normalized input → preferred lookup term.

const PRE_NORM_ALIASES: Record<string, string> = {
  // Fragrance / parfum variants
  "parfum":             "fragrance",
  "aroma":              "fragrance",
  "perfume":            "fragrance",
  // Water variants
  "aqua":               "water",
  "eau":                "water",
  // Vitamin C shorthand
  "vitamin c":          "ascorbic acid",
  "vitamin e":          "tocopherol",
  "vitamin a":          "retinol",
  // Glycerin variants
  "glycerine":          "glycerin",
  "glycerol":           "glycerin",
  // Common shorthand
  "squalene":           "squalane",
  "beeswax":            "beeswax",
  "cera alba":          "beeswax",
  // Hyaluronic acid family
  "ha":                 "hyaluronic acid",
  "hya":                "hyaluronic acid",
  // BHA/BHT shorthand handled via library aliases already
};

// ── Text normalizer ────────────────────────────────────────────────────────────

/**
 * Reduces an ingredient token to a flat, comparison-safe string:
 * 1. lowercase
 * 2. collapse dashes/underscores to spaces
 * 3. remove all punctuation except spaces and alphanumerics
 * 4. collapse whitespace
 * 5. apply pre-normalization alias substitution
 */
function normalizeKey(str: string): string {
  const base = str
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9 /]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return PRE_NORM_ALIASES[base] ?? base;
}

// ── Build indexed library ──────────────────────────────────────────────────────

const NORMALIZED_LIB = GENERATED_MOBILE_LIBRARY.map((entry) => ({
  canonical_name: entry.canonical_name,
  category:       entry.category,
  flags:          entry.flags as string[],
  risk_level:     entry.risk_level as "low" | "medium" | "high" | "unknown",
  normalizedAliases: (entry.aliases as string[]).map(normalizeKey),
}));

// ── Core resolver ──────────────────────────────────────────────────────────────

export function resolveIngredient(token: string): ResolvedIngredient {
  const normalized = normalizeKey(token);

  // 1. Exact alias match (preferred)
  const exactRecord = NORMALIZED_LIB.find((lib) =>
    lib.normalizedAliases.some((alias) => normalized === alias)
  );

  // 2. Substring match — only used as fallback to reduce false positives
  const record =
    exactRecord ??
    NORMALIZED_LIB.find((lib) =>
      lib.normalizedAliases.some(
        (alias) =>
          alias.length >= 5 &&
          normalized.length >= 5 &&
          (normalized.includes(alias) || alias.includes(normalized))
      )
    );

  if (record) {
    return {
      raw:            token,
      normalized,
      canonical_name: record.canonical_name,
      category:       record.category,
      flags:          record.flags,
      risk_level:     record.risk_level,
      matched:        true,
    };
  }

  return {
    raw:            token,
    normalized,
    canonical_name: null,
    category:       null,
    flags:          [],
    risk_level:     null,
    matched:        false,
  };
}

// ── Debug helper ───────────────────────────────────────────────────────────────

export interface ResolverDebugReport {
  source:           string;
  library_size:     number;
  total_tokens:     number;
  matched_count:    number;
  unknown_count:    number;
  coverage_pct:     number;
  unknown_pct:      number;
  top_unmatched:    string[];
}

/**
 * Resolves a batch of tokens and returns a debug summary.
 * Call this in dev/debug flows — NOT in production hot paths.
 */
export function debugResolveBatch(tokens: string[]): ResolverDebugReport {
  const results = tokens.map((t) => resolveIngredient(t));

  const matched   = results.filter((r) => r.matched);
  const unmatched = results.filter((r) => !r.matched);

  const total         = results.length;
  const matched_count = matched.length;
  const unknown_count = unmatched.length;
  const coverage_pct  = total > 0 ? Math.round((matched_count / total) * 100) : 0;
  const unknown_pct   = total > 0 ? Math.round((unknown_count / total) * 100) : 0;

  const top_unmatched = unmatched
    .slice(0, 10)
    .map((r) => r.raw);

  return {
    source:        "GENERATED_MOBILE_LIBRARY (canonical dataset, 317 entries)",
    library_size:  GENERATED_MOBILE_LIBRARY.length,
    total_tokens:  total,
    matched_count,
    unknown_count,
    coverage_pct,
    unknown_pct,
    top_unmatched,
  };
}
