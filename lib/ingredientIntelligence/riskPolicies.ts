/**
 * riskPolicies.ts — ingredientIntelligence
 *
 * Declarative, data-driven risk policy tables.
 * This is the single source of truth for all risk decisions in the V3 engine.
 *
 * Decision order consumed by riskEngine.ts:
 *   1. CANONICAL_OVERRIDES   — exact ingredient-level exception
 *   2. FLAG_PRIORITY_POLICY  — flag beats category when present
 *   3. CATEGORY_BASE_POLICY  — category-level default
 *   4. Fallback unknown      — nothing matched
 *
 * To adjust any risk decision: edit this file only. riskEngine.ts is the
 * executor; riskPolicies.ts is the policy author.
 */

import type { RiskLevel, RiskBucket } from "./riskEngine";

// ── Shared policy shape ────────────────────────────────────────────────────────

export interface RiskPolicy {
  risk_level: RiskLevel;
  bucket:     RiskBucket;
  reason:     string;
}

// ── CANONICAL_OVERRIDES ────────────────────────────────────────────────────────
// Exact canonical_name → forced outcome.
// These are ingredient-level exceptions that trump category and flag logic.
// Key must match canonical_name from the library (already normalized).

export const CANONICAL_OVERRIDES: Record<string, RiskPolicy> = {
  // ── Water / solvents treated as inert ──────────────────────────────────────
  "water":                 { risk_level: "low",    bucket: "safe",        reason: "Water — inert solvent" },
  "glycerin":              { risk_level: "low",    bucket: "safe",        reason: "Glycerin — well-tolerated humectant" },

  // ── Well-characterized actives with excellent safety record ───────────────
  "niacinamide":           { risk_level: "low",    bucket: "safe",        reason: "Niacinamide — extensively studied, low irritation" },
  "panthenol":             { risk_level: "low",    bucket: "safe",        reason: "Panthenol (B5) — soothing, low sensitization" },
  "tocopherol":            { risk_level: "low",    bucket: "safe",        reason: "Tocopherol — antioxidant, low concern" },
  "tocopheryl acetate":    { risk_level: "low",    bucket: "safe",        reason: "Tocopheryl acetate — antioxidant ester, low concern" },
  "sodium hyaluronate":    { risk_level: "low",    bucket: "safe",        reason: "Sodium hyaluronate — humectant, low concern" },
  "hyaluronic acid":       { risk_level: "low",    bucket: "safe",        reason: "Hyaluronic acid — humectant, low concern" },
  "allantoin":             { risk_level: "low",    bucket: "safe",        reason: "Allantoin — soothing, widely tolerated" },
  "betaine":               { risk_level: "low",    bucket: "safe",        reason: "Betaine — gentle humectant" },
  "urea":                  { risk_level: "low",    bucket: "low_risk",    reason: "Urea — effective but potential sting in broken skin" },

  // ── pH adjusters: cosmetically inert at buffered concentrations ───────────
  "citric acid":           { risk_level: "low",    bucket: "safe",        reason: "Citric acid — pH buffer at cosmetic concentrations" },
  "sodium hydroxide":      { risk_level: "low",    bucket: "safe",        reason: "Sodium hydroxide — trace buffer, no risk at final pH" },
  "lactic acid":           { risk_level: "low",    bucket: "low_risk",    reason: "Lactic acid — AHA; mild irritation possible at high % " },
  "glycolic acid":         { risk_level: "medium", bucket: "medium_risk", reason: "Glycolic acid — AHA; irritation/photosensitivity concern" },

  // ── Mineral UV filters: well-tolerated inorganics ─────────────────────────
  "titanium dioxide":      { risk_level: "low",    bucket: "low_risk",    reason: "Titanium dioxide — mineral UV filter, low concern" },
  "zinc oxide":            { risk_level: "low",    bucket: "low_risk",    reason: "Zinc oxide — mineral UV filter, low concern" },

  // ── Known sensitizers / high-risk ingredient-level exceptions ────────────
  "phenoxyethanol":        { risk_level: "medium", bucket: "medium_risk", reason: "Phenoxyethanol — preservative, sensitization in some individuals" },
  "alcohol denat.":        { risk_level: "high",   bucket: "high_risk",   reason: "Denatured alcohol — barrier-disrupting, drying" },
  "fragrance":             { risk_level: "high",   bucket: "high_risk",   reason: "Fragrance complex — undisclosed allergen mix" },
  "parfum":                { risk_level: "high",   bucket: "high_risk",   reason: "Parfum — undisclosed fragrance complex" },
  "formaldehyde":          { risk_level: "high",   bucket: "high_risk",   reason: "Formaldehyde — known human carcinogen / allergen" },
  "quaternium-15":         { risk_level: "high",   bucket: "high_risk",   reason: "Quaternium-15 — formaldehyde releaser" },
  "methylisothiazolinone": { risk_level: "high",   bucket: "high_risk",   reason: "MIT — potent contact allergen" },
  "methylchloroisothiazolinone": { risk_level: "high", bucket: "high_risk", reason: "CMIT/MIT — restricted in EU rinse-off; high sensitizer" },

  // ── Silica: absorbent, not a risk ─────────────────────────────────────────
  "silica":                { risk_level: "low",    bucket: "safe",        reason: "Silica — inert absorbent powder" },
};

