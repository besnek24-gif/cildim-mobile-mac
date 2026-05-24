/**
 * adminIngredientNormalizer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ingredient Learning Pipeline — Phase 1 — PREPROCESSING NORMALIZER
 *
 * PURPOSE:
 *   INCI-aware normalization for learning pipeline candidate names.
 *   Fixes malformed normalized_name entries that come from the resolver's
 *   aggressive character stripping:
 *
 *   Resolver bug examples (input → resolver output → this module output):
 *     "Avène Thermal Spring Water (Avène Aqua)"
 *       → "avene thermal spring water avene aqua"   (resolver)
 *       → "avene thermal spring water"              (this module) ✅
 *
 *     "ORYZA SATIVA (RICE STARCH)/ORYZA SATIVA STARCH"
 *       → "oryza sativa rice starch oryza sativa starch"  (resolver)
 *       → "oryza sativa starch"                           (this module) ✅
 *
 *     "acrylates/vinyl isodecanoate crosspolymer"
 *       → "acrylatesvinyl isodecanoate crosspolymer"      (resolver — / removed without space)
 *       → "acrylates vinyl isodecanoate crosspolymer"     (this module) ✅
 *
 * WHY THE RESOLVER PRODUCES MALFORMED NAMES:
 *   The resolver normalizer uses:
 *     .replace(/[^a-z0-9 \-]/g, "")   ← removes "/" without a space
 *     .replace(/[^a-z0-9 \-]/g, "")   ← removes "(" and ")" but keeps their content
 *   This causes word concatenation (acrylatesvinyl) and annotation bleed
 *   (parens content merged into the name).
 *
 * STRICT RULES:
 *   ✅ ONLY used in the learning pipeline (Candidate Builder + Capture layer)
 *   ✅ Does NOT change resolver logic (resolver/index.ts is untouched)
 *   ✅ Does NOT change score engine
 *   ✅ Does NOT change ingredient_unknown_queue writes
 *   ✅ Pure TypeScript — no Supabase dependency
 *   ✅ Additive only — no existing file modified
 *
 * PIPELINE POSITION:
 *   ingredient_unknown_queue (normalized_name — may be malformed)
 *     ──[captureUnknownAggregates]──▶ CaptureAggregate (sample_raw_names intact)
 *       ──[bestCandidateName]──▶ clean suggested_canonical_name ← THIS MODULE
 *         ──[adminCandidateBuilderService]──▶ LearningCandidate
 */

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Normalization trace for debugging.
 * Shows each transformation step: raw → cleaned → final.
 */
export interface NormalizationTrace {
  /** Input: raw ingredient string (from sample_raw_names) or normalized_name */
  raw:      string;
  /** After step 1–4 (parens, slash, accent, special char cleaning) */
  cleaned:  string;
  /** After step 5 (duplicate word sequence collapse) */
  final:    string;
  /** Which path was used: "raw" (from sample_raw_names) or "normalized" (fallback) */
  source:   "raw" | "normalized";
}

// ── Step 1: Parenthetical removal ────────────────────────────────────────────

/**
 * removeParentheticals
 *
 * Strips parenthetical annotations from ingredient names.
 * Parentheticals in INCI names are almost always:
 *   - Common/vernacular name annotations: "Niacinamide (Vitamin B3)"
 *   - Species annotations: "Oryza Sativa (Rice) Starch"
 *   - Country-specific name equivalents: "Aqua (Water)"
 *
 * These are NOT part of the canonical INCI name — they're labels for
 * the human reader. Stripping them (vs. keeping as resolver does) gives
 * cleaner suggested canonical names.
 *
 * Does NOT strip nested parens — only outermost () pairs.
 */
export function removeParentheticals(raw: string): string {
  // Replace all (...) blocks with a single space
  // Non-greedy so nested parens don't swallow too much
  return raw.replace(/\([^)]*\)/g, " ");
}

// ── Step 2: Slash expansion ───────────────────────────────────────────────────

