/**
 * routineTracking.ts
 * Rutin takip yardımcıları: uyum analizi, uyarı üretimi, adaptif mimari
 * Mesaj tonu: eczacı danışman dili — sakin, gerçekçi, aşırısız
 */

import type { DailyLog, ManualRoutine } from "./routineStore";

// ─── Uyum analizi ─────────────────────────────────────────────────────────────

export interface AdherenceResult {
  activeDays: number;
  totalDays: number;
  morningDays: number;
  eveningDays: number;
  score: number;
  label: string;
  statusMessage: string;
}

export function routineAdherenceTracker(logs: DailyLog[], days = 7): AdherenceResult {
  const activeDays   = logs.filter(l => l.morningDone || l.eveningDone).length;
  const morningDays  = logs.filter(l => l.morningDone).length;
  const eveningDays  = logs.filter(l => l.eveningDone).length;
  const score        = Math.round((activeDays / days) * 100);

  let label: string;
  if (score >= 85)      label = "Düzenli";
  else if (score >= 70) label = "İyi seyrediyor";
  else if (score >= 50) label = "Oturuyor";
  else if (score >= 30) label = "Değişken";
  else                  label = "Yeni başlangıç";

  let statusMessage: string;

  if (activeDays === 0) {
    statusMessage = "Bu hafta henüz bir rutin uygulanmamış. Bugün küçük bir adımla başlanabilir.";
  } else if (score >= 85) {
    statusMessage = "Bu hafta rutin istikrarlı bir şekilde uygulandı. Bu düzen ciltte karşılığını verir.";
  } else if (score >= 70) {
    statusMessage = "Bu haftaki düzen oldukça tutarlı. Cilt bakımı sabırla ilerler.";
  } else if (eveningDays < morningDays - 1) {
    statusMessage = "Akşam seansı bu hafta daha sık atlanmış. Sadeleştirmek sürekliliği kolaylaştırabilir.";
  } else if (score >= 50) {
    statusMessage = `Bu hafta ${activeDays} gün rutin uygulandı. Her gün kusursuz olmak gerekmez.`;
  } else if (score >= 30) {
    statusMessage = "Bu hafta düzen değişken kalmış. Bırakmamak, mükemmel gitmekten daha önemlidir.";
  } else {
    statusMessage = `Bu hafta ${activeDays} gün uygulama yapılmış. Yeniden başlamak için geç değil.`;
  }

  return { activeDays, totalDays: days, morningDays, eveningDays, score, label, statusMessage };
}

// ─── Uyarı üretici ───────────────────────────────────────────────────────────

export function routineWarningGenerator(logs: DailyLog[]): string[] {
  const warnings: string[] = [];
  const skipCounts      = logs.reduce((acc, l) => acc + l.skippedStepIds.length, 0);
  const completedCounts = logs.reduce((acc, l) => acc + l.completedStepIds.length, 0);
  const consecutiveEveningSkips = _consecutiveSlotSkips(logs, "evening");

  if (consecutiveEveningSkips >= 3) {
    warnings.push("Akşam seansı art arda atlanıyor. Rutini biraz sadeleştirmek uyumu artırabilir.");
  }
  if (skipCounts > completedCounts && logs.some(l => l.completedStepIds.length > 0)) {
    warnings.push("Atlanan adımlar tamamlananlardan fazla. Daha kısa bir rutin daha sürdürülebilir olabilir.");
  }

  return warnings;
}

function _consecutiveSlotSkips(logs: DailyLog[], slot: "morning" | "evening"): number {
  let count = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    const isDone = slot === "morning" ? log.morningDone : log.eveningDone;
    if (!isDone && (log.morningDone || log.eveningDone || log.completedStepIds.length > 0)) {
      count++;
    } else if (isDone) {
      break;
    }
  }
  return count;
}

// ─── Adaptif öneri (adaptive architecture) ────────────────────────────────────

export interface AdjustmentSuggestion {
  type: "simplify" | "soften" | "intensify" | "none";
  message: string;
}

export function routineAdjuster(logs: DailyLog[], routine: ManualRoutine): AdjustmentSuggestion {
  const adherence  = routineAdherenceTracker(logs);
  const totalSteps = routine.morning.length + routine.evening.length;

  if (adherence.score < 30 && totalSteps > 4) {
    return {
      type: "simplify",
      message: "Rutin biraz uzun olabilir. Daha az adımla başlamak sürekliliği kolaylaştırır.",
    };
  }
  if (adherence.score < 50) {
    return {
      type: "soften",
      message: "Sabah seansına odaklanmak, düzeni oturtmak için daha kolay bir başlangıç noktasıdır.",
    };
  }
  if (adherence.score >= 85) {
    return {
      type: "none",
      message: "Rutin yerli yerine oturmuş. İstersen ilerleyen dönemde yeni bir adım eklenebilir.",
    };
  }

  return { type: "none", message: "" };
}
