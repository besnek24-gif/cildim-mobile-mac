/**
 * parser.ts — ingredientIntelligence
 *
 * Robust INCI ingredient text parser.
 * Handles separators: comma, semicolon, period, newline, asterisk annotations.
 *
 * Design: pure function, no side effects.
 *
 * IMPLEMENTATION NOTE (Dalga E1 / Phase 1):
 *   This module now delegates to the shared `tokenizeInciList` utility so that
 *   parser behavior stays consistent across the codebase. The public export
 *   name, signature, and contract are unchanged. Existing callers do not need
 *   to be modified.
 */

import { tokenizeInciList } from "@/lib/ingredients/inciTokenizer";

/**
 * Parses a raw INCI ingredient string into individual tokens.
 *
 * Handles:
 * - Standard INCI comma-separated lists
 * - Semicolon and newline delimiters
 * - Asterisk annotation markers (* = natural/organic/etc)
 * - Unicode zero-width characters
 * - Leading/trailing whitespace and punctuation noise
 * - Balanced parentheses (does NOT split on commas inside them)
 * - Numeric-comma chemical locants (e.g. "1,3-Butylene Glycol")
 */
export function parseIngredients(rawText: string): string[] {
  if (!rawText || rawText.trim().length === 0) return [];
  return tokenizeInciList(rawText);
}

/**
 * Returns total token count from a raw ingredient string.
 */
export function countIngredients(rawText: string): number {
  return parseIngredients(rawText).length;
}