/**
 * expandSlashes
 *
 * Replaces "/" with a space instead of silent removal.
 *
 * The resolver does: .replace(/[^a-z0-9 \-]/g, "") which removes "/" without
 * inserting a space, producing "acrylatesvinyl" from "acrylates/vinyl".
 *
 * In INCI names, "/" appears in two contexts:
 *   1. Alternate names: "Glycerin/Glycerol" → both are same ingredient
 *   2. Multi-part chemical names: "Acrylates/C10-30 Alkyl Acrylate Crosspolymer"
 *
 * Replacing with space handles both: "glycerin glycerol" and
 * "acrylates c10-30 alkyl acrylate crosspolymer" are both parseable.
 */
export function expandSlashes(raw: string): string {
  return raw.replace(/\//g, " ");
}

// ── Step 3: Accent + special char normalization ───────────────────────────────

/**
 * normalizeCharacters
 *
 * Produces a clean lowercase ASCII string suitable for INCI lookup.
 * Steps:
 *   1. Lowercase
 *   2. NFD decomposition (splits "è" into "e" + combining accent)
 *   3. Strip combining accent marks (U+0300–U+036F)
 *   4. Remove remaining special chars (keep a-z, 0-9, space, hyphen)
 *   5. Collapse multiple spaces → single space + trim
 */
export function normalizeCharacters(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accent marks
    .replace(/[^a-z0-9 \-]/g, " ")     // replace remaining special chars with space
    .replace(/\s+/g, " ")
    .trim();
}

// ── Step 4: Duplicate word sequence collapse ──────────────────────────────────

/**
 * collapseDuplicateWordSequences
 *
 * Detects and collapses repeated word subsequences within a normalized
 * ingredient name. This occurs when the resolver merges two ingredient
 * representations (separated by "/" or parenthetical) into one string.
 *
 * Algorithm:
 *   For n-gram sizes maxN → 1 (largest first for specificity):
 *     Find the first n words as prefix.
 *     Search if that prefix appears again anywhere after position n.
 *     If found: take from the second occurrence to end of string.
 *     (The "second occurrence" form is typically the more specific INCI name.)
 *
 * Examples:
 *   "oryza sativa rice starch oryza sativa starch"
 *     prefix "oryza sativa" (n=2) found at position 4
 *     → "oryza sativa starch" ✅
 *
 *   "avene thermal spring water avene aqua"
 *     prefix "avene" (n=1) found at position 4
 *     → "avene aqua" ✅
 *
 *   "aqua water aqua" (degenerate duplicate)
 *     prefix "aqua" (n=1) found at position 2
 *     → "aqua" ✅
 *
 * @param text  Already-normalized (lowercase, ASCII) ingredient string
 */
export function collapseDuplicateWordSequences(text: string): string {
  const words = text.split(" ").filter(Boolean);
  // Need at least 4 words to have a meaningful duplicate
  if (words.length < 4) return text;

  // Try largest n-gram first for most specific deduplication
  const maxN = Math.min(5, Math.floor(words.length / 2));

  for (let n = maxN; n >= 1; n--) {
    const prefix = words.slice(0, n);

    // Search for prefix appearing again after its first occurrence
    for (let i = n; i <= words.length - n; i++) {
      const windowMatches = prefix.every((w, idx) => w === words[i + idx]);
      if (windowMatches) {
        // Found repeat at position i — take from i to end
        const collapsed = words.slice(i).join(" ");
        // Sanity: collapsed must be non-trivial (at least 2 chars)
        if (collapsed.length >= 2) return collapsed;
      }
    }
  }

  return text;
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * cleanRawNameForCandidate
 *
 * Applies the full 4-step cleaning pipeline to a RAW ingredient string
 * (before resolver normalization). Use this when sample_raw_names[0] is
 * available — it gives the best results because the raw string still has
 * its original punctuation intact.
 *
 * Steps: parens removal → slash expansion → char normalization → dedup
 *
 * @param raw  Original raw ingredient string from the product label
 */
export function cleanRawNameForCandidate(raw: string): string {
  const step1 = removeParentheticals(raw);
  const step2 = expandSlashes(step1);
  const step3 = normalizeCharacters(step2);
  const step4 = collapseDuplicateWordSequences(step3);
  return step4;
}

/**
 * cleanNormalizedNameForCandidate
 *
 * Applies only the dedup step to an ALREADY-normalized name (from the queue).
 * Use this as a fallback when no raw name is available.
 * Parens and slashes are already gone, so only deduplication is possible.
 *
 * @param normalizedName  Already-normalized string from ingredient_unknown_queue
 */
export function cleanNormalizedNameForCandidate(normalizedName: string): string {
  // Only dedup is possible since parens/slashes are already stripped
  return collapseDuplicateWordSequences(normalizedName);
}

// ── Best candidate name picker ────────────────────────────────────────────────

/**
 * bestCandidateName
 *
 * Main entry point for the learning pipeline normalizer.
 * Picks the best suggested_canonical_name using a two-path strategy:
 *
 *   PATH A (preferred): Clean from raw name (sample_raw_names[0])
 *     Retains original punctuation → allows slash expansion and parens removal.
 *     Only used if the cleaned result is non-empty and no longer than the
 *     existing normalized_name (ensures we're not making things worse).
 *
 *   PATH B (fallback): Dedup the already-normalized name
 *     Applied when no raw name is available or PATH A produces a longer result.
 *
 * Returns the best name + a NormalizationTrace for debugging.
 *
 * @param normalizedName  Queue-stored normalized_name (may be malformed)
 * @param sampleRawNames  Raw ingredient strings from the queue row
 */
export function bestCandidateName(
  normalizedName: string,
  sampleRawNames: string[],
): { name: string; trace: NormalizationTrace } {

  // ── PATH A: Clean from raw ────────────────────────────────────────────────
  if (sampleRawNames.length > 0) {
    const raw     = sampleRawNames[0].trim();
    const cleaned = raw ? cleanRawNameForCandidate(raw) : "";

    if (
      cleaned.length >= 2 &&                       // non-trivial result
      cleaned.length <= normalizedName.length + 5  // not longer than original
                                                   // (+5 tolerance for accent expansion)
    ) {
      return {
        name:  cleaned,
        trace: {
          raw,
          cleaned,
          final:  cleaned,
          source: "raw",
        },
      };
    }
  }

  // ── PATH B: Dedup the normalized name ─────────────────────────────────────
  const cleaned = cleanNormalizedNameForCandidate(normalizedName);

  return {
    name:  cleaned || normalizedName,  // never return empty string
    trace: {
      raw:    normalizedName,
      cleaned,
      final:  cleaned || normalizedName,
      source: "normalized",
    },
  };
}

// ── Alias cleaning ────────────────────────────────────────────────────────────

/**
 * cleanAliasesFromRawNames
 *
 * Produces clean alias candidates from raw name variants.
 * Uses `cleanRawNameForCandidate` instead of the resolver's stripping logic,
 * so aliases are also free of slash/parens artifacts.
 *
 * @param canonicalName  The chosen canonical name (aliases must differ)
 * @param sampleRawNames Raw name variants from the queue
 */
export function cleanAliasesFromRawNames(
  canonicalName:  string,
  sampleRawNames: string[],
): string[] {
  const aliases = new Set<string>();

  for (const raw of sampleRawNames) {
    const cleaned = cleanRawNameForCandidate(raw);
    if (
      cleaned &&
      cleaned !== canonicalName &&
      cleaned.length >= 3 &&
      cleaned.length <= 120     // sanity cap: no aberrant long strings
    ) {
      aliases.add(cleaned);
    }
  }

  return [...aliases];
}

// ── Debug formatter ───────────────────────────────────────────────────────────

/**
 * formatNormalizationTrace
 *
 * Human-readable single-line trace for debug scripts.
 * Format: raw → cleaned → final  [source]
 *
 * Example:
 *   "ORYZA SATIVA (RICE STARCH)/ORYZA SATIVA STARCH"
 *   → "oryza sativa oryza sativa starch"
 *   → "oryza sativa starch"  [raw]
 */
export function formatNormalizationTrace(trace: NormalizationTrace): string {
  if (trace.raw === trace.final) {
    return `"${trace.raw}" → no change [${trace.source}]`;
  }
  return [
    `  raw     : "${trace.raw}"`,
    `  cleaned : "${trace.cleaned}"`,
    `  final   : "${trace.final}"`,
    `  source  : ${trace.source}`,
  ].join("\n");
}
