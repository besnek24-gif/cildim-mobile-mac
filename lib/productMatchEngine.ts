/**
 * productMatchEngine.ts  —  v2 "Gerçek Eczacı"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Üç katmanlı karar sistemi:
 *
 * KATMAN 1 — HARD FILTER (önce geç, skor alma)
 *   · Alerji çakışması           → doğrudan çıkar
 *   · Hamilelik yüksek riski     → doğrudan çıkar
 *   · Tamamen yanlış kategori    → doğrudan çıkar
 *
 * KATMAN 2 — DİNAMİK PUANLAMA (profile-context aware)
 *   Profil bağlamına göre ağırlıklar değişir:
 *   · Hamile kullanıcı → güvenlik ağırlığı ×3
 *   · Rosacea/Egzama   → hassasiyet ağırlığı ×2
 *   · Akne odaklı      → kaygı eşleşmesi ağırlığı ×2
 *   Sabit +20/-40 yok; her boyut için ARALIK bazlı skor.
 *
 * KATMAN 3 — ÇEŞİTLİLİK + LİMİT
 *   · Benzer feature imzasına sahip ürünler tekrarlanmaz
 *   · Max 8 ürün, tier başına max 4
 *
 * Güvenlik sinyalleri: evaluateProductWarnings reuse edilir.
 */

import { evaluateProductWarnings } from "@/lib/productWarnings";
import type { SmartWarningWithSuggestion } from "@/lib/productWarnings";
import type { UserPreferences, SkinConcernKey, SkinType } from "@/lib/userPreferences";
import type { Product } from "@/types/product";

// ─────────────────────────────────────────────────────────────────────────────
// TİP TANIMLARI
// ─────────────────────────────────────────────────────────────────────────────

export type MatchTier       = "best" | "strong" | "consider";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface TierMeta {
  key:      MatchTier;
  label:    string;
  sublabel: string;
  color:    string;
  iconName: string;
}

export const TIER_META: Record<MatchTier, TierMeta> = {
  best:    { key: "best",    label: "Senin için en doğru seçim", sublabel: "Profilinle mükemmel uyum",  color: "#7A8F6B", iconName: "award"     },
  strong:  { key: "strong",  label: "Güçlü alternatif",          sublabel: "Yüksek uyum",               color: "#4A6FA5", iconName: "thumbs-up" },
  consider:{ key: "consider",label: "Düşünülebilir",             sublabel: "Kısmi uyum — dikkatli ol", color: "#C8A97E", iconName: "info"       },
};

export interface MatchResult {
  product:        Product;
  score:          number;
  tier:           MatchTier;
  confidence:     ConfidenceLevel;
  confidenceLabel:string;
  matchReasons:   string[];   // doğal dil açıklamalar
  warnings:       SmartWarningWithSuggestion[];
  fitScore:       number;
}

