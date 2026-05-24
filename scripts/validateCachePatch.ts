/**
 * validateCachePatch.ts — node-safe doğrulama scripti
 *
 * React Native / supabaseClient bağımlılığı YOKTUR.
 * Doğrudan normalizer + coreRegistry + createLeanSupabase() kullanır.
 *
 * Doğrular:
 *   BEFORE = sadece local V4 registry (matchLocal)
 *   AFTER  = Supabase cache (bulk) + local V4 registry
 */

import { createLeanSupabase } from "../lib/admin/nodeResolver";

// Normalizer — React Native bağımlılığı yok
import {
  normalizeV4Token,
  flattenV4Key,
  parseV4Ingredients,
} from "../lib/ingredientEngineV4/normalizer";

// Registry verileri — sadece data dosyaları, React Native yok
import { CORE_REGISTRY }             from "../lib/ingredientEngineV4/registry/coreRegistry";
import { CORE_REGISTRY_EXPANSION_V1 } from "../lib/ingredientEngineV4/registry/coreRegistryExpansion_v1";

import type {
  V4RegistryEntry,
  V4MatchResult,
  V4RiskLevel,
  IngredientCategory,
  IngredientFlag,
  PregnancySafety,
} from "../lib/ingredientEngineV4/registry/types";

const sb = createLeanSupabase();

// ── Local registry (inline, aynı registry/index.ts mantığı) ─────────────────

const _seen = new Set<string>();
const _merged: V4RegistryEntry[] = [];
for (const e of CORE_REGISTRY) {
  if (!_seen.has(e.canonical_name)) { _seen.add(e.canonical_name); _merged.push(e); }
}
for (const e of CORE_REGISTRY_EXPANSION_V1) {
  if (!_seen.has(e.canonical_name)) { _seen.add(e.canonical_name); _merged.push(e); }
}

interface IndexedEntry extends V4RegistryEntry {
  normalizedAliases: string[];
  flatAliases: string[];
}
const _index: IndexedEntry[] = _merged.map(e => ({
  ...e,
  normalizedAliases: e.aliases.map(normalizeV4Token),
  flatAliases: e.aliases.map(a => flattenV4Key(normalizeV4Token(a))),
}));

function matchLocal(raw: string): V4MatchResult {
  const normalized = normalizeV4Token(raw);
  const flatNorm   = flattenV4Key(normalized);

  for (const e of _index) {
    if (e.normalizedAliases.includes(normalized))
      return { raw, normalized, canonical_name: e.canonical_name, category: e.category,
               risk_level: e.risk_level, flags: e.flags, pregnancy_safe: e.pregnancy_safe ?? null,
               matched: true, match_tier: "exact", confidence: e.confidence };
  }
  if (flatNorm.length >= 4) {
    for (const e of _index) {
      if (e.flatAliases.includes(flatNorm))
        return { raw, normalized, canonical_name: e.canonical_name, category: e.category,
                 risk_level: e.risk_level, flags: e.flags, pregnancy_safe: e.pregnancy_safe ?? null,
                 matched: true, match_tier: "flat", confidence: e.confidence };
    }
  }
  if (normalized.length >= 6) {
    for (const e of _index) {
      for (const alias of e.normalizedAliases) {
        if (alias.length >= 6 && (normalized.includes(alias) || alias.includes(normalized)))
          return { raw, normalized, canonical_name: e.canonical_name, category: e.category,
                   risk_level: e.risk_level, flags: e.flags, pregnancy_safe: e.pregnancy_safe ?? null,
                   matched: true, match_tier: "soft", confidence: e.confidence };
      }
    }
  }
  return { raw, normalized, canonical_name: null, category: null, risk_level: null,
           flags: [], pregnancy_safe: null, matched: false, match_tier: "none", confidence: null };
}

// ── Supabase mapping helpers ──────────────────────────────────────────────────

