/**
 * Skin Intelligence — Capture Guard
 * Layer 1: Fotoğraf kalite kontrolü ve analiz engelleme kuralları.
 * Güvenilmeyen kareler analiz motoruna ulaşamaz.
 */

import type { CaptureFrame, CaptureQuality } from "./types";

// ─── Kalite Eşikleri ─────────────────────────────────────────────────────────

const THRESHOLDS = {
  MIN_QUALITY_SCORE: 55,          // altındaki kare reddedilir
  MIN_FACE_SIZE_RATIO: 0.12,      // ekran alanının en az %12'si yüz olmalı
  MAX_BLUR_VARIANCE: 80,          // Laplacian varyansı — düşükse bulanık
  MIN_BRIGHTNESS: 40,             // ortalama piksel parlaklığı
  MAX_BRIGHTNESS: 210,
} as const;

// ─── Heuristic kalite skoru (kamera metadata'ya göre) ────────────────────────
/**
 * Expo Camera'nın takePictureAsync'ten dönen metadata kullanılarak
 * 0-100 arası bir kalite skoru hesaplanır.
 * Gerçek implementasyonda TFLite/Vision API entegrasyonu yapılabilir.
 */
export function scoreCapture(opts: {
  width: number;
  height: number;
  exifBrightness?: number;      // Expo EXIF'ten
  estimatedBlur?: number;       // 0=net, 100=çok bulanık
  faceAreaRatio?: number;       // yüzün kare içindeki alanı 0-1
}): CaptureQuality {
  const { width, height, exifBrightness, estimatedBlur, faceAreaRatio } = opts;

  let score = 100;
  let lighting: CaptureQuality["lighting"] = "ok";
  let blur: CaptureQuality["blur"] = "ok";
  let faceSize: CaptureQuality["faceSize"] = "ok";
  const issues: string[] = [];

  // Aydınlatma
  if (exifBrightness !== undefined) {
    if (exifBrightness < THRESHOLDS.MIN_BRIGHTNESS) {
      lighting = "dark";
      score -= 35;
      issues.push("Ortam çok karanlık");
    } else if (exifBrightness > THRESHOLDS.MAX_BRIGHTNESS) {
      lighting = "bright";
      score -= 20;
      issues.push("Aşırı parlak ışık");
    }
  }

  // Bulanıklık
  if (estimatedBlur !== undefined && estimatedBlur > 50) {
    blur = "blurry";
    score -= 30;
    issues.push("Görüntü bulanık — hareketsiz durun");
  }

  // Yüz boyutu
  if (faceAreaRatio !== undefined) {
    if (faceAreaRatio < THRESHOLDS.MIN_FACE_SIZE_RATIO) {
      faceSize = "too_small";
      score -= 25;
      issues.push("Yüz çok küçük — kameraya yaklaşın");
    } else if (faceAreaRatio > 0.7) {
      faceSize = "too_large";
      score -= 10;
      issues.push("Yüz çok yakın — biraz uzaklaşın");
    }
  }

  // Çözünürlük kontrolü
  if (width < 480 || height < 480) {
    score -= 20;
    issues.push("Çözünürlük düşük");
  }

  score = Math.max(0, Math.min(100, score));

  const confidence: CaptureQuality["confidence"] =
    score >= 80 ? "high" : score >= 60 ? "medium" : "low";

  const blockAnalysis = score < THRESHOLDS.MIN_QUALITY_SCORE || !!(faceAreaRatio && faceAreaRatio < 0.05);

  return {
    score,
    lighting,
    blur,
    faceDetected: !!(faceAreaRatio && faceAreaRatio > 0.05),
    faceSize,
    confidence,
    blockAnalysis,
    blockReason: blockAnalysis ? issues[0] : undefined,
  };
}

// ─── Paket kalite özeti ───────────────────────────────────────────────────────

export function evaluateScanPackage(frames: CaptureFrame[]): {
  overallScore: number;
  isReadyForAnalysis: boolean;
  blockedFrames: CaptureFrame[];
  warnings: string[];
} {
  if (frames.length === 0) {
    return { overallScore: 0, isReadyForAnalysis: false, blockedFrames: [], warnings: ["Kare yok"] };
  }

  const blockedFrames = frames.filter((f) => f.quality.blockAnalysis);
  const overallScore = Math.round(
    frames.reduce((s, f) => s + f.quality.score, 0) / frames.length
  );

  const warnings: string[] = [];
  if (overallScore < 60) warnings.push("Genel kalite düşük — daha iyi ışık önerilir");
  if (blockedFrames.length > 0)
    warnings.push(`${blockedFrames.length} kare yetersiz kalitede`);
  if (!frames.some((f) => f.angle === "front"))
    warnings.push("Ön açı zorunludur");

  const isReadyForAnalysis =
    overallScore >= THRESHOLDS.MIN_QUALITY_SCORE &&
    blockedFrames.length === 0 &&
    frames.some((f) => f.angle === "front");

  return { overallScore, isReadyForAnalysis, blockedFrames, warnings };
}

// ─── Güven tabanlı çıktı dili denetimi ──────────────────────────────────────
/**
 * Analiz güveni düşükse aktif içerik önerileri engellenir.
 * Çocuk/geçersiz fotoğraf senaryolarına karşı koruma.
 */
export function shouldDowngradeOutput(overallQuality: number): {
  downgrade: boolean;
  softLanguage: boolean;
  blockStrongActives: boolean;
} {
  if (overallQuality >= 75) {
    return { downgrade: false, softLanguage: false, blockStrongActives: false };
  } else if (overallQuality >= 55) {
    return { downgrade: true, softLanguage: true, blockStrongActives: false };
  } else {
    return { downgrade: true, softLanguage: true, blockStrongActives: true };
  }
}
