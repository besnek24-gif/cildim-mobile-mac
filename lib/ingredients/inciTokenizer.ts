/**
 * inciTokenizer.ts — shared safe INCI tokenizer
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, additive utility that splits a raw INCI ingredient string (or array)
 * into individual tokens.
 *
 * Designed as the single source of truth for ingredient tokenization across
 * the production runtime parser and (eventually) admin diagnostic scripts.
 *
 * SAFE IMPROVEMENTS over the legacy `.split(/[,;.\n]+/)` approach:
 *   1. Does NOT split inside balanced parentheses.
 *      "BIOCOMPLEX B11 (URTICA URENS LEAF EXTRACT, EQUISETUM ARVENSE LEAF EXTRACT)"
 *        stays as ONE token.
 *   2. Does NOT split numeric comma patterns inside a single INCI name.
 *      "2-Oleamido-1,3-Octadecanediol" stays as ONE token.
 *   3. Strips trailing punctuation safely.
 *      "Geranyl Acetate." → "Geranyl Acetate"
 *   4. Collapses repeated whitespace.
 *
 * BEHAVIOR PRESERVATION:
 *   - Splits on comma, semicolon, period, newline (when SAFE — not inside
 *     balanced parens and not between two digits).
 *   - Removes zero-width / non-breaking space characters.
 *   - Removes leading annotation markers (* + ° § #).
 *   - Removes empty tokens.
 *   - Removes number-only tokens (e.g. "10", "0.5%", "1,2").
 *
 * NON-GOALS:
 *   - No network calls.
 *   - No Supabase calls.
 *   - No resolver / alias / scoring calls.
 *   - No casing changes (preserves original token casing).
 */

// Placeholder code points in the Unicode Private Use Area — guaranteed not to
// appear in any real INCI text.
const PH_COMMA     = "\uE000";
const PH_SEMICOLON = "\uE001";
const PH_PERIOD    = "\uE002";
const PH_NEWLINE   = "\uE003";

/**
 * Walk the raw string and replace separator characters that occur inside
 * BALANCED parentheses with private-use placeholders. Restored after split.
 *
 * Linear scan, O(n). Stack-free depth counter is sufficient because we only
 * care whether we are currently inside any depth ≥ 1 of parens.
 */
function protectParenthesisSeparators(raw: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "(") {
      depth++;
      out += ch;
      continue;
    }
    if (ch === ")") {
      if (depth > 0) depth--;
      out += ch;
      continue;
    }
    if (depth > 0) {
      if (ch === ",")      { out += PH_COMMA;     continue; }
      if (ch === ";")      { out += PH_SEMICOLON; continue; }
      if (ch === ".")      { out += PH_PERIOD;    continue; }
      if (ch === "\n")     { out += PH_NEWLINE;   continue; }
    }
    out += ch;
  }
  return out;
}

/**
 * Replace numeric-comma patterns like "1,3" or "2,4" with a placeholder so the
 * subsequent split does not break tokens like "2-Oleamido-1,3-Octadecanediol".
 *
 * Conservative: only triggers when BOTH sides of the comma are digits and there
 * is no whitespace, i.e. it is clearly a chemical locant, not a separator.
 */
function protectNumericCommas(raw: string): string {
  return raw.replace(/(\d),(\d)/g, (_m, a, b) => `${a}${PH_COMMA}${b}`);
}

/** Restore placeholders back to their original characters. */
function restorePlaceholders(token: string): string {
  return token
    .replace(new RegExp(PH_COMMA, "g"),     ",")
    .replace(new RegExp(PH_SEMICOLON, "g"), ";")
    .replace(new RegExp(PH_PERIOD, "g"),    ".")
    .replace(new RegExp(PH_NEWLINE, "g"),   "\n");
}

/** Strip leading annotation markers and trailing punctuation/whitespace. */
function cleanToken(rawToken: string): string {
  return rawToken
    // Remove zero-width and non-breaking spaces
    .replace(/[\u200b\u00a0\ufeff]/g, "")
    // Remove leading annotation markers (* + ° § # and whitespace)
    .replace(/^[\s*+°§#]+/, "")
    // Remove trailing annotation markers, punctuation, whitespace
    .replace(/[\s*+°§#.,;:]+$/, "")
    // Collapse internal whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns true if the token is purely numeric / percentage noise. */
function isNumericNoise(token: string): boolean {
  return /^\d+([.,]\d+)?%?$/.test(token);
}

/**
 * Tokenize an INCI ingredient list.
 *
 * Accepts string, string[], null, or undefined. Always returns string[].
 */
export function tokenizeInciList(
  raw: string | string[] | null | undefined
): string[] {
  if (raw == null) return [];

  // String[] input: clean each entry individually, do not re-split.
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const entry of raw) {
      if (typeof entry !== "string") continue;
      const cleaned = cleanToken(entry);
      if (cleaned.length > 1 && !isNumericNoise(cleaned)) {
        out.push(cleaned);
      }
    }
    return out;
  }

  if (typeof raw !== "string" || raw.trim().length === 0) return [];

  // Step 1: protect separators that should NOT cause a split.
  const protectedText = protectNumericCommas(protectParenthesisSeparators(raw));

  // Step 2: split on standard INCI separators (those that survived protection).
  const rawTokens = protectedText.split(/[,;.\n]+/);

  // Step 3: restore placeholders, clean, filter.
  const out: string[] = [];
  for (const t of rawTokens) {
    const restored = restorePlaceholders(t);
    const cleaned  = cleanToken(restored);
    if (cleaned.length <= 1) continue;
    if (isNumericNoise(cleaned)) continue;
    out.push(cleaned);
  }
  return out;
}
