/**
 * policyEngine/policies.ts — ingredientEngineV4
 *
 * Declarative, data-driven V4 risk policy tables.
 * This is the single source of truth for all V4 risk decisions.
 *
 * Decision order (consumed by engine.ts):
 *   1. CANONICAL_OVERRIDES_V4   — exact ingredient-level exception
 *   2. FLAG_PRIORITY_POLICY_V4  — flag overrides category when present
 *   3. CATEGORY_BASE_POLICY_V4  — category-level default
 *   4. FORMULA_PENALTY_MODIFIERS — formula-type-aware bucket adjustments
 *
 * To adjust any risk decision: edit THIS file only. engine.ts is the executor.
 *
 * Formula-aware modifier rule:
 *   If a flag matches a formula type in FORMULA_PENALTY_MODIFIERS, the bucket is
 *   OVERRIDDEN for that formula type. This handles the sunscreen UV filter problem:
 *   UV filters in a sunscreen formula should NOT incur a medium_risk penalty.
 */

import type {
  V4RiskPolicy,
  CanonicalOverrideMap,
  FlagPolicy,
  CategoryPolicyMap,
  FormulaPenaltyModifier,
} from "./types";

// ── CANONICAL OVERRIDES ────────────────────────────────────────────────────────
// Exact canonical_name → forced outcome. Key must be lowercase canonical_name.
// These take absolute precedence over flag and category policies.

export const CANONICAL_OVERRIDES_V4: CanonicalOverrideMap = {
  // Inert ingredients
  "water":                      { risk_level: "safe",        bucket: "safe",        reason: "Water — inert solvent" },
  "glycerin":                   { risk_level: "safe",        bucket: "safe",        reason: "Glycerin — well-tolerated humectant" },
  "silica":                     { risk_level: "safe",        bucket: "safe",        reason: "Silica — inert absorbent powder" },

  // Well-characterized safe actives
  "niacinamide":                { risk_level: "safe",        bucket: "safe",        reason: "Niacinamide — extensively studied, low irritation" },
  "panthenol":                  { risk_level: "safe",        bucket: "safe",        reason: "Panthenol (B5) — soothing, low sensitization" },
  "tocopherol":                 { risk_level: "safe",        bucket: "safe",        reason: "Tocopherol — antioxidant, low concern" },
  "tocopheryl acetate":         { risk_level: "safe",        bucket: "safe",        reason: "Tocopheryl acetate — antioxidant ester, low concern" },
  "sodium hyaluronate":         { risk_level: "safe",        bucket: "safe",        reason: "Sodium hyaluronate — humectant, low concern" },
  "hyaluronic acid":            { risk_level: "safe",        bucket: "safe",        reason: "Hyaluronic acid — humectant, low concern" },
  "allantoin":                  { risk_level: "safe",        bucket: "safe",        reason: "Allantoin — soothing, widely tolerated" },
  "betaine":                    { risk_level: "safe",        bucket: "safe",        reason: "Betaine — gentle humectant" },
  "adenosine":                  { risk_level: "safe",        bucket: "safe",        reason: "Adenosine — anti-aging, well-tolerated" },
  "bisabolol":                  { risk_level: "safe",        bucket: "safe",        reason: "Bisabolol — soothing botanical" },

  // Mineral UV filters: safe
  "titanium dioxide":           { risk_level: "safe",        bucket: "low_risk",    reason: "Titanium dioxide — inorganic UV filter, well-tolerated" },
  "zinc oxide":                 { risk_level: "safe",        bucket: "low_risk",    reason: "Zinc oxide — inorganic UV filter, preferred in pregnancy" },

  // pH adjusters at cosmetic concentrations: inert
  "citric acid":                { risk_level: "safe",        bucket: "safe",        reason: "Citric acid — pH buffer at cosmetic concentrations" },
  "sodium hydroxide":           { risk_level: "safe",        bucket: "safe",        reason: "Sodium hydroxide — trace buffer, inert at final pH" },

  // Mild AHAs
  "lactic acid":                { risk_level: "low_risk",    bucket: "low_risk",    reason: "Lactic acid — mild AHA; accepted at cosmetic %" },
  "azelaic acid":               { risk_level: "low_risk",    bucket: "low_risk",    reason: "Azelaic acid — anti-inflammatory; generally safe" },

  // Concern-level AHAs/BHAs
  "glycolic acid":              { risk_level: "medium_risk", bucket: "medium_risk", reason: "Glycolic acid — AHA; irritation/photosensitivity risk" },
  "salicylic acid":             { risk_level: "medium_risk", bucket: "medium_risk", reason: "Salicylic acid — BHA; avoid in pregnancy" },

  // Retinoids: medium risk (pregnancy concern)
  "retinol":                    { risk_level: "medium_risk", bucket: "medium_risk", reason: "Retinol — AVOID in pregnancy; irritation possible" },
  "retinyl palmitate":          { risk_level: "medium_risk", bucket: "medium_risk", reason: "Retinyl palmitate — Vitamin A ester; avoid in pregnancy" },
  "retinal":                    { risk_level: "medium_risk", bucket: "medium_risk", reason: "Retinal — potent retinoid; avoid in pregnancy" },

  // Preservative exceptions
  "phenoxyethanol":             { risk_level: "medium_risk", bucket: "medium_risk", reason: "Phenoxyethanol — preservative; sensitization in some individuals" },
  "potassium sorbate":          { risk_level: "safe",        bucket: "safe",        reason: "Potassium sorbate — mild preservative, well-tolerated" },
  "sodium benzoate":            { risk_level: "safe",        bucket: "safe",        reason: "Sodium benzoate — mild preservative, well-tolerated" },
  "ethylhexylglycerin":         { risk_level: "safe",        bucket: "safe",        reason: "Ethylhexylglycerin — mild broad-spectrum preservative" },
  "caprylyl glycol":            { risk_level: "safe",        bucket: "safe",        reason: "Caprylyl glycol — gentle antimicrobial, low concern" },
  "chlorphenesin":              { risk_level: "low_risk",    bucket: "low_risk",    reason: "Chlorphenesin — preservative; low sensitization potential" },

  // High-risk preservatives
  "methylisothiazolinone":      { risk_level: "high_risk",   bucket: "high_risk",   reason: "MIT — potent contact allergen; EU banned in leave-on" },
  "methylchloroisothiazolinone":{ risk_level: "high_risk",   bucket: "high_risk",   reason: "CMIT — restricted; high sensitizer" },
  "formaldehyde":               { risk_level: "high_risk",   bucket: "high_risk",   reason: "Formaldehyde — known human carcinogen/allergen" },
  "quaternium-15":              { risk_level: "high_risk",   bucket: "high_risk",   reason: "Quaternium-15 — formaldehyde releaser" },
  "dmdm hydantoin":             { risk_level: "high_risk",   bucket: "high_risk",   reason: "DMDM hydantoin — formaldehyde releaser" },

  // Alcohol
  "alcohol denat.":             { risk_level: "high_risk",   bucket: "high_risk",   reason: "Denatured alcohol — barrier-disrupting; avoid in dry/sensitive skin" },
  "isopropyl alcohol":          { risk_level: "high_risk",   bucket: "high_risk",   reason: "Isopropyl alcohol — drying; barrier disruption" },

  // Fragrance / parfum (undisclosed complex)
  "fragrance":                  { risk_level: "high_risk",   bucket: "high_risk",   reason: "Fragrance — undisclosed sensitizer complex" },

  // Harmful UV chemical filters
  "benzophenone-3":             { risk_level: "medium_risk", bucket: "medium_risk", reason: "Oxybenzone — endocrine activity; significant penetration" },
};

