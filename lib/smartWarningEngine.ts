/**
 * smartWarningEngine.ts
 * Cilt bakımı akıllı uyarı motoru — modüler ve yeniden kullanılabilir
 *
 * Kaynak: concern akış profili, rutin yapısı, ürün verileri, kullanıcı güvenlik profili
 */

import type { RoutineProfile, Routine } from "./concernRoutineBridge";
import type { ManualRoutine } from "./routineStore";
import type { DailyLog } from "./routineStore";

// ─── Tip sistemi ──────────────────────────────────────────────────────────────

export type WarningType =
  | "sensitivity"
  | "barrier"
  | "active_overload"
  | "combination"
  | "beginner"
  | "pregnancy"
  | "allergy";

export interface SmartWarning {
  id:            string;
  type:          WarningType;
  severity:      "low" | "medium" | "high";
  title:         string;
  message:       string;
  premiumDetail?: string;
  relatedSteps?: string[];
  premiumOnly?:  boolean;
}

// ─── Kullanıcı güvenlik profili (mimari hazır) ────────────────────────────────

export interface UserSafetyProfile {
  isPregnant?:         boolean;
  isBreastfeeding?:    boolean;
  allergyFlags?:       string[];
  avoidedIngredients?: string[];
  isBeginner?:         boolean;
  highSensitivity?:    boolean;
}

// ─── Varsayılan boş güvenlik profili ─────────────────────────────────────────

export const DEFAULT_USER_SAFETY: UserSafetyProfile = {
  isPregnant:         false,
  isBreastfeeding:    false,
  allergyFlags:       [],
  avoidedIngredients: [],
  isBeginner:         false,
  highSensitivity:    false,
};

// In-memory kullanıcı güvenlik profili deposu
let _userSafety: UserSafetyProfile = { ...DEFAULT_USER_SAFETY };
export function getUserSafetyProfile(): UserSafetyProfile { return _userSafety; }
export function setUserSafetyProfile(p: Partial<UserSafetyProfile>): void {
  _userSafety = { ..._userSafety, ...p };
}

// ─── 1. Concern profil uyarıları ─────────────────────────────────────────────

