/**
 * safetyAlertEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Akıllı Güvenlik Uyarı Motoru
 *
 * Kullanıcı profilini (alerji, hamilelik, cilt tipi, özel koşullar) ürün
 * verileriyle (içerik listesi, özellik bayrakları) karşılaştırır ve
 * kategorize edilmiş uyarı kartları üretir.
 *
 * TASARIM PRENSİPLERİ:
 * - Her kural ayrı, saf bir fonksiyon (test edilebilir + genişletilebilir)
 * - Kesin hüküm verilmez — "tehlikeli/zararsız" yerine "dikkat/uygun görünüyor"
 * - Sadece kullanıcının belirlediği alerjiler için uyarı üretilir
 * - Ürün verisi eksikse "bilinmiyor" kategorisi açıkça belirtilir
 */

import type { UserPreferences, AllergyKey, SpecialConditionKey, SkinType } from "./userPreferences";

// ─── Tip tanımları ─────────────────────────────────────────────────────────────

export type SafetyAlertSeverity = "danger" | "warning" | "info" | "safe";

export interface SafetyAlert {
  id: string;
  severity: SafetyAlertSeverity;
  title: string;
  message: string;
  /**
   * İnsan okunabilir başlık rengi (Türkçe eczacı dili ile yazılmış)
   */
  ingredient?: string;
}

/** Ürünün kural motoruna girecek özellik bayrakları */
export interface ProductFeatureFlags {
  /**
   * "positive"  → ürün bu bileşeni İÇERMİYOR (parfümsüz, vb.)
   * "negative"  → ürün bu bileşeni İÇERİYOR
   * "unknown"   → veri yok / belirsiz
   */
  fragrance: "positive" | "negative" | "unknown";
  alcohol:   "positive" | "negative" | "unknown";
  paraben:   "positive" | "negative" | "unknown";
  silicone:  "positive" | "negative" | "unknown";
  sulfate:   "positive" | "negative" | "unknown";
}

/** Hamilelik/emzirme dönemi dikkat gerektiren içerikler */
const PREGNANCY_HIGH_RISK = [
  "retinol", "retinyl", "retinal", "tretinoin", "retinoid", "retinoic",
  "granactive retinoid", "hydroxypinacolone retinoate",
];

const PREGNANCY_CAUTION = [
  "salicylic acid", "benzoyl peroxide", "glycolic acid",
  "kojic acid", "hydroquinone", "formaldehyde", "oxybenzone",
];

/** Hassas cilt için tetikleyici olabilecek içerikler (fragrance + alkol) */
const SENSITIVE_SKIN_TRIGGERS = ["parfum", "fragrance", "alcohol denat", "denatured alcohol", "ethanol"];

// ─── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

function ingredientsLower(ingredientsRaw: string | null): string {
  return (ingredientsRaw ?? "").toLowerCase();
}

function containsAny(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    if (haystack.includes(n.toLowerCase())) return n;
  }
  return null;
}

// ─── Kural 1: Alerji kontrolü ─────────────────────────────────────────────────

/**
 * Kullanıcının alerji listesindeki maddeleri ürün bayraklarıyla karşılaştırır.
 * Badge "negative" ise ürün bu bileşeni içeriyor → uyarı.
 * Badge "unknown" ise veri eksik → bilgi notu.
 */
export function checkAllergyRules(
  allergies: AllergyKey[],
  flags: ProductFeatureFlags,
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];

  const FLAG_MAP: Partial<Record<AllergyKey, keyof ProductFeatureFlags>> = {
    fragrance: "fragrance",
    alcohol:   "alcohol",
    paraben:   "paraben",
    silicone:  "silicone",
    sulfate:   "sulfate",
  };

  const ALLERGY_LABELS: Partial<Record<AllergyKey, string>> = {
    fragrance:    "Parfüm / Koku",
    alcohol:      "Alkol",
    paraben:      "Paraben",
    silicone:     "Silikon",
    sulfate:      "Sülfat",
    essential_oil:"Esansiyel Yağ",
    lanolin:      "Lanolin",
    nickel:       "Nikel",
    nut:          "Fındık / Ceviz Yağı",
    latex:        "Lateks",
    gluten:       "Gluten",
  };

  for (const allergy of allergies) {
    const flagKey = FLAG_MAP[allergy];
    if (!flagKey) continue;

    const status = flags[flagKey];

    if (status === "negative") {
      alerts.push({
        id: `allergy-${allergy}`,
        severity: "danger",
        title: "Alerji Uyarısı",
        message: `Profilinizde ${ALLERGY_LABELS[allergy] ?? allergy} hassasiyeti belirtilmiş. Bu ürün bu bileşeni içeriyor.`,
        ingredient: ALLERGY_LABELS[allergy],
      });
    } else if (status === "unknown") {
      alerts.push({
        id: `allergy-unknown-${allergy}`,
        severity: "info",
        title: "Veri Eksik",
        message: `${ALLERGY_LABELS[allergy] ?? allergy} içerip içermediği bu ürün için belirsiz. İçerik listesini incelemeniz önerilir.`,
        ingredient: ALLERGY_LABELS[allergy],
      });
    }
    // status === "positive" → ürün bu bileşeni içermiyor, uyarı gerekmez
  }

  return alerts;
}

