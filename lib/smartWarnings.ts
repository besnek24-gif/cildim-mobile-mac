/**
 * smartWarnings.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Akıllı Uyarı Motoru — içerik analizi + kullanıcı profili tabanlı.
 *
 * getSmartWarnings(parsedIngredients, preferences?)
 *   → SmartWarning[] — öncelik sıralı, maks 4 uyarı
 *
 * Mantık:
 *   1. İçerik listesi bilinen risk anahtar kelimeleriyle taranır.
 *   2. Kullanıcı profili (specialConditions, allergies, skinType) varsa
 *      uyarı seviyesi yükseltilir (info→caution, caution→sensitive).
 *   3. Boş profilde tüm uyarılar "bazal" seviyede çıkar.
 *   4. Profil eşleşince `contextMessage` ile somut gerekçe gösterilir.
 */

import type { ParsedIngredient } from "./ingredientAnalysis";
import type { UserPreferences } from "./userPreferences";

// ── Tipler ─────────────────────────────────────────────────────────────────

export type WarningType =
  | "fragrance"       // Parfüm / koku bileşenleri
  | "alcohol"         // Sert alkol türevleri
  | "essential_oil"   // Esansiyel yağlar
  | "pregnancy"       // Hamilelik / emzirme dönemi
  | "comedogenic"     // Komedojenik / gözenek tıkayıcı risk
  | "rosacea"         // Rozasea / hassas cilt iritasyonu
  | "drying"          // Kurutuculuk potansiyeli
  | "sensitizer";     // Cildi hassaslaştırıcı koruyucu madde

export type WarningLevel = "info" | "caution" | "sensitive";

export interface SmartWarning {
  type: WarningType;
  level: WarningLevel;
  message: string;
  /**
   * Profil eşleşmesini somutlaştıran ek metin.
   * Gösterildiğinde generic "Şahsî profilinize göre öncelikli" yerine bu kullanılır.
   */
  contextMessage?: string;
  /** Kullanıcı profiliyle eşleşip eşleşmediği — badge için */
  boostedByProfile: boolean;
}

// ── İçerik eşleme kuralları ────────────────────────────────────────────────

type WarningRule = {
  type: WarningType;
  baseLevel: WarningLevel;
  keywords: string[];
  message: string;
};

const RULES: WarningRule[] = [
  {
    type: "fragrance",
    baseLevel: "caution",
    keywords: [
      "parfum", "fragrance", "perfume", "aroma",
      "limonene", "linalool", "eugenol", "citronellol", "geraniol",
      "benzyl benzoate", "cinnamal", "isoeugenol", "coumarin",
      "cinnamyl alcohol", "farnesol", "hexyl cinnamal",
      "alpha-isomethyl ionone", "hydroxycitronellal",
    ],
    message: "Parfüm ve koku bileşenleri hassas ciltlerde reaksiyon oluşturabilir.",
  },
  {
    type: "alcohol",
    baseLevel: "caution",
    keywords: [
      "alcohol denat", "denatured alcohol", "sd alcohol", "isopropyl alcohol",
      "ethyl alcohol",
    ],
    message: "Sert alkol türevleri cildi kurutabilir; bariyer hassasiyeti olanlarda dikkat gerekir.",
  },
  {
    type: "essential_oil",
    baseLevel: "info",
    keywords: [
      "lavandula angustifolia oil", "lavender oil", "tea tree oil",
      "melaleuca alternifolia", "citrus aurantium", "bergamot oil",
      "lemon oil", "eucalyptus oil", "peppermint oil", "mentha piperita",
      "rosemary oil", "rosmarinus officinalis", "orange oil",
      "clove oil", "cinnamon oil", "jasmine oil", "ylang ylang",
    ],
    message: "Esansiyel yağlar hassas ciltlerde tahriş ve ışık hassasiyeti riski oluşturabilir.",
  },
  {
    type: "pregnancy",
    baseLevel: "caution",
    keywords: [
      "retinol", "retinyl", "retinal", "tretinoin", "retinoid", "retinoic",
      "salicylic acid", "benzoyl peroxide",
    ],
    message: "Hamilelik ve emzirme döneminde bu bileşenler için hekim onayı önerilir.",
  },
  {
    type: "comedogenic",
    baseLevel: "info",
    keywords: [
      "isopropyl myristate", "isopropyl palmitate", "acetylated lanolin",
      "wheat germ oil", "coconut oil", "algae extract",
      "linseed oil", "flaxseed oil",
    ],
    message: "Gözenek tıkayıcı potansiyelli bileşenler içeriyor — akne eğilimli ciltlerde dikkat.",
  },
  {
    type: "rosacea",
    baseLevel: "caution",
    keywords: [
      "menthol", "peppermint", "eucalyptus", "camphor", "cinnamon extract",
      "parfum", "fragrance", "alcohol denat", "denatured alcohol", "sd alcohol",
    ],
    message: "Rozasea ve hassas ciltlerde kızarıklık ve iritasyonu tetikleyebilecek bileşenler var.",
  },
  {
    type: "drying",
    baseLevel: "info",
    keywords: [
      "sodium lauryl sulfate", "sodium laureth sulfate", "ammonium lauryl sulfate",
    ],
    message: "Kuru ve hassas ciltlerde uzun vadede bariyer zayıflaması görülebilir.",
  },
  {
    type: "sensitizer",
    baseLevel: "caution",
    keywords: [
      "methylisothiazolinone", "methylchloroisothiazolinone", "kathon",
      "formaldehyde", "bronopol", "dmdm hydantoin", "imidazolidinyl urea",
      "quaternium-15", "2-bromo-2-nitropropane",
    ],
    message: "Cildi hassaslaştırıcı koruyucu madde içeriyor; tekrarlı kullanımda dikkat edilmesi önerilir.",
  },
];