export function generateWarningsFromConcernProfile(
  rp: RoutineProfile,
  userProfile: UserSafetyProfile = _userSafety,
): SmartWarning[] {
  const warnings: SmartWarning[] = [];

  // Hassasiyet uyarısı
  if (rp.sensitivityLevel === "high" || userProfile.highSensitivity) {
    warnings.push({
      id:           "sens-high",
      type:         "sensitivity",
      severity:     "high",
      title:        "Hassas cilt yaklaşımı",
      message:      "Bu cilt yapısında aktif içeriklerin miktarı ve sıklığı dikkatlice ayarlanmalı.",
      premiumDetail:"Hassasiyet öne çıktığı için rutin daha sade tutuldu; güçlü aktifler minimize edildi.",
    });
  } else if (rp.sensitivityLevel === "medium") {
    warnings.push({
      id:       "sens-med",
      type:     "sensitivity",
      severity: "low",
      title:    "Nazik ilerlemek daha uygun",
      message:  "Orta hassasiyette ciltte yeni ürünleri birer birer eklemek daha güvenli sonuç verir.",
    });
  }

  // Bariyer uyarısı
  if (rp.barrierStatus === "weak") {
    warnings.push({
      id:           "barrier-weak",
      type:         "barrier",
      severity:     "high",
      title:        "Bariyer desteği öne çıkıyor",
      message:      "Bariyer hassassa daha sade bir rutin daha uygun olabilir. Onarım adımları öncelikli tutuldu.",
      premiumDetail:"Bariyer zayıflığı nedeniyle agresif aktifler kaldırıldı; seramid ve peptit önceliği verildi.",
    });
  } else if (rp.barrierStatus === "partial") {
    warnings.push({
      id:       "barrier-partial",
      type:     "barrier",
      severity: "low",
      title:    "Bariyer dengeyi koruma",
      message:  "Bariyer kısmen hassas görünüyor. Aşırı temizleme ve asit içerikleri minimumda tutulmalı.",
    });
  }

  // Aktif içerik toleransı
  if (rp.activeTolerance === "low") {
    warnings.push({
      id:           "active-low",
      type:         "active_overload",
      severity:     "medium",
      title:        "Aktif içerikte kademeli yaklaşım",
      message:      "Bu cilt yapısında fazla aktif içerik tahrişi artırabilir. Tek seferde birden fazla güçlü aktif önerilmez.",
      premiumDetail:"Aktif tolerans düşük olduğu için serum adımı sadeleştirildi; retinol veya AHA/BHA birlikte kullanılmadı.",
    });
  }

  // Koruma ihtiyacı (leke / güneş odağı)
  if (rp.protectionNeed === "high" && rp.concern !== "sun") {
    warnings.push({
      id:       "protection-high",
      type:     "combination",
      severity: "medium",
      title:    "Koruma adımı kritik",
      message:  "Leke eğilimi olan ciltte güneş koruyucu olmadan toparlanma süreci uzar. Sabah koruması önceliklidir.",
    });
  }

  // Concern bazlı özel uyarılar
  if (rp.concern === "acne" && rp.sensitivityLevel === "high") {
    warnings.push({
      id:           "acne-sens",
      type:         "combination",
      severity:     "high",
      title:        "Bu kombinasyonda dikkat",
      message:      "Akne odaklı aktifler hassas ciltte agresif gelebilir. Düşük konsantrasyonlu ürünler tercih edilmeli.",
      premiumDetail:"Akne + yüksek hassasiyet birlikte değerlendirildi; salisilik asit ve retinol aynı akşamda önerilmedi.",
    });
  }

  if (rp.concern === "dryness" && rp.barrierStatus === "weak") {
    warnings.push({
      id:       "dry-barrier",
      type:     "barrier",
      severity: "medium",
      title:    "Önce onarım, sonra nem",
      message:  "Bariyer zayıfken yoğun nem öncesi onarım adımı uygulamak daha kalıcı sonuç sağlar.",
    });
  }

  if (rp.concern === "dark_spots" && rp.protectionNeed !== "high") {
    warnings.push({
      id:       "spots-spf",
      type:     "combination",
      severity: "medium",
      title:    "Koruma olmadan ilerleme yavaşlar",
      message:  "Koruma adımı olmadan leke görünümünü toparlamak zorlaşabilir. Sabah SPF rutinin bir parçası olmalı.",
    });
  }

  if (rp.concern === "hair_loss") {
    warnings.push({
      id:       "hair-patience",
      type:     "beginner",
      severity: "low",
      title:    "Sabır gerektiren bir süreç",
      message:  "Saç dökülmesinde bakım sonuçları genellikle 2–3 ay içinde belirginleşir. Düzenli ve tutarlı uygulamak kritik.",
    });
  }

  // Hamilelik / emzirme (mimari hazır)
  if (userProfile.isPregnant || userProfile.isBreastfeeding) {
    warnings.push({
      id:       "pregnancy-caution",
      type:     "pregnancy",
      severity: "medium",
      title:    "Bu dönemde dikkatli seçim",
      message:  "Bu dönemde bazı içerikler için daha dikkatli seçim gerekebilir. Retinol ve yüksek doz AHA içeriklerinde uzman görüşü alınması önerilir.",
    });
  }

  return warnings;
}

// ─── 2. Rutin yapısından uyarılar ─────────────────────────────────────────────

