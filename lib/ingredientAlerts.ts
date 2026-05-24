/**
 * ingredientAlerts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * İçerik Eşleştirme Motoru:
 *
 * - getIngredientAlerts(parsedIngredients, preferences)
 *     → IngredientAlert[]  (şahsî alerji / kaçınma listesi çakışmaları)
 *
 * - getPregnancyBreastfeedingStatus(parsedIngredients, preferences?)
 *     → PregnancyBreastfeedingResult  (hamilelik / emzirme değerlendirmesi)
 *
 * - getTopSafetyBadges(parsedIngredients, preferences)
 *     → SafetyBadge[]  (hero alanında gösterilecek maks 3 rozet)
 *
 * DİL KURALI:
 * ASLA kesin hüküm verme. "Uygundur/zararsız" yerine "genel olarak uygun görünüyor".
 * "Kullanılmaz/tehlikeli" yerine "temkinli değerlendirilmeli".
 */

import { findIngredientMatch, normalizeIngredient } from "./ingredientAliases";
import type { UserPreferences } from "./userPreferences";
import {
  resolveAllergenMatch,
  resolvePregnancyVerdict,
  resolveBreastfeedingVerdict,
} from "@/lib/features/featureTruth";

// ── Tipler ───────────────────────────────────────────────────────────────────

export type AlertType =
  | "allergy_match"    // allergyIngredients listesiyle çakışma
  | "avoided_match"    // avoidedIngredients listesiyle çakışma
  | "pregnancy_risk"   // hamilelik dönemi bileşen riski
  | "breastfeeding_risk" // emzirme dönemi bileşen riski
  | "child_use_risk"   // çocuk kullanımı için dikkat
  | "essential_oil_risk"; // esansiyel yağ hassasiyeti

export type AlertLevel = "high" | "caution" | "info";

export interface IngredientAlert {
  type: AlertType;
  level: AlertLevel;
  /** Üründe tespit edilen gerçek içerik adı */
  ingredient: string;
  /** Kullanıcının listesindeki hangi girişle eşleşti (alias dahil) */
  matchedUserEntry?: string;
  /** Türkçe açıklama */
  message: string;
  /**
   * true = sadece seçkin kullanıcılar tam detayı görsün.
   * false / undefined = herkese açık.
   */
  seckinOnly?: boolean;
}

export type SafetyStatus = "generally_ok" | "caution" | "avoid_or_consult";

export interface SafetyEval {
  status: SafetyStatus;
  message: string;
}

export interface PregnancyBreastfeedingResult {
  pregnancy: SafetyEval;
  breastfeeding: SafetyEval;
}

export interface SafetyBadge {
  label: string;
  color: string;
  icon: string;
}

// ── Hamilelik/emzirme tetikleyici içerikler ──────────────────────────────────

const PREGNANCY_AVOID_KEYWORDS = [
  "retinol", "retinyl", "retinal", "tretinoin", "retinoid", "retinoic",
  "granactive retinoid", "hydroxypinacolone retinoate",
];

const PREGNANCY_CAUTION_KEYWORDS = [
  "salicylic acid", "benzoyl peroxide", "glycolic acid",
  "kojic acid", "hydroquinone", "formaldehyde",
  "dihydroxyacetone", "oxybenzone",
];

const CHILD_USE_CAUTION_KEYWORDS = [
  "salicylic acid", "retinol", "glycolic acid", "lactic acid",
  "benzoyl peroxide", "alcohol denat", "denatured alcohol",
  "methylisothiazolinone", "methylchloroisothiazolinone",
  "oxybenzone", "perfume", "parfum", "fragrance",
];

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function normalizeList(ingredients: string[]): string[] {
  return ingredients.map((n) => normalizeIngredient(n));
}

function containsKeyword(normalizedList: string[], keywords: string[]): string | null {
  for (const kw of keywords) {
    const found = normalizedList.find(
      (n) => n === kw || n.includes(kw) || kw.includes(n),
    );
    if (found) return found;
  }
  return null;
}

// ── Ana fonksiyonlar ─────────────────────────────────────────────────────────

/**
 * Kullanıcının şahsî alerji / kaçınma listesini ürün içerikleriyle karşılaştırır.
 *
 * @param ingredientNames  Ürün içeriklerinin adları (string[])
 * @param preferences      Kullanıcı tercihleri
 */
