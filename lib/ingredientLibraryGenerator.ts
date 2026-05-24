/**
 * ingredientLibraryGenerator.ts
 *
 * Transforms CANONICAL_INGREDIENT_DATASET into a mobile-compatible library.
 *
 * Usage:
 *   import { GENERATED_MOBILE_LIBRARY } from "./ingredientLibraryGenerator";
 *   import { generateMobileLibrary }    from "./ingredientLibraryGenerator";
 *
 * This is the bridge between the canonical source and the mobile consumer.
 * When the canonical dataset is updated, this generator re-derives the
 * mobile library automatically — no manual editing of the output needed.
 *
 * Do NOT wire into productAnalysisV3 or UI yet.
 */

import {
  CANONICAL_INGREDIENT_DATASET,
  type CanonicalIngredientEntry,
} from "./ingredientCanonicalDataset_combined";

export interface MobileIngredientEntry {
  canonical_name: string;
  aliases: string[];
  category: string;
  risk_level: string;
  flags: string[];
}

/**
 * Pure transformer — converts one canonical entry to mobile format.
 * Preserves all fields; add any mobile-specific transformations here.
 */
function toMobileEntry(entry: CanonicalIngredientEntry): MobileIngredientEntry {
  return {
    canonical_name: entry.canonical_name,
    aliases:        entry.aliases,
    category:       entry.category,
    risk_level:     entry.risk_level,
    flags:          entry.flags,
  };
}

/**
 * Generates the full mobile-compatible ingredient library
 * from the canonical dataset.
 */
export function generateMobileLibrary(): MobileIngredientEntry[] {
  return CANONICAL_INGREDIENT_DATASET.map(toMobileEntry);
}

/**
 * Pre-computed mobile library derived from canonical dataset.
 * Import this instead of INGREDIENT_LIBRARY when using V3 pipeline.
 */
export const GENERATED_MOBILE_LIBRARY: MobileIngredientEntry[] =
  generateMobileLibrary();

/**
 * Validation report — call at build/check time, not at runtime.
 */
export interface LibrarySyncReport {
  canonical_count: number;
  generated_count: number;
  priority_entries_included: boolean;
  priority_check: Record<string, boolean>;
}

const PRIORITY_ENTRIES = [
  "ethylhexyl triazone",
  "bis-ethylhexyloxyphenol methoxyphenyl triazine",
  "phenylene bis-diphenyltriazine",
  "carbomer",
  "disodium edta",
] as const;

export function getLibrarySyncReport(): LibrarySyncReport {
  const generatedNames = new Set(
    GENERATED_MOBILE_LIBRARY.map((e) => e.canonical_name.toLowerCase())
  );

  const priority_check: Record<string, boolean> = {};
  for (const entry of PRIORITY_ENTRIES) {
    priority_check[entry] = generatedNames.has(entry);
  }

  const priority_entries_included = Object.values(priority_check).every(Boolean);

  return {
    canonical_count:           CANONICAL_INGREDIENT_DATASET.length,
    generated_count:           GENERATED_MOBILE_LIBRARY.length,
    priority_entries_included,
    priority_check,
  };
}