// ── FLAG PRIORITY POLICY ───────────────────────────────────────────────────────
// Iterated in priority order. First matching flag wins.
// Applied when CANONICAL_OVERRIDES does not match.

export const FLAG_PRIORITY_POLICY_V4: FlagPolicy[] = [
  // Highest concern
  { flag: "allergen",            risk_level: "high_risk",   bucket: "high_risk",   reason: "Known fragrance allergen (EU 26 sensitizer list)" },
  { flag: "formaldehyde_releaser",risk_level:"high_risk",   bucket: "high_risk",   reason: "Formaldehyde releaser — releases carcinogen in formula" },
  { flag: "eu_restricted",       risk_level: "high_risk",   bucket: "high_risk",   reason: "EU-restricted ingredient — banned/limited in EU cosmetics" },
  { flag: "fragrance",           risk_level: "high_risk",   bucket: "high_risk",   reason: "Fragrance marker — potential undisclosed sensitizer" },
  { flag: "drying_alcohol",      risk_level: "high_risk",   bucket: "high_risk",   reason: "Drying alcohol — disrupts barrier at typical concentrations" },
  // Medium concern
  { flag: "endocrine_disruptor", risk_level: "medium_risk", bucket: "medium_risk", reason: "Suspected endocrine disruptor — avoid in pregnancy" },
  { flag: "uv_filter",           risk_level: "medium_risk", bucket: "medium_risk", reason: "UV filter — may sensitize; formula-type modifier applies" },
  { flag: "preservative",        risk_level: "medium_risk", bucket: "medium_risk", reason: "Preservative — may cause contact sensitivity" },
  { flag: "surfactant",          risk_level: "medium_risk", bucket: "medium_risk", reason: "Surfactant — barrier disruption potential" },
  { flag: "active",              risk_level: "medium_risk", bucket: "medium_risk", reason: "Active ingredient — may irritate sensitive skin" },
  // Low concern
  { flag: "barrier_support",     risk_level: "safe",        bucket: "safe",        reason: "Barrier-support ingredient" },
  { flag: "mineral_filter",      risk_level: "safe",        bucket: "low_risk",    reason: "Mineral UV filter — inorganic, well-tolerated" },
  { flag: "silicone",            risk_level: "safe",        bucket: "low_risk",    reason: "Silicone — generally inert, non-irritating" },
  { flag: "paraben",             risk_level: "medium_risk", bucket: "medium_risk", reason: "Paraben-class preservative — endocrine concern" },
  { flag: "polymer",             risk_level: "safe",        bucket: "low_risk",    reason: "Polymer film-former — low concern" },
];