// ─── Kural 2: Hamilelik / emzirme kontrolü ────────────────────────────────────

/**
 * Kullanıcının hamilelik/emzirme koşulu varsa içerik metnini tarar.
 */
export function checkPregnancyRules(
  specialConditions: SpecialConditionKey[],
  ingredientsRaw: string | null,
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  const text = ingredientsLower(ingredientsRaw);

  const isPregnant     = specialConditions.includes("pregnancy");
  const isBreastfeeding = specialConditions.includes("breastfeeding");

  if (!isPregnant && !isBreastfeeding) return [];

  if (isPregnant) {
    const highRisk = containsAny(text, PREGNANCY_HIGH_RISK);
    if (highRisk) {
      alerts.push({
        id: "pregnancy-high",
        severity: "danger",
        title: "Hamilelikte Dikkat",
        message: `İçerik profilinde hamilelik döneminde temkinli yaklaşılması gereken bir bileşen tespit edildi (${highRisk}). Kullanmadan önce hekiminizle görüşün.`,
        ingredient: highRisk,
      });
    } else {
      const caution = containsAny(text, PREGNANCY_CAUTION);
      if (caution) {
        alerts.push({
          id: "pregnancy-caution",
          severity: "warning",
          title: "Hamilelikte Temkinli",
          message: `İçerikte (${caution}) hamilelik döneminde dikkat gerektiren bir bileşen var. Hekiminize danışmanız daha doğru olur.`,
          ingredient: caution,
        });
      }
    }
  }

  if (isBreastfeeding && !alerts.some(a => a.id.startsWith("pregnancy"))) {
    const risk = containsAny(text, PREGNANCY_HIGH_RISK);
    if (risk) {
      alerts.push({
        id: "breastfeeding-caution",
        severity: "warning",
        title: "Emzirme Döneminde Dikkat",
        message: `İçerikte (${risk}) emzirme döneminde temkinli değerlendirilmesi önerilen bir bileşen var.`,
        ingredient: risk,
      });
    }
  }

  return alerts;
}

// ─── Kural 3: Cilt tipi kontrolü ─────────────────────────────────────────────

/**
 * Hassas cilt için ürün parfüm veya alkol içeriyorsa uyarı üretir.
 * Kuru cilt + alkol içeriği de uyarıya neden olabilir.
 */
export function checkSkinTypeRules(
  skinType: SkinType | null,
  specialConditions: SpecialConditionKey[],
  flags: ProductFeatureFlags,
  ingredientsRaw: string | null,
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];

  const isSensitive =
    skinType === "sensitive" ||
    specialConditions.includes("sensitive_skin") ||
    specialConditions.includes("rosacea") ||
    specialConditions.includes("eczema");

  const isDry = skinType === "dry";

  if (isSensitive) {
    if (flags.fragrance === "negative") {
      alerts.push({
        id: "sensitive-fragrance",
        severity: "warning",
        title: "Hassas Cilt Uyarısı",
        message: "Hassas cilt profiliniz var ve bu ürün parfüm içeriyor. Parfüm hassas ciltte tahrişi artırabilir.",
      });
    }
    if (flags.alcohol === "negative") {
      // Alkol içerdiği bilinen ürünler + hassas cilt
      const text = ingredientsLower(ingredientsRaw);
      const hasDenatured = containsAny(text, ["alcohol denat", "denatured alcohol", "ethanol", "sd alcohol"]);
      if (hasDenatured) {
        alerts.push({
          id: "sensitive-alcohol",
          severity: "warning",
          title: "Hassas Cilt Uyarısı",
          message: "Bu üründe tahriş edici alkol türleri tespit edildi. Hassas cilt için nazik formüller önerilir.",
          ingredient: hasDenatured,
        });
      }
    }
    if (flags.fragrance === "unknown" && flags.alcohol === "unknown" && ingredientsRaw) {
      const text = ingredientsLower(ingredientsRaw);
      const trigger = containsAny(text, SENSITIVE_SKIN_TRIGGERS);
      if (trigger) {
        alerts.push({
          id: "sensitive-trigger",
          severity: "warning",
          title: "Hassas Cilt Uyarısı",
          message: `İçerikte (${trigger}) hassas cilt için tetikleyici olabilecek bir bileşen var. Yama testi yapmanız önerilir.`,
          ingredient: trigger,
        });
      }
    }
  }

  if (isDry && flags.alcohol === "negative") {
    const text = ingredientsLower(ingredientsRaw);
    const hasDenatured = containsAny(text, ["alcohol denat", "denatured alcohol"]);
    if (hasDenatured) {
      alerts.push({
        id: "dry-alcohol",
        severity: "info",
        title: "Kuru Cilt Notu",
        message: "Kuru cilt için formüle edilmiş ürünlerde tahriş edici alkol tercih edilmez. İçerik listesini gözden geçirebilirsiniz.",
      });
    }
  }

  return alerts;
}