// ── FLAG_PRIORITY_POLICY ───────────────────────────────────────────────────────
// Flag → forced outcome. Applied when CANONICAL_OVERRIDES does not match.
// Order of priority is the ORDER of iteration below (highest priority first).
// Only the FIRST matching flag is applied.

export const FLAG_PRIORITY_POLICY: Array<{ flag: string } & RiskPolicy> = [
  // Highest danger — allergen
  {
    flag:       "allergen",
    risk_level: "high",
    bucket:     "high_risk",
    reason:     "Known fragrance allergen (EU 26 sensitizer list)",
  },
  // Fragrance complex
  {
    flag:       "fragrance",
    risk_level: "high",
    bucket:     "high_risk",
    reason:     "Fragrance marker — potential sensitizer / undisclosed ingredients",
  },
  // Drying / barrier-disrupting alcohols
  {
    flag:       "drying_alcohol",
    risk_level: "high",
    bucket:     "high_risk",
    reason:     "Drying alcohol — disrupts skin barrier at typical concentrations",
  },
  // UV filter flag (organic chemical filters)
  {
    flag:       "uv_filter",
    risk_level: "medium",
    bucket:     "medium_risk",
    reason:     "UV filter — may sensitize at high concentrations",
  },
  // Preservatives
  {
    flag:       "preservative",
    risk_level: "medium",
    bucket:     "medium_risk",
    reason:     "Preservative — may cause contact sensitivity",
  },
  // Surfactants
  {
    flag:       "surfactant",
    risk_level: "medium",
    bucket:     "medium_risk",
    reason:     "Surfactant — moderate barrier disruption potential",
  },
  // Active ingredients
  {
    flag:       "active",
    risk_level: "medium",
    bucket:     "medium_risk",
    reason:     "Active ingredient — efficacious but may irritate sensitive skin",
  },
  // Barrier-supporting ingredients
  {
    flag:       "barrier_support",
    risk_level: "low",
    bucket:     "safe",
    reason:     "Barrier-support — promotes skin integrity",
  },
  // Silicones — inert
  {
    flag:       "silicone",
    risk_level: "low",
    bucket:     "low_risk",
    reason:     "Silicone — generally inert, non-irritating",
  },
  // Polymers — film formers / rheology agents
  {
    flag:       "polymer",
    risk_level: "medium",
    bucket:     "low_risk",
    reason:     "Polymer — functional film-former, low concern",
  },
];

// ── CATEGORY_BASE_POLICY ───────────────────────────────────────────────────────
// Applied when no canonical override and no flag override matched.
// Maps normalized category name → default policy.