// ── CATEGORY BASE POLICY ──────────────────────────────────────────────────────
// Applied when no canonical override and no flag policy matched.

export const CATEGORY_BASE_POLICY_V4: CategoryPolicyMap = {
  humectant:    { risk_level: "safe",        bucket: "safe",       reason: "Category: humectant — skin-hydrating, low concern" },
  soothing:     { risk_level: "safe",        bucket: "safe",       reason: "Category: soothing — calming, low concern" },
  antioxidant:  { risk_level: "safe",        bucket: "safe",       reason: "Category: antioxidant — protective, low concern" },
  barrier:      { risk_level: "safe",        bucket: "safe",       reason: "Category: barrier — supports skin integrity" },
  chelating:    { risk_level: "safe",        bucket: "safe",       reason: "Category: chelating — trace mineral sequestrant" },
  emollient:    { risk_level: "safe",        bucket: "low_risk",   reason: "Category: emollient — skin texture, low concern" },
  occlusive:    { risk_level: "safe",        bucket: "low_risk",   reason: "Category: occlusive — moisture barrier, low concern" },
  silicone:     { risk_level: "safe",        bucket: "low_risk",   reason: "Category: silicone — inert polymer" },
  botanical:    { risk_level: "low_risk",    bucket: "low_risk",   reason: "Category: botanical — plant-derived, variable tolerance" },
  colorant:     { risk_level: "low_risk",    bucket: "low_risk",   reason: "Category: colorant — pigment, low concern" },
  absorbent:    { risk_level: "safe",        bucket: "low_risk",   reason: "Category: absorbent — oil control, low concern" },
  polymer:      { risk_level: "safe",        bucket: "low_risk",   reason: "Category: polymer — film-former, low concern" },
  film_former:  { risk_level: "safe",        bucket: "low_risk",   reason: "Category: film_former — coating, low concern" },
  emulsifier:   { risk_level: "low_risk",    bucket: "low_risk",   reason: "Category: emulsifier — stabilizer, low concern" },
  thickener:    { risk_level: "safe",        bucket: "low_risk",   reason: "Category: thickener — rheology modifier, low concern" },
  ph_adjuster:  { risk_level: "safe",        bucket: "low_risk",   reason: "Category: ph_adjuster — buffered, low concern" },
  solvent:      { risk_level: "low_risk",    bucket: "low_risk",   reason: "Category: solvent — dissolution agent, low concern" },
  preservative: { risk_level: "medium_risk", bucket: "medium_risk",reason: "Category: preservative — antimicrobial, sensitization risk" },
  surfactant:   { risk_level: "medium_risk", bucket: "medium_risk",reason: "Category: surfactant — cleansing, barrier disruption risk" },
  active:       { risk_level: "medium_risk", bucket: "medium_risk",reason: "Category: active — functional, may irritate sensitive skin" },
  uv_filter:    { risk_level: "medium_risk", bucket: "medium_risk",reason: "Category: UV filter — chemical filter, sensitization risk" },
  fragrance:    { risk_level: "high_risk",   bucket: "high_risk",  reason: "Category: fragrance — undisclosed sensitizer complex" },
  unknown:      { risk_level: "medium_risk", bucket: "unknown",    reason: "Category: unknown — no classification data" },
};

// ── FORMULA PENALTY MODIFIERS ─────────────────────────────────────────────────
// Applied AFTER the base risk assessment. Overrides bucket for specific
// flag + formula type combinations.
//
// Critical fix: UV filters in a sunscreen are EXPECTED — do not penalize them.
// Chemical UV filters in non-sunscreen contexts retain their medium_risk bucket.

export const FORMULA_PENALTY_MODIFIERS: FormulaPenaltyModifier[] = [
  // UV filter in a SUNSCREEN → expected, downgrade to low_risk (not zero — still worth tracking)
  {
    flag:           "uv_filter",
    formulaTypes:   ["sunscreen"],
    bucketOverride: "low_risk",
    reason:         "UV filter is expected and functional in a sunscreen formula",
  },
  // Mineral filter in sunscreen → safe, no penalty
  {
    flag:           "mineral_filter",
    formulaTypes:   ["sunscreen"],
    bucketOverride: "safe",
    reason:         "Mineral UV filter in sunscreen — inert, no sensitization concern",
  },
  // Surfactant in a cleanser or shampoo → expected, downgrade to low_risk
  {
    flag:           "surfactant",
    formulaTypes:   ["cleanser", "shampoo"],
    bucketOverride: "low_risk",
    reason:         "Surfactant is a functional component in a cleanser/shampoo",
  },
  // NOTE: No modifier for "active" flag — retinol, salicylic acid etc. must retain
  // their canonical/flag-based risk bucket even in serums/treatments.
];