// ─── Kural 4: Özel koşul kontrolleri ─────────────────────────────────────────

/**
 * Akne eğilimli cilt için komedojenik bileşen uyarısı.
 * Çocuk kullanımı için belirli içerikler.
 */
export function checkSpecialConditionRules(
  specialConditions: SpecialConditionKey[],
  ingredientsRaw: string | null,
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  const text = ingredientsLower(ingredientsRaw);

  if (specialConditions.includes("for_child")) {
    const childRisk = containsAny(text, [
      "salicylic acid", "retinol", "glycolic acid", "benzoyl peroxide",
      "alcohol denat", "methylisothiazolinone", "oxybenzone",
    ]);
    if (childRisk) {
      alerts.push({
        id: "child-risk",
        severity: "warning",
        title: "Çocuk Kullanımı İçin Dikkat",
        message: `Bu ürün çocuk cildi için önerilmeyen bir bileşen içeriyor (${childRisk}). Pediatrik dermatologa danışılması daha doğru olur.`,
        ingredient: childRisk,
      });
    }
  }

  return alerts;
}

// ─── Ana motor: runSafetyAlertEngine ─────────────────────────────────────────

export interface SafetyAlertResult {
  alerts: SafetyAlert[];
  /** En yüksek severity (kolay conditional render için) */
  maxSeverity: SafetyAlertSeverity | null;
  /** Hiçbir uyarı yoksa ve profil doldurulmuşsa "safe" bilgisi üretilebilir */
  isProfiled: boolean;
}

/**
 * Tüm güvenlik kurallarını sırayla çalıştırır ve birleşik sonuç döner.
 *
 * @param preferences  Kullanıcı tercihleri (allergies, specialConditions, skinType)
 * @param flags        Ürün özellik bayrakları (fragrance, alcohol, paraben, ...)
 * @param ingredientsRaw  Ham içerik metni (virgülle ayrılmış)
 */
export function runSafetyAlertEngine(
  preferences: Pick<UserPreferences, "allergies" | "specialConditions" | "skinType">,
  flags: ProductFeatureFlags,
  ingredientsRaw: string | null,
): SafetyAlertResult {
  const allAlerts: SafetyAlert[] = [
    ...checkAllergyRules(preferences.allergies, flags),
    ...checkPregnancyRules(preferences.specialConditions, ingredientsRaw),
    ...checkSkinTypeRules(preferences.skinType, preferences.specialConditions, flags, ingredientsRaw),
    ...checkSpecialConditionRules(preferences.specialConditions, ingredientsRaw),
  ];

  // Dedup by id
  const seen = new Set<string>();
  const alerts = allAlerts.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  const SEVERITY_ORDER: SafetyAlertSeverity[] = ["danger", "warning", "info", "safe"];
  let maxSeverity: SafetyAlertSeverity | null = null;
  for (const sev of SEVERITY_ORDER) {
    if (alerts.some(a => a.severity === sev)) {
      maxSeverity = sev;
      break;
    }
  }

  const isProfiled =
    preferences.allergies.length > 0 ||
    preferences.specialConditions.length > 0 ||
    preferences.skinType !== null;

  return { alerts, maxSeverity, isProfiled };
}

// ─── Renk / görsel yardımcılar ────────────────────────────────────────────────

export function alertSeverityColor(s: SafetyAlertSeverity): string {
  if (s === "danger")  return "#B91C1C";
  if (s === "warning") return "#B45309";
  if (s === "info")    return "#0369A1";
  return "#15803D";
}

export function alertSeverityBg(s: SafetyAlertSeverity, isDark: boolean): string {
  if (s === "danger")  return isDark ? "rgba(185,28,28,0.12)"  : "#FEF2F2";
  if (s === "warning") return isDark ? "rgba(180,83,9,0.12)"   : "#FFFBEB";
  if (s === "info")    return isDark ? "rgba(3,105,161,0.10)"  : "#EFF6FF";
  return isDark ? "rgba(21,128,61,0.10)" : "#F0FDF4";
}

export function alertSeverityBorder(s: SafetyAlertSeverity, isDark: boolean): string {
  if (s === "danger")  return isDark ? "rgba(252,165,165,0.30)" : "#FCA5A5";
  if (s === "warning") return isDark ? "rgba(253,211,77,0.25)"  : "#FDE68A";
  if (s === "info")    return isDark ? "rgba(147,197,253,0.25)" : "#BFDBFE";
  return isDark ? "rgba(134,239,172,0.25)" : "#BBF7D0";
}

export function alertSeverityIcon(s: SafetyAlertSeverity): string {
  if (s === "danger")  return "alert-triangle";
  if (s === "warning") return "alert-circle";
  if (s === "info")    return "info";
  return "check-circle";
}
