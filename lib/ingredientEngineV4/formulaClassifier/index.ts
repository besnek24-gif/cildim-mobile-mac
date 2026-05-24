/**
 * formulaClassifier/index.ts — ingredientEngineV4
 *
 * Dedicated formula-type classifier.
 * Determines what kind of product a formula represents
 * based on its matched ingredient profile.
 *
 * Output is used by policyEngine to apply formula-aware risk adjustments.
 *
 * ZERO imports from legacy/V3 systems.
 */

import type { V4MatchResult } from "../registry/types";
import type { IngredientFlag, IngredientCategory } from "../registry/types";

// ── Formula type ───────────────────────────────────────────────────────────────

export type V4FormulaType =
  | "sunscreen"
  | "cleanser"
  | "serum"
  | "moisturizer"
  | "treatment"
  | "shampoo"
  | "other";

export interface FormulaClassification {
  formulaType:    V4FormulaType;
  confidence:     "high" | "medium" | "low";
  signals:        string[];
}

// ── Flag / category count helpers ─────────────────────────────────────────────

function countFlag(matches: V4MatchResult[], flag: IngredientFlag): number {
  return matches.filter((m) => m.flags.includes(flag)).length;
}

function countCategory(matches: V4MatchResult[], cat: IngredientCategory): number {
  return matches.filter((m) => m.category === cat).length;
}

function countFlagMineralFilter(matches: V4MatchResult[]): number {
  return matches.filter((m) => m.flags.includes("mineral_filter")).length;
}