export const CATEGORY_BASE_POLICY: Record<string, RiskPolicy> = {
  // ── Benign functional categories ──────────────────────────────────────────
  humectant:         { risk_level: "low",    bucket: "safe",        reason: "Category: humectant — skin-hydrating, low concern" },
  soothing:          { risk_level: "low",    bucket: "safe",        reason: "Category: soothing — calming, low concern" },
  antioxidant:       { risk_level: "low",    bucket: "safe",        reason: "Category: antioxidant — protective, low concern" },
  barrier:           { risk_level: "low",    bucket: "safe",        reason: "Category: barrier — supports skin integrity" },
  barrier_support:   { risk_level: "low",    bucket: "safe",        reason: "Category: barrier_support — supports skin integrity" },
  chelating:         { risk_level: "low",    bucket: "safe",        reason: "Category: chelating — trace mineral sequestrant" },
  chelator:          { risk_level: "low",    bucket: "safe",        reason: "Category: chelator — trace mineral sequestrant" },
  botanical:         { risk_level: "low",    bucket: "low_risk",    reason: "Category: botanical — plant-derived, variable tolerance" },

  // ── Low-risk functional categories ───────────────────────────────────────
  emollient:         { risk_level: "low",    bucket: "low_risk",    reason: "Category: emollient — skin texture, low concern" },
  silicone:          { risk_level: "low",    bucket: "low_risk",    reason: "Category: silicone — inert polymer, low concern" },
  occlusive:         { risk_level: "low",    bucket: "low_risk",    reason: "Category: occlusive — moisture barrier, low concern" },
  colorant:          { risk_level: "medium", bucket: "low_risk",    reason: "Category: colorant — pigment, low concern at typical levels" },
  absorbent:         { risk_level: "medium", bucket: "low_risk",    reason: "Category: absorbent — oil control, low concern" },
  polymer:           { risk_level: "medium", bucket: "low_risk",    reason: "Category: polymer — rheology/film, low concern" },
  film_former:       { risk_level: "medium", bucket: "low_risk",    reason: "Category: film_former — coating, low concern" },

  // ── Mid-level functional categories ──────────────────────────────────────
  solvent:           { risk_level: "medium", bucket: "low_risk",    reason: "Category: solvent — dissolution agent, low concern" },
  emulsifier:        { risk_level: "medium", bucket: "low_risk",    reason: "Category: emulsifier — stabilizer, low concern" },
  thickener:         { risk_level: "medium", bucket: "low_risk",    reason: "Category: thickener — rheology modifier, low concern" },
  ph_adjuster:       { risk_level: "medium", bucket: "low_risk",    reason: "Category: ph_adjuster — buffered, low concern" },

  // ── Medium concern categories ─────────────────────────────────────────────
  preservative:      { risk_level: "medium", bucket: "medium_risk", reason: "Category: preservative — antimicrobial, sensitization risk" },
  surfactant:        { risk_level: "medium", bucket: "medium_risk", reason: "Category: surfactant — cleansing, barrier disruption risk" },
  active:            { risk_level: "medium", bucket: "medium_risk", reason: "Category: active — functional, may irritate sensitive skin" },

  // ── UV filters ────────────────────────────────────────────────────────────
  sunfilter:         { risk_level: "medium", bucket: "medium_risk", reason: "Category: UV filter — chemical filter, sensitization risk" },
  uv_filter:         { risk_level: "medium", bucket: "medium_risk", reason: "Category: UV filter — chemical filter, sensitization risk" },
  sunscreen:         { risk_level: "medium", bucket: "medium_risk", reason: "Category: UV filter — chemical filter, sensitization risk" },

  // ── High concern categories ───────────────────────────────────────────────
  fragrance:         { risk_level: "high",   bucket: "high_risk",   reason: "Category: fragrance — undisclosed sensitizer complex" },
  allergen:          { risk_level: "high",   bucket: "high_risk",   reason: "Category: allergen — known contact sensitizer" },

  // ── Unknown / unclassified ────────────────────────────────────────────────
  unknown:           { risk_level: "unknown", bucket: "unknown",    reason: "Category: unknown — no classification data" },
};

// ── BUCKET_MAPPING ─────────────────────────────────────────────────────────────
// Last-resort: maps raw risk_level from library to default bucket.
// Used only when no policy matched.

export const BUCKET_MAPPING: Record<string, RiskBucket> = {
  low:     "low_risk",
  medium:  "medium_risk",
  high:    "high_risk",
  unknown: "unknown",
};

// ── Category normalizer ────────────────────────────────────────────────────────
// Maps legacy / variant category strings to canonical policy keys.

export const CATEGORY_NORMALIZE: Record<string, string> = {
  sunfilter:       "sunfilter",
  sunscreen:       "sunfilter",
  uv_filter:       "sunfilter",
  uvfilter:        "sunfilter",
  chelating:       "chelator",
  barrier_support: "barrier_support",
  film_former:     "film_former",
};

export function normalizeCategory(raw: string | null): string | null {
  if (!raw) return null;
  return CATEGORY_NORMALIZE[raw] ?? raw;
}