// ── Yardımcı sabitler ──────────────────────────────────────────────────────

const LEVEL_PRIORITY: Record<WarningLevel, number> = {
  sensitive: 3,
  caution:   2,
  info:      1,
};

// ── İçerik adı eşleme ─────────────────────────────────────────────────────

function matchesKeyword(nameList: string[], keywords: string[]): boolean {
  return keywords.some((kw) => nameList.some((n) => n === kw || n.includes(kw)));
}

// ── Seviye yükseltici ─────────────────────────────────────────────────────

function upgradeLevel(base: WarningLevel): WarningLevel {
  if (base === "info")    return "caution";
  if (base === "caution") return "sensitive";
  return "sensitive";
}

// ── Ana fonksiyon ──────────────────────────────────────────────────────────

/**
 * Ürünün içerik listesini kullanıcı profiliyle birlikte değerlendirip
 * öncelik sıralı SmartWarning dizisi döner.
 *
 * @param parsedIngredients  `analyzeIngredients` çıktısı
 * @param preferences        `useUserPreferences().preferences` (opsiyonel)
 */
export function getSmartWarnings(
  parsedIngredients: ParsedIngredient[],
  preferences?: Pick<UserPreferences, "specialConditions" | "allergies" | "skinType">,
): SmartWarning[] {
  if (parsedIngredients.length === 0) return [];

  const nameList = parsedIngredients.map((i) => i.name.toLocaleLowerCase("tr-TR"));
  const sc       = preferences?.specialConditions ?? [];
  const al       = preferences?.allergies         ?? [];
  const skin     = preferences?.skinType          ?? null;

  // Profil bayrakları
  const isSensitive         = sc.includes("sensitive_skin") || skin === "sensitive";
  const isPregnant          = sc.includes("pregnancy");
  const isBreastfeeding     = sc.includes("breastfeeding");
  const hasRosacea          = sc.includes("rosacea");
  const isAcneProne         = sc.includes("acne_prone");
  const fragranceAllergy    = al.includes("fragrance");
  const alcoholAllergy      = al.includes("alcohol");
  const essentialOilAllergy = al.includes("essential_oil");
  const isDry               = skin === "dry";

  const results: SmartWarning[] = [];

  for (const rule of RULES) {
    if (!matchesKeyword(nameList, rule.keywords)) continue;

    let boosted = false;
    let contextMessage: string | undefined;

    switch (rule.type) {
      case "fragrance":
        if (fragranceAllergy) {
          boosted = true;
          contextMessage = "Parfüm alerjiniz nedeniyle bu koku bileşenleri reaksiyon riski taşıyabilir.";
        } else if (hasRosacea) {
          boosted = true;
          contextMessage = "Rozasea profiliniz için parfüm ve koku bileşenleri kızarıklığı tetikleyebilir.";
        } else if (isSensitive) {
          boosted = true;
          contextMessage = "Hassas cilt profiliniz için parfüm bileşenleri tahriş oluşturabilir.";
        }
        break;

      case "alcohol":
        if (alcoholAllergy) {
          boosted = true;
          contextMessage = "Alkol alerjiniz nedeniyle sert alkol içeren ürünlerde dikkat önerilir.";
        } else if (hasRosacea) {
          boosted = true;
          contextMessage = "Rozasea profiliniz için alkol içeren ürünler cildi irrite edebilir.";
        } else if (isSensitive) {
          boosted = true;
          contextMessage = "Hassas cilt profiliniz için sert alkol bariyer hasarı riski taşıyabilir.";
        }
        break;

      case "essential_oil":
        if (essentialOilAllergy) {
          boosted = true;
          contextMessage = "Esansiyel yağ hassasiyetiniz nedeniyle bu bileşenler dikkat gerektirir.";
        } else if (isSensitive) {
          boosted = true;
          contextMessage = "Hassas cilt profiliniz için esansiyel yağlar tahriş ve ışık hassasiyeti riski oluşturabilir.";
        }
        break;

      case "pregnancy":
        if (isPregnant) {
          boosted = true;
          contextMessage = "Hamilelik profilinize göre bu bileşenler için uzman görüşü alınması önerilir.";
        } else if (isBreastfeeding) {
          boosted = true;
          contextMessage = "Emzirme döneminde bu bileşenler için hekiminize danışmanızı öneririz.";
        }
        break;

      case "comedogenic":
        if (isAcneProne) {
          boosted = true;
          contextMessage = "Akne eğilimli cildiniz için bu yağ bazlı bileşenler gözenek tıkama riskini artırabilir.";
        }
        break;

      case "rosacea":
        if (hasRosacea) {
          boosted = true;
          contextMessage = "Rozasea profiliniz için bu bileşenler kızarıklık ve tahrişi tetikleyebilir.";
        } else if (isSensitive) {
          boosted = true;
          contextMessage = "Hassas cilt profiliniz için irrite edici bileşenler dikkat gerektirir.";
        }
        break;

      case "drying":
        if (isDry) {
          boosted = true;
          contextMessage = "Kuru cilt profiliniz için sülfat bazlı içerikler bariyer zayıflaması riski taşıyabilir.";
        } else if (isSensitive) {
          boosted = true;
          contextMessage = "Hassas cilt profiliniz için kurutucu bileşenler uzun vadede bariyer hasarı oluşturabilir.";
        }
        break;

      case "sensitizer":
        if (hasRosacea) {
          boosted = true;
          contextMessage = "Rozasea profiliniz için bu koruyucu maddeler irrite edici olabilir; eczacıya danışmanızı öneririz.";
        } else if (isSensitive) {
          boosted = true;
          contextMessage = "Hassas cilt profiliniz için bu koruyucu maddeler uzun vadede hassaslaşma riski oluşturabilir.";
        }
        break;
    }

    results.push({
      type:             rule.type,
      level:            boosted ? upgradeLevel(rule.baseLevel) : rule.baseLevel,
      message:          rule.message,
      contextMessage,
      boostedByProfile: boosted,
    });
  }

  // Öncelik sıralaması: level (desc) → boostedByProfile (desc)
  results.sort((a, b) => {
    const ldiff = LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level];
    if (ldiff !== 0) return ldiff;
    return (b.boostedByProfile ? 1 : 0) - (a.boostedByProfile ? 1 : 0);
  });

  // Tip tekrarını temizle, maks 4 uyarı
  const seen = new Set<WarningType>();
  return results
    .filter((w) => {
      if (seen.has(w.type)) return false;
      seen.add(w.type);
      return true;
    })
    .slice(0, 4);
}

// ── Görsel yardımcılar (UI bileşenlerinde kullanılabilir) ──────────────────

export function warningLevelColor(level: WarningLevel): string {
  if (level === "sensitive") return "#b91c1c";
  if (level === "caution")   return "#d97706";
  return "#0369a1";
}

export function warningLevelIcon(level: WarningLevel): string {
  if (level === "sensitive") return "alert-triangle";
  if (level === "caution")   return "alert-circle";
  return "info";
}

export function warningLevelBg(level: WarningLevel): string {
  if (level === "sensitive") return "#fef2f2";
  if (level === "caution")   return "#fffbeb";
  return "#eff6ff";
}

export function warningLevelBorder(level: WarningLevel): string {
  if (level === "sensitive") return "#fca5a5";
  if (level === "caution")   return "#fde68a";
  return "#bfdbfe";
}
