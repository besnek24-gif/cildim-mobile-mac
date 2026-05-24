/**
 * parser.ts — productAnalysisV3
 *
 * Splits a raw INCI ingredient string into individual tokens.
 * Preserves original casing; does not normalize.
 */

export function parseIngredients(rawText: string): string[] {
  if (!rawText || rawText.trim() === "") return [];

  return rawText
    .split(/[,;.\n]+/)
    .map((token) => token.replace(/\u200b/g, "").trim())
    .filter((token) => token.length > 0);
}
