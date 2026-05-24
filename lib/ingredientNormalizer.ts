import { INGREDIENT_ALIAS_MAP } from "./ingredientAliasDictionary";
import { INGREDIENT_LIBRARY } from "./ingredientLibrary";

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_LIB = INGREDIENT_LIBRARY.map(lib => ({
  canonical_name: lib.canonical_name,
  normalizedAliases: lib.aliases.map(normalizeKey),
}));

export function normalizeIngredients(raw: string | string[]) {
  const text = Array.isArray(raw) ? raw.join(",") : raw;

  if (!text || !text.trim()) {
    return {
      raw: [],
      normalized: [],
      recognized: [],
      unknown: [],
      unknown_ratio: 0
    };
  }

  const parts = text
    .split(/[,.;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const normalized: string[] = [];
  const recognized: string[] = [];
  const unknown: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    const key = normalizeKey(part);

    // Step 1: direct alias map match
    if (INGREDIENT_ALIAS_MAP[lower]) {
      const canonical = INGREDIENT_ALIAS_MAP[lower];
      normalized.push(canonical);
      recognized.push(canonical);
      continue;
    }

    // Step 2: exact normalized match against INGREDIENT_LIBRARY
    const exactMatch = NORMALIZED_LIB.find(lib =>
      lib.normalizedAliases.some(alias => key === alias)
    );
    if (exactMatch) {
      normalized.push(exactMatch.canonical_name);
      recognized.push(exactMatch.canonical_name);
      continue;
    }

    // Step 3: fuzzy includes fallback
    const fuzzyMatch = NORMALIZED_LIB.find(lib =>
      lib.normalizedAliases.some(alias =>
        alias.length > 3 && (key.includes(alias) || alias.includes(key))
      )
    );
    if (fuzzyMatch) {
      normalized.push(fuzzyMatch.canonical_name);
      recognized.push(fuzzyMatch.canonical_name);
      continue;
    }

    // Not matched
    normalized.push(lower);
    unknown.push(lower);
  }

  return {
    raw: parts,
    normalized,
    recognized,
    unknown,
    unknown_ratio: normalized.length ? unknown.length / normalized.length : 0
  };
}
