/**
 * registry/types.ts — ingredientEngineV4
 *
 * V4 canonical registry type definitions.
 * Richer than V3: adds pregnancy_safe, breastfeeding_safe, confidence,
 * functional tags, and structured concern flags.
 *
 * ZERO imports from legacy/V3 systems. Self-contained.
 */

// ── Ingredient categories (INCI functional) ────────────────────────────────────

export type IngredientCategory =
  | "solvent"
  | "humectant"
  | "emollient"
  | "occlusive"
  | "barrier"
  | "soothing"
  | "active"
  | "antioxidant"
  | "surfactant"
  | "preservative"
  | "emulsifier"
  | "thickener"
  | "chelating"
  | "fragrance"
  | "uv_filter"
  | "absorbent"
  | "ph_adjuster"
  | "film_former"
  | "silicone"
  | "botanical"
  | "colorant"
  | "polymer"
  | "unknown";

// ── Risk levels ────────────────────────────────────────────────────────────────

export type V4RiskLevel =
  | "safe"
  | "low_risk"
  | "medium_risk"
  | "high_risk";

// ── Concern flags (bitfield-style tags) ───────────────────────────────────────

export type IngredientFlag =
  | "fragrance"            // undisclosed fragrance complex
  | "allergen"             // EU 26 fragrance allergen list
  | "drying_alcohol"       // barrier-disrupting alcohol
  | "uv_filter"            // organic/mineral UV filter
  | "preservative"         // biocidal preservative
  | "surfactant"           // cleansing/foaming agent
  | "active"               // functional active ingredient
  | "barrier_support"      // ceramides, fatty acids supporting barrier
  | "silicone"             // silicone polymer
  | "polymer"              // synthetic polymer (film former / rheology)
  | "paraben"              // paraben-class preservative
  | "formaldehyde_releaser"// releases formaldehyde in formulation
  | "endocrine_disruptor"  // suspected hormonal activity
  | "eu_restricted"        // restricted/banned in EU cosmetics
  | "mineral_filter"       // inorganic UV filter (ZnO, TiO2);

// ── Pregnancy safety ──────────────────────────────────────────────────────────

export type PregnancySafety = true | false | "uncertain";

// ── Data confidence ────────────────────────────────────────────────────────────

export type RegistryConfidence = "high" | "medium" | "low";

// ── Core registry entry ────────────────────────────────────────────────────────

export interface V4RegistryEntry {
  canonical_name:    string;
  aliases:           string[];
  category:          IngredientCategory;
  risk_level:        V4RiskLevel;
  flags:             IngredientFlag[];
  pregnancy_safe?:   PregnancySafety;
  breastfeeding_safe?: PregnancySafety;
  confidence:        RegistryConfidence;
  notes?:            string;
}

// ── Resolved match (output of matcher) ────────────────────────────────────────

export interface V4MatchResult {
  raw:            string;
  normalized:     string;
  canonical_name: string | null;
  category:       IngredientCategory | null;
  risk_level:     V4RiskLevel | null;
  flags:          IngredientFlag[];
  pregnancy_safe: PregnancySafety | null;
  matched:        boolean;
  match_tier:     "exact" | "flat" | "soft" | "none";
  confidence:     RegistryConfidence | null;
}
