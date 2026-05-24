/**
 * draftEntryGenerator.ts — ingredientExpansion
 *
 * Converts analyzed unknown ingredients into draft canonical entries.
 * All draft entries are marked `needs_validation: true` and must NOT be
 * merged into the production canonical dataset without manual review.
 *
 * Usage:
 *   const drafts = generateDraftEntries(analyzedUnknowns);
 *   // Review, validate, then manually promote to ingredientCanonicalDataset.ts
 */

import type { AnalyzedUnknown } from "./unknownAnalyzer";
import type { DefaultRiskLevel } from "./unknownAnalyzer";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DraftCanonicalEntry {
  canonical_name:   string;
  aliases:          string[];
  category:         string;
  risk_level:       DefaultRiskLevel;
  flags:            string[];
  needs_validation: true;
  source:           "auto_generated";
  confidence:       "high" | "medium" | "low";
  notes:            string;
}

export interface DraftReport {
  total_drafts:      number;
  high_confidence:   number;
  medium_confidence: number;
  low_confidence:    number;
  by_category:       Record<string, number>;
  entries:           DraftCanonicalEntry[];
}

// ── Canonical name deriver ─────────────────────────────────────────────────────

/**
 * Derives a canonical name from the normalized token.
 * Applies light title-casing conventions matching INCI format.
 */
function deriveCanonicalName(normalized: string): string {
  // Capitalize first letter only — INCI convention
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// ── Alias generator ────────────────────────────────────────────────────────────

/**
 * Generates alias variants from the raw and normalized strings.
 * Deduplicates and keeps only non-trivial aliases.
 */
function buildAliases(raw: string, normalized: string): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];

  const candidates = [
    raw.trim(),
    normalized,
    raw.trim().toLowerCase(),
  ];

  for (const c of candidates) {
    const clean = c.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      aliases.push(clean);
    }
  }

  return aliases;
}

// ── Notes builder ──────────────────────────────────────────────────────────────

function buildNotes(item: AnalyzedUnknown): string {
  const parts: string[] = [
    `Auto-generated from unknown collector.`,
    item.matched_pattern
      ? `Pattern: ${item.matched_pattern}.`
      : "No pattern matched — categorized as 'other'.",
    `Confidence: ${item.confidence}.`,
    `Observed frequency: ${item.frequency} product(s).`,
    `Needs manual review before promoting to canonical dataset.`,
  ];
  return parts.join(" ");
}

// ── Core generator ─────────────────────────────────────────────────────────────

function generateDraftEntry(item: AnalyzedUnknown): DraftCanonicalEntry {
  return {
    canonical_name:   deriveCanonicalName(item.normalized),
    aliases:          buildAliases(item.raw, item.normalized),
    category:         item.suggested_category,
    risk_level:       item.default_risk_level,
    flags:            item.suggested_flags,
    needs_validation: true,
    source:           "auto_generated",
    confidence:       item.confidence,
    notes:            buildNotes(item),
  };
}

/**
 * Generates draft canonical entries for all analyzed unknowns.
 * Skips items already categorized as "other" with low confidence
 * unless explicitly requested via `includeOther`.
 */
export function generateDraftEntries(
  analyzed: AnalyzedUnknown[],
  options: { includeOther?: boolean; minFrequency?: number } = {}
): DraftReport {
  const { includeOther = false, minFrequency = 1 } = options;

  const filtered = analyzed.filter((item) => {
    if (item.frequency < minFrequency) return false;
    if (!includeOther && item.suggested_category === "other" && item.confidence === "low") return false;
    return true;
  });

  const entries = filtered.map(generateDraftEntry);

  const by_category: Record<string, number> = {};
  let high_confidence   = 0;
  let medium_confidence = 0;
  let low_confidence    = 0;

  for (const e of entries) {
    by_category[e.category] = (by_category[e.category] ?? 0) + 1;
    if (e.confidence === "high")   high_confidence++;
    if (e.confidence === "medium") medium_confidence++;
    if (e.confidence === "low")    low_confidence++;
  }

  return {
    total_drafts:      entries.length,
    high_confidence,
    medium_confidence,
    low_confidence,
    by_category,
    entries,
  };
}

/**
 * Formats a draft entry as a TypeScript snippet suitable for copy-paste
 * into ingredientCanonicalDataset.ts after human validation.
 */
export function formatAsTsSnippet(entry: DraftCanonicalEntry): string {
  const aliases = entry.aliases.map((a) => `"${a}"`).join(", ");
  const flags   = entry.flags.map((f) => `"${f}"`).join(", ");
  return (
    `  // [NEEDS VALIDATION] confidence: ${entry.confidence} | ${entry.notes}\n` +
    `  { canonical_name: "${entry.canonical_name}", aliases: [${aliases}], ` +
    `category: "${entry.category}", risk_level: "${entry.risk_level}", flags: [${flags}] },`
  );
}