function mapRiskLevel(raw: string | null): V4RiskLevel {
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

const CAT_REMAP: Record<string, IngredientCategory> = {
  skin_conditioning: "soothing",
  film_forming:      "film_former",
  pigment:           "colorant",
  antimicrobial:     "preservative",
  texturizing:       "polymer",
  bulking:           "absorbent",
  stabilizer:        "thickener",
};
const VALID_CATS = new Set<string>([
  "solvent","humectant","emollient","occlusive","barrier","soothing","active",
  "antioxidant","surfactant","preservative","emulsifier","thickener","chelating",
  "fragrance","uv_filter","absorbent","ph_adjuster","film_former","silicone",
  "botanical","colorant","polymer","unknown",
]);
function mapCategory(tags: string[] | null): IngredientCategory {
  if (!tags || tags.length === 0) return "unknown";
  for (const t of tags) {
    if (CAT_REMAP[t]) return CAT_REMAP[t];
    if (VALID_CATS.has(t)) return t as IngredientCategory;
  }
  return "unknown";
}

const VALID_FLAGS = new Set<string>([
  "fragrance","allergen","drying_alcohol","uv_filter","preservative","surfactant",
  "active","barrier_support","silicone","polymer","paraben","formaldehyde_releaser",
  "endocrine_disruptor","eu_restricted","mineral_filter",
]);
function mapFlags(raw: string[] | null): IngredientFlag[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(f => VALID_FLAGS.has(f)) as IngredientFlag[];
}
function mapPregnancySafe(raw: string | null): PregnancySafety | null {
  if (raw === "safe")      return true;
  if (raw === "avoid")     return false;
  if (raw === "uncertain") return "uncertain";
  return null;
}

// ── Supabase cache yükle ──────────────────────────────────────────────────────

type MasterRow = {
  id: string;
  canonical_name: string;
  risk_level: string | null;
  function_tags: string[] | null;
  concern_flags: string[] | null;
  pregnancy_flag: string | null;
};

async function loadCache(): Promise<Map<string, { canonical_name: string; risk_level: V4RiskLevel; category: IngredientCategory }>> {
  const info = new Map<string, { canonical_name: string; risk_level: V4RiskLevel; category: IngredientCategory }>();

  const { data: masters, error: me } = await sb
    .from("ingredients_master")
    .select("id, canonical_name, risk_level, function_tags, concern_flags, pregnancy_flag")
    .eq("is_active", true)
    .limit(5000);

  if (me || !masters) { console.error("  master fetch error:", me?.message); return info; }

  const { data: aliases, error: ae } = await sb
    .from("ingredient_aliases")
    .select("alias_name, ingredient_id")
    .eq("is_active", true)
    .limit(20000);

  if (ae || !aliases) { console.error("  alias fetch error:", ae?.message); return info; }

  const masterById = new Map(masters.map((m: MasterRow) => [m.id, m]));

  for (const alias of aliases) {
    const m = masterById.get(alias.ingredient_id);
    if (!m) continue;
    const flatKey = flattenV4Key(normalizeV4Token(alias.alias_name));
    if (!flatKey || info.has(flatKey)) continue;
    info.set(flatKey, {
      canonical_name: m.canonical_name,
      risk_level:     mapRiskLevel(m.risk_level),
      category:       mapCategory(m.function_tags),
    });
  }
  for (const m of masters) {
    const flatKey = flattenV4Key(normalizeV4Token((m as MasterRow).canonical_name));
    if (!flatKey || info.has(flatKey)) continue;
    info.set(flatKey, {
      canonical_name: (m as MasterRow).canonical_name,
      risk_level:     mapRiskLevel((m as MasterRow).risk_level),
      category:       mapCategory((m as MasterRow).function_tags),
    });
  }

  return info;
}

// ── Ana program ───────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(72));
  console.log("SUPABASE CACHE PATCH — DOĞRULAMA (3 ÜRÜN)");
  console.log("=".repeat(72));

  // Supabase cache yükle
  process.stdout.write("\n[1/3] Cache yükleniyor... ");
  const cache = await loadCache();
  console.log(`${cache.size} flat-key hazır`);

  // 3 ürün çek
  process.stdout.write("[2/3] Ürünler çekiliyor... ");
  const { data: products, error: pe } = await sb
    .from("products")
    .select("id, name, ingredients")
    .not("ingredients", "is", null)
    .neq("ingredients", "")
    .limit(3);

  if (pe || !products || products.length === 0) {
    console.error("Ürün çekilemedi:", pe?.message);
    process.exit(1);
  }
  console.log(`${products.length} ürün alındı`);

  // Karşılaştırma
  let totalTokens = 0, totalUnknownBefore = 0, totalUnknownAfter = 0;

  for (const product of products) {
    const raw = product.ingredients as string;
    const tokens = parseV4Ingredients(raw);

    if (tokens.length === 0) {
      console.log(`\n⚠️  ${product.name} — token yok, atlanıyor`);
      continue;
    }

    const unknownBefore: string[] = [];
    const unknownAfter: string[] = [];
    const newlyResolved: { raw: string; canonical: string; risk: string; category: string }[] = [];

    for (const token of tokens) {
      const localHit  = matchLocal(token);
      const flatKey   = flattenV4Key(normalizeV4Token(token));
      const cacheEntry = cache.get(flatKey);

      if (!localHit.matched) unknownBefore.push(token);

      const afterResolved = localHit.matched || !!cacheEntry;
      if (!afterResolved) unknownAfter.push(token);

      if (!localHit.matched && cacheEntry) {
        newlyResolved.push({
          raw:       token,
          canonical: cacheEntry.canonical_name,
          risk:      cacheEntry.risk_level,
          category:  cacheEntry.category,
        });
      }
    }

    totalTokens        += tokens.length;
    totalUnknownBefore += unknownBefore.length;
    totalUnknownAfter  += unknownAfter.length;

    const pBefore = ((unknownBefore.length / tokens.length) * 100).toFixed(1);
    const pAfter  = ((unknownAfter.length  / tokens.length) * 100).toFixed(1);

    console.log("\n" + "─".repeat(72));
    console.log(`📦  ${product.name ?? product.id}`);
    console.log(`    Toplam: ${tokens.length} token`);
    console.log(`    BEFORE (local only) : ${unknownBefore.length} unknown  %${pBefore}`);
    console.log(`    AFTER  (cache+local): ${unknownAfter.length} unknown  %${pAfter}`);

    if (newlyResolved.length > 0) {
      console.log(`\n    ✅ YENİ ÇÖZÜMLENEN — ${newlyResolved.length} ingredient (sadece cache sayesinde):`);
      for (const r of newlyResolved) {
        console.log(`       • "${r.raw}" → ${r.canonical} [${r.risk} / ${r.category}]`);
      }
    } else {
      console.log(`\n    ℹ️  Bu üründe cache ek çözümleme sağlamadı (zaten local'de çözümlü veya yeni batch lazım).`);
    }

    const stillUnknown = unknownAfter.slice(0, 8);
    if (stillUnknown.length > 0) {
      console.log(`\n    ❓ HÂLÂ UNKNOWN (${unknownAfter.length} adet, ilk 8):`);
      for (const u of stillUnknown) console.log(`       • "${u}"`);
      if (unknownAfter.length > 8) console.log(`       ... +${unknownAfter.length - 8} tane daha`);
    }
  }

  // Özet
  const pBef  = ((totalUnknownBefore / totalTokens) * 100).toFixed(1);
  const pAft  = ((totalUnknownAfter  / totalTokens) * 100).toFixed(1);
  const drop  = totalUnknownBefore - totalUnknownAfter;
  const pDrop = (((drop) / totalTokens) * 100).toFixed(1);

  console.log("\n" + "=".repeat(72));
  console.log("TOPLAM ÖZET — 3 ÜRÜN");
  console.log("=".repeat(72));
  console.log(`  Toplam ingredient token  : ${totalTokens}`);
  console.log(`  Unknown — BEFORE         : ${totalUnknownBefore}  (%${pBef})`);
  console.log(`  Unknown — AFTER          : ${totalUnknownAfter}  (%${pAft})`);
  console.log(`  Düşüş                    : -${drop} token  (-%${pDrop} puan)`);
  console.log(`  Supabase cache boyutu    : ${cache.size} anahtar`);
  console.log(`  Local registry boyutu    : ${_merged.length} giriş`);
  console.log("=".repeat(72));
}

main().catch(err => { console.error("HATA:", err); process.exit(1); });
