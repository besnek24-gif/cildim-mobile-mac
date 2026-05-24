/**
 * validationProfiles.ts — ingredientIntelligence
 *
 * Expected bucket-distribution ranges for common cosmetic formula types.
 * Used by profileValidator.ts to check whether an ingredient analysis
 * matches the expected pattern for a given formula type.
 *
 * Ranges are expressed as percentage of total ingredients.
 * Example: safe: [10, 40] means 10%–40% of ingredients should be "safe".
 *
 * Sources:
 * - EU cosmetic ingredient database patterns
 * - Typical INCI lists for each formula category
 * - Internal calibration on 28-product Supabase corpus
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type FormulaType =
  | "sunscreen"
  | "moisturizer"
  | "cleanser"
  | "serum"
  | "fragrance_alcohol_formula"
  | "tinted_product";

export interface BucketRange {
  min: number;   // % of total (0-100)
  max: number;   // % of total (0-100)
}

export interface ValidationProfile {
  formula_type:    FormulaType;
  description:     string;
  safe:            BucketRange;
  low_risk:        BucketRange;
  medium_risk:     BucketRange;
  high_risk:       BucketRange;
  unknown:         BucketRange;
  detection_hints: string[];   // flags / categories that indicate this formula type
}

// ── Profile definitions ────────────────────────────────────────────────────────

export const VALIDATION_PROFILES: Record<FormulaType, ValidationProfile> = {

  sunscreen: {
    formula_type: "sunscreen",
    description:  "Chemical or mineral UV protection formula",
    safe:         { min: 10,  max: 45 },
    low_risk:     { min: 20,  max: 55 },
    medium_risk:  { min: 15,  max: 45 },   // UV filters expected here
    high_risk:    { min: 0,   max: 15 },
    unknown:      { min: 0,   max: 15 },
    detection_hints: ["sunfilter", "uv_filter", "titanium dioxide", "zinc oxide", "avobenzone"],
  },

  moisturizer: {
    formula_type: "moisturizer",
    description:  "Hydration-focused leave-on cream or lotion",
    safe:         { min: 30,  max: 70 },
    low_risk:     { min: 15,  max: 45 },
    medium_risk:  { min: 5,   max: 25 },
    high_risk:    { min: 0,   max: 10 },
    unknown:      { min: 0,   max: 15 },
    detection_hints: ["humectant", "emollient", "occlusive", "glycerin", "hyaluronic acid"],
  },

  cleanser: {
    formula_type: "cleanser",
    description:  "Rinse-off foaming or gel cleanser",
    safe:         { min: 10,  max: 40 },
    low_risk:     { min: 10,  max: 35 },
    medium_risk:  { min: 20,  max: 50 },   // surfactants expected
    high_risk:    { min: 0,   max: 20 },
    unknown:      { min: 0,   max: 15 },
    detection_hints: ["surfactant", "sodium lauryl sulfate", "cocamidopropyl betaine"],
  },

  serum: {
    formula_type: "serum",
    description:  "Concentrated active-ingredient treatment",
    safe:         { min: 25,  max: 65 },
    low_risk:     { min: 10,  max: 35 },
    medium_risk:  { min: 10,  max: 40 },   // actives expected
    high_risk:    { min: 0,   max: 15 },
    unknown:      { min: 0,   max: 15 },
    detection_hints: ["active", "niacinamide", "retinol", "ascorbic acid", "peptide"],
  },

  fragrance_alcohol_formula: {
    formula_type: "fragrance_alcohol_formula",
    description:  "Alcohol-based or fragrance-heavy formula (parfum, cologne, toner)",
    safe:         { min: 10,  max: 35 },
    low_risk:     { min: 10,  max: 30 },
    medium_risk:  { min: 10,  max: 35 },
    high_risk:    { min: 15,  max: 55 },   // drying alcohol + fragrance expected
    unknown:      { min: 0,   max: 15 },
    detection_hints: ["fragrance", "alcohol denat.", "parfum", "drying_alcohol"],
  },

  tinted_product: {
    formula_type: "tinted_product",
    description:  "Tinted moisturizer, BB/CC cream or foundation",
    safe:         { min: 15,  max: 50 },
    low_risk:     { min: 15,  max: 45 },
    medium_risk:  { min: 15,  max: 40 },
    high_risk:    { min: 0,   max: 20 },
    unknown:      { min: 0,   max: 20 },
    detection_hints: ["colorant", "titanium dioxide", "iron oxides", "mica"],
  },
};

// ── Auto-detect formula type from analysis items ───────────────────────────────

/**
 * Tries to guess the formula type from item categories and canonical names.
 * Returns "moisturizer" as default when ambiguous.
 */
export function detectFormulaType(
  items: Array<{ canonical_name: string | null; category: string | null; flags: string[] }>
): FormulaType {
  const cats    = new Set(items.map((i) => i.category ?? "").filter(Boolean));
  const names   = new Set(items.map((i) => (i.canonical_name ?? "").toLowerCase()));
  const allFlags = items.flatMap((i) => i.flags);
  const flagSet  = new Set(allFlags);

  // Fragrance / alcohol formula
  if (
    flagSet.has("drying_alcohol") ||
    names.has("fragrance") ||
    names.has("parfum") ||
    flagSet.has("fragrance")
  ) {
    const alcoholCount = items.filter((i) => i.flags.includes("drying_alcohol")).length;
    if (alcoholCount >= 1) return "fragrance_alcohol_formula";
  }

  // Sunscreen
  const uvCount = items.filter(
    (i) => i.category === "sunfilter" || i.category === "uv_filter"
  ).length;
  if (uvCount >= 2) return "sunscreen";

  // Cleanser — high surfactant ratio
  const surfCount = items.filter(
    (i) => i.category === "surfactant" || i.flags.includes("surfactant")
  ).length;
  if (surfCount >= 2) return "cleanser";

  // Serum — high active ratio
  const activeCount = items.filter(
    (i) => i.category === "active" || i.flags.includes("active")
  ).length;
  if (activeCount >= 2 && items.length <= 20) return "serum";

  // Tinted — colorants present
  if (cats.has("colorant") || names.has("titanium dioxide")) return "tinted_product";

  return "moisturizer";
}
