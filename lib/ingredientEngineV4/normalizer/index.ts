/**
 * normalizer/index.ts — ingredientEngineV4
 *
 * Deterministic V4 normalization pipeline.
 * Completely independent from V3 aliasNormalizer and legacy ingredientNormalizer.
 *
 * Pipeline (in order):
 *   1. cleanUnicode   — zero-width chars, smart quotes, em-dash → ASCII
 *   2. normalizeRaw   — lowercase, collapse whitespace, strip noise
 *   3. typoFix        — word-level OCR / spelling corrections
 *   4. aliasResolve   — INCI synonym + trade-name remapping, slash-variant handling
 *   → normalizeV4Token composes all four steps.
 *
 * Tokenizer:
 *   parseV4Ingredients — raw INCI string → string[]
 */

// ── Step 1: Unicode cleaner ────────────────────────────────────────────────────

export function cleanUnicodeV4(s: string): string {
  return s
    .replace(/[\u200b\u200c\u200d\u200e\u200f\u00ad\u00a0\ufeff\u2060]/g, " ")
    .replace(/[\u202a\u202b\u202c\u202d\u202e\u202f]/g, "")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Step 2: Raw normalizer ─────────────────────────────────────────────────────

export function normalizeRawV4(s: string): string {
  return cleanUnicodeV4(s)
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9 /]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Step 3: Typo / OCR corrections ────────────────────────────────────────────

export const V4_TYPO_MAP: Record<string, string> = {
  // Glyceryl
  "clyceryl":          "glyceryl",
  "glyceryle":         "glyceryl",
  // Alcohol
  "alchool":           "alcohol",
  "alcool":            "alcohol",
  "alcol":             "alcohol",
  "alohol":            "alcohol",
  // Niacinamide
  "niacinamid":        "niacinamide",
  "niacinamida":       "niacinamide",
  "niacinimide":       "niacinamide",
  // Paraben
  "methylparben":      "methylparaben",
  "methylparabin":     "methylparaben",
  "parabene":          "paraben",
  // Phenoxyethanol
  "phenoxyetanol":     "phenoxyethanol",
  "phenoxyethano":     "phenoxyethanol",
  // Sodium
  "sodiurn":           "sodium",
  "sod1um":            "sodium",
  // Retinol
  "retinols":          "retinol",
  "tocopherols":       "tocopherol",
  // Dipotassium
  "dipotasium":        "dipotassium",
  // Caprylyl
  "caprylil":          "caprylyl",
  // Triglyceride
  "trigliceride":      "triglyceride",
  "triglyceryde":      "triglyceride",
  // Cetearyl / Cetyl
  "cetearyl":          "cetearyl",
  "cetyl":             "cetyl",
  // Panthenol
  "panthénol":         "panthenol",
  // Hyaluronic
  "hialuronic":        "hyaluronic",
  "hyaluronique":      "hyaluronic",
};

export function applyV4TypoFix(normalized: string): string {
  return normalized
    .split(" ")
    .map((w) => V4_TYPO_MAP[w] ?? w)
    .join(" ");
}

// ── Step 4: Alias / synonym resolver ──────────────────────────────────────────

export const V4_ALIAS_MAP: Record<string, string> = {
  // Prefix-stripped forms (e.g. "D-Panthenol" → normalizes to "d panthenol" → alias → "panthenol")
  "d panthenol":                             "panthenol",
  "dl panthenol":                            "panthenol",
  "l panthenol":                             "panthenol",
  "d alpha tocopherol":                      "tocopherol",
  "dl alpha tocopherol":                     "tocopherol",
  "l ascorbic acid":                         "ascorbic acid",
  "d glucosamine":                           "glucosamine",

  // Water
  "aqua":                                    "water",
  "eau":                                     "water",
  "purified water":                          "water",
  "deionized water":                         "water",
  "distilled water":                         "water",
  "aqua purificata":                         "water",
  "demineralized water":                     "water",

  // Glycerin
  "glycerine":                               "glycerin",
  "glycerol":                                "glycerin",
  "glycerina":                               "glycerin",

  // Fragrance
  "parfum":                                  "fragrance",
  "aroma":                                   "fragrance",
  "perfume":                                 "fragrance",
  "flavor":                                  "fragrance",

  // Vitamins
  "vitamin c":                               "ascorbic acid",
  "l-ascorbic acid":                         "ascorbic acid",
  "vitamin e":                               "tocopherol",
  "vitamin a":                               "retinol",
  "vitamin b5":                              "panthenol",
  "vitamin b3":                              "niacinamide",
  "provitamin b5":                           "panthenol",

  // Waxes
  "cera alba":                               "beeswax",
  "cera carnauba":                           "carnauba wax",

  // Shorthands
  "ha":                                      "hyaluronic acid",
  "hya":                                     "hyaluronic acid",
  "squalene":                                "squalane",
  "coq10":                                   "ubiquinone",
  "coenzyme q10":                            "ubiquinone",
  "retinaldehyde":                           "retinal",

  // UV trade names
  "tinosorb s":                              "bis-ethylhexyloxyphenol methoxyphenyl triazine",
  "tinosorb m":                              "methylene bis-benzotriazolyl tetramethylbutylphenol",
  "mexoryl sx":                              "ecamsule",
  "mexoryl xl":                              "drometrizole trisiloxane",
  "uvinul t 150":                            "ethylhexyl triazone",
  "uvinul a plus":                           "diethylamino hydroxybenzoyl hexyl benzoate",
  "uvinul a+":                               "diethylamino hydroxybenzoyl hexyl benzoate",
  "uvasorb heb":                             "diethylhexyl butamido triazone",
  "ensulizole":                              "phenylbenzimidazole sulfonic acid",
  "octinoxate":                              "ethylhexyl methoxycinnamate",
  "avobenzone":                              "butyl methoxydibenzoylmethane",
  "parsol 1789":                             "butyl methoxydibenzoylmethane",
  "oxybenzone":                              "benzophenone-3",
  "bemotrizinol":                            "bis-ethylhexyloxyphenol methoxyphenyl triazine",

  // Silicones
  "pdms":                                    "dimethicone",
  "poly dimethicone":                        "dimethicone",
  "polydimethylsiloxane":                    "dimethicone",
  "d5":                                      "cyclopentasiloxane",
  "d6":                                      "cyclohexasiloxane",

  // Acid shorthands
  "aha":                                     "glycolic acid",
  "bha":                                     "salicylic acid",

  // Botanicals
  "aloe vera":                               "aloe barbadensis leaf juice",
  "aloe vera gel":                           "aloe barbadensis leaf juice",
  "aloe barbadensis":                        "aloe barbadensis leaf juice",
  "green tea extract":                       "camellia sinensis leaf extract",
  "green tea":                               "camellia sinensis leaf extract",
  "cica":                                    "centella asiatica extract",
  "gotu kola extract":                       "centella asiatica extract",
  "chamomile extract":                       "chamomilla recutita flower extract",
  "licorice extract":                        "licorice root extract",

  // Preservatives
  "2-phenoxyethanol":                        "phenoxyethanol",
  "sarcosinate":                             "sodium lauroyl sarcosinate",

  // Misc
  "edta":                                    "disodium edta",
  "gluconate":                               "sodium gluconate",
  "lye":                                     "sodium hydroxide",
  "petroleum jelly":                         "petrolatum",
  "china clay":                              "kaolin",
  "jojoba":                                  "jojoba oil",
  "silicon dioxide":                         "silica",
};

/**
 * Applies V4 alias map with slash-variant support.
 * Slash-variant: "aqua/water/eau" → first-segment lookup → "water"
 */
export function applyV4AliasMap(normalized: string): string {
  if (V4_ALIAS_MAP[normalized] !== undefined) return V4_ALIAS_MAP[normalized];

  if (normalized.includes("/")) {
    const segments = normalized.split("/").map((s) => s.trim());
    for (const seg of segments) {
      if (V4_ALIAS_MAP[seg] !== undefined) return V4_ALIAS_MAP[seg];
    }
  }

  return normalized;
}

// ── Composed pipeline ──────────────────────────────────────────────────────────

/**
 * Full V4 normalization: cleanUnicode → normalizeRaw → typoFix → aliasResolve.
 * This is what matching uses. Pure function — no side effects.
 */
export function normalizeV4Token(raw: string): string {
  return applyV4AliasMap(applyV4TypoFix(normalizeRawV4(raw)));
}

/**
 * Removes separators for flat-key comparison.
 * "peg-100 stearate" → "peg100stearate"
 */
export function flattenV4Key(normalized: string): string {
  return normalized.replace(/[\s/]/g, "");
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

/**
 * Parses a raw INCI ingredient string into individual tokens.
 *
 * Handles:
 *   - Comma-separated (standard INCI)
 *   - Semicolon / newline (LF, CR+LF) / period separators
 *   - Slash-only entries (Aqua/Water/Eau handled at match layer, not here)
 *   - Asterisk annotation markers (* = organic / ** = vegan / etc.)
 *   - Percentage values and numeric-only tokens (filtered out)
 *   - Measurement tokens like "50mg", "1000iu" (filtered out)
 *   - Unicode noise (cleaned per-token AFTER splitting to preserve separators)
 *
 * IMPORTANT: We split FIRST so that \n and \r\n are preserved as separators,
 * then apply per-token cleaning. cleanUnicodeV4 is NOT called on the whole
 * string because it collapses whitespace (including \n) before the split.
 */
export function parseV4Ingredients(rawText: string): string[] {
  if (!rawText || rawText.trim().length === 0) return [];

  return rawText
    .split(/[,;\r\n.]+/)
    .map((token) =>
      cleanUnicodeV4(token)
        .replace(/^[\s*+°§#\[\]()]+/, "")
        .replace(/[\s*+°§#\[\]()]+$/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((token) => token.length > 1)
    // Numeric-only: "100%", "2.5", "50"
    .filter((token) => !/^\d+[\.,]?\d*%?$/.test(token))
    // Measurement tokens: "50mg", "1000iu", "2.5ml", "100ppm"
    .filter((token) => !/^\d+[\.,]?\d*\s*(mg|ml|g|iu|ppm|mcg|µg|µl|oz|%)\s*$/i.test(token))
    .filter((token) => token.length <= 120); // guard against malformed data
}

/** Returns token count from a raw INCI string. */
export function countV4Ingredients(rawText: string): number {
  return parseV4Ingredients(rawText).length;
}
