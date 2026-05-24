/**
 * aliasNormalizer.ts — ingredientIntelligence
 *
 * Shared text normalization utilities for the ingredient intelligence system.
 * Used by parser, matcher, and corpus builder.
 *
 * Design: pure functions, no side effects, no imports.
 *
 * Normalization pipeline (in order):
 *   1. cleanUnicode  — strip invisible/problematic unicode, fix smart punctuation
 *   2. normalizeRaw  — lowercase, collapse whitespace, strip noise chars
 *   3. applyTypoCorrections — word-level OCR / typo fixes (e.g. "clyceryl" → "glyceryl")
 *   4. applyAliasMap — INCI synonym remapping + slash-variant handling
 *   → normalizeToken composes all four steps.
 */

// ── Step 1: Unicode cleaner ────────────────────────────────────────────────────
// Applied first so all downstream steps see clean ASCII-range text.

/**
 * Strips invisible unicode, normalizes punctuation variants.
 * Safe to call on any raw label text before further processing.
 */
export function cleanUnicode(s: string): string {
  return s
    // Zero-width characters (zero-width space, joiner, non-joiner, BOM, etc.)
    .replace(/[\u200b\u200c\u200d\u200e\u200f\u00ad\u00a0\ufeff\u2060]/g, " ")
    // Directional overrides / formatting marks
    .replace(/[\u202a\u202b\u202c\u202d\u202e\u202f]/g, "")
    // Soft hyphen → hard hyphen
    .replace(/\u00ad/g, "-")
    // Smart quotes → neutral
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    // Em dash / en dash → hyphen
    .replace(/[\u2013\u2014]/g, "-")
    // Ellipsis → single dot
    .replace(/\u2026/g, ".")
    // Repeated hyphens / dashes → single
    .replace(/-{2,}/g, "-")
    // Repeated dots → single
    .replace(/\.{2,}/g, ".")
    // Trim stray whitespace that unicode cleaning may have introduced
    .replace(/\s+/g, " ")
    .trim();
}

// ── Step 2: Raw normalizer ─────────────────────────────────────────────────────

/**
 * Converts a cleaned INCI token to a comparison-safe lowercase form.
 * Retains "/" for step 4 (alias map) which handles slash variants.
 */
export function normalizeRaw(s: string): string {
  return cleanUnicode(s)
    .toLowerCase()
    .replace(/[-_]/g, " ")          // hyphen/underscore → space
    .replace(/[^a-z0-9 /]/g, "")   // keep only letters, digits, space, slash
    .replace(/\s+/g, " ")
    .trim();
}

// ── Step 3: Typo / OCR correction layer ───────────────────────────────────────
// Word-level corrections applied AFTER normalizeRaw, BEFORE alias lookup.
// Key: misspelling/variant. Value: correct form.

export const TYPO_WORD_MAP: Record<string, string> = {
  // Glyceryl variants
  "clyceryl":     "glyceryl",
  "glyceryle":    "glyceryl",

  // Alcohol misspellings
  "alchool":      "alcohol",
  "alcool":       "alcohol",
  "alcol":        "alcohol",
  "alohol":       "alcohol",

  // Paraben misspellings
  "methylparben": "methylparaben",
  "methylparabin": "methylparaben",
  "parabene":     "paraben",
  "paraben":      "paraben",     // identity

  // Phenoxyethanol misspellings
  "phenoxyetanol": "phenoxyethanol",
  "phenoxyethano": "phenoxyethanol",

  // Niacinamide misspellings
  "niacinamid":   "niacinamide",
  "niacinimide":  "niacinamide",
  "niacinamida":  "niacinamide",

  // Potassium misspellings
  "dipotasium":   "dipotassium",

  // Caprylyl misspellings
  "caprylil":     "caprylyl",

  // Retinol plurals
  "retinols":     "retinol",
  "tocopherols":  "tocopherol",

  // Cetearyl / Cetyl
  "cetearyl":     "cetearyl",    // identity
  "cetyl":        "cetyl",       // identity

  // Triglyceride misspellings
  "trigliceride": "triglyceride",
  "triglyceryde": "triglyceride",

  // Common OCR artefacts
  "sodiurn":      "sodium",
  "sod1um":       "sodium",
  "gluconate":    "gluconate",   // identity
};

/**
 * Applies word-level typo corrections to a normalizeRaw output.
 * Splits on spaces and replaces each word if found in TYPO_WORD_MAP.
 */
export function applyTypoCorrections(normalized: string): string {
  return normalized
    .split(" ")
    .map((w) => TYPO_WORD_MAP[w] ?? w)
    .join(" ");
}

// ── Step 4: Pre-normalization alias map ────────────────────────────────────────
// Applied AFTER normalizeRaw + typo corrections. Handles INCI interchangeable names,
// trade names, slash variants, and regional synonyms.

