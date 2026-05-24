/**
 * weeklyEvaluationEngine.ts
 * Seçkin kullanıcı için haftalık cilt değerlendirmesi üretir.
 *
 * Ton: eczacı sesi — gözlemler, nazikçe yönlendirir, kısa konuşur.
 */

import type { SkinStateEntry } from "@/lib/retentionEngine";

export type WeekTrend = "improving" | "stable" | "declining";

export interface WeeklyEvaluation {
  title: string;
  summary: string;
  bullets: string[];
  suggestion: string;
  warning: string | null;
  adherenceScore: number;
  trend: WeekTrend;
  trendLabel: string;
  trendColor: string;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 5;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function overallScore(e: SkinStateEntry): number {
  return (10 - avg([e.sensitivity, e.acne]) + e.hydration + (10 - e.oiliness)) / 3;
}

export function generateWeeklyEvaluation(
  skinLog: SkinStateEntry[],
  adherenceScore: number,
  activeDays: number,
): WeeklyEvaluation {
  const adherenceLabel =
    adherenceScore >= 80 ? "çok iyi"
    : adherenceScore >= 60 ? "iyi"
    : adherenceScore >= 40 ? "orta"
    : "düşük";

  // Trend hesapla
  let trend: WeekTrend = "stable";
  let trendLabel = "Dengede";
  let trendColor = "#D97706";

  if (skinLog.length >= 3) {
    const firstHalf = skinLog.slice(0, Math.floor(skinLog.length / 2));
    const secondHalf = skinLog.slice(Math.floor(skinLog.length / 2));
    const firstAvg = avg(firstHalf.map(overallScore));
    const secondAvg = avg(secondHalf.map(overallScore));

    if (secondAvg > firstAvg + 0.8) {
      trend = "improving";
      trendLabel = "İyileşiyor";
      trendColor = "#059669";
    } else if (secondAvg < firstAvg - 0.8) {
      trend = "declining";
      trendLabel = "Dikkat gerektiriyor";
      trendColor = "#DC2626";
    }
  }

  const recent = skinLog.slice(-3);
  const avgSensitivity = avg(recent.map(e => e.sensitivity));
  const avgAcne        = avg(recent.map(e => e.acne));
  const avgHydration   = avg(recent.map(e => e.hydration));
  const avgOverall     = avg(recent.map(e => e.overall));

  // ── Maddeler (eczacı sesi) ────────────────────────────────────────────────
  const bullets: string[] = [];

  if (activeDays >= 5) {
    bullets.push(`${activeDays} gündür rutin düzenli gidiyor, bağlılık ${adherenceLabel}.`);
  } else if (activeDays >= 3) {
    bullets.push(`Bu hafta ${activeDays} gün aktif bakım var.`);
  } else if (activeDays > 0) {
    bullets.push(`${activeDays} gün iyi bir başlangıç. Biraz daha sürekliliğe yer var.`);
  } else {
    bullets.push("Bu hafta kayıt yok. Küçük bir adımla başlanabilir.");
  }

  if (skinLog.length >= 2) {
    if (avgHydration >= 7)
      bullets.push("Nem dengesi iyi seyrediyor.");
    else if (avgHydration <= 4)
      bullets.push("Nem seviyeleri biraz düşük görünüyor.");

    if (avgSensitivity >= 7)
      bullets.push("Hassasiyet biraz artmış, nazik ürünler daha uygun olabilir.");
    else if (avgSensitivity <= 3)
      bullets.push("Hassasiyet dengede, cilt sakin görünüyor.");

    if (avgAcne >= 6)
      bullets.push("Akne belirtileri var, takip devam etsin.");
    else if (avgAcne <= 2)
      bullets.push("Akne belirtileri minimal seviyede.");
  } else {
    bullets.push("Daha iyi görüş için cilt takibini sürdürmek yeterli olur.");
  }

  // ── Öneri (eczacı sesi — max 2 cümle) ────────────────────────────────────
  let suggestion =
    "Sabah rutininde nem adımını atlamasan iyi olur. Kümülatif etkisi var.";

  if (avgSensitivity >= 7) {
    suggestion =
      "Hassasiyet artmış. Bu hafta sade ve yumuşatıcı ürünlere yönelmek daha iyi olabilir.";
  } else if (avgHydration <= 4) {
    suggestion =
      "Nem seviyeleri düşük görünüyor. Akşam rutinine hafif bir nem katmanı eklemek işe yarar.";
  } else if (adherenceScore < 50) {
    suggestion =
      "Son günler aksadı. Küçük başlayalım, devamı gelir.";
  } else if (avgOverall >= 4) {
    suggestion =
      "Genel tablo iyi gidiyor. Mevcut rutini sürdürmek en doğrusu.";
  }

  // ── Uyarı ─────────────────────────────────────────────────────────────────
  let warning: string | null = null;
  if (avgSensitivity >= 8 && avgAcne >= 6) {
    warning =
      "Hassasiyet ve akne aynı anda artmış. Şimdilik aktif içerikleri biraz geri çekmek faydalı olabilir.";
  }

  return {
    title: "Bu Hafta Cildin",
    summary: `Bu hafta rutin bağlılığı ${adherenceLabel}. Tablo ${trendLabel.toLowerCase()} gidiyor.`,
    bullets: bullets.slice(0, 3),
    suggestion,
    warning,
    adherenceScore,
    trend,
    trendLabel,
    trendColor,
  };
}
