/**
 * registry/index.ts — ingredientEngineV4
 *
 * Loads, merges and exposes the V4 canonical registry.
 *
 * Architecture:
 *   CORE_REGISTRY  (coreRegistry.ts)     ← primary entries, never modified
 *   + future expansion layers            ← additive only, named coreRegistryExpansion_vN.ts
 *
 * Consumers: import V4_REGISTRY from this file only.
 * Do NOT import coreRegistry.ts directly in consumer code.
 */

import type { V4RegistryEntry, V4MatchResult } from "./types";
import { CORE_REGISTRY } from "./coreRegistry";
import { CORE_REGISTRY_EXPANSION_V1 } from "./coreRegistryExpansion_v1";
import { normalizeV4Token, flattenV4Key } from "../normalizer";

// ── Supabase cache injection (dependency-injection, no import of supabaseClient) ─
// supabaseCache/index.ts calls setSupabaseCacheLookup() after its bulk preload.
// registry/index.ts itself NEVER imports supabaseClient or any React Native module.

type CacheLookupFn = (flatKey: string) => V4MatchResult | null;
let _cacheLookup: CacheLookupFn | null = null;

/**
 * Called by supabaseCache/index.ts after the bulk preload completes.
 * Passing null resets to local-only behavior (cache miss always).
 */
export function setSupabaseCacheLookup(fn: CacheLookupFn | null): void {
  _cacheLookup = fn;
}

// ── Merge + deduplicate ────────────────────────────────────────────────────────
// Core layer wins. Expansion entries with duplicate canonical_name are silently dropped.

const _seen = new Set<string>();
const _merged: V4RegistryEntry[] = [];

for (const entry of CORE_REGISTRY) {
  if (!_seen.has(entry.canonical_name)) {
    _seen.add(entry.canonical_name);
    _merged.push(entry);
  }
}

// Expansion v1 — additive layer, never overrides core
for (const entry of CORE_REGISTRY_EXPANSION_V1) {
  if (!_seen.has(entry.canonical_name)) {
    _seen.add(entry.canonical_name);
    _merged.push(entry);
  }
}

/** Full merged V4 canonical registry — single source of truth. */
export const V4_REGISTRY: ReadonlyArray<V4RegistryEntry> = _merged;

// ── Queryable index ───────────────────────────────────────────────────────────

interface IndexedV4Entry extends V4RegistryEntry {
  normalizedAliases: string[];
  flatAliases:       string[];
}

const _index: IndexedV4Entry[] = V4_REGISTRY.map((entry) => {
  const normalizedAliases = entry.aliases.map(normalizeV4Token);
  return {
    ...entry,
    normalizedAliases,
    flatAliases: normalizedAliases.map(flattenV4Key),
  };
});

// ── Match function (3-tier) ────────────────────────────────────────────────────

/**
 * Resolves a single raw token against the V4 registry.
 *
 * Tier 1: exact normalized alias match
 * Tier 2: flat-key match (removes separators — catches hyphen/space variants)
 * Tier 3: substring soft match (min 6 chars both sides — conservative)
 *
 * Returns matched: false if none succeed.
 */
export function matchV4Ingredient(raw: string): V4MatchResult {
  const normalized = normalizeV4Token(raw);
  const flatNorm   = flattenV4Key(normalized);

  // PATH 0: Supabase preload cache (injected by supabaseCache/index.ts after bulk fetch)
  // _cacheLookup is null until initSupabaseIngredientCache() completes — safe fallback.
  if (_cacheLookup !== null) {
    const cacheHit = _cacheLookup(flatNorm);
    if (cacheHit) return { ...cacheHit, raw, normalized };
  }

  // Tier 1: exact normalized
  for (const entry of _index) {
    if (entry.normalizedAliases.includes(normalized)) {
      return _hit(raw, normalized, entry, "exact");
    }
  }

  // Tier 2: flat-key (hyphen/space variants)
  if (flatNorm.length >= 4) {
    for (const entry of _index) {
      if (entry.flatAliases.includes(flatNorm)) {
        return _hit(raw, normalized, entry, "flat");
      }
    }
  }

  // Tier 3: substring soft match
  if (normalized.length >= 6) {
    for (const entry of _index) {
      for (const alias of entry.normalizedAliases) {
        if (alias.length >= 6 && (normalized.includes(alias) || alias.includes(normalized))) {
          return _hit(raw, normalized, entry, "soft");
        }
      }
    }
  }

  return {
    raw, normalized,
    canonical_name: null,
    category:       null,
    risk_level:     null,
    flags:          [],
    pregnancy_safe: null,
    matched:        false,
    match_tier:     "none",
    confidence:     null,
  };
}

function _hit(
  raw:        string,
  normalized: string,
  entry:      IndexedV4Entry,
  tier:       "exact" | "flat" | "soft"
): V4MatchResult {
  return {
    raw, normalized,
    canonical_name: entry.canonical_name,
    category:       entry.category,
    risk_level:     entry.risk_level,
    flags:          entry.flags,
    pregnancy_safe: entry.pregnancy_safe ?? null,
    matched:        true,
    match_tier:     tier,
    confidence:     entry.confidence,
  };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getV4RegistryStats() {
  const byCategory: Record<string, number> = {};
  for (const e of V4_REGISTRY) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return {
    total_entries:    V4_REGISTRY.length,
    by_category:      byCategory,
    by_risk: {
      safe:         V4_REGISTRY.filter((e) => e.risk_level === "safe").length,
      low_risk:     V4_REGISTRY.filter((e) => e.risk_level === "low_risk").length,
      medium_risk:  V4_REGISTRY.filter((e) => e.risk_level === "medium_risk").length,
      high_risk:    V4_REGISTRY.filter((e) => e.risk_level === "high_risk").length,
    },
  };
}