function countFlagUvChemical(matches: V4MatchResult[]): number {
  return matches.filter((m) => m.flags.includes("uv_filter") && !m.flags.includes("mineral_filter")).length;
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classifies the product formula type from a list of matched ingredient results.
 *
 * Priority order:
 *   1. sunscreen   — UV filters dominate
 *   2. cleanser    — Surfactants dominate + high total count
 *   3. shampoo     — Surfactants + specific hair surfactants
 *   4. serum       — Actives dominate, low emollient/occlusives, lightweight
 *   5. treatment   — Strong actives, low humectant/emollient
 *   6. moisturizer — Humectants + emollients, few actives
 *   7. other       — Does not fit above profiles
 */
export function classifyV4Formula(matches: V4MatchResult[]): FormulaClassification {
  const total = matches.length;
  if (total === 0) {
    return { formulaType: "other", confidence: "low", signals: ["no_ingredients"] };
  }

  const signals: string[] = [];

  const uvFilterCount    = countFlag(matches, "uv_filter");
  const mineralCount     = countFlagMineralFilter(matches);
  const chemicalUvCount  = countFlagUvChemical(matches);
  const surfactantCount  = countFlag(matches, "surfactant");
  const activeCount      = countFlag(matches, "active");
  const preservCount     = countFlag(matches, "preservative");

  const humectantCount   = countCategory(matches, "humectant");
  const emollientCount   = countCategory(matches, "emollient");
  const occlusiveCount   = countCategory(matches, "occlusive");
  const siliconeCount    = countCategory(matches, "silicone");

  const uvRatio          = uvFilterCount / total;
  const surfactantRatio  = surfactantCount / total;
  const activeRatio      = activeCount / total;
  const moistureRatio    = (humectantCount + emollientCount + occlusiveCount + siliconeCount) / total;

  // ── 1. Sunscreen detection ─────────────────────────────────────────────────
  // Strong signal: ≥2 UV filters OR ≥1 mineral filter + ≥1 chemical UV filter
  // or very high UV filter ratio
  if (uvFilterCount >= 3) {
    signals.push(`uv_filter_count=${uvFilterCount}`);
    return {
      formulaType: "sunscreen",
      confidence:  uvFilterCount >= 4 ? "high" : "medium",
      signals,
    };
  }
  if (uvFilterCount >= 2) {
    signals.push(`uv_filter_count=${uvFilterCount}`);
    if (mineralCount >= 1 || chemicalUvCount >= 2) {
      return { formulaType: "sunscreen", confidence: "high", signals };
    }
    return { formulaType: "sunscreen", confidence: "medium", signals };
  }
  // Single mineral filter alone (e.g. zinc oxide as anti-acne in serum):
  // Only classify as sunscreen if another chemical UV filter is also present.
  if (uvFilterCount === 1 && mineralCount === 1 && chemicalUvCount >= 1) {
    signals.push("mineral_plus_chemical_filter");
    return { formulaType: "sunscreen", confidence: "medium", signals };
  }

  // ── 2. Shampoo detection (BEFORE cleanser — shampoo shares surfactants) ───
  // Key distinguisher: ammonium laureth/lauryl sulfate is shampoo-specific.
  // Cleansers use sodium laureth sulfate but rarely ammonium versions.
  const ammoniumSulfates = matches.filter((m) =>
    m.canonical_name &&
    ["ammonium laureth sulfate", "ammonium lauryl sulfate"].includes(m.canonical_name)
  );
  const shampooSulfateSurfactants = matches.filter((m) =>
    m.canonical_name &&
    ["ammonium laureth sulfate", "sodium laureth sulfate", "sodium lauryl sulfate",
     "ammonium lauryl sulfate"].includes(m.canonical_name)
  );
  // High-confidence shampoo: ≥2 shampoo sulfates (includes ammonium) + high surfactant ratio
  if (shampooSulfateSurfactants.length >= 2 && ammoniumSulfates.length >= 1 && surfactantRatio >= 0.15) {
    signals.push(`shampoo_sulfates=${shampooSulfateSurfactants.length}`, `ammonium=${ammoniumSulfates.length}`);
    return { formulaType: "shampoo", confidence: "high", signals };
  }
  // Medium-confidence: ammonium sulfate present + multiple surfactants → shampoo
  if (ammoniumSulfates.length >= 1 && surfactantCount >= 3) {
    signals.push(`ammonium_sulfate=${ammoniumSulfates.length}`, `surfactant_count=${surfactantCount}`);
    return { formulaType: "shampoo", confidence: "medium", signals };
  }

  // ── 3. Cleanser detection ─────────────────────────────────────────────────
  if (surfactantCount >= 2 && surfactantRatio >= 0.12) {
    signals.push(`surfactant_count=${surfactantCount}`, `surfactant_ratio=${surfactantRatio.toFixed(2)}`);
    return {
      formulaType: "cleanser",
      confidence:  surfactantRatio >= 0.20 ? "high" : "medium",
      signals,
    };
  }

  // ── 4. Serum detection (BEFORE treatment — serum has humectants too) ──────
  // Strong serum: active(s) + multiple humectants + no heavy emollient base
  if (activeCount >= 2 && humectantCount >= 2 && emollientCount <= 2 && occlusiveCount === 0) {
    signals.push(`active_count=${activeCount}`, `humectant_count=${humectantCount}`);
    return { formulaType: "serum", confidence: "medium", signals };
  }
  // Short-form serum: at least 1 active + 2 humectants + lightweight (no rich base)
  // Covers: niacinamide+zinc+hyaluronate patterns, vitamin C serums with few ingredients
  if (activeCount >= 1 && humectantCount >= 2 && emollientCount === 0 && occlusiveCount === 0 && surfactantCount === 0) {
    signals.push(`active_count=${activeCount}`, `humectant_count=${humectantCount}`, "lightweight");
    return { formulaType: "serum", confidence: "medium", signals };
  }
  if (activeRatio >= 0.10 && moistureRatio < 0.30 && surfactantCount === 0 && emollientCount <= 1) {
    signals.push(`active_ratio=${activeRatio.toFixed(2)}`);
    return { formulaType: "serum", confidence: "low", signals };
  }

  // ── 5. Treatment detection ────────────────────────────────────────────────
  // Very high active concentration, no moisturizing base
  if (activeCount >= 3 && activeRatio >= 0.20 && moistureRatio < 0.20) {
    signals.push(`active_count=${activeCount}`, `active_ratio=${activeRatio.toFixed(2)}`);
    return { formulaType: "treatment", confidence: "medium", signals };
  }

  // ── 6. Moisturizer detection ──────────────────────────────────────────────
  // Emollient OR occlusive present + high moisture ratio (richBase distinguishes from serum)
  const richBase = emollientCount + occlusiveCount >= 1;
  if (moistureRatio >= 0.30 && richBase && activeRatio < 0.15) {
    signals.push(`moisture_ratio=${moistureRatio.toFixed(2)}`, `richbase=${emollientCount + occlusiveCount}`);
    return {
      formulaType: "moisturizer",
      confidence:  moistureRatio >= 0.45 ? "high" : "medium",
      signals,
    };
  }
  if (humectantCount >= 2 && richBase) {
    signals.push(`humectant=${humectantCount}`, `richbase=${emollientCount + occlusiveCount}`);
    return { formulaType: "moisturizer", confidence: "low", signals };
  }

  // ── 7. Default ────────────────────────────────────────────────────────────
  signals.push("no_dominant_pattern");
  return { formulaType: "other", confidence: "low", signals };
}
