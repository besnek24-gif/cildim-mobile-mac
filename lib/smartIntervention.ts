/**
 * smartIntervention.ts
 * Rutin atlama, cilt kötüleşme ve bariyer zarar sinyallerini tespit eder
 * → Akıllı müdahale kartı için içerik üretir
 */

import type { SkinStateEntry } from "@/lib/retentionEngine";

export type InterventionType =
  | "simplify_routine"
  | "boost_hydration"
  | "reduce_actives"
  | "barrier_focus"
  | "consistent_reminder"
  | "none";

export interface SmartIntervention {
  type: Exclude<InterventionType, "none">;
  title: string;
  message: string;
  action: string;
  severity: "gentle" | "moderate";
  icon: string;  // Feather icon name
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 5;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

interface WeekLogLite {
  morningDone: boolean;
  eveningDone: boolean;
}

export function detectIntervention(
  skinLog: SkinStateEntry[],
  weekLogs: WeekLogLite[],
  adherenceScore: number,
): SmartIntervention | null {
  const recent = skinLog.slice(-3);
  const avgSensitivity = avg(recent.map(e => e.sensitivity));
  const avgAcne = avg(recent.map(e => e.acne));
  const avgHydration = avg(recent.map(e => e.hydration));

  const skippedDays = weekLogs.filter(d => !d.morningDone && !d.eveningDone).length;

  // Öncelik sırasına göre değerlendir
  if (avgSensitivity >= 8 && avgAcne >= 6) {
    return {
      type: "barrier_focus",
      title: "Bariyer onarımı öncelikli",
      message:
        "Son günlerde hassasiyet ve akne aynı anda yükseldi. Bariyer desteği odaklı ürünlerle rutini sakinleştirmeni öneriyoruz.",
      action: "Nasıl uygulayacağım?",
      severity: "moderate",
      icon: "shield",
    };
  }

  if (avgSensitivity >= 7) {
    return {
      type: "reduce_actives",
      title: "Aktif içerik yükünü azalt",
      message:
        "Son 3 günde hassasiyet artışı gözleniyor. Bu hafta aktif içerikli adımları geçici olarak azaltmayı dene.",
      action: "Rutini hafiflettim",
      severity: "gentle",
      icon: "feather",
    };
  }

  if (avgHydration <= 3) {
    return {
      type: "boost_hydration",
      title: "Nem takviyesi gerekiyor",
      message:
        "Cilt nem seviyesi düşük seyrediyor. Akşam rutinine yoğun nem adımı eklenmesini öneriyoruz.",
      action: "Anlıyorum",
      severity: "gentle",
      icon: "droplet",
    };
  }

  if (skippedDays >= 3 && adherenceScore < 50) {
    return {
      type: "simplify_routine",
      title: "Rutin sadeleştirme zamanı olabilir",
      message: `Bu hafta ${skippedDays} gün rutin atlandı. Daha kısa ama tutarlı bir rutin, uzun ama atlanan birinden daha etkili.`,
      action: "Rutini düzenle",
      severity: "gentle",
      icon: "layers",
    };
  }

  if (adherenceScore < 35) {
    return {
      type: "consistent_reminder",
      title: "Düzenlilik en güçlü etken",
      message:
        "Bağlılık skoru düşük. Kısa ama sürekli bir rutin cilt dengesini haftalarca daha stabil tutar.",
      action: "Anlıyorum",
      severity: "gentle",
      icon: "repeat",
    };
  }

  return null;
}

/** "Gizli İçgörü" metni için cilt log analizi */
export function buildHiddenInsight(
  skinLog: SkinStateEntry[],
  adherenceScore: number,
): string | null {
  if (skinLog.length < 3) return null;

  const recent = skinLog.slice(-5);
  const avgSensitivity = avg(recent.map(e => e.sensitivity));
  const avgHydration = avg(recent.map(e => e.hydration));
  const avgAcne = avg(recent.map(e => e.acne));

  if (avgSensitivity >= 6.5) {
    return "Son günlerde cilt bariyerin normalden daha hassas bir seyir gösteriyor. Bu genellikle stres, iklim değişikliği veya aşırı aktif içerik yükünün sinyali.";
  }

  if (avgHydration <= 4.5) {
    return "Nem profilinde düşme tespit edildi. Cilt nemini koruyamazsa bariyeri zayıflar — bunu erken fark etmek önemli.";
  }

  if (avgAcne >= 6) {
    return "Akne aktivitesi yükseliyor. Bunu erken okuyabilmek olası bir kötüleşmeyi önleyebilir — rutin yükünü değerlendirmek gerekebilir.";
  }

  if (adherenceScore >= 80) {
    return "Düzenli rutin bağlılığın cilt dengesine yansıyor. Bu hafta tutarlı bir tablo görünüyor.";
  }

  return null;
}
