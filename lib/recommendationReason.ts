/**
 * recommendationReason.ts
 *
 * getRecommendationReasons  — birden fazla gerekçe döndürür (max 3)
 * getRecommendationReason   — ürün kartı altındaki TEK micro-label için
 *
 * KURAL: Her metin MAX ~34 karakter, karar odaklı, tek başına anlamlı.
 * Genel ifade YOK ("Temel ihtiyacı karşılıyor", "Sık baktığın kategoriden" vb.)
 * Hiçbir kaynak anlamlı sinyal üretemezse → null döner (alan gizlenir).
 */

import { analyzeIngredients } from "./analyzeIngredients";
import type { LearningProfile } from "./userEvents";
import { resolveFeature, type FeatureKey } from "@/lib/features/featureTruth";
// ECZ-4 DÖRTLÜ tech debt cleanup: SkinConcernKey kanonik truth (userPreferences.ts).
// Yerel duplike union kaldırıldı — type-only import; runtime davranış birebir aynı.
import type { SkinConcernKey } from "@/lib/userPreferences";

declare const __DEV__: boolean;

// ── Truth-gated "X-siz" doğrulayıcı ──────────────────────────────────────────
// Curated badge'i göz ardı edip karar VERİSİNİ truth layer'a devreder.
//   • truth === false  → "X içermez" net kanıtlandı, olumlu iddia edilebilir
//   • truth === true   → İçerik DOĞRULANMIŞ, iddia ÇELİŞİR; engellenir
//   • truth === null   → Sinyal yok; iddia spekülatif olur, engellenir
// Audit 2026-05-04 fix #4: önceden hasBadge(..., "negative") tek başına
// karar veriyordu; küratör yanlış işaretlediğinde (örn. Parfümsüz badge ama
// INCI'de "parfum") UI sticky uyarı + reason çelişkisi üretiyordu.
function _truthFree(
  product: unknown,
  key: FeatureKey,
  blockedLabel: string,
): boolean {
  const truth = resolveFeature(product, key);
  if (truth === false) return true;
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console, @typescript-eslint/no-explicit-any
    const nm = (product as any)?.name;
    const tag = truth === true ? "truth=contradicts" : "truth=unknown";
    // eslint-disable-next-line no-console
    console.log("[reason-blocked]", nm, blockedLabel, tag);
  }
  return false;
}

// ── Tipler ──────────────────────────────────────────────────────────────────

type SkinType = "oily" | "dry" | "combination" | "sensitive" | "normal";

export interface PreferencesSlice {
  skinType?: SkinType;
  skinConcerns: SkinConcernKey[];
  allergies: string[];
  specialConditions: string[];
}

interface Candidate {
  text: string;
  priority: number;
}

// ── Eşleşme anahtar kelimeleri ───────────────────────────────────────────────

const SKIN_TYPE_KWS: Record<SkinType, string[]> = {
  oily:        ["oily", "yağlı", "oil-free", "yağsız", "mat", "matte", "sebum"],
  dry:         ["dry", "kuru", "kuruyan", "nourish", "besleyici", "rich"],
  combination: ["combination", "karma"],
  sensitive:   ["sensitive", "hassas", "duyarlı", "gentle", "nazik", "fragrance-free"],
  normal:      ["normal"],
};

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily:        "Yağlanmayı dengeleyen içerik",
  dry:         "Kuru cildi besleyen formül",
  combination: "Karma cilde uygun aktifler",
  sensitive:   "Hassas cilt için formüle edilmiş",
  normal:      "Normal cilde uygun",
};

const CONCERN_KWS: Record<SkinConcernKey, string[]> = {
  acne:          ["acne", "akne", "sivilce", "blemish", "breakout", "salicylic"],
  spots:         ["spot", "leke", "pigment", "brightening", "aydınlatma", "niacinamide"],
  redness:       ["redness", "kızarıklık", "calming", "soothing", "centella", "cica"],
  dehydration:   ["dehydration", "nem", "hydration", "hyaluronic", "moisture"],
  barrier_repair:["barrier", "bariyer", "repair", "ceramide", "onarım"],
  anti_aging:    ["anti-aging", "yaşlanma", "wrinkle", "kırışıklık", "retinol", "peptide"],
  pore:          ["pore", "gözenek", "minimiz"],
};

