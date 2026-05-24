import { INGREDIENT_LIBRARY } from "./ingredientLibrary";
import { addUnknownCandidates } from "./unknownCollector";

export interface MatchedItem {
  raw: string;
  canonical_name: string;
  matched: boolean;
  category: string;
  risk_level: string;
  flags: string[];
}

export interface UnknownCandidate {
  raw: string;
  normalized: string;
}

export interface MatchResult {
  total: number;
  matched: number;
  unknown: number;
  coverage_pct: number;
  items: MatchedItem[];
  unknown_items: string[];
  unknown_candidates: UnknownCandidate[];
}

export function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_LIBRARY = INGREDIENT_LIBRARY.map((lib) => ({
  ...lib,
  normalizedAliases: lib.aliases.map(normalizeKey),
}));

export function matchIngredients(raw: string | string[]): MatchResult {
  const empty: MatchResult = {
    total: 0,
    matched: 0,
    unknown: 0,
    coverage_pct: 0,
    items: [],
    unknown_items: [],
    unknown_candidates: [],
  };

  if (!raw || (typeof raw === "string" && raw.trim() === "") || (Array.isArray(raw) && raw.length === 0)) {
    return empty;
  }

  const entries: string[] = Array.isArray(raw)
    ? raw.map((s) => s.trim()).filter(Boolean)
    : raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  if (entries.length === 0) return empty;

  const items: MatchedItem[] = [];
  const unknown_items: string[] = [];
  const unknown_candidates: UnknownCandidate[] = [];

  for (const entry of entries) {
    const key = normalizeKey(entry);
    const exactRecord = NORMALIZED_LIBRARY.find((lib) =>
      lib.normalizedAliases.some((alias) => key === alias)
    );
    const record =
      exactRecord ??
      NORMALIZED_LIBRARY.find((lib) =>
        lib.normalizedAliases.some(
          (alias) => key.includes(alias) || alias.includes(key)
        )
      );

    if (record) {
      items.push({
        raw: entry,
        canonical_name: record.canonical_name,
        matched: true,
        category: record.category,
        risk_level: record.risk_level,
        flags: record.flags as string[],
      });
    } else {
      unknown_items.push(entry);
      unknown_candidates.push({ raw: entry, normalized: key });
      items.push({
        raw: entry,
        canonical_name: entry,
        matched: false,
        category: "unknown",
        risk_level: "unknown",
        flags: [],
      });
    }
  }

  const total = items.length;
  const matched = items.filter((i) => i.matched).length;
  const unknown = total - matched;
  const coverage_pct = total > 0 ? Math.round((matched / total) * 100) : 0;

  addUnknownCandidates(unknown_candidates);

  return { total, matched, unknown, coverage_pct, items, unknown_items, unknown_candidates };
}
