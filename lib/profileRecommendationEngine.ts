/**
 * profileRecommendationEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Kapsamlı ürün öneri motoru — "eczacı gibi düşün"
 *
 * 4 mod:
 *   A. contextual   — mevcut ekran/eylem bazlı
 *   B. profile      — kullanıcı profili (cilt tipi, kaygılar, alerji, özel durum)
 *   C. behavior     — öğrenme profili + geçmiş etkileşimler
 *   D. goal         — kullanıcının çözmek istediği sorun
 *
 * Puanlama faktörleri (spec uyumlu):
 *   category_match:    0–25
 *   concern_match:     0–30
 *   skin_type_match:   0–20
 *   feature_match:     0–15
 *   ingredient_fit:    0–10
 *   behavior_signal:   0–15
 *   safety_penalty:   -100–0
 *   premium_boost:     0–5
 *
 * Güvenlik kuralı:
 *   Alerji çakışması veya gebelik/emzirme yasaklı içerik → BLOKE
 */

import type { UserPreferences, SkinType, SkinConcernKey, AllergyKey } from "./userPreferences";
import type { LearningProfile } from "./userEvents";
import type { Product } from "@/types/product";

// ── Segment sıralaması ────────────────────────────────────────────────────────

export type SegmentTier = "ekonomik" | "profesyonel" | "seçkin";

const SEG_RANK: Record<string, number> = {
  ekonomik:    0,
  profesyonel: 1,
  "seçkin":    2,
};

// ── Öneri modu ────────────────────────────────────────────────────────────────

export type RecommendationMode = "contextual" | "profile" | "behavior" | "goal";

// ── Sonuç tipi ────────────────────────────────────────────────────────────────

export interface ProfileRecommendation {
  product:         Product;
  score:           number;
  tier:            SegmentTier | null;
  reasonLabel:     string;
  reasonIcon:      string;
  reasonBg:        string;
  reasonColor:     string;
  mode:            RecommendationMode;
  safetyBlocked:   boolean;
}

// ── Puanlama girdileri ────────────────────────────────────────────────────────

export interface RecommendationContext {
  preferences:    UserPreferences;
  learningProfile?: LearningProfile;
  targetConcern?: SkinConcernKey;
  contextCategory?: string;
  isPremium?:     boolean;
  excludeIds?:    Set<string>;
  limit?:         number;
  mode?:          RecommendationMode;
}

// ── Cilt tipi anahtar kelimeleri ──────────────────────────────────────────────

const SKIN_TYPE_KWS: Record<SkinType, string[]> = {
  oily:        ["oily", "yağlı", "oil-free", "yağsız", "mat", "matte", "sebum", "pore", "gözenek"],
  dry:         ["dry", "kuru", "rich", "besleyici", "nourish", "hydrat", "ceramide", "seramid"],
  combination: ["combination", "karma", "balance", "denge"],
  sensitive:   ["sensitive", "hassas", "duyarlı", "gentle", "nazik", "fragrance-free", "parfümsüz", "centella", "cica"],
  normal:      ["normal"],
};

// ── Kaygı anahtar kelimeleri & ağırlıklar ────────────────────────────────────

const CONCERN_KWS: Record<SkinConcernKey, string[]> = {
  acne:          ["acne", "akne", "sivilce", "blemish", "breakout", "salicylic", "salisilik", "bha", "zinc", "çinko", "niacinamide"],
  spots:         ["spot", "leke", "pigment", "brightening", "aydınlatma", "niacinamide", "vitamin c", "arbutin", "kojic"],
  redness:       ["redness", "kızarıklık", "calming", "soothing", "centella", "cica", "azulen", "allantoin"],
  dehydration:   ["dehydration", "nem", "hydration", "hyaluronic", "moisture", "moistur", "hydrat"],
  barrier_repair:["barrier", "bariyer", "repair", "onarım", "ceramide", "seramid", "fatty acid"],
  anti_aging:    ["anti-aging", "yaşlanma", "wrinkle", "kırışıklık", "retinol", "peptide", "bakuchiol", "collagen"],
  pore:          ["pore", "gözenek", "minimiz", "bha", "salicylic", "niacinamide"],
};