export interface TieredMatchResults {
  best:     MatchResult[];
  strong:   MatchResult[];
  consider: MatchResult[];
  total:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFİL BAĞLAMI — dinamik ağırlık hesaplama
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileContext {
  safetyPriority:     0 | 1 | 2 | 3;  // 3 = hamilelik, her şeyi geçersiz kılar
  sensitivityCritical:boolean;
  comedogenicCritical:boolean;
  weights: {
    skinType:    number;
    concern:     number;
    sensitivity: number;
    ingredients: number;
    safety:      number;   // güvenlik cezası çarpanı
  };
}

function buildProfileContext(prefs: UserPreferences, concern: SkinConcernKey): ProfileContext {
  const sc = prefs.specialConditions ?? [];

  // ── Hamilelik / Emzirme → güvenlik her şeyin önünde ──────────────────────
  if (sc.includes("pregnancy") || sc.includes("breastfeeding")) {
    return {
      safetyPriority: 3,
      sensitivityCritical: false,
      comedogenicCritical: concern === "acne",
      weights: { skinType: 0.6, concern: 0.8, sensitivity: 0.5, ingredients: 1.4, safety: 3.0 },
    };
  }

  // ── Rosacea / Egzama / Sedef → hassasiyet kritik ─────────────────────────
  if (sc.includes("rosacea") || sc.includes("eczema") || sc.includes("psoriasis")) {
    return {
      safetyPriority: 2,
      sensitivityCritical: true,
      comedogenicCritical: concern === "acne",
      weights: { skinType: 1.0, concern: 1.0, sensitivity: 2.2, ingredients: 1.2, safety: 2.0 },
    };
  }

  // ── Hassas cilt (belirtilmiş veya profil) ─────────────────────────────────
  if (sc.includes("sensitive_skin") || prefs.skinType === "sensitive") {
    return {
      safetyPriority: 1,
      sensitivityCritical: true,
      comedogenicCritical: concern === "acne",
      weights: { skinType: 1.2, concern: 1.0, sensitivity: 1.8, ingredients: 1.0, safety: 1.4 },
    };
  }

  // ── Akne odaklı ──────────────────────────────────────────────────────────
  if (concern === "acne" || sc.includes("acne_prone")) {
    return {
      safetyPriority: 0,
      sensitivityCritical: false,
      comedogenicCritical: true,
      weights: { skinType: 1.0, concern: 2.0, sensitivity: 0.8, ingredients: 1.5, safety: 1.2 },
    };
  }

  // ── Hiperpigmentasyon odaklı ──────────────────────────────────────────────
  if (concern === "spots" || sc.includes("hyperpigmentation")) {
    return {
      safetyPriority: 0,
      sensitivityCritical: false,
      comedogenicCritical: false,
      weights: { skinType: 0.9, concern: 2.0, sensitivity: 0.8, ingredients: 1.6, safety: 1.0 },
    };
  }

  // ── Varsayılan ─────────────────────────────────────────────────────────────
  return {
    safetyPriority: 0,
    sensitivityCritical: false,
    comedogenicCritical: false,
    weights: { skinType: 1.0, concern: 1.2, sensitivity: 1.0, ingredients: 1.0, safety: 1.0 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 1 — HARD FİLTRE
// ─────────────────────────────────────────────────────────────────────────────

// Cilt bakımıyla ilgisiz kategoriler → cilt kaygıları için çıkar
const UNRELATED_CAT_SIGNALS = [
  "saç bakım", "saç boyası", "şampuan", "saç kremi", "saç maskesi",
  "diş macunu", "diş bakım", "deodorant", "antiperspirant",
  "tırnak", "oje", "makyaj kaldır",
];

function isHardExcluded(
  product: Record<string, unknown>,
  prefs:   UserPreferences,
  warningTypes: string[],
): boolean {
  // 1. Alerji çakışması → çıkar
  if (warningTypes.includes("allergy")) return true;

  // 2. Hamilelik yüksek riski → çıkar (hamile/emziren kullanıcı için)
  const sc = prefs.specialConditions ?? [];
  const hasPregnancy = sc.includes("pregnancy") || sc.includes("breastfeeding");
  if (hasPregnancy && warningTypes.includes("pregnancy")) return true;

  // 3. Tamamen yanlış kategori → çıkar
  const catText = [
    String(product.category ?? ""),
    String(product.kategori ?? ""),
    String(product.subcategory ?? ""),
    String(product.name ?? ""),
  ].join(" ").toLowerCase();

  if (UNRELATED_CAT_SIGNALS.some(sig => catText.includes(sig))) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERİ ERİŞİMİ — yardımcılar
// ─────────────────────────────────────────────────────────────────────────────

// ECZ4 Step 3 — getFeatures input normalization adapter (additive).
// DB shape gerçeği: products.features çoğunlukla object (vegan/alcohol/paraben/
// sulfate/silicone/fragrance booleans), products.badges ise dolu Türkçe
// string[]. Engine'in CONCERN_FEATURES vocab'ı string[] beklediği için bu
// adapter — scoring formülünü, ağırlıkları, eşikleri DEĞİŞTİRMEDEN — mevcut
// veriyi kanonik feature flag'lerine map eder. Eski array path'leri korunur.
//
// Tek truth: çıktı string'leri **CONCERN_FEATURES vocab'ından**. Yeni vocab
// üretilmiyor. Adapter yalnızca productMatchEngine içinde kullanılır.

const FEATURE_CACHE: WeakMap<object, string[]> = new WeakMap();

// Türkçe diakritik tolerant normalize. Search engine helper'ları import
// EDİLMEZ (kural #2). Lokal, küçük, saf.
function normalizeBadgeKey(s: unknown): string {
  if (typeof s !== "string") return "";
  let out = s.toLowerCase();
  out = out
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

// Onaylı badge → kanonik feature flag(ler) tablosu. Anahtarlar
// normalizeBadgeKey ile aynı normalize biçimindedir (ASCII, lowercase, tek
// boşluk). Genişletmek için STEP 3A audit raporundaki SAFE listesi referans.
const BADGE_TO_CANONICAL: Record<string, string[]> = {
  "parfumsuz":              ["fragrance_free"],
  "hassas cilt":            ["sensitive_skin_friendly"],
  "atopik cilt":            ["sensitive_skin_friendly"],
  "hassas cilt dostu":      ["sensitive_skin_friendly"],
  "bariyer destegi":        ["barrier_support"],
  "onarici":                ["repair_care"],
  "onarim":                 ["repair_care"],
  "guclendirici":           ["repair_care"],
  "yatistirici":            ["soothing"],
  "yogun nem":              ["hydrating"],
  "nem destegi":            ["hydrating"],
  "hyaluronik asit":        ["hydrating"],
  "hafif nem":              ["hydrating"],
  "leke karsiti":           ["tone_evening", "brightening"],
  "aydinlatici":            ["brightening"],
  "parlaklik":              ["brightening"],
  "c vitamini":             ["brightening"],
  "ton esitleyici":         ["tone_evening"],
  "mat bitis":              ["matte_finish"],
  "matlastirici":           ["matte_finish"],
  "yag kontrolu":           ["oil_control"],
  "sebum dengeleyici":      ["oil_control"],
  "gozenek temizleyici":    ["pore_care"],
  "akne karsiti":           ["acne_prone_friendly"],
  "akne dostu":             ["acne_prone_friendly"],
  "anti-aging":             ["anti_aging"],
  "anti aging":             ["anti_aging"],
  "kirisiklik karsiti":     ["anti_aging"],
  "yaslanma karsiti":       ["anti_aging"],
  "retinol":                ["anti_aging"],
  "gunluk kullanim":        ["daily_use"],
  "gunluk bakim":           ["daily_use"],
  "nazik temizlik":         ["gentle_cleanse"],
  "nazik temizleme":        ["gentle_cleanse"],
};

function getFeatures(p: Record<string, unknown>): string[] {
  // WeakMap key yalnız non-null object olabilir. Primitive/null gelirse cache
  // bypass edilir; runtime hata atılmaz.
  const cacheable = p !== null && typeof p === "object";
  if (cacheable) {
    const cached = FEATURE_CACHE.get(p as object);
    if (cached) return cached;
  }
  if (!cacheable) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (flag: unknown) => {
    if (typeof flag !== "string" || flag.length === 0) return;
    if (seen.has(flag)) return;
    seen.add(flag);
    out.push(flag);
  };

  // 1) Eski array path — geri uyumluluk korunur.
  if (Array.isArray(p.features)) {
    for (const f of p.features as unknown[]) push(f);
  }
  if (Array.isArray(p.ozellikler)) {
    for (const f of p.ozellikler as unknown[]) push(f);
  }

  // 2) features object (DB gerçek shape). Yalnız fragrance:false güvenli.
  const fObj = p.features;
  if (fObj && typeof fObj === "object" && !Array.isArray(fObj)) {
    if ((fObj as Record<string, unknown>).fragrance === false) {
      push("fragrance_free");
    }
  }

  // 3) badges array → BADGE_TO_CANONICAL (additive sinyal kaynağı).
  if (Array.isArray(p.badges)) {
    for (const b of p.badges as unknown[]) {
      const key = normalizeBadgeKey(b);
      if (!key) continue;
      const flags = BADGE_TO_CANONICAL[key];
      if (!flags) continue;
      for (const f of flags) push(f);
    }
  }

  FEATURE_CACHE.set(p as object, out);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ECZ4 Step 4 — Kategori soft guard (additive post-process).
// Step 3 sonrası kalan SPF/eye/cleanser kategori artıkları için konservatif
// demote. Hard exclude DEĞİL — ürün listede kalır, genelde consider'a iner.
// CONCERN_FEATURES, CONCERN_INGREDIENTS, score weights, tier eşikleri,
// computeScoreDetail, rankProductsForConcern public API HİÇ değişmez. Tek yer:
// evaluateProduct çıktısında uygulanır.
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryKind {
  sunscreen:         boolean;
  eyeArea:           boolean;
  cleanseLike:       boolean;
  barrierSupporting: boolean;
}

const CATEGORY_KIND_CACHE: WeakMap<object, CategoryKind> = new WeakMap();

function getCategoryText(p: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(normalizeBadgeKey(p.category));
  parts.push(normalizeBadgeKey(p.kategori));
  parts.push(normalizeBadgeKey(p.subcategory));
  parts.push(normalizeBadgeKey(p.name));
  parts.push(normalizeBadgeKey(p.isim));
  if (Array.isArray(p.badges)) {
    for (const b of p.badges as unknown[]) {
      const k = normalizeBadgeKey(b);
      if (k) parts.push(k);
    }
  }
  return parts.filter(Boolean).join(" | ");
}

function hasAny(text: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (text.includes(n)) return true;
  }
  return false;
}

// Sunscreen: çok-kelimeli + özgün marka/teknik token'lar. "gunes" tek başına
// kullanılmaz; "gunes kremi" / "gunes koruyucu" / "stick gunes" gibi bağlam
// gerekir (false-positive engellenir).
const SUNSCREEN_TOKENS: readonly string[] = [
  "spf",
  "gunes kremi",
  "gunes koruyucu",
  "gunes koruma",
  "stick gunes",
  "sunscreen",
  "sun care",
  "sun protect",
  "anthelios",
  "mineral filtre",
];

// Eye: "goz" tek başına "gozenek" (pore) ile çakışır. Çok-kelimeli zorunlu.
const EYE_TOKENS: readonly string[] = [
  "goz kremi",
  "goz cevresi",
  "goz serumu",
  "goz konturu",
  "eye contour",
  "eye cream",
  "eye serum",
];

// Cleanse-like: rinse-off temizleyici/tonik/misel + peeling jel (rinse-off).
// Leave-on "peeling serum" yakalanmasın diye "peeling" yalnız "peeling jel"
// formuyla aranır.
const CLEANSE_TOKENS: readonly string[] = [
  "temizleyici",
  "temizleme jeli",
  "temizleme suyu",
  "cleanser",
  "tonik",
  "toner",
  "peeling jel",
  "misel",
  "micellar",
];

// Barrier-supporting bağlam (yalnız barrier_repair'da SPF leniency için).
const BARRIER_SUPPORT_TOKENS: readonly string[] = [
  "bariyer",
  "onarici",
  "onarim",
  "ceramide",
  "ceramid",
];

function categoryKind(p: Record<string, unknown>): CategoryKind {
  const cacheable = p !== null && typeof p === "object";
  if (cacheable) {
    const cached = CATEGORY_KIND_CACHE.get(p as object);
    if (cached) return cached;
  }
  const text = getCategoryText(p);
  const kind: CategoryKind = {
    sunscreen:         hasAny(text, SUNSCREEN_TOKENS),
    eyeArea:           hasAny(text, EYE_TOKENS),
    cleanseLike:       hasAny(text, CLEANSE_TOKENS),
    barrierSupporting: hasAny(text, BARRIER_SUPPORT_TOKENS),
  };
  if (cacheable) CATEGORY_KIND_CACHE.set(p as object, kind);
  return kind;
}

const TREATMENT_TARGETED_CONCERNS: ReadonlySet<SkinConcernKey> = new Set<SkinConcernKey>([
  "redness", "spots", "dehydration", "anti_aging",
]);

const CLEANSE_PENALIZED_CONCERNS: ReadonlySet<SkinConcernKey> = new Set<SkinConcernKey>([
  "redness", "dehydration", "barrier_repair", "anti_aging", "spots",
]);

const EYE_CAPPED_CONCERNS: ReadonlySet<SkinConcernKey> = new Set<SkinConcernKey>([
  "anti_aging", "spots", "redness", "dehydration", "barrier_repair",
  "acne", "pore",
]);

function tierFromScore(score: number): MatchTier | null {
  if (score >= 85) return "best";
  if (score >= 70) return "strong";
  if (score >= 50) return "consider";
  return null;
}

const TIER_ORDER: readonly MatchTier[] = ["consider", "strong", "best"];

function capTier(tier: MatchTier | null, max: MatchTier): MatchTier | null {
  if (tier == null) return null;
  const ti = TIER_ORDER.indexOf(tier);
  const mi = TIER_ORDER.indexOf(max);
  return ti > mi ? max : tier;
}

function applyCategorySoftGuard(
  p:       Record<string, unknown>,
  concern: SkinConcernKey,
  score:   number,
  tier:    MatchTier | null,
): { score: number; tier: MatchTier | null } {
  if (tier == null) return { score, tier };

  const k = categoryKind(p);
  let s = score;
  let t: MatchTier | null = tier;

  // A) Sunscreen
  if (k.sunscreen) {
    if (concern === "barrier_repair") {
      if (k.barrierSupporting) {
        // "Bariyer Onarıcı SPF" gibi borderline meşru ürün: cap=strong, penalty yok.
        t = capTier(t, "strong");
      } else {
        s = s - 10;
        const rt = tierFromScore(s);
        t = capTier(rt, "consider");
      }
    } else if (concern === "acne") {
      // Akne dostu/oil control SPF meşru ek; best değil ama strong olabilir.
      t = capTier(t, "strong");
    } else if (concern === "pore") {
      // Konservatif: bu adımda dokunma.
    } else if (TREATMENT_TARGETED_CONCERNS.has(concern)) {
      s = s - 10;
      const rt = tierFromScore(s);
      t = capTier(rt, "consider");
    }
  }

  // B) Eye area
  if (k.eyeArea && EYE_CAPPED_CONCERNS.has(concern)) {
    if (s > 69) s = 69;
    t = capTier(tierFromScore(s) ?? t, "consider");
  }

  // C) Cleanser/toner/peeling
  if (k.cleanseLike && CLEANSE_PENALIZED_CONCERNS.has(concern)) {
    s = s - 5;
    const rt = tierFromScore(s);
    if (rt === null) return { score: s, tier: null };
    // Hâlâ best ise strong'a indir; aksi halde recomputed tier.
    t = capTier(rt, "strong");
  }

  if (s < 50) return { score: s, tier: null };
  return { score: s, tier: t };
}

function productText(p: Record<string, unknown>): string {
  return [
    p.ingredients, p.icindekiler,
    p.active_ingredients, p.aktif_icindekiler,
    p.description, p.aciklama,
    p.short_benefit, p.kisa_fayda,
    p.name, p.isim,
    p.category, p.kategori,
    p.subcategory,
    ...(Array.isArray(p.concerns)           ? p.concerns           : []),
    ...(Array.isArray(p.concerns_supported) ? p.concerns_supported : []),
    ...(Array.isArray(p.tags)               ? p.tags               : []),
    ...(Array.isArray(p.benefits)           ? p.benefits           : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function dataCompleteness(p: Record<string, unknown>): number {
  let score = 0;
  if (p.ingredients || p.icindekiler)             score += 3;
  if (getFeatures(p).length > 0)                  score += 2;
  if (Array.isArray(p.skin_types) && (p.skin_types as unknown[]).length > 0) score += 1;
  if (p.short_benefit || p.kisa_fayda)            score += 1;
  if (p.description || p.aciklama)                score += 1;
  return score; // max 8
}

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 2A — KAYGIYA ÖZEL EŞLEŞME TABLOLARI
// ─────────────────────────────────────────────────────────────────────────────

// Feature key'leri → öncelik sırası (kritik / önemli / destekleyici)
const CONCERN_FEATURES: Record<SkinConcernKey, { critical: string[]; supporting: string[] }> = {
  acne: {
    critical:   ["non_comedogenic", "acne_prone_friendly"],
    supporting: ["oil_control", "pore_care", "matte_finish", "daily_use"],
  },
  spots: {
    critical:   ["brightening", "tone_evening"],
    supporting: ["spot_care", "anti_aging"],
  },
  redness: {
    critical:   ["soothing", "redness_support"],
    supporting: ["sensitive_skin_friendly", "fragrance_free", "barrier_support"],
  },
  dehydration: {
    critical:   ["hydrating"],
    supporting: ["barrier_support", "repair_care", "soothing"],
  },
  barrier_repair: {
    critical:   ["barrier_support", "repair_care"],
    supporting: ["soothing", "hydrating", "sensitive_skin_friendly"],
  },
  anti_aging: {
    critical:   ["anti_aging"],
    supporting: ["brightening", "repair_care", "barrier_support"],
  },
  pore: {
    critical:   ["pore_care"],
    supporting: ["oil_control", "deep_cleanse", "matte_finish", "non_comedogenic"],
  },
};

// Aktif içerik sinyalleri (öncelikli / destekleyici)
const CONCERN_INGREDIENTS: Record<SkinConcernKey, { primary: string[]; secondary: string[] }> = {
  acne: {
    primary:   ["salicylic acid", "salisilik", "benzoyl peroxide", "niacinamide", "niasinamid"],
    secondary: ["zinc", "çinko", "tea tree", "sulfur", "kükürt"],
  },
  spots: {
    primary:   ["vitamin c", "ascorbic acid", "alpha arbutin", "kojic acid", "tranexamic acid"],
    secondary: ["niacinamide", "niasinamid", "azelaic acid", "retinol", "arbutin"],
  },
  redness: {
    primary:   ["centella asiatica", "madecassoside", "allantoin", "panthenol"],
    secondary: ["chamomile", "bisabolol", "aloe vera", "oat extract", "yulaf"],
  },
  dehydration: {
    primary:   ["hyaluronic acid", "hüalüronik asit", "sodium hyaluronate", "glycerin", "gliserin"],
    secondary: ["urea", "squalane", "ceramide", "betaine"],
  },
  barrier_repair: {
    primary:   ["ceramide", "ceramid", "niacinamide", "niasinamid", "panthenol"],
    secondary: ["shea butter", "cholesterol", "fatty acid", "squalane"],
  },
  anti_aging: {
    primary:   ["retinol", "retinal", "bakuchiol", "peptide"],
    secondary: ["niacinamide", "vitamin c", "coenzyme q10", "resveratrol", "adenosine"],
  },
  pore: {
    primary:   ["salicylic acid", "salisilik", "niacinamide", "niasinamid"],
    secondary: ["kaolin", "bentonite", "charcoal", "kömür", "zinc", "witch hazel"],
  },
};

// Doğru kategori sinyalleri
const CONCERN_GOOD_CATS: Record<SkinConcernKey, string[]> = {
  acne:          ["temizley", "cleanser", "serum", "treatment", "toner", "tonik", "jel yüz"],
  spots:         ["serum", "treatment", "krem", "cream", "aktif"],
  redness:       ["krem", "cream", "serum", "nemlendirici", "moisturizer", "bariyer"],
  dehydration:   ["nemlendirici", "moisturizer", "krem", "cream", "serum", "esans"],
  barrier_repair:["nemlendirici", "moisturizer", "bariyer", "krem", "cream", "serum"],
  anti_aging:    ["serum", "treatment", "krem", "cream", "aktif"],
  pore:          ["temizley", "cleanser", "serum", "toner", "tonik", "maske", "mask"],
};

const SKIN_TYPE_FEATURES: Record<SkinType, string[]> = {
  dry:         ["hydrating", "barrier_support", "repair_care"],
  oily:        ["oil_control", "matte_finish", "non_comedogenic", "pore_care"],
  sensitive:   ["sensitive_skin_friendly", "fragrance_free", "soothing", "gentle_cleanse"],
  combination: ["oil_control", "hydrating", "pore_care"],
  normal:      ["daily_use"],
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 2B — DOĞAL DİL AÇIKLAMASI (explanation engine)
// ─────────────────────────────────────────────────────────────────────────────

function buildConcernExplanation(
  concern:       SkinConcernKey,
  criticalHits:  number,
  supportingHits:number,
  ingredientHits: { primary: number; secondary: number },
): string | null {
  const strong = criticalHits >= 2 || (criticalHits >= 1 && supportingHits >= 2);
  const moderate = criticalHits === 1 || supportingHits >= 2;

  const STRONG: Record<SkinConcernKey, string> = {
    acne:          "Gözenek tıkayıcı içerik taşımıyor; akneye yatkın ciltler için bilinçli formüle edilmiş",
    spots:         "Leke ve ton eşitsizliğini hedefleyen aydınlatıcı aktifler belirgin şekilde öne çıkıyor",
    redness:       "Kızarıklık ve reaktif ciltler için tasarlanmış; cilt bariyerini yatıştırarak destekliyor",
    dehydration:   "Nem bariyerini katman katman onarır ve uzun süreli nem retansiyonu sağlar",
    barrier_repair:"Cilt bariyerinin yapısal onarımına odaklanmış; yapı taşları doğrudan içeriğinde mevcut",
    anti_aging:    "Hücre yenilenmesini teşvik eden güçlü anti-aging kompleksi ile formüle edilmiş",
    pore:          "Gözenek sıkılaştırıcı ve sebum dengeleyici özellikleriyle gözenek kaygısını doğrudan hedefliyor",
  };

  const MODERATE: Record<SkinConcernKey, string> = {
    acne:          "Akne kontrolünü destekleyen temel özelliklere sahip",
    spots:         "Leke görünümünü iyileştirmeye yardımcı bileşenler içeriyor",
    redness:       "Hassas ve reaktif ciltlere kısmi destek sağlayan yapıda",
    dehydration:   "Nem gereksinimini karşılamaya yönelik destekleyici bileşenler mevcut",
    barrier_repair:"Bariyer onarımına destek verebilecek bileşenler içeriyor",
    anti_aging:    "Yaşlanma karşıtı süreçleri destekleyen aktifler bulunduruyor",
    pore:          "Gözenek görünümünü iyileştirmeye destek verebilecek bileşenler içeriyor",
  };

  if (strong) return STRONG[concern] ?? null;
  if (moderate) return MODERATE[concern] ?? null;

  // Sadece içerik sinyali varsa
  if (ingredientHits.primary >= 1) {
    return `${concern === "acne" ? "Akne" : concern === "spots" ? "Leke" : "Kaygı"} için hedeflenen aktifler içerikte tespit edildi`;
  }

  return null;
}

function buildSkinTypeExplanation(skinType: SkinType | null, hit: boolean): string | null {
  if (!skinType || !hit) return null;
  const MAP: Record<SkinType, string> = {
    dry:         "Kuru cilt gereksinimlerine uygun besleyici yapısı günlük konfor ve nem dengesi sağlar",
    oily:        "Hafif ve mat dokusu yağlı ciltte sıkışma hissi yaratmadan kullanılabiliyor",
    sensitive:   "Hassas cilt dostu bileşimle formüle edilmiş; tahriş riski minimize edilmiş",
    combination: "Karma cilde uygun dengeli yapısı T-bölgesini kontrol ederken diğer bölgeleri besliyor",
    normal:      "Normal cilt için günlük kullanıma uygun dengeli ve sade formül",
  };
  return MAP[skinType] ?? null;
}

function buildSensitivityExplanation(
  conditions: string[],
  hasFF: boolean,
  hasSoothing: boolean,
  hasSensitiveFriendly: boolean,
): string | null {
  if (!hasSensitiveFriendly && !hasFF && !hasSoothing) return null;

  if (conditions.includes("rosacea")) {
    return hasFF
      ? "Rozasea için kritik olan parfüm ve alkol gibi tetikleyicilerden arındırılmış formül"
      : "Reaktif ciltlere yönelik sakinleştirici yapı rozasea semptomlarını kontrol altında tutar";
  }
  if (conditions.includes("eczema")) {
    return "Egzama süreçlerinde aranan hafif, katkısız ve yatıştırıcı formül yapısına sahip";
  }
  if (conditions.includes("psoriasis")) {
    return "Sedef hastalığında hassas olan deri için irritan içeriklerden uzak, sakin formül";
  }
  if (hasSensitiveFriendly && hasFF) {
    return "Hassas cilt onaylı; parfümsüz ve hipoalerjenik bileşimle tahriş riskini en aza indiriyor";
  }
  if (hasSensitiveFriendly) {
    return "Hassas cilt uyumlu olarak ayrıca tanımlanmış — günlük güvenli kullanıma uygun";
  }
  return null;
}

function buildIngredientExplanation(
  concern: SkinConcernKey,
  text:    string,
): string | null {
  type IngMap = Partial<Record<SkinConcernKey, Array<[string, string]>>>;
  const NAMED: IngMap = {
    acne:    [["niacinamide", "Niasinamid sebum dengesini sağlarken leke görünümünü de azaltır"],
              ["salicylic acid", "Salisilik asit gözenek içini temizleyerek sivilce oluşumunu engeller"]],
    spots:   [["vitamin c", "C vitamini melanin sentezini yavaşlatarak leke aydınlatmasında kritik rol üstlenir"],
              ["alpha arbutin", "Alpha arbutin leke görünümünü hedefleyen en güvenli aydınlatıcılardan biri"],
              ["tranexamic acid", "Traneksamik asit pigmentasyon döngüsünü kökten kesiyor"]],
    redness: [["centella asiatica", "Centella asiatica kızarıklık ve iltihabı hafifletmede klinik olarak desteklenmiş"],
              ["allantoin", "Allantoin iltihaplı cilt dokusunu sakinleştirir ve onarır"],
              ["panthenol", "Panthenol (B5) bariyer onarımını hızlandırır ve kızarıklığı yatıştırır"]],
    dehydration:[["hyaluronic acid", "Hüalüronik asit katmanları cildi dolgun ve canlı tutar; nem kaybını önler"],
                 ["ceramide", "Ceramid su tutucuların uzun süreli kalmasını sağlayan bariyer kilidi"]],
    barrier_repair:[["ceramide", "Ceramid bozulan bariyer yapısını doğrudan yeniden inşa eder"],
                    ["niacinamide", "Niasinamid bariyer proteinlerini (filaggrin) uyararak onarım sürecini hızlandırır"]],
    anti_aging:    [["retinol", "Retinol hücre döngüsünü hızlandırarak ince çizgileri kademeli olarak azaltır"],
                    ["peptide", "Peptid kompleksleri kolajen sentezini uyararak cilt sıkılığını artırır"],
                    ["bakuchiol", "Bakuchiol retinol alternatifi olarak hamile ve hassas ciltler için önerilir"]],
    pore:    [["niacinamide", "Niasinamid gözenek büyüklüğünü görsel olarak küçülterek mat bir görünüm sağlar"],
              ["salicylic acid", "Salisilik asit gözenek içindeki birikintileri eritip boşaltır"]],
  };

  const list = NAMED[concern] ?? [];
  for (const [signal, explanation] of list) {
    if (text.includes(signal)) return explanation;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 2C — ARALIK BAZLI PUANLAMA
// ─────────────────────────────────────────────────────────────────────────────

interface ScoreDetail {
  skinTypeRaw:   number;
  concernRaw:    number;
  sensitivityRaw:number;
  ingredientRaw: number;
  safetyPenalty: number;
  finalScore:    number;
  // Explanation inputs
  skinTypeHit:   boolean;
  criticalHits:  number;
  supportingHits:number;
  ingredientHits:{ primary: number; secondary: number };
  hasSensitiveFriendly:boolean;
  hasFF:         boolean;
  hasSoothing:   boolean;
  // Confidence inputs
  completeness:  number;
}

function computeScoreDetail(
  p:       Record<string, unknown>,
  prefs:   UserPreferences,
  concern: SkinConcernKey,
  ctx:     ProfileContext,
  fitScore:number,
): ScoreDetail {
  const features   = getFeatures(p);
  const text       = productText(p);
  const cData      = CONCERN_FEATURES[concern];
  const iData      = CONCERN_INGREDIENTS[concern];
  const goodCats   = CONCERN_GOOD_CATS[concern] ?? [];

  // ── Cilt tipi (0–25) ────────────────────────────────────────────────────
  let skinTypeRaw  = 0;
  let skinTypeHit  = false;
  if (prefs.skinType) {
    const stFeatures  = SKIN_TYPE_FEATURES[prefs.skinType] ?? [];
    const skinTypesArr: string[] = Array.isArray(p.skin_types)
      ? (p.skin_types as string[]).map(s => String(s).toLowerCase())
      : [];
    if (skinTypesArr.includes(prefs.skinType)) {
      skinTypeRaw = 25; skinTypeHit = true;
    } else if (skinTypesArr.some(s => s.includes(prefs.skinType!.slice(0, 4)))) {
      skinTypeRaw = 18; skinTypeHit = true;
    } else {
      const hits = stFeatures.filter(k => features.includes(k)).length;
      if (hits >= 2) { skinTypeRaw = 20; skinTypeHit = true; }
      else if (hits === 1) { skinTypeRaw = 10; skinTypeHit = true; }
    }
  }

  // ── Kaygı eşleşmesi (0–32) ──────────────────────────────────────────────
  const criticalHits  = cData.critical.filter(k => features.includes(k)).length;
  const supportingHits= cData.supporting.filter(k => features.includes(k)).length;
  const catMatch      = goodCats.some(c => text.includes(c));

  let concernRaw = 0;
  if (criticalHits >= 2)      concernRaw = 32;
  else if (criticalHits === 1 && supportingHits >= 2) concernRaw = 28;
  else if (criticalHits === 1) concernRaw = 20;
  else if (supportingHits >= 3) concernRaw = 18;
  else if (supportingHits === 2) concernRaw = 12;
  else if (supportingHits === 1) concernRaw = 6;
  if (catMatch) concernRaw = Math.min(concernRaw + 5, 32);

  // Komedojenik kritik: akne + product hiç "non_comedogenic" değil ama yağ bazlı → ceza
  if (ctx.comedogenicCritical && !features.includes("non_comedogenic") && !features.includes("acne_prone_friendly")) {
    concernRaw = Math.max(0, concernRaw - 8);
  }

  // ── Hassasiyet uyumu (0–20) ──────────────────────────────────────────────
  const hasSensitiveFriendly = features.includes("sensitive_skin_friendly");
  const hasFF                = features.includes("fragrance_free");
  const hasSoothing          = features.includes("soothing");

  let sensitivityRaw = 0;
  if (ctx.sensitivityCritical) {
    if (hasSensitiveFriendly) sensitivityRaw += 14;
    if (hasFF)                sensitivityRaw += 10;
    if (hasSoothing)          sensitivityRaw += 5;
    sensitivityRaw = Math.min(sensitivityRaw, 20);
  } else {
    // Hassasiyet kritik değilse küçük bonus
    if (hasSensitiveFriendly) sensitivityRaw += 5;
    if (hasFF)                sensitivityRaw += 3;
  }

  // ── Aktif içerik (0–14) ──────────────────────────────────────────────────
  const primaryHits   = iData.primary.filter(s => text.includes(s)).length;
  const secondaryHits = iData.secondary.filter(s => text.includes(s)).length;
  const ingredientRaw = Math.min(primaryHits * 5 + secondaryHits * 2, 14);

  // ── Güvenlik cezası ──────────────────────────────────────────────────────
  // fitScore 100 → ceza 0; fitScore 0 → temel ceza ~30, hamile ise ×3
  const basePenalty  = Math.round((100 - fitScore) * 0.55);
  const safetyPenalty = Math.round(basePenalty * ctx.weights.safety);

  // ── Final skor ───────────────────────────────────────────────────────────
  const weighted =
    (skinTypeRaw   * ctx.weights.skinType)   +
    (concernRaw    * ctx.weights.concern)    +
    (sensitivityRaw* ctx.weights.sensitivity)+
    (ingredientRaw * ctx.weights.ingredients);

  // Normalize ağırlıklı toplamı 0-70 aralığına çek
  const MAX_WEIGHTED = (25 * ctx.weights.skinType) + (32 * ctx.weights.concern) +
                       (20 * ctx.weights.sensitivity) + (14 * ctx.weights.ingredients);
  const normalizedBonus = MAX_WEIGHTED > 0 ? (weighted / MAX_WEIGHTED) * 70 : 0;

  const finalScore = Math.max(0, Math.min(100, Math.round(50 + normalizedBonus - safetyPenalty)));

  return {
    skinTypeRaw, concernRaw, sensitivityRaw, ingredientRaw,
    safetyPenalty, finalScore,
    skinTypeHit, criticalHits, supportingHits,
    ingredientHits: { primary: primaryHits, secondary: secondaryHits },
    hasSensitiveFriendly, hasFF, hasSoothing,
    completeness: dataCompleteness(p),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KONFİDANS SEVİYESİ
// ─────────────────────────────────────────────────────────────────────────────

function computeConfidence(d: ScoreDetail): { level: ConfidenceLevel; label: string } {
  let pts = 0;
  if (d.completeness >= 6) pts += 3;
  else if (d.completeness >= 3) pts += 1;
  if (d.criticalHits >= 1)  pts += 2;
  if (d.supportingHits >= 2) pts += 1;
  if (d.ingredientHits.primary >= 1) pts += 2;
  if (d.ingredientHits.secondary >= 1) pts += 1;

  if (pts >= 7) return { level: "high",   label: "Veriye dayalı — güçlü öneri" };
  if (pts >= 4) return { level: "medium", label: "Genel uyum baz alındı" };
  return         { level: "low",    label: "Sınırlı veri — genel eğilim" };
}

// ─────────────────────────────────────────────────────────────────────────────
// AÇIKLAMA DERLEYİCİ — matchReasons
// ─────────────────────────────────────────────────────────────────────────────

function buildMatchReasons(
  d:       ScoreDetail,
  prefs:   UserPreferences,
  concern: SkinConcernKey,
  p:       Record<string, unknown>,
): string[] {
  const reasons: string[] = [];
  const text = productText(p);

  // 1. Kaygı açıklaması (en önemli)
  const concernExp = buildConcernExplanation(
    concern,
    d.criticalHits,
    d.supportingHits,
    d.ingredientHits,
  );
  if (concernExp) reasons.push(concernExp);

  // 2. Aktif içerik açıklaması
  const ingExp = buildIngredientExplanation(concern, text);
  if (ingExp) reasons.push(ingExp);

  // 3. Cilt tipi açıklaması
  const stExp = buildSkinTypeExplanation(prefs.skinType, d.skinTypeHit);
  if (stExp) reasons.push(stExp);

  // 4. Hassasiyet açıklaması
  const svExp = buildSensitivityExplanation(
    prefs.specialConditions ?? [],
    d.hasFF,
    d.hasSoothing,
    d.hasSensitiveFriendly,
  );
  if (svExp) reasons.push(svExp);

  return reasons.slice(0, 3); // max 3 açıklama
}

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 3 — ÇEŞİTLİLİK + LİMİT
// ─────────────────────────────────────────────────────────────────────────────

function featureSignature(p: Record<string, unknown>, concern: SkinConcernKey): string {
  const features = getFeatures(p);
  const cData    = CONCERN_FEATURES[concern];
  const relevant = [...cData.critical, ...cData.supporting].filter(k => features.includes(k)).sort();
  return relevant.join("|");
}

// ECZ4 Step C — Marka adını güvenli normalize eder. Hatalı/eksik markalar
// "" string'ine düşer; bu durumda brand-cap UYGULANMAZ (boş string'ler
// kümelenmiş tek bir marka gibi davranmaz). Crash etmez, mutate etmez.
function normalizeBrand(p: unknown): string {
  const raw =
    (p as any)?.brand ??
    (p as any)?.marka ??
    "";
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

function diversify(
  results:    MatchResult[],
  concern:    SkinConcernKey,
  maxTotal:   number,
  maxTier:    number,
  maxPerBrand: number = 2,
): MatchResult[] {
  const seenSignatures = new Set<string>();
  const tierCount: Record<MatchTier, number> = { best: 0, strong: 0, consider: 0 };
  const brandCount = new Map<string, number>();
  const out: MatchResult[] = [];
  // ECZ4 Step C — İlk geçişte marka kapağı nedeniyle atlananları sakla.
  // Katalog daraysa (örn. "leke" gibi düşük envanterli concern'ler) ikinci
  // geçişte buradan dolduracağız. featureSignature dedup ve tier limit yine
  // geçerli kalır; yalnız brand-cap gevşetilir.
  const skippedDueToBrandCap: MatchResult[] = [];

  // ───── 1. PASS — Marka çeşitliliği önceliği ──────────────────────────────
  for (const r of results) {
    if (out.length >= maxTotal) break;
    if (tierCount[r.tier] >= maxTier) continue;

    const sig = featureSignature(r.product as unknown as Record<string, unknown>, concern);
    if (sig && seenSignatures.has(sig)) continue;

    const brand = normalizeBrand(r.product);
    if (brand && (brandCount.get(brand) ?? 0) >= maxPerBrand) {
      skippedDueToBrandCap.push(r);
      continue;
    }

    if (sig) seenSignatures.add(sig);
    if (brand) brandCount.set(brand, (brandCount.get(brand) ?? 0) + 1);
    tierCount[r.tier]++;
    out.push(r);
  }

  // ───── 2. PASS — Doldurma (yalnız ihtiyaç varsa) ─────────────────────────
  // Brand-cap gevşetilir; tier-limit ve featureSignature dedup KORUNUR.
  // Skor sırası ilk geçişten devralındığı için skipped listesi zaten DESC.
  if (out.length < maxTotal && skippedDueToBrandCap.length > 0) {
    for (const r of skippedDueToBrandCap) {
      if (out.length >= maxTotal) break;
      if (tierCount[r.tier] >= maxTier) continue;

      const sig = featureSignature(r.product as unknown as Record<string, unknown>, concern);
      if (sig && seenSignatures.has(sig)) continue;

      if (sig) seenSignatures.add(sig);
      tierCount[r.tier]++;
      out.push(r);
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEK ÜRÜN DEĞERLENDİRME
// ─────────────────────────────────────────────────────────────────────────────

function evaluateProduct(
  product: Product,
  prefs:   UserPreferences,
  concern: SkinConcernKey,
  ctx:     ProfileContext,
): MatchResult | null {
  const p = product as unknown as Record<string, unknown>;

  // Güvenlik sinyali: evaluateProductWarnings
  const warningResult = evaluateProductWarnings(p, {
    allergies:          prefs.allergies,
    specialConditions:  prefs.specialConditions,
    allergyIngredients: prefs.allergyIngredients,
    avoidedIngredients: prefs.avoidedIngredients,
    skinType:           prefs.skinType,
  });

  // Hard filter
  const warningTypes = warningResult.warnings.map(w => w.type);
  if (isHardExcluded(p, prefs, warningTypes)) return null;

  // Skor detayı
  const d = computeScoreDetail(p, prefs, concern, ctx, warningResult.fitScore);

  // Tier (base)
  let tier: MatchTier | null = null;
  if (d.finalScore >= 85)      tier = "best";
  else if (d.finalScore >= 70) tier = "strong";
  else if (d.finalScore >= 50) tier = "consider";
  else return null;

  // ECZ4 Step 4 — kategori soft guard. Score formülü/CONCERN_FEATURES/tier
  // eşikleri DEĞİŞMEZ; sadece kategori-aware demote uygulanır (additive).
  const guarded = applyCategorySoftGuard(p, concern, d.finalScore, tier);
  if (guarded.tier == null) return null;
  const finalScore = guarded.score;
  tier = guarded.tier;

  // Güven seviyesi
  const conf = computeConfidence(d);

  // Doğal dil açıklamalar
  const matchReasons = buildMatchReasons(d, prefs, concern, p);

  return {
    product,
    score:          finalScore,
    tier,
    confidence:     conf.level,
    confidenceLabel:conf.label,
    matchReasons,
    warnings:       warningResult.warnings,
    fitScore:       warningResult.fitScore,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANA EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function rankProductsForConcern(
  products:     Product[],
  prefs:        UserPreferences,
  concern:      SkinConcernKey,
  subcategory?: string | null,
): TieredMatchResults {
  const ctx     = buildProfileContext(prefs, concern);
  const results: MatchResult[] = [];

  for (const p of products) {
    if (subcategory) {
      const pSub = ((p as any).subcategory ?? "").toLowerCase();
      if (pSub && !pSub.includes(subcategory.toLowerCase())) continue;
    }

    const r = evaluateProduct(p, prefs, concern, ctx);
    if (r) results.push(r);
  }

  // Skor DESC
  results.sort((a, b) => b.score - a.score);

  // Çeşitlilik + limit (max 8 toplam, tier başına max 4)
  const diversified = diversify(results, concern, 8, 4);

  return {
    best:     diversified.filter(r => r.tier === "best"),
    strong:   diversified.filter(r => r.tier === "strong"),
    consider: diversified.filter(r => r.tier === "consider"),
    total:    diversified.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI KONSABİTLERİ
// ─────────────────────────────────────────────────────────────────────────────

export const CONCERN_ICONS: Record<SkinConcernKey, string> = {
  acne:          "zap",
  spots:         "sun",
  redness:       "heart",
  dehydration:   "droplet",
  barrier_repair:"shield",
  anti_aging:    "clock",
  pore:          "aperture",
};

export const CONCERN_COLORS: Record<SkinConcernKey, string> = {
  acne:          "#E8604C",
  spots:         "#C8A97E",
  redness:       "#D97A7A",
  dehydration:   "#4A8FA5",
  barrier_repair:"#7A8F6B",
  anti_aging:    "#8A70A8",
  pore:          "#5A7FA0",
};
