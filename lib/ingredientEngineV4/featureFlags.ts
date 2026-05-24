/**
 * featureFlags.ts — ingredientEngineV4
 * ─────────────────────────────────────────────────────────────────────────────
 * Central feature-flag registry for gradual V4 engine migration.
 *
 * RULES:
 *   - All flags default to false  → production behavior is always unchanged
 *   - Change a flag here only     → never inline booleans at call sites
 *   - One flag per concern        → flags stay independent
 *   - No auto-enable              → manual flip per release stage
 *
 * CURRENT FLAGS:
 * ┌──────────────────────────┬─────────┬──────────────────────────────────────┐
 * │ Flag                     │ Default │ Effect when true                     │
 * ├──────────────────────────┼─────────┼──────────────────────────────────────┤
 * │ USE_V4_SCORE_INPUT       │ false   │ scoreEngineGate uses Supabase+local  │
 * │                          │         │ resolved ingredients as score input   │
 * │                          │         │ instead of raw local-registry-only   │
 * └──────────────────────────┴─────────┴──────────────────────────────────────┘
 *
 * HOW TO ENABLE FOR TESTING:
 *   Change `USE_V4_SCORE_INPUT` to `true` here, then call
 *   `analyzeProductFullV4Gate` from scoreEngineGate.ts.
 *   The live `analyzeProductFull` path in ingredientIntelligence/index.ts
 *   remains completely unchanged.
 *
 * NEXT FLAGS (planned, not yet active):
 *   USE_V4_RISK_SCORING    — use V4 risk_level for score formula
 *   USE_V4_WARNINGS        — derive warnings from concern_flags / allergy_flag
 */

// ── Active flags ──────────────────────────────────────────────────────────────

/**
 * USE_V4_SCORE_INPUT
 *
 * When false (default / production):
 *   scoreEngineGate → analyzeProductFull(rawText) → legacy IngredientIntelligence pipeline
 *   Behavior is identical to today. No Supabase call is made.
 *
 * When true (opt-in / testing):
 *   scoreEngineGate → buildResolvedIngredientScoreInputV4(rawIngredients)
 *   → scoreInputAdapter maps V4 payload → IngredientIntelligenceResult shape
 *   → calculateIngredientScore(adapted) produces score from richer input
 *
 * DEFAULT: false — production behavior unchanged.
 */
export const USE_V4_SCORE_INPUT = false;
