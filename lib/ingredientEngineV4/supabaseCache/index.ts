/**
 * supabaseCache/index.ts — ingredientEngineV4
 *
 * One-time bulk preload of Supabase ingredients_master + ingredient_aliases.
 * Exposes a synchronous in-memory lookup used by matchV4Ingredient as PATH 0.
 *
 * PATH priority in matchV4Ingredient after this module loads:
 *   PATH 0 — Supabase preload cache (this module, flat-key lookup, zero network)
 *   PATH 1 — Local V4 registry Tier 1/2/3 (unchanged)
 *   PATH 3 — unknown queue (unchanged)
 *
 * Preload strategy:
 *   1. Fetch ALL active ingredients_master rows (single query)
 *   2. Fetch ALL active ingredient_aliases rows (single query)
 *   3. Join in-memory: for each alias → find master → build V4MatchResult
 *   4. Key = flattenV4Key(normalizeV4Token(alias_name)) — identical pipeline to matchV4Ingredient
 *   5. Also key the canonical_name itself (catch exact INCI hits)
 *
 * Guarantees:
 *   - Zero per-ingredient network calls
 *   - Synchronous lookup after init (Map)
 *   - Silent on error: if fetch fails, isSupabaseCacheReady() returns false
 *     and matchV4Ingredient falls through to existing local registry behavior
 *   - Safe to call initSupabaseIngredientCache() multiple times: only loads once
 */

import { supabase }                          from "../../supabaseClient";
import { normalizeV4Token, flattenV4Key }    from "../normalizer";
import { setSupabaseCacheLookup }            from "../registry";
import type {
  V4MatchResult,
  V4RiskLevel,
  IngredientCategory,
  IngredientFlag,
  PregnancySafety,
} from "../registry/types";

// ── Internal cache state ──────────────────────────────────────────────────────

let _initPending = false;
let _initDone    = false;

const _cache = new Map<string, V4MatchResult>();

/**
 * Triggers a one-time bulk preload of all active Supabase ingredient entries.
 * On success, calls setSupabaseCacheLookup() to wire the cache into matchV4Ingredient.
 * Safe to call multiple times — only runs once.
 * Fire-and-forget: never throws; errors are swallowed and cache stays empty.
 */
export async function initSupabaseIngredientCache(): Promise<void> {
  if (_initDone || _initPending) return;
  _initPending = true;

  try {
    // ── Query 1: all active master rows ──────────────────────────────────────
    const { data: masters, error: masterErr } = await supabase
      .from("ingredients_master")
      .select("id, canonical_name, risk_level, function_tags, concern_flags, pregnancy_flag")
      .eq("is_active", true)
      .limit(5000);

    if (masterErr || !masters) {
      if (__DEV__) console.warn("[SupabaseCache] ingredients_master fetch failed:", masterErr?.message);
      _initPending = false;
      return;
    }

    // ── Query 2: all active alias rows ────────────────────────────────────────
    const { data: aliases, error: aliasErr } = await supabase
      .from("ingredient_aliases")
      .select("alias_name, ingredient_id")
      .eq("is_active", true)
      .limit(20000);

    if (aliasErr || !aliases) {
      if (__DEV__) console.warn("[SupabaseCache] ingredient_aliases fetch failed:", aliasErr?.message);
      _initPending = false;
      return;
    }

    // ── Build master index ────────────────────────────────────────────────────
    const masterById = new Map<string, typeof masters[number]>();
    for (const m of masters) {
      masterById.set(m.id, m);
    }

    // ── Populate cache ────────────────────────────────────────────────────────
    let loaded = 0;

    for (const alias of aliases) {
      const master = masterById.get(alias.ingredient_id);
      if (!master) continue;

      const flatKey = flattenV4Key(normalizeV4Token(alias.alias_name));
      if (!flatKey || _cache.has(flatKey)) continue;

      _cache.set(flatKey, _buildMatchResult(alias.alias_name, master));
      loaded++;
    }

    // Also index canonical_name as a direct key (catches exact INCI name hits)
    for (const master of masters) {
      const flatKey = flattenV4Key(normalizeV4Token(master.canonical_name));
      if (!flatKey || _cache.has(flatKey)) continue;
      _cache.set(flatKey, _buildMatchResult(master.canonical_name, master));
      loaded++;
    }

    // Wire cache into matchV4Ingredient (dependency injection — no RN import in registry)
    setSupabaseCacheLookup((flatKey) => _cache.get(flatKey) ?? null);
    _initDone = true;

    if (__DEV__) {
      console.log(
        `[SupabaseCache] Ready — ${loaded} keys from ${masters.length} ingredients, ${aliases.length} aliases`
      );
    }
  } catch (err) {
    if (__DEV__) console.warn("[SupabaseCache] Unexpected error during preload:", err);
  } finally {
    _initPending = false;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type MasterRow = {
  id: string;
  canonical_name: string;
  risk_level: string | null;
  function_tags: string[] | null;
  concern_flags: string[] | null;
  pregnancy_flag: string | null;
};

function _buildMatchResult(rawAlias: string, master: MasterRow): V4MatchResult {
  const normalized = normalizeV4Token(rawAlias);
  return {
    raw:            rawAlias,
    normalized,
    canonical_name: master.canonical_name,
    category:       _mapCategory(master.function_tags),
    risk_level:     _mapRiskLevel(master.risk_level),
    flags:          _mapFlags(master.concern_flags),
    pregnancy_safe: _mapPregnancySafe(master.pregnancy_flag),
    matched:        true,
    match_tier:     "exact",
    confidence:     "high",
  };
}

function _mapRiskLevel(raw: string | null): V4RiskLevel {
  switch (raw) {
    case "safe":        return "safe";
    case "low":         return "low_risk";
    case "low_risk":    return "low_risk";
    case "medium":      return "medium_risk";
    case "medium_risk": return "medium_risk";
    case "high":        return "high_risk";
    case "high_risk":   return "high_risk";
    default:            return "low_risk";
  }
}

const _CATEGORY_REMAP: Record<string, IngredientCategory> = {
  skin_conditioning: "soothing",
  film_forming:      "film_former",
  pigment:           "colorant",
  antimicrobial:     "preservative",
  texturizing:       "polymer",
  bulking:           "absorbent",
  stabilizer:        "thickener",
};

const _VALID_CATEGORIES = new Set<string>([
  "solvent","humectant","emollient","occlusive","barrier","soothing","active",
  "antioxidant","surfactant","preservative","emulsifier","thickener","chelating",
  "fragrance","uv_filter","absorbent","ph_adjuster","film_former","silicone",
  "botanical","colorant","polymer","unknown",
]);

function _mapCategory(tags: string[] | null): IngredientCategory {
  if (!tags || tags.length === 0) return "unknown";
  for (const t of tags) {
    if (_CATEGORY_REMAP[t]) return _CATEGORY_REMAP[t];
    if (_VALID_CATEGORIES.has(t)) return t as IngredientCategory;
  }
  return "unknown";
}

const _VALID_FLAGS = new Set<string>([
  "fragrance","allergen","drying_alcohol","uv_filter","preservative","surfactant",
  "active","barrier_support","silicone","polymer","paraben","formaldehyde_releaser",
  "endocrine_disruptor","eu_restricted","mineral_filter",
]);

function _mapFlags(raw: string[] | null): IngredientFlag[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((f) => _VALID_FLAGS.has(f)) as IngredientFlag[];
}

function _mapPregnancySafe(raw: string | null): PregnancySafety | null {
  if (raw === "safe")      return true;
  if (raw === "avoid")     return false;
  if (raw === "uncertain") return "uncertain";
  return null;
}