const CONCERN_LABELS: Record<SkinConcernKey, string> = {
  acne:          "Akne kaygına uygun aktifler",
  spots:         "Leke karşıtı içerik profili",
  redness:       "Kızarıklığı yatıştırıcı formül",
  dehydration:   "Nem dengesini destekliyor",
  barrier_repair:"Bariyer onarımı için uygun",
  anti_aging:    "Yaşlanma karşıtı aktif içerik",
  pore:          "Gözenek odaklı formül",
};

// ── Alerji → içerik eşleşme haritası ─────────────────────────────────────────

const ALLERGY_INGREDIENT_KWS: Record<AllergyKey, string[]> = {
  fragrance:    ["parfum", "fragrance", "perfume", "koku", "aroma"],
  alcohol:      ["alcohol denat", "ethanol", "sd alcohol", "isopropyl alcohol"],
  essential_oil:["essential oil", "esansiyel yağ", "tea tree oil", "lavender oil", "eucalyptus"],
  paraben:      ["paraben", "methylparaben", "propylparaben", "butylparaben"],
  silicone:     ["silicone", "dimethicone", "cyclopentasiloxane", "siloxane"],
  sulfate:      ["sulfate", "sls", "sles", "sodium lauryl", "sodium laureth"],
  nut:          ["walnut", "almond oil", "hazelnut", "ceviz", "badem yağı"],
  latex:        ["latex", "rubber", "hevea"],
  lanolin:      ["lanolin", "wool alcohol", "wool wax"],
  gluten:       ["gluten", "wheat", "buğday", "oat"],
  nickel:       ["nickel", "nikel"],
};

// ── Gebelik/emzirme yasaklı içerikler ────────────────────────────────────────

const PREGNANCY_BLOCKED_KWS = [
  "retinol", "tretinoin", "retinoid", "retinoic",
  "salicylic acid", "salisilik asit",
  "hydroquinone", "hidroquinon",
  "formaldehyde", "formaldehit",
  "high-dose vitamin a",
];

const BREASTFEEDING_BLOCKED_KWS = [
  "retinol", "tretinoin",
  "salicylic acid",
];

// ── Yardımcı: haystack oluştur ────────────────────────────────────────────────

function buildHaystack(p: Product): string {
  return [
    p.name                        ?? "",
    (p as any).isim               ?? "",
    p.category                    ?? "",
    (p as any).kategori           ?? "",
    (p as any).subcategory        ?? "",
    (p as any).short_benefit      ?? "",
    (p as any).description        ?? "",
    (p as any).about              ?? "",
    ...((p as any).skin_types     ?? []),
    ...((p as any).concerns_supported ?? []),
    ...((p as any).concerns       ?? []),
    ...((p as any).tags           ?? []),
    (p as any).ingredients        ?? "",
  ].join(" ").toLowerCase();
}

function matchesAny(haystack: string, kws: string[]): boolean {
  return kws.some((kw) => haystack.includes(kw));
}

// ── Güvenlik kontrolü ─────────────────────────────────────────────────────────

function checkSafety(p: Product, prefs: UserPreferences): { blocked: boolean; penalty: number } {
  const hs = buildHaystack(p);
  const conditions = prefs.specialConditions ?? [];

  if (conditions.includes("pregnancy") && matchesAny(hs, PREGNANCY_BLOCKED_KWS)) {
    return { blocked: true, penalty: -100 };
  }
  if (conditions.includes("breastfeeding") && matchesAny(hs, BREASTFEEDING_BLOCKED_KWS)) {
    return { blocked: true, penalty: -100 };
  }

  let penalty = 0;
  for (const allergy of (prefs.allergies ?? [])) {
    const kws = ALLERGY_INGREDIENT_KWS[allergy as AllergyKey] ?? [];
    if (kws.length > 0 && matchesAny(hs, kws)) {
      return { blocked: true, penalty: -100 };
    }
  }

  if (prefs.allergyIngredients?.length) {
    for (const ing of prefs.allergyIngredients) {
      if (hs.includes(ing.toLowerCase())) {
        return { blocked: true, penalty: -100 };
      }
    }
  }

  if (
    (prefs.specialConditions ?? []).includes("sensitive_skin") &&
    matchesAny(hs, ["alcohol denat", "parfum", "fragrance"])
  ) {
    penalty -= 20;
  }

  return { blocked: false, penalty };
}