// Kullanıcının kendi endişesiyle eşleşen micro-label — tercih bazlı
const CONCERN_MICRO: Record<SkinConcernKey, string> = {
  acne:          "Akne eğilimi için uygun aktifler",
  spots:         "Leke karşıtı içerik profili",
  redness:       "Kızarıklığa karşı yatıştırıcı",
  dehydration:   "Nem dengesini destekliyor",
  barrier_repair:"Bariyer onarımını destekliyor",
  anti_aging:    "Yaşlanma karşıtı aktif içerik",
  pore:          "Gözenek görünümünü azaltıyor",
};

// ── Anahtar kelimeler: ürün içeriğinden otomatik tespit ──────────────────────

const NIGHT_KWS = ["night", "gece", "retinol", "overnight", "tretinoin", "bakuchiol"];
const DAILY_KWS = ["daily", "günlük", "everyday", "her gün", "all day", "sabah"];
const PORE_KWS  = ["pore", "gözenek", "bha", "salicylic", "minimiz", "pori"];
const ACNE_KWS  = ["acne", "akne", "sivilce", "salicylic", "bha", "blemish", "breakout"];
const SENS_KWS  = ["sensitive", "hassas", "duyarlı", "gentle", "nazik", "centella", "cica", "allantoin"];

// ── Yardımcı: ürün metninden arama dizesi ────────────────────────────────────