export function generateWarningsFromRoutine(
  routine: Routine | ManualRoutine,
  rp?: RoutineProfile,
): SmartWarning[] {
  const warnings: SmartWarning[] = [];

  const morningSteps = routine.morning;
  const eveningSteps = routine.evening;
  const totalSteps   = morningSteps.length + eveningSteps.length;

  // Çok uzun rutin uyarısı
  if (totalSteps > 8) {
    warnings.push({
      id:           "routine-long",
      type:         "beginner",
      severity:     "medium",
      title:        "Rutin biraz yoğun görünüyor",
      message:      "Cildin şu an daha sade bir rutine daha uygun görünüyor. Önce 3–4 temel adımla ilerlemek daha akıllıca olabilir.",
      premiumDetail:"Uzun rutinler uyumsuzluk riskini artırır. Önce çekirdek adımlarla düzenli bir alışkanlık kurmak önerilir.",
    });
  }

  // Akşam çok fazla aktif (isimlere göre basit tahmin)
  const activeKeywords = ["retinol", "aha", "bha", "asit", "acid", "niasinamid", "benzoyl", "salicyl", "glycol"];
  const eveningActiveCount = eveningSteps.filter(s => {
    const label = ("label" in s ? s.label : s.category ?? "").toLowerCase();
    return activeKeywords.some(k => label.includes(k));
  }).length;

  if (eveningActiveCount >= 2) {
    warnings.push({
      id:           "active-stack",
      type:         "active_overload",
      severity:     "high",
      title:        "Akşam rutin yoğunluğu",
      message:      "Bu içerik birlikte kullanımda cildi yorabilir. Güçlü aktifler farklı gecelere bölünebilir.",
      premiumDetail:"Aktif üst üste bindirmesi (layering) hassasiyeti artırabilir; AHA ve retinol aynı akşamda kullanılmamalı.",
    });
  }

  // Sabahta SPF yok ama leke/güneş endişesi var
  if (rp && rp.protectionNeed === "high") {
    const hasSPF = morningSteps.some(s => {
      const label = ("label" in s ? s.label : s.category ?? "").toLowerCase();
      return label.includes("güneş") || label.includes("spf") || label.includes("sunscreen") || label.includes("koruyucu");
    });
    if (!hasSPF && morningSteps.length > 0) {
      warnings.push({
        id:       "no-spf-morning",
        type:     "combination",
        severity: "high",
        title:    "Sabah koruma adımı eksik",
        message:  "Koruma adımı olmadan leke görünümünü toparlamak zorlaşabilir. Güneş koruyucu sabah rutininin son adımı olmalı.",
      });
    }
  }

  // Sensitif cilt + çok adım
  if (rp && rp.sensitivityLevel === "high" && morningSteps.length > 4) {
    warnings.push({
      id:       "sens-overload",
      type:     "sensitivity",
      severity: "medium",
      title:    "Hassas cilt için sadeleştir",
      message:  "Hassas ciltte çok fazla ürün katmanı tahriş riskini artırabilir. Sabah rutini 3–4 adımda tutulabilir.",
    });
  }

  return warnings;
}

// ─── 3. Ürün verilerinden uyarılar ────────────────────────────────────────────

export function generateWarningsFromProducts(
  products: Array<{ name?: string; isim?: string; ingredients?: string; icerik?: string; category?: string; category_tr?: string }>,
  rp: RoutineProfile,
  userProfile: UserSafetyProfile = _userSafety,
): SmartWarning[] {
  const warnings: SmartWarning[] = [];
  const allIngredients = products.map(p => (p.ingredients ?? p.icerik ?? "").toLowerCase()).join(",");

  // Hassas profil + güçlü aktifler
  const aggressiveActives = ["retinol", "retinoid", "aha", "glycolic acid", "lactic acid", "salicylic", "benzoyl peroxide"];
  const foundActives = aggressiveActives.filter(a => allIngredients.includes(a));

  if (rp.sensitivityLevel === "high" && foundActives.length >= 2) {
    warnings.push({
      id:       "product-active-sens",
      type:     "active_overload",
      severity: "high",
      title:    "Aktif içerik yoğunluğu",
      message:  "Bu seçim hassasiyet riskini artırabilir. Seçilen ürünlerde birden fazla güçlü aktif içerik var.",
    });
  }

  // Bariyer zayıf + alkol yüksek
  if (rp.barrierStatus === "weak" && allIngredients.includes("alcohol denat")) {
    warnings.push({
      id:       "barrier-alcohol",
      type:     "barrier",
      severity: "medium",
      title:    "Bariyer hassasında dikkat",
      message:  "Zayıf bariyerde denatüre alkol içeren ürünler kuruluğu artırabilir. Alkol içermeyen alternatifler değerlendirilebilir.",
    });
  }

  // Kaçınılması gereken içeriklerle kesişim (kullanıcı güvenlik profili)
  if (userProfile.avoidedIngredients?.length) {
    const conflicts = userProfile.avoidedIngredients.filter(ing => allIngredients.includes(ing.toLowerCase()));
    if (conflicts.length > 0) {
      warnings.push({
        id:       "allergy-conflict",
        type:     "allergy",
        severity: "high",
        title:    "İçerik uyum notu",
        message:  `Seçtiğin hassasiyet tercihleriyle bu içerik tam uyumlu görünmeyebilir: ${conflicts.slice(0, 2).join(", ")}.`,
      });
    }
  }

  return warnings;
}

