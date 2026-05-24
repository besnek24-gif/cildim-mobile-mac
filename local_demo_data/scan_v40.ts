import { type Concern } from "./products_v37";
import { type RoutineLevel, type SkinFeel } from "./analysis_v39";

export type ScanEntryMode = "Demo tarama" | "Fotoğraf seçimi" | "Manuel değerlendirme";
export type ScanQuality = "İyi" | "Orta" | "Yetersiz";

export type ScanPreviewV40 = {
  title: string;
  status: string;
  summary: string;
  checklist: string[];
  nextConcern: Concern;
  nextFeel: SkinFeel;
  nextLevel: RoutineLevel;
};

export const SCAN_ENTRY_MODES: ScanEntryMode[] = ["Demo tarama", "Fotoğraf seçimi", "Manuel değerlendirme"];
export const SCAN_QUALITY_LEVELS: ScanQuality[] = ["İyi", "Orta", "Yetersiz"];

export function buildScanPreviewV40(params: {
  mode: ScanEntryMode;
  quality: ScanQuality;
  concern: Concern;
  feel: SkinFeel;
  level: RoutineLevel;
}): ScanPreviewV40 {
  const status =
    params.quality === "İyi"
      ? "Görsel kalitesi demo akış için uygun görünüyor."
      : params.quality === "Orta"
        ? "Görsel kalitesi kabul edilebilir; sonuç dili temkinli tutulmalı."
        : "Görsel kalitesi düşük; kullanıcıya yeniden deneme veya manuel akış önerilmeli.";

  return {
    title: "Güvenli tarama önizlemesi",
    status,
    summary: "Bu sürüm gerçek görsel işleme yapmaz; tarama deneyiminin ekran akışını ve yönlendirme mantığını test eder.",
    checklist: [
      `Akış tipi: ${params.mode}`,
      `Kalite: ${params.quality}`,
      `Öncelikli endişe: ${params.concern}`,
      `Cilt hissi: ${params.feel}`,
      `Rutin seviyesi: ${params.level}`,
    ],
    nextConcern: params.concern,
    nextFeel: params.feel,
    nextLevel: params.level,
  };
}