export function getIngredientAlerts(
  ingredientNames: string[],
  preferences: Pick<UserPreferences, "allergyIngredients" | "avoidedIngredients">,
): IngredientAlert[] {
  const alerts: IngredientAlert[] = [];
  const productNorms = normalizeList(ingredientNames);

  // 1. Alerji listesi (high risk)
  for (const entry of preferences.allergyIngredients) {
    if (!entry.trim()) continue;
    const match = findIngredientMatch(entry, productNorms);
    if (match) {
      alerts.push({
        type: "allergy_match",
        level: "high",
        ingredient: match,
        matchedUserEntry: entry,
        message: "Şahsî alerji listenizde bulunan bir bileşenle eşleşme saptandı.",
        seckinOnly: true,
      });
    }
  }

  // 2. Kaçınma listesi (caution)
  for (const entry of preferences.avoidedIngredients) {
    if (!entry.trim()) continue;
    // Alerji listesinde zaten varsa tekrar ekleme
    const alreadyFlagged = alerts.some(
      (a) => a.ingredient === findIngredientMatch(entry, productNorms),
    );
    if (alreadyFlagged) continue;

    const match = findIngredientMatch(entry, productNorms);
    if (match) {
      alerts.push({
        type: "avoided_match",
        level: "caution",
        ingredient: match,
        matchedUserEntry: entry,
        message: "Kaçınmak istediğiniz bileşenlerden biriyle eşleşme var.",
        seckinOnly: true,
      });
    }
  }

  return alerts;
}

/**
 * Hamilelik / emzirme döneminde ürünün güvenlik değerlendirmesini döner.
 * Kesin hüküm verilmez; eczacı dili kullanılır.
 */
export function getPregnancyBreastfeedingStatus(
  ingredientNames: string[],
): PregnancyBreastfeedingResult {
  const norms = normalizeList(ingredientNames);

  // Hamilelik değerlendirmesi
  const avoidFound = containsKeyword(norms, PREGNANCY_AVOID_KEYWORDS);
  const cautionFound = containsKeyword(norms, PREGNANCY_CAUTION_KEYWORDS);

  let pregnancyStatus: SafetyEval;
  if (avoidFound) {
    pregnancyStatus = {
      status: "avoid_or_consult",
      message: "İçerik profilinde hamilelik döneminde dikkat gerektiren bileşen tespit edildi. Uzman görüşüyle netleştirilmesi önerilir.",
    };
  } else if (cautionFound) {
    pregnancyStatus = {
      status: "caution",
      message: "Bazı içerikler hamilelik döneminde temkinli değerlendirilmelidir. Gerekirse hekime danışın.",
    };
  } else if (ingredientNames.length === 0) {
    pregnancyStatus = {
      status: "caution",
      message: "İçerik verisi yetersiz. Kullanmadan önce uzman görüşüyle netleştirilmesi daha doğru olabilir.",
    };
  } else {
    pregnancyStatus = {
      status: "generally_ok",
      message: "İçerik profilinde hamilelik dönemine özgü belirgin risk bileşeni saptanmadı. Yine de özel durumunuza göre hekiminize danışmanızı öneririz.",
    };
  }

  // Emzirme değerlendirmesi — retinoidler dışında genellikle daha esnek
  let breastfeedingStatus: SafetyEval;
  if (avoidFound) {
    breastfeedingStatus = {
      status: "caution",
      message: "İçerikte emzirme döneminde temkinli yaklaşılması önerilen bileşenler tespit edildi.",
    };
  } else if (ingredientNames.length === 0) {
    breastfeedingStatus = {
      status: "caution",
      message: "İçerik verisi yetersiz. Uzman görüşü alınması daha doğru olabilir.",
    };
  } else {
    breastfeedingStatus = {
      status: "generally_ok",
      message: "İçerik profili emzirme döneminde genel olarak daha uygun görünüyor. Bireysel hassasiyetler için hekiminizle görüşebilirsiniz.",
    };
  }

  return { pregnancy: pregnancyStatus, breastfeeding: breastfeedingStatus };
}

/**
 * Çocuk kullanımı için uyarı notu üretir.
 */
export function getChildUseNote(ingredientNames: string[]): string | null {
  const norms = normalizeList(ingredientNames);
  const found = containsKeyword(norms, CHILD_USE_CAUTION_KEYWORDS);
  if (found) {
    return "Çocuk cildine uygulamadan önce içerik profilinin yaşa göre değerlendirilmesi önerilir.";
  }
  return "İçerikte çocuk cildi için belirgin risk bileşeni saptanmadı; yine de yaşa uygunluk için dermatologa danışılabilir.";
}

/**
 * Hero alanında gösterilecek en kritik güvenlik rozetlerini üretir (maks 3).
 */
