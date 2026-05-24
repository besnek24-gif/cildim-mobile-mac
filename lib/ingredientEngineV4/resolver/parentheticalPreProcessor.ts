/**
 * parentheticalPreProcessor.ts — ingredientEngineV4/resolver
 * ─────────────────────────────────────────────────────────────────────────────
 * Safe, additive pre-normalization utility for INCI ingredient labels that
 * contain parenthetical alternative names.
 *
 * PROBLEM:
 *   INCI labels often embed an alternative common name in parentheses:
 *     "Water (Aqua)"
 *     "Avene Thermal Spring Water (Avene Aqua)"
 *     "Oryza Sativa (Rice) Starch (Oryza Sativa Starch)"
 *     "Zea Mays (Corn) Starch (Zea Mays Starch)"
 *
 *   After normalisation the parenthetical content is kept:
 *     "water aqua", "avene thermal spring water avene aqua", …
 *   which no longer matches "water", "avene thermal spring water", etc.
 *
 * SOLUTION:
 *   Produce a second candidate string with ALL parenthetical blocks removed,
 *   then collapse whitespace. Resolution tries both forms; returns whichever
 *   matches first.
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT modify matchV4Ingredient() or the local registry
 *   - Does NOT alter the resolver's PATH ordering
 *   - Does NOT write to any table
 *   - Is purely a string transformation utility
 *
 * USAGE:
 *   import {
 *     stripParentheticals,
 *     buildParentheticalCandidates,
 *   } from "./parentheticalPreProcessor";
 */

// ── Strip utility ──────────────────────────────────────────────────────────────

/**
 * Remove all parenthetical blocks from a raw ingredient label and return a
 * clean trimmed string.
 *
 * Examples:
 *   "Water (Aqua)"                            → "Water"
 *   "Avene Thermal Spring Water (Avene Aqua)" → "Avene Thermal Spring Water"
 *   "Oryza Sativa (Rice) Starch (Oryza …)"   → "Oryza Sativa Starch"
 *   "Zea Mays (Corn) Starch (Zea Mays …)"    → "Zea Mays Starch"
 *   "Niacinamide"                             → "Niacinamide"  (unchanged)
 *
 * Only top-level `(…)` blocks are removed. Nested parentheses are handled by
 * repeated application of the outer regex (greedy match of non-`)` content).
 */
export function stripParentheticals(raw: string): string {
  // Remove all blocks of the form `(anything except closing paren)` including
  // any leading whitespace before the opening paren.
  const stripped = raw.replace(/\s*\([^)]*\)/g, "");
  // Collapse any internal whitespace gaps left by the removal, then trim.
  return stripped.replace(/\s{2,}/g, " ").trim();
}

// ── Candidate builder ──────────────────────────────────────────────────────────

export interface ParentheticalCandidates {
  /** The raw string as received — never modified. */
  original: string;
  /**
   * The raw string with all `(…)` blocks removed and whitespace collapsed.
   * Identical to `original` when no parentheses are present.
   */
  stripped: string;
  /**
   * `true` when at least one parenthetical block was found and removed.
   * When `false`, `stripped === original` (no second lookup needed).
   */
  hasParentheticals: boolean;
}

/**
 * Build a pair of lookup candidates for a raw ingredient label.
 *
 * Callers should:
 *   1. Try resolution with `original`.
 *   2. If that fails AND `hasParentheticals` is true, try again with `stripped`.
 *   3. If both fail, continue existing fallback unchanged.
 *
 * @param raw  Raw ingredient string from a product label.
 */
export function buildParentheticalCandidates(raw: string): ParentheticalCandidates {
  const stripped           = stripParentheticals(raw);
  const hasParentheticals  = stripped !== raw;

  return { original: raw, stripped, hasParentheticals };
}