// ── Öneri sebebi çözümle ──────────────────────────────────────────────────────

function resolveReason(
  mode: RecommendationMode,
  concern?: SkinConcernKey,
  skinType?: SkinType,
  isBehavior?: boolean,
  tierDiff?: number,
): { reasonLabel: string; reasonIcon: string; reasonBg: string; reasonColor: string } {
  if (concern && CONCERN_LABELS[concern]) {
    return {
      reasonLabel: CONCERN_LABELS[concern],
      reasonIcon:  "target",
      reasonBg:    "#FFF7ED",
      reasonColor: "#C2410C",
    };
  }
  if (skinType) {
    const labels: Record<SkinType, string> = {
      oily:        "Yağlı cilt için dengeli",
      dry:         "Kuru cilt için besleyici",
      combination: "Karma cilde uygun aktifler",
      sensitive:   "Hassas cilt için formüle edilmiş",
      normal:      "Normal cilde uygun formül",
    };
    return {
      reasonLabel: labels[skinType] ?? "Cilt tipine uygun",
      reasonIcon:  "user-check",
      reasonBg:    "#EFF6FF",
      reasonColor: "#1D4ED8",
    };
  }
  if (isBehavior) {
    return {
      reasonLabel: "İlgi alanına yakın ürün",
      reasonIcon:  "trending-up",
      reasonBg:    "#F0FDF4",
      reasonColor: "#15803D",
    };
  }
  if (tierDiff && tierDiff > 0) {
    return {
      reasonLabel: "Daha güçlü formül",
      reasonIcon:  "chevrons-up",
      reasonBg:    "#F5F3FF",
      reasonColor: "#6D28D9",
    };
  }
  if (tierDiff && tierDiff < 0) {
    return {
      reasonLabel: "Daha uygun fiyat",
      reasonIcon:  "chevrons-down",
      reasonBg:    "#F0FDF4",
      reasonColor: "#15803D",
    };
  }
  return {
    reasonLabel: "Profil uyumu yüksek",
    reasonIcon:  "check-circle",
    reasonBg:    "#F0FDF4",
    reasonColor: "#15803D",
  };
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────

export function getProfileRecommendations(
  allProducts: Product[],
  ctx: RecommendationContext,
): ProfileRecommendation[] {
  const {
    preferences,
    learningProfile,
    targetConcern,
    contextCategory,
    isPremium    = false,
    excludeIds   = new Set<string>(),
    limit        = 6,
    mode         = "profile",
  } = ctx;

  const results: ProfileRecommendation[] = [];

  for (const p of allProducts) {
    const pid = String(p.id);
    if (excludeIds.has(pid)) continue;

    const hs      = buildHaystack(p);
    const safety  = checkSafety(p, preferences);
    if (safety.blocked) continue;

    let score = 0;

    // ── 1. Kategori eşleşmesi (0–25) ───────────────────────────────────────
    const pCat = ((p as any).category ?? (p as any).kategori ?? "").toLowerCase();
    if (contextCategory && pCat && pCat.includes(contextCategory.toLowerCase())) {
      score += 25;
    } else if (contextCategory && pCat) {
      const words = contextCategory.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const overlap = words.filter(w => pCat.includes(w)).length;
      score += Math.min(overlap * 8, 20);
    }

    // ── 2. Kaygı eşleşmesi (0–30) ──────────────────────────────────────────
    let concernScore = 0;
    const userConcerns: SkinConcernKey[] = preferences.skinConcerns ?? [];
    const activeConcern = targetConcern ?? userConcerns[0];

    if (activeConcern && CONCERN_KWS[activeConcern]) {
      const hits = CONCERN_KWS[activeConcern].filter(kw => hs.includes(kw)).length;
      concernScore = Math.min(hits * 6, 30);
    }

    if (concernScore === 0 && userConcerns.length > 1) {
      for (const c of userConcerns.slice(1)) {
        const hits = CONCERN_KWS[c]?.filter(kw => hs.includes(kw)).length ?? 0;
        if (hits > 0) { concernScore = Math.min(hits * 4, 18); break; }
      }
    }
    score += concernScore;

    // ── 3. Cilt tipi eşleşmesi (0–20) ──────────────────────────────────────
    let skinTypeScore = 0;
    if (preferences.skinType) {
      const kws = SKIN_TYPE_KWS[preferences.skinType] ?? [];
      const hits = kws.filter(kw => hs.includes(kw)).length;
      skinTypeScore = Math.min(hits * 5, 20);
    }
    score += skinTypeScore;

    // ── 4. Özellik eşleşmesi (0–15) ────────────────────────────────────────
    let featureScore = 0;
    if ((preferences.texturePreferences ?? []).length > 0) {
      const texKws: Record<string, string[]> = {
        light:  ["light", "hafif", "su bazlı", "water", "gel", "fluid", "serum"],
        rich:   ["rich", "yoğun", "besleyici", "nourish", "cream", "krem"],
        gel:    ["gel", "jel"],
        cream:  ["cream", "krem", "krem kıvam"],
        fluid:  ["fluid", "akışkan", "serum", "essence"],
      };
      for (const tex of preferences.texturePreferences) {
        const kws = texKws[tex] ?? [];
        if (kws.some(kw => hs.includes(kw))) { featureScore = 10; break; }
      }
    }
    if (preferences.finishPreference) {
      const finKws: Record<string, string[]> = {
        matte:   ["mat", "matte", "oil-free", "yağsız"],
        natural: ["natural", "doğal", "satin"],
        glow:    ["glow", "ışıltı", "brightening", "luminous"],
      };
      const kws = finKws[preferences.finishPreference] ?? [];
      if (kws.some(kw => hs.includes(kw))) featureScore = Math.min(featureScore + 5, 15);
    }
    score += featureScore;

    // ── 5. İçerik uyumu (0–10) ─────────────────────────────────────────────
    let ingredientScore = 0;
    const avoidKws = (preferences.avoidedIngredients ?? []).map(i => i.toLowerCase());
    if (avoidKws.length > 0 && !avoidKws.some(kw => hs.includes(kw))) {
      ingredientScore += 5;
    }
    const badges: any[] = (p as any).badges ?? [];
    const isFragFree = badges.some((b: any) => b.key === "fragrance" && b.status === "negative");
    const isAlcFree  = badges.some((b: any) => b.key === "alcohol"   && b.status === "negative");
    if (isFragFree) ingredientScore += 3;
    if (isAlcFree)  ingredientScore += 2;
    score += Math.min(ingredientScore, 10);

    // ── 6. Davranış sinyali (0–15) ─────────────────────────────────────────
    let behaviorScore = 0;
    if (learningProfile?.hasEnoughData) {
      const brand = ((p as any).brand ?? (p as any).marka ?? "").toLowerCase().trim();
      const cat   = pCat;
      const sub   = ((p as any).subcategory ?? "").toLowerCase().trim();
      const seg   = ((p as any).segment     ?? "").toLowerCase().trim();

      if (brand && learningProfile.topBrands?.includes(brand))      behaviorScore += 5;
      if (cat   && learningProfile.topCategories?.includes(cat))    behaviorScore += 5;
      if (sub   && learningProfile.topSubcategories?.includes(sub)) behaviorScore += 3;
      if (seg   && learningProfile.topSegments?.includes(seg))      behaviorScore += 2;
    }
    score += Math.min(behaviorScore, 15);

    // ── 7. Güvenlik cezası ─────────────────────────────────────────────────
    score += safety.penalty;

    // ── 8. Premium boost (0–5) ─────────────────────────────────────────────
    const pSeg = ((p as any).segment ?? "").toLowerCase();
    if (isPremium && pSeg === "seçkin") score += 5;

    // Minimum eşik
    if (score < 15) continue;

    // ── Tier belirleme ─────────────────────────────────────────────────────
    const tier: SegmentTier | null =
      pSeg === "ekonomik"    ? "ekonomik"    :
      pSeg === "profesyonel" ? "profesyonel" :
      pSeg === "seçkin"      ? "seçkin"      :
      null;

    // ── Sebep etiketleme ───────────────────────────────────────────────────
    const matchedConcern  = activeConcern && concernScore > 0 ? activeConcern : undefined;
    const matchedSkinType = skinTypeScore > 0 ? preferences.skinType ?? undefined : undefined;
    const isBehaviorHit   = behaviorScore >= 5;

    const reason = resolveReason(mode, matchedConcern, matchedSkinType, isBehaviorHit);

    results.push({
      product:       p,
      score,
      tier,
      mode,
      safetyBlocked: false,
      ...reason,
    });
  }

  // ── Sıralama ────────────────────────────────────────────────────────────────
  results.sort((a, b) => b.score - a.score);

  // ── Çeşitlilik: marka başına max 2 ────────────────────────────────────────
  const brandCount: Record<string, number> = {};
  const diverse: ProfileRecommendation[] = [];
  for (const r of results) {
    const brand = ((r.product as any).brand ?? (r.product as any).marka ?? "unknown").toLowerCase();
    const n = brandCount[brand] ?? 0;
    if (n >= 2) continue;
    brandCount[brand] = n + 1;
    diverse.push(r);
    if (diverse.length >= limit) break;
  }

  return diverse;
}

// ── Hedef bazlı mod: belirli bir kaygı için ───────────────────────────────────

export function getGoalBasedRecommendations(
  allProducts: Product[],
  concern: SkinConcernKey,
  preferences: UserPreferences,
  options?: { limit?: number; isPremium?: boolean; excludeIds?: Set<string> },
): ProfileRecommendation[] {
  return getProfileRecommendations(allProducts, {
    preferences,
    targetConcern: concern,
    mode: "goal",
    limit:         options?.limit ?? 6,
    isPremium:     options?.isPremium ?? false,
    excludeIds:    options?.excludeIds ?? new Set(),
  });
}

// ── Davranış bazlı mod: öğrenme profilinden ───────────────────────────────────

export function getBehaviorBasedRecommendations(
  allProducts: Product[],
  preferences: UserPreferences,
  learningProfile: LearningProfile,
  options?: { limit?: number; isPremium?: boolean; excludeIds?: Set<string> },
): ProfileRecommendation[] {
  return getProfileRecommendations(allProducts, {
    preferences,
    learningProfile,
    mode:      "behavior",
    limit:     options?.limit ?? 6,
    isPremium: options?.isPremium ?? false,
    excludeIds: options?.excludeIds ?? new Set(),
  });
}

// ── Tier çeşitliliği: Ekonomik / Pro / Seçkin üçlüsü ─────────────────────────

export interface TierTriplet {
  ekonomik:    ProfileRecommendation | null;
  profesyonel: ProfileRecommendation | null;
  seckin:      ProfileRecommendation | null;
}

export function getTierTriplet(
  allProducts: Product[],
  ctx: RecommendationContext,
): TierTriplet {
  const all = getProfileRecommendations(allProducts, { ...ctx, limit: 20 });
  return {
    ekonomik:    all.find(r => r.tier === "ekonomik")    ?? null,
    profesyonel: all.find(r => r.tier === "profesyonel") ?? null,
    seckin:      all.find(r => r.tier === "seçkin")      ?? null,
  };
}