// ─── 4. Birleştir ve önceliklendir ───────────────────────────────────────────

export function mergeAndPrioritizeWarnings(
  warningGroups: SmartWarning[][],
  options?: { maxTotal?: number; suppressTypes?: WarningType[] },
): SmartWarning[] {
  const max       = options?.maxTotal ?? 99;
  const suppress  = options?.suppressTypes ?? [];
  const seen      = new Set<string>();
  const merged: SmartWarning[] = [];

  const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const all = warningGroups.flat().sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  for (const w of all) {
    if (seen.has(w.id)) continue;
    if (suppress.includes(w.type)) continue;
    seen.add(w.id);
    merged.push(w);
    if (merged.length >= max) break;
  }

  return merged;
}

// ─── 5. Takip bazlı uyarı güncelleme (adaptive hook) ─────────────────────────

export function updateWarningsFromTracking(
  existing: SmartWarning[],
  logs: DailyLog[],
): SmartWarning[] {
  const skips = logs.reduce((acc, l) => acc + l.skippedStepIds.length, 0);
  const active = logs.filter(l => l.morningDone || l.eveningDone).length;
  const additionalWarnings: SmartWarning[] = [];

  if (active === 0 && logs.length >= 3) {
    additionalWarnings.push({
      id:       "tracking-no-start",
      type:     "beginner",
      severity: "low",
      title:    "Başlamak için iyi zaman",
      message:  "Rutin henüz uygulanmamış. Küçük adımlarla başlamak uzun vadede daha iyi sonuç verir.",
    });
  }

  if (skips > active + 2) {
    additionalWarnings.push({
      id:       "tracking-too-demanding",
      type:     "beginner",
      severity: "medium",
      title:    "Rutin sadeleştirilebilir",
      message:  "Çok sık atlanan adımlar var. Rutin biraz yoğun olabilir — temel adımlara odaklanmak uyum artırabilir.",
    });
  }

  return mergeAndPrioritizeWarnings([existing, additionalWarnings]);
}

// ─── 6. Rutin uyarlama (adaptive hook) ───────────────────────────────────────

export function adjustRoutineFromWarnings(
  routine: Routine,
  warnings: SmartWarning[],
): Routine {
  const hasActiveOverload = warnings.some(w => w.type === "active_overload" && w.severity === "high");
  const hasBarrierWeak    = warnings.some(w => w.type === "barrier" && w.severity === "high");
  const hasTooLong        = warnings.some(w => w.id === "routine-long");

  let morning = [...routine.morning];
  let evening = [...routine.evening];

  if (hasActiveOverload) {
    // Akşamdan ikinci aktif adımı çıkar
    const activeKeywords = ["treatment", "retinol", "acid", "exfoliant"];
    let removedActive = false;
    evening = evening.filter(s => {
      if (!removedActive && activeKeywords.some(k => (s.category ?? s.slot ?? "").toLowerCase().includes(k))) {
        removedActive = true;
        return false;
      }
      return true;
    });
  }

  if (hasBarrierWeak) {
    // Sabahtan güçlü aktif çıkar (bariyer zayıfken)
    const harshKeywords = ["treatment", "acid", "exfoliant", "aha", "bha"];
    morning = morning.filter(s => !harshKeywords.some(k => (s.category ?? "").toLowerCase().includes(k)));
  }

  if (hasTooLong && morning.length > 4) {
    morning = morning.slice(0, 4);
  }
  if (hasTooLong && evening.length > 4) {
    evening = evening.slice(0, 4);
  }

  return { ...routine, morning, evening };
}

// ─── 7. Uyarı derecesi helper'ları ───────────────────────────────────────────

export function getHighestSeverity(warnings: SmartWarning[]): "low" | "medium" | "high" | null {
  if (warnings.some(w => w.severity === "high"))   return "high";
  if (warnings.some(w => w.severity === "medium")) return "medium";
  if (warnings.some(w => w.severity === "low"))    return "low";
  return null;
}

export function filterByMinSeverity(
  warnings: SmartWarning[],
  min: "low" | "medium" | "high",
): SmartWarning[] {
  const sevOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  return warnings.filter(w => sevOrder[w.severity] >= sevOrder[min]);
}