function buildHaystack(product: any): string {
  return [
    product.name         ?? "",
    product.isim         ?? "",
    product.category     ?? "",
    product.kategori     ?? "",
    product.subcategory  ?? "",
    product.short_benefit ?? "",
    product.shortBenefit  ?? "",
    product.faydalar     ?? "",
    ...(Array.isArray(product.skin_types)          ? product.skin_types          : []),
    product.skin_type    ?? "",
    ...(Array.isArray(product.concerns_supported)  ? product.concerns_supported  : []),
    ...(Array.isArray(product.concerns)            ? product.concerns            : []),
    ...(Array.isArray(product.tags)                ? product.tags                : []),
    product.about        ?? "",
    product.description  ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function matchesAny(haystack: string, kws: string[]): boolean {
  return kws.some((kw) => haystack.includes(kw));
}

// ── Badge yardımcısı ─────────────────────────────────────────────────────────

function hasBadge(product: any, key: string, status: "positive" | "negative"): boolean {
  const badges: any[] = product.badges ?? [];
  return badges.some((b: any) => b.key === key && b.status === status);
}

// ── Ana fonksiyon: çoklu gerekçe (ürün detay sayfası için) ──────────────────

export function getRecommendationReasons(
  product: any,
  preferences?: PreferencesSlice,
  learningProfile?: LearningProfile,
): string[] {
  const candidates: Candidate[] = [];

  const score: number | null = product.score ?? product.dermo_score?.score ?? null;
  const segment: string      = (product.segment ?? "").toLowerCase();
  const category: string     = (product.category ?? product.kategori ?? "").toLowerCase();
  const haystack             = buildHaystack(product);

  // Truth-gated "X-siz" bayrakları (audit 2026-05-04 fix #4)
  // hasBadge yalnızca curated veriyi yansıtır; truth layer ise INCI
  // escalation ile küratör hatasını telafi eder. Aşağıdaki tüm olumlu
  // iddialar truth tarafından doğrulanmış kanıtlanmış yokluk gerektirir.
  const isFragFree    = _truthFree(product, "fragrance", "Parfümsüz");
  const isSulfateFree = _truthFree(product, "sulfate",   "Sülfatsız");
  const isAlcFree     = _truthFree(product, "alcohol",   "Alkolsüz");
  const isParabenFree = _truthFree(product, "paraben",   "Parabensiz");
  const isVegan       = hasBadge(product, "vegan",     "positive");

  const userConcerns = preferences?.skinConcerns ?? [];

  // ── 1. Güvenlik / alerji uyumu ──────────────────────────────────────────
  if (preferences && preferences.allergies.length > 0 && product.ingredients) {
    try {
      const ia = analyzeIngredients(product.ingredients, preferences.allergies);
      if (ia.reliable && ia.matchedAllergies.length === 0) {
        candidates.push({ text: "Hassasiyet listenle uyumlu", priority: 11 });
      }
    } catch {}
  }

  // ── 2. Parfüm hassasiyeti + fragrance-free badge ────────────────────────
  if (
    preferences &&
    preferences.allergies.some((a) =>
      ["parfüm", "parfum", "fragrance", "koku"].some((k) => a.toLowerCase().includes(k))
    ) &&
    isFragFree
  ) {
    candidates.push({ text: "Parfümsüz — düşük hassasiyet riski", priority: 10 });
  }

  // ── 3. Cilt tipi eşleşmesi ──────────────────────────────────────────────
  if (preferences?.skinType) {
    const kws = SKIN_TYPE_KWS[preferences.skinType];
    if (kws.some((kw) => haystack.includes(kw))) {
      candidates.push({ text: SKIN_TYPE_LABELS[preferences.skinType], priority: 9 });
    }
  }

  // ── 4. Cilt kaygıları — kullanıcı tercihiyle eşleşen ───────────────────
  if (userConcerns.length > 0) {
    let matched = 0;
    for (const concern of userConcerns) {
      if (matched >= 2) break;
      if (CONCERN_KWS[concern].some((kw) => haystack.includes(kw))) {
        candidates.push({ text: CONCERN_MICRO[concern], priority: 8 - matched });
        matched++;
      }
    }
  }

  // ── 5. İçerik bazlı tespitler (tercihten bağımsız) ──────────────────────

  // Hassas cilt uyumu: fragrance-free + alcohol-free + cilt dost içerik
  const isSensitiveFriendly =
    isFragFree && (isAlcFree || matchesAny(haystack, SENS_KWS));
  if (isSensitiveFriendly && !candidates.some((c) => c.text.includes("hassasiyet") || c.text.includes("Hassas"))) {
    candidates.push({ text: "Hassas ciltle uyumlu içerik", priority: 7 });
  }

  // Gözenek odaklı — kullanıcının pore endişesi yoksa ek sinyal
  if (!userConcerns.includes("pore") && matchesAny(haystack, PORE_KWS)) {
    candidates.push({ text: "Gözenek odaklı aktifler içerir", priority: 6 });
  }

  // Akne hedefli — kullanıcının akne endişesi yoksa ek sinyal
  if (!userConcerns.includes("acne") && matchesAny(haystack, ACNE_KWS)) {
    candidates.push({ text: "Akne eğilimine yönelik içerik", priority: 6 });
  }

  // ── 6. Kullanım zamanı bazlı ────────────────────────────────────────────

  if (matchesAny(haystack, NIGHT_KWS)) {
    candidates.push({ text: "Gece rutinine daha uygun", priority: 5 });
  } else if (matchesAny(haystack, DAILY_KWS)) {
    candidates.push({ text: "Günlük kullanım için dengeli", priority: 4 });
  }

  // ── 7. Rozet bazlı ──────────────────────────────────────────────────────

  if (isFragFree && !candidates.some((c) => c.text.includes("Hassas") || c.text.includes("hassas") || c.text.includes("parfüm"))) {
    candidates.push({ text: "Parfümsüz formül", priority: 5 });
  }
  if (isSulfateFree) {
    candidates.push({ text: "Sülfatsız formül", priority: 4 });
  }
  if (isAlcFree && !candidates.some((c) => c.text.includes("Hassas") || c.text.includes("hassas"))) {
    candidates.push({ text: "Alkolsüz formül", priority: 4 });
  }
  if (isParabenFree) {
    candidates.push({ text: "Parabensiz formül", priority: 3 });
  }
  if (isVegan) {
    candidates.push({ text: "Vegan formül", priority: 3 });
  }

  // ── 8. Puan bazlı gerekçe ───────────────────────────────────────────────
  if (score != null) {
    if (score >= 80) {
      candidates.push({ text: "Yüksek güven puanı", priority: 6 });
    } else if (score >= 65) {
      candidates.push({ text: "Dengeli formül profili", priority: 3 });
    }
  }

  // ── 9. Segment bazlı ────────────────────────────────────────────────────
  if (segment === "seçkin") {
    candidates.push({ text: "Üst segment formül", priority: 3 });
  }

  // ── 10. Öğrenme profili — yalnızca spesifik eşleşme ────────────────────
  if (learningProfile?.hasEnoughData) {
    const brand = (product.brand ?? product.marka ?? "").toLowerCase().trim();
    if (brand && learningProfile.topBrands?.includes(brand)) {
      candidates.push({ text: "Sık tercih ettiğin marka", priority: 2 });
    }
    // NOT: "Sık baktığın kategoriden" ve "Benzer profile sahip ürün" kaldırıldı
    // — çok genel, karar değeri taşımıyor
  }

  // ── 11. Fallback — veri yoksa puan veya segment ─────────────────────────
  if (candidates.length === 0) {
    if (segment === "seçkin") {
      candidates.push({ text: "Üst kalite formül", priority: 1 });
    } else if (score != null && score >= 60) {
      candidates.push({ text: "Yüksek güven puanı", priority: 1 });
    }
  }

  // ── Sıralama, tekilleştirme, max 3 seç ─────────────────────────────────
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .filter((c) => {
      if (seen.has(c.text)) return false;
      seen.add(c.text);
      return true;
    })
    .slice(0, 3)
    .map((c) => c.text);
}

// ── Kart micro-label: tek string | null ─────────────────────────────────────
// Hiçbir anlamlı sinyal yoksa null döner → kart bu alanı gizler

export function getRecommendationReason(
  product: any,
  preferences: PreferencesSlice,
  learningProfile: LearningProfile | undefined,
): string | null {
  const reasons = getRecommendationReasons(product, preferences, learningProfile);
  return reasons[0] ?? null;
}

// ── KART ETİKETİ — yalnızca ürün içeriği bazlı, tercih/davranış bağımsız ──
//
// Kural: max 6 kelime · ürünün NE OLDUĞUNU söyle · davranış açıklama YOK
// null → etiket alanı gizlenir (sessiz kart)
//
export function getCardLabel(product: any): string | null {
  const hs = buildHaystack(product);

  // Truth-gated "X-siz" bayrakları (audit 2026-05-04 fix #4)
  const isFragFree    = _truthFree(product, "fragrance", "Parfümsüz");
  const isAlcFree     = _truthFree(product, "alcohol",   "Alkolsüz");
  const isSulfateFree = _truthFree(product, "sulfate",   "Sülfatsız");
  const isVegan       = hasBadge(product, "vegan",     "positive");

  // 1. Hassas cilt dostu — en güçlü birleşik sinyal
  const isSensitiveFriendly =
    (isFragFree && isAlcFree) ||
    matchesAny(hs, ["centella", "cica", "allantoin", "azulen"]);
  if (isSensitiveFriendly) return "Hassas ciltler için uygun";

  // 2. Gece kullanımı — ürün içeriği bunu gösteriyorsa
  if (matchesAny(hs, NIGHT_KWS)) return "Gece kullanımına uygun";

  // 3. Yağlı cilt
  if (matchesAny(hs, ["oil-free", "yağsız", "mat", "matte", "sebum", "yağlı cilt"])) {
    return "Yağlı ciltler için dengeli";
  }

  // 4. Kuru cilt
  if (matchesAny(hs, ["kuru cilt", "dry skin", "besleyici", "nourish", "rich cream"])) {
    return "Kuru ciltler için besleyici";
  }

  // 5. Akne hedefli
  if (matchesAny(hs, ACNE_KWS)) return "Akne karşıtı formül";

  // 6. Gözenek odaklı
  if (matchesAny(hs, PORE_KWS)) return "Gözenek için aktif içerik";

  // 7. Leke karşıtı
  if (matchesAny(hs, ["niacinamide", "leke", "spot", "pigment", "brightening"])) {
    return "Leke karşıtı formül";
  }

  // 8. Günlük kullanım
  if (matchesAny(hs, DAILY_KWS)) return "Günlük kullanım için hafif";

  // 9. Vegan
  if (isVegan) return "Vegan formül";

  // 10. Parfümsüz tek başına
  if (isFragFree) return "Parfümsüz formül";

  // 11. Sülfatsız
  if (isSulfateFree) return "Sülfatsız formül";

  // Anlamlı sinyal yok — sessiz kart
  return null;
}
