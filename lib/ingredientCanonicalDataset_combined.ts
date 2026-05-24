/**
 * ingredientCanonicalDataset_combined.ts
 *
 * MERGE LAYER — Combines the base dataset with expansion layers v1 and v2.
 *
 * Architecture:
 *   ingredientCanonicalDataset.ts            ← BASE (317 entries, NEVER modify)
 *   ingredientCanonicalDataset_expansion.ts  ← EXPANSION v1 (additive, ~322 unique entries)
 *   ingredientCanonicalDataset_expansion_v2.ts ← EXPANSION v2 (additive, corpus-derived)
 *   ingredientCanonicalDataset_combined.ts   ← THIS FILE (merged, deduplicated)
 *
 * Consumers must import CANONICAL_INGREDIENT_DATASET from THIS file only.
 * Do NOT import from base, v1, or v2 directly in consumer code.
 *
 * Deduplication strategy:
 *   Base takes precedence over v1; v1 takes precedence over v2.
 *   Duplicate canonical_names are silently dropped (later layer loses).
 */

import {
  CANONICAL_INGREDIENT_DATASET as BASE_DATASET,
  type CanonicalIngredientEntry,
} from "./ingredientCanonicalDataset";

import { CANONICAL_INGREDIENT_EXPANSION }    from "./ingredientCanonicalDataset_expansion";
import { CANONICAL_INGREDIENT_EXPANSION_V2 } from "./ingredientCanonicalDataset_expansion_v2";

// ── Deduplication ─────────────────────────────────────────────────────────────

const _baseNames = new Set(BASE_DATASET.map((e) => e.canonical_name));

const _dedupedV1: CanonicalIngredientEntry[] = CANONICAL_INGREDIENT_EXPANSION.filter(
  (e) => !_baseNames.has(e.canonical_name)
);

const _combinedNames = new Set([
  ..._baseNames,
  ..._dedupedV1.map((e) => e.canonical_name),
]);

const _dedupedV2: CanonicalIngredientEntry[] = CANONICAL_INGREDIENT_EXPANSION_V2.filter(
  (e) => !_combinedNames.has(e.canonical_name)
);

// ── Combined export ───────────────────────────────────────────────────────────

/**
 * Combined canonical ingredient dataset.
 * Single authoritative source for all ingredient intelligence consumers.
 */
export const CANONICAL_INGREDIENT_DATASET: CanonicalIngredientEntry[] = [
  ...BASE_DATASET,
  ..._dedupedV1,
  ..._dedupedV2,
];

export type { CanonicalIngredientEntry };

// ── Diagnostic exports (dev only) ─────────────────────────────────────────────
export const DATASET_STATS = {
  base_count:         BASE_DATASET.length,
  expansion_v1_count: _dedupedV1.length,
  expansion_v2_count: _dedupedV2.length,
  total_count:        BASE_DATASET.length + _dedupedV1.length + _dedupedV2.length,
  growth_ratio:       parseFloat(
    ((BASE_DATASET.length + _dedupedV1.length + _dedupedV2.length) / BASE_DATASET.length).toFixed(2)
  ),
} as const;
