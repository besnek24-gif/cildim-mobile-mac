/**
 * validation/fixtures.ts — ingredientEngineV4
 *
 * Deterministic test fixtures using REAL product ingredient strings
 * from the 28-product TENVİR corpus.
 *
 * Each fixture declares:
 *   - id:           unique fixture identifier
 *   - product_name: real product name
 *   - rawText:      actual INCI ingredient string
 *   - expected:     expected analysis outcome assertions
 *
 * Assertions are minimum requirements — engine may produce richer output.
 *
 * ZERO imports from legacy/V3 systems.
 */

export interface V4Fixture {
  id:              string;
  product_name:    string;
  rawText:         string;
  expected: {
    formulaType:      string;
    minScore?:        number;
    maxScore?:        number;
    minCoverage?:     number;
    hasWarning?:      string[];
    hasNoWarning?:    string[];
    minMatched?:      number;
  };
}

export const V4_FIXTURES: V4Fixture[] = [

  // ── Sunscreen fixtures ────────────────────────────────────────────────────────

  {
    id:           "sunscreen-ducray-spf50",
    product_name: "Ducray Keracnyl UV Fluide SPF50+",
    rawText: [
      "Water, Octocrylene, Ethylhexyl Methoxycinnamate, Butyl Methoxydibenzoylmethane,",
      "Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Diethylamino Hydroxybenzoyl Hexyl Benzoate,",
      "Ethylhexyl Triazone, Silica, Dimethicone, Glycerin, Carbomer, Phenoxyethanol, Triethanolamine,",
      "Xanthan Gum, Caprylyl Glycol, Niacinamide, Tocopheryl Acetate, Disodium EDTA"
    ].join(" "),
    expected: {
      formulaType: "sunscreen",
      minScore:    85,           // formula modifier makes UV filters low_risk; only phenoxyethanol penalized
      minCoverage: 90,
      minMatched:  14,
      hasNoWarning: ["contains_drying_alcohol", "contains_fragrance"],
    },
  },

  {
    id:           "sunscreen-larocheposay-anthelios",
    product_name: "La Roche-Posay Anthelios SPF50",
    rawText: [
      "Aqua, Homosalate, Octocrylene, Ethylhexyl Salicylate,",
      "Butyl Methoxydibenzoylmethane, Drometrizole Trisiloxane,",
      "Glycerin, Dimethicone, Niacinamide, Phenoxyethanol, Carbomer,",
      "Disodium EDTA, Sodium Hydroxide, Tocopherol, Xanthan Gum"
    ].join(" "),
    expected: {
      formulaType: "sunscreen",
      minScore:    80,
      minCoverage: 75,
      minMatched:  12,
    },
  },

  {
    id:           "sunscreen-mineral-zinc",
    product_name: "Mineral SPF50 Zinc Oxide Formula",
    rawText: [
      "Water, Zinc Oxide, Titanium Dioxide, Glycerin, Cetearyl Alcohol,",
      "Caprylic/Capric Triglyceride, Glyceryl Stearate, PEG-100 Stearate,",
      "Phenoxyethanol, Carbomer, Xanthan Gum, Disodium EDTA, Citric Acid,",
      "Sodium Hydroxide, Tocopherol, Allantoin"
    ].join(" "),
    expected: {
      formulaType: "sunscreen",
      minScore:    85,           // mineral filters are safe; only phenoxyethanol penalized
      minCoverage: 85,
      hasNoWarning: ["contains_drying_alcohol", "contains_fragrance"],
    },
  },

  // ── Serum fixtures ─────────────────────────────────────────────────────────────

  {
    id:           "serum-niacinamide-10",
    product_name: "Niacinamide 10% + Zinc Serum",
    rawText: [
      "Water, Niacinamide, Zinc Oxide, Pentylene Glycol, Glycerin,",
      "Sodium Hyaluronate, Ascorbyl Glucoside, Sodium PCA,",
      "Phenoxyethanol, Ethylhexylglycerin, Carbomer, Arginine,",
      "Allantoin, Disodium EDTA"
    ].join(" "),
    expected: {
      formulaType: "serum",
      minScore:    65,
      maxScore:    95,
      minCoverage: 85,
      hasNoWarning: ["contains_fragrance", "contains_drying_alcohol"],
      minMatched:  12,
    },
  },

  {
    id:           "serum-vitamin-c",
    product_name: "Vitamin C 15% Brightening Serum",
    rawText: [
      "Water, Ascorbic Acid, Sodium Ascorbyl Phosphate, Glycerin,",
      "Ferulic Acid, Tocopherol, Panthenol, Niacinamide,",
      "Sodium Hyaluronate, Bisabolol, Phenoxyethanol, Carbomer,",
      "Citric Acid, Sodium Hydroxide, Disodium EDTA"
    ].join(" "),
    expected: {
      formulaType: "serum",
      minScore:    65,
      maxScore:    95,
      minCoverage: 85,
    },
  },

  {
    id:           "serum-retinol",
    product_name: "Advanced Retinol Night Serum",
    rawText: [
      "Water, Glycerin, Retinol, Squalane, Tocopherol,",
      "Sodium Hyaluronate, Panthenol, Allantoin, Caprylic/Capric Triglyceride,",
      "Phenoxyethanol, Caprylyl Glycol, Carbomer, Arginine, Disodium EDTA"
    ].join(" "),
    expected: {
      // Retinol + 2 emollients (squalane, caprylic/capric) + 3 humectants → moisturizer profile
      // retinol (-5) + phenoxyethanol (-5) + safe_bonus → score ~95
      formulaType: "moisturizer",
      minScore:    60,
      maxScore:    97,
      hasWarning:  ["pregnancy_caution"],
    },
  },

  // ── Moisturizer fixtures ──────────────────────────────────────────────────────

  {
    id:           "moisturizer-daily-basic",
    product_name: "Daily Moisturizing Cream",
    rawText: [
      "Water, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride,",
      "Glyceryl Stearate, PEG-100 Stearate, Dimethicone, Panthenol,",
      "Sodium Hyaluronate, Allantoin, Tocopheryl Acetate,",
      "Phenoxyethanol, Carbomer, Xanthan Gum, Citric Acid,",
      "Disodium EDTA, Caprylyl Glycol"
    ].join(" "),
    expected: {
      formulaType: "moisturizer",
      minScore:    65,
      maxScore:    100,           // clean formula: only phenoxyethanol penalized, safe_bonus offsets
      minCoverage: 85,
      hasNoWarning: ["contains_fragrance", "contains_drying_alcohol"],
    },
  },

  {
    id:           "moisturizer-with-fragrance",
    product_name: "Luxe Moisturizing Cream with Fragrance",
    rawText: [
      "Water, Glycerin, Cetearyl Alcohol, Dimethicone, Petrolatum,",
      "Glyceryl Stearate, Niacinamide, Panthenol, Sodium Hyaluronate,",
      "Fragrance, Phenoxyethanol, Tocopherol, Carbomer, Disodium EDTA,",
      "Citric Acid, Limonene, Linalool"
    ].join(" "),
    expected: {
      formulaType: "moisturizer",
      minScore:    40,
      maxScore:    75,
      hasWarning:  ["contains_fragrance", "contains_allergen"],
    },
  },

  // ── Cleanser fixtures ─────────────────────────────────────────────────────────

  {
    id:           "cleanser-gentle-foaming",
    product_name: "Gentle Foaming Cleanser",
    rawText: [
      "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine,",
      "Decyl Glucoside, Glycerin, Panthenol, Allantoin,",
      "Sodium PCA, Potassium Sorbate, Sodium Benzoate,",
      "Citric Acid, Xanthan Gum"
    ].join(" "),
    expected: {
      formulaType: "cleanser",
      minScore:    70,
      maxScore:    100,          // surfactant formula modifier → low_risk in cleanser context
      minCoverage: 85,
      hasNoWarning: ["contains_fragrance"],
    },
  },

  // ── Edge cases ────────────────────────────────────────────────────────────────

  {
    id:           "edge-high-risk-preservatives",
    product_name: "Old Formula with MIT",
    rawText: [
      "Water, Glycerin, Methylisothiazolinone, Methylchloroisothiazolinone,",
      "Propylparaben, Butylparaben, DMDM Hydantoin, Phenoxyethanol,",
      "Carbomer, Xanthan Gum, Citric Acid"
    ].join(" "),
    expected: {
      formulaType: "other",
      maxScore:    40,
      hasWarning:  ["contains_allergen"],
    },
  },

  {
    id:           "edge-empty-string",
    product_name: "Empty ingredients",
    rawText:      "",
    expected: {
      formulaType: "other",
      maxScore:    0,
      minMatched:  0,
    },
  },

  {
    id:           "edge-alcohol-heavy",
    product_name: "High-Alcohol Toner",
    rawText: [
      "Water, Alcohol Denat., Niacinamide, Glycerin, Salicylic Acid,",
      "Sodium Hyaluronate, Phenoxyethanol, Carbomer, Disodium EDTA"
    ].join(" "),
    expected: {
      // 2 actives (niacinamide, salicylic acid) + 2 humectants + 0 emollients → serum classifier
      // The real concern is the drying alcohol penalty
      formulaType: "serum",
      minScore:    20,
      maxScore:    82,
      hasWarning:  ["contains_drying_alcohol"],
    },
  },
];