export const PRE_NORM_MAP: Record<string, string> = {
  // ── Water aliases ────────────────────────────────────────────────────────────
  "aqua":                    "water",
  "eau":                     "water",
  "purified water":          "water",
  "deionized water":         "water",
  "distilled water":         "water",

  // ── Fragrance / parfum ───────────────────────────────────────────────────────
  "parfum":                  "fragrance",
  "aroma":                   "fragrance",
  "perfume":                 "fragrance",
  "flavor":                  "fragrance",

  // ── Glycerin / glycerol ──────────────────────────────────────────────────────
  "glycerine":               "glycerin",
  "glycerol":                "glycerin",

  // ── Vitamins ─────────────────────────────────────────────────────────────────
  "vitamin c":               "ascorbic acid",
  "vitamin e":               "tocopherol",
  "vitamin a":               "retinol",
  "vitamin b5":              "panthenol",
  "vitamin b3":              "niacinamide",

  // ── Fatty alcohols / waxes ───────────────────────────────────────────────────
  "cera alba":               "beeswax",
  "cera carnauba":           "carnauba wax",

  // ── Common shorthands ────────────────────────────────────────────────────────
  "squalene":                "squalane",
  "coq10":                   "ubiquinone",
  "coenzyme q10":            "ubiquinone",
  "ha":                      "hyaluronic acid",
  "hya":                     "hyaluronic acid",
  "retinaldehyde":           "retinal",

  // ── UV filter trade names ─────────────────────────────────────────────────────
  "tinosorb s":              "bis-ethylhexyloxyphenol methoxyphenyl triazine",
  "tinosorb m":              "methylene bis-benzotriazolyl tetramethylbutylphenol",
  "mexoryl sx":              "ecamsule",
  "mexoryl xl":              "drometrizole trisiloxane",
  "uvinul t 150":            "ethylhexyl triazone",
  "uvinul a plus":           "diethylamino hydroxybenzoyl hexyl benzoate",
  "uvasorb heb":             "diethylhexyl butamido triazone",
  "ensulizole":              "phenylbenzimidazole sulfonic acid",
  "octinoxate":              "ethylhexyl methoxycinnamate",
  "avobenzone":              "butyl methoxydibenzoylmethane",
  "oxybenzone":              "benzophenone-3",

  // ── Silicone variants ─────────────────────────────────────────────────────────
  "pdms":                    "dimethicone",
  "poly dimethicone":        "dimethicone",

  // ── Acid shorthands ──────────────────────────────────────────────────────────
  "aha":                     "glycolic acid",
  "lha":                     "capryloyl salicylic acid",

  // ── Botanical term normalizations ─────────────────────────────────────────────
  "aloe vera":               "aloe barbadensis leaf juice",
  "aloe barbadensis":        "aloe barbadensis leaf juice",
  "green tea extract":       "camellia sinensis leaf extract",
};

/**
 * Applies pre-normalization alias map with slash-variant handling.
 *
 * Slash-variant rule:
 *   If the normalized token contains "/" AND the first segment before "/"
 *   is a known alias, return its mapped value.
 *   Example: "aqua/water/eau" → first segment "aqua" → "water"
 *   Safety: only activates when the first segment IS in PRE_NORM_MAP,
 *   so "caprylic/capric triglyceride" is NOT split (first seg "caprylic" is not in map).
 */
export function applyAliasMap(normalized: string): string {
  // 1. Direct match
  if (PRE_NORM_MAP[normalized] !== undefined) return PRE_NORM_MAP[normalized];

  // 2. Slash-variant: first segment lookup
  if (normalized.includes("/")) {
    const firstSeg = normalized.split("/")[0].trim();
    if (firstSeg && PRE_NORM_MAP[firstSeg] !== undefined) {
      return PRE_NORM_MAP[firstSeg];
    }
    // 3. Last segment lookup (catches "water/aqua" order variants)
    const segments = normalized.split("/");
    const lastSeg  = segments[segments.length - 1].trim();
    if (lastSeg && PRE_NORM_MAP[lastSeg] !== undefined) {
      return PRE_NORM_MAP[lastSeg];
    }
  }

  return normalized;
}

// ── Composed pipeline ──────────────────────────────────────────────────────────

/**
 * Full normalizer pipeline: cleanUnicode → normalizeRaw → typoCorrections → aliasMap.
 * This is what all matching uses.
 */
export function normalizeToken(raw: string): string {
  return applyAliasMap(applyTypoCorrections(normalizeRaw(raw)));
}

// ── Soft-match utilities ───────────────────────────────────────────────────────

/**
 * Removes separators (/, -, space) for a "flat" key comparison.
 * Used as a last-resort soft match for hyphen/space variants.
 * Example: "peg-100 stearate" → "peg100stearate"
 */
export function flattenKey(normalized: string): string {
  return normalized.replace(/[\s/]/g, "");
}

/**
 * Returns true if two normalized strings are likely the same ingredient,
 * accounting for hyphen/space/prefix differences.
 */
export function softMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (flattenKey(a) === flattenKey(b)) return true;
  // Substring only for strings of meaningful length
  if (a.length >= 6 && b.length >= 6) {
    return a.includes(b) || b.includes(a);
  }
  return false;
}