export function getTopSafetyBadges(
  ingredientNames: string[],
  preferences: Pick<
    UserPreferences,
    "specialConditions" | "allergyIngredients" | "avoidedIngredients"
  >,
  /**
   * Opsiyonel ürün ipucu — verilirse hamilelik/emzirme rozetleri FEATURE TRUTH
   * LAYER üzerinden hesaplanır (DB pregnancy_safe + pregnancy_use + INCI tarama).
   * Verilmezse synthetic product ile sadece içerik sinyali kullanılır; bu durumda
   * hero chip ile aynı içerik kararını üretir (DB-only durumlar için ipucu şart).
   */
  productHint?: Record<string, unknown>,
): SafetyBadge[] {
  const badges: SafetyBadge[] = [];
  const sc = preferences.specialConditions;
  const norms = normalizeList(ingredientNames);

  // ─── FEATURE TRUTH LAYER (additive top-injection) ─────────────────────────
  // Sentetik ürün şekliyle truth katmanını çağır; lowercase/trim normalizasyon
  // ile findIngredientMatch'in kaçırdığı serbest-metin girdilerini yakalar.
  const _truthAllergyOnly = resolveAllergenMatch(
    { ingredients: ingredientNames },
    { allergyIngredients: preferences.allergyIngredients },
  );
  const _truthAvoidedOnly = resolveAllergenMatch(
    { ingredients: ingredientNames },
    { avoidedIngredients: preferences.avoidedIngredients },
  );

  // Alerji çakışması — en yüksek öncelik (truth OR mevcut)
  const hasAllergyMatch =
    _truthAllergyOnly.matched ||
    (preferences.allergyIngredients.length > 0 &&
      preferences.allergyIngredients.some((e) => findIngredientMatch(e, norms)));
  if (hasAllergyMatch) {
    badges.push({ label: "Alerji Uyarısı", color: "#b91c1c", icon: "alert-triangle" });
  }

  // Kaçınma listesi çakışması (truth OR mevcut)
  const hasAvoidedMatch =
    _truthAvoidedOnly.matched ||
    (preferences.avoidedIngredients.length > 0 &&
      preferences.avoidedIngredients.some((e) => findIngredientMatch(e, norms)));
  if (hasAvoidedMatch && !hasAllergyMatch) {
    badges.push({ label: "Çakışma Var", color: "#d97706", icon: "alert-circle" });
  }

  // ─── FEATURE TRUTH LAYER — Hamilelik / Emzirme rozetleri ──────────────────
  // Hero "Hamileler İçin..." chip'i ile çelişmemesi için truth'tan türet.
  // productHint verildiyse DB+INCI birleşik karar; verilmediyse synthetic
  // product ile sadece içerik sinyali → yine hero chip ile tutarlı.
  const _truthPregProduct: Record<string, unknown> = productHint ?? {
    ingredients: ingredientNames,
  };
  const _truthPreg = resolvePregnancyVerdict(_truthPregProduct);

  // Hamilelik
  if (sc.includes("pregnancy")) {
    const ts = _truthPreg.status; // "safe" | "caution" | "avoid"
    badges.push({
      label:
        ts === "avoid"
          ? "Hamilelik: Dikkat"
          : ts === "caution"
            ? "Hamilelik: Temkinli"
            : "Hamilelik: Uygun",
      color: ts === "avoid" ? "#b91c1c" : ts === "caution" ? "#d97706" : "#16a34a",
      icon: ts === "safe" ? "check-circle" : "alert-circle",
    });
  }

  // Emzirme — bağımsız truth verdict'i (audit 2026-05-04 fix #3: önceden
  // pregnancy verdict'inden piggyback'liyordu; artık breastfeeding_use Türkçe
  // değerleri DB'den doğrudan okunup 3 seviyeye ayrılır).
  if (sc.includes("breastfeeding") && badges.length < 3) {
    const _truthBreast = resolveBreastfeedingVerdict(_truthPregProduct);
    const ts = _truthBreast.status; // "safe" | "caution" | "avoid"
    badges.push({
      label:
        ts === "avoid"
          ? "Emzirme: Dikkat"
          : ts === "caution"
            ? "Emzirme: Temkinli"
            : "Emzirme: Uygun",
      color: ts === "avoid" ? "#b91c1c" : ts === "caution" ? "#d97706" : "#16a34a",
      icon: ts === "safe" ? "check-circle" : "alert-circle",
    });
  }

  return badges.slice(0, 3);
}

// ── Renk / görsel yardımcılar ────────────────────────────────────────────────

export function safetyStatusColor(status: SafetyStatus): string {
  if (status === "avoid_or_consult") return "#b91c1c";
  if (status === "caution") return "#d97706";
  return "#16a34a";
}

export function safetyStatusIcon(status: SafetyStatus): string {
  if (status === "avoid_or_consult") return "alert-triangle";
  if (status === "caution") return "alert-circle";
  return "check-circle";
}

export function alertLevelColor(level: AlertLevel): string {
  if (level === "high") return "#b91c1c";
  if (level === "caution") return "#d97706";
  return "#0369a1";
}

export function alertLevelBg(level: AlertLevel): string {
  if (level === "high") return "#fef2f2";
  if (level === "caution") return "#fffbeb";
  return "#eff6ff";
}

export function alertLevelBorder(level: AlertLevel): string {
  if (level === "high") return "#fca5a5";
  if (level === "caution") return "#fde68a";
  return "#bfdbfe";
}
