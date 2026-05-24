/**
 * premium-skin-scan-v2 — qualityGate
 *
 * Gerçek piksel-bazlı parlaklık (luminance) + sharpness (Laplacian variance) kapısı.
 * - expo-image-manipulator → 64px JPEG + base64
 * - jpeg-js → RGBA decode
 * - Y = 0.299R + 0.587G + 0.114B (Rec. 601)
 *
 * Kullanım:
 *   - analyzePhotoBrightness(uri)         → legacy, sadece brightness (geriye dönük)
 *   - analyzePhotoFull(uri, angle, opts)  → ECZ-CAP-1 additive: brightness + sharpness
 *                                            + pose + face stub + composite qualityScore
 *
 * NOT: Face detection için yüklü kütüphane YOK; faceDetected/faceCount undefined döner
 *      ve warnings'e "face_detection_unavailable" eklenir.
 */

import * as ImageManipulator from "expo-image-manipulator";
import { decode as decodeJpeg } from "jpeg-js";

import type { QualityLabel } from "./captureStore";

// ─── Eşikler ──────────────────────────────────────────────────────────────────

const MIN_BRIGHTNESS = 70;   // 0-255 arası
const MAX_BRIGHTNESS = 235;
const RESIZE_WIDTH   = 64;

// Sharpness (Laplacian variance) eşikleri — empirik
// Düşük variance = blurry; yüksek = keskin.
const SHARPNESS_FAILED_BELOW = 30;
const SHARPNESS_POOR_BELOW   = 80;
const SHARPNESS_FAIR_BELOW   = 200;
// 200+ → good

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface BrightnessResult {
  ok:         boolean;
  brightness: number;       // 0-255 ortalama Y
  reason?:    string;
}

export interface FullPhotoQuality {
  qualityScore:     number;        // 0-100 composite
  qualityLabel:     QualityLabel;
  brightnessScore:  number;        // 0-100 normalize edilmiş
  brightnessRaw:    number;        // 0-255 ortalama Y
  sharpnessScore?:  number;        // 0-100 (varsa)
  sharpnessRaw?:    number;        // ham Laplacian variance
  faceDetected?:    boolean;       // bilinmiyorsa undefined
  faceCount?:       number;        // bilinmiyorsa undefined
  poseAngleOk?:     boolean;       // çağıran sağlarsa
  warnings:         string[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const _brightCache = new Map<string, BrightnessResult>();
const _fullCache   = new Map<string, FullPhotoQuality>();
const _hashCache   = new Map<string, string>();

/** Manuel cache temizleme — debug/test için. */
export function clearBrightnessCache(): void {
  _brightCache.clear();
  _fullCache.clear();
  _hashCache.clear();
}

// ─── base64 → Uint8Array ──────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const len    = binary.length;
  const bytes  = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Decode helper ────────────────────────────────────────────────────────────

interface DecodedImage {
  data:   Uint8Array;
  width:  number;
  height: number;
}

async function decodeAt64(uri: string): Promise<DecodedImage | null> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: RESIZE_WIDTH } }],
    {
      base64:   true,
      compress: 0.6,
      format:   ImageManipulator.SaveFormat.JPEG,
    },
  );
  if (!resized.base64) return null;
  const bytes = base64ToBytes(resized.base64);
  const raw   = decodeJpeg(bytes, { useTArray: true });
  return { data: raw.data, width: raw.width, height: raw.height };
}

// ─── Brightness (legacy public — değişmez davranış) ──────────────────────────

export async function analyzePhotoBrightness(
  uri: string,
): Promise<BrightnessResult> {
  if (!uri) {
    return { ok: false, brightness: 0, reason: "Fotoğraf bulunamadı." };
  }
  const cached = _brightCache.get(uri);
  if (cached) return cached;

  try {
    const img = await decodeAt64(uri);
    if (!img) {
      const r: BrightnessResult = {
        ok: false,
        brightness: 0,
        reason: "Fotoğraf işlenemedi. Tekrar çekin.",
      };
      _brightCache.set(uri, r);
      return r;
    }

    const brightness = computeMeanLuminance(img.data);

    let result: BrightnessResult;
    if (brightness < MIN_BRIGHTNESS) {
      result = {
        ok: false,
        brightness,
        reason: "Fotoğraf çok karanlık. Daha iyi ışıkta tekrar çekin.",
      };
    } else if (brightness > MAX_BRIGHTNESS) {
      result = {
        ok: false,
        brightness,
        reason: "Fotoğraf fazla parlak. Yüzünüzü daha dengeli ışıkta tekrar çekin.",
      };
    } else {
      result = { ok: true, brightness };
    }

    _brightCache.set(uri, result);
    return result;
  } catch {
    const r: BrightnessResult = {
      ok: false,
      brightness: 0,
      reason: "Fotoğraf doğrulanamadı. Tekrar çekin.",
    };
    _brightCache.set(uri, r);
    return r;
  }
}

export async function analyzePhotosBrightness(
  uris: string[],
): Promise<BrightnessResult[]> {
  return Promise.all(uris.map((u) => analyzePhotoBrightness(u)));
}

// ─── Iç hesap yardımcıları ────────────────────────────────────────────────────

function computeMeanLuminance(data: Uint8Array): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** RGBA → grayscale (Float32) — Laplacian için */
function toGray(data: Uint8Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/**
 * 4-komşu Laplacian'ın variance'ı.
 * Yüksek variance = keskin kenarlar var = net foto.
 * Düşük variance  = düz/bulanık.
 */
function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  const lap: number[] = [];
  let sum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - w] +
        gray[i + w];
      lap.push(v);
      sum += v;
    }
  }
  if (lap.length === 0) return 0;
  const mean = sum / lap.length;
  let varSum = 0;
  for (let k = 0; k < lap.length; k++) {
    const d = lap[k] - mean;
    varSum += d * d;
  }
  return varSum / lap.length;
}

/** brightness 0-255 → 0-100 (ideal aralık 110-200, kenarlara doğru ceza) */
function brightnessTo100(b: number): number {
  if (b <= 0) return 0;
  if (b >= 255) return 0;
  // Trapezoid: 110-200 = 100; doğrusal düşüş 70-110 ve 200-235.
  if (b >= 110 && b <= 200) return 100;
  if (b > 200 && b < 235) return Math.round(((235 - b) / 35) * 100);
  if (b > 70 && b < 110)  return Math.round(((b - 70) / 40) * 100);
  return 0; // <70 veya >235 → çok karanlık/parlak
}

/** Laplacian variance → 0-100 (eşiklere göre) */
function sharpnessTo100(v: number): number {
  if (v <= 0) return 0;
  // <30 failed (0-25 puan), 30-80 poor (25-50), 80-200 fair (50-80), 200+ good (80-100)
  if (v < SHARPNESS_FAILED_BELOW) return Math.round((v / SHARPNESS_FAILED_BELOW) * 25);
  if (v < SHARPNESS_POOR_BELOW)
    return 25 + Math.round(((v - SHARPNESS_FAILED_BELOW) /
      (SHARPNESS_POOR_BELOW - SHARPNESS_FAILED_BELOW)) * 25);
  if (v < SHARPNESS_FAIR_BELOW)
    return 50 + Math.round(((v - SHARPNESS_POOR_BELOW) /
      (SHARPNESS_FAIR_BELOW - SHARPNESS_POOR_BELOW)) * 30);
  // 200..1000+ → 80..100 yumuşak doygunluk
  return Math.min(100, 80 + Math.round(((v - SHARPNESS_FAIR_BELOW) / 800) * 20));
}

function scoreToLabel(score: number, hardFail: boolean): QualityLabel {
  if (hardFail) return "failed";
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  if (score >= 35) return "poor";
  return "failed";
}

// ─── ECZ-CAP-1: Tam analiz ────────────────────────────────────────────────────

export interface AnalyzeFullOpts {
  /** Çekim anındaki gyroscope-stable bayrağı (varsa). */
  gyroStable?: boolean;
}

/**
 * Bir fotoğraftan brightness + sharpness + composite qualityScore üretir.
 * Face detection kütüphanesi yüklü değil → faceDetected/faceCount undefined,
 * warnings'e "face_detection_unavailable" eklenir.
 */
export async function analyzePhotoFull(
  uri: string,
  _expectedAngle?: string,
  opts?: AnalyzeFullOpts,
): Promise<FullPhotoQuality> {
  const cacheKey = `${uri}|${opts?.gyroStable === undefined ? "?" : opts?.gyroStable ? "1" : "0"}`;
  const cached = _fullCache.get(cacheKey);
  if (cached) return cached;

  const warnings: string[] = [];
  warnings.push("face_detection_unavailable");

  if (!uri) {
    const r: FullPhotoQuality = {
      qualityScore: 0,
      qualityLabel: "failed",
      brightnessScore: 0,
      brightnessRaw: 0,
      warnings: [...warnings, "no_uri"],
    };
    return r;
  }

  try {
    const img = await decodeAt64(uri);
    if (!img) {
      const r: FullPhotoQuality = {
        qualityScore: 0,
        qualityLabel: "failed",
        brightnessScore: 0,
        brightnessRaw: 0,
        warnings: [...warnings, "decode_failed"],
      };
      _fullCache.set(cacheKey, r);
      return r;
    }

    // Brightness
    const brightnessRaw   = computeMeanLuminance(img.data);
    const brightnessScore = brightnessTo100(brightnessRaw);
    if (brightnessRaw < MIN_BRIGHTNESS) warnings.push("too_dark");
    else if (brightnessRaw > MAX_BRIGHTNESS) warnings.push("too_bright");

    // Sharpness
    let sharpnessScore: number | undefined;
    let sharpnessRaw:   number | undefined;
    try {
      const gray = toGray(img.data, img.width, img.height);
      sharpnessRaw   = laplacianVariance(gray, img.width, img.height);
      sharpnessScore = sharpnessTo100(sharpnessRaw);
      if (sharpnessRaw < SHARPNESS_POOR_BELOW) warnings.push("possibly_blurry");
    } catch {
      warnings.push("sharpness_unavailable");
    }

    // Pose (caller-provided; piksel okumadan)
    const poseAngleOk = opts?.gyroStable;
    if (poseAngleOk === false) warnings.push("pose_unstable");

    // Composite — sharpness varsa ağırlıklı; yoksa "no silent optimism" (penalty)
    let qualityScore: number;
    if (sharpnessScore !== undefined) {
      qualityScore = Math.round(0.4 * brightnessScore + 0.6 * sharpnessScore);
    } else {
      // Eksik metrik → en fazla "fair" çıkabilsin diye 70 ile clamp
      qualityScore = Math.min(70, Math.round(brightnessScore * 0.7));
    }
    if (poseAngleOk === false) qualityScore = Math.max(0, qualityScore - 15);

    // Hard-fail koşulları → label "failed"
    const hardFail =
      brightnessRaw < MIN_BRIGHTNESS ||
      brightnessRaw > MAX_BRIGHTNESS ||
      (sharpnessRaw !== undefined && sharpnessRaw < SHARPNESS_FAILED_BELOW);

    const qualityLabel = scoreToLabel(qualityScore, hardFail);

    const result: FullPhotoQuality = {
      qualityScore,
      qualityLabel,
      brightnessScore,
      brightnessRaw,
      sharpnessScore,
      sharpnessRaw,
      faceDetected: undefined,
      faceCount:    undefined,
      poseAngleOk,
      warnings,
    };
    _fullCache.set(cacheKey, result);
    return result;
  } catch {
    const r: FullPhotoQuality = {
      qualityScore: 0,
      qualityLabel: "failed",
      brightnessScore: 0,
      brightnessRaw: 0,
      warnings: [...warnings, "exception"],
    };
    _fullCache.set(cacheKey, r);
    return r;
  }
}

// ─── ECZ-FINAL-QA-FIX-5: Perceptual Hash (dHash) ────────────────────────────
// 9x8 grayscale → her satır için 8 komşu fark biti → 64-bit hash (16 hex char).
// Aynı sahne/açıdan iki çekim yakın hash üretir; aynı ışık ama farklı yüz-pozu
// için biraz fark verir. Hamming mesafesi 0-3 = neredeyse aynı (çoğu yüz pozu
// değişikliği bunun çok üstünde olur). Sadece brightness/sharpness'tan farklı
// olarak, GERÇEK piksel desenine dayanır → açı değişikliğine duyarlı.

const DHASH_W = 9;
const DHASH_H = 8;

export async function computePerceptualHash(uri: string): Promise<string | null> {
  if (!uri) return null;
  const cached = _hashCache.get(uri);
  if (cached) return cached;
  try {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: DHASH_W, height: DHASH_H } }],
      {
        base64:   true,
        compress: 0.6,
        format:   ImageManipulator.SaveFormat.JPEG,
      },
    );
    if (!resized.base64) return null;
    const bytes = base64ToBytes(resized.base64);
    const raw   = decodeJpeg(bytes, { useTArray: true });
    if (raw.width < 2 || raw.height < 1) return null;
    // dHash: her satırda komşu piksellerin gri değer farkını bit'e dönüştür.
    let bits = "";
    for (let y = 0; y < raw.height; y++) {
      for (let x = 0; x < raw.width - 1; x++) {
        const i1 = (y * raw.width + x) * 4;
        const i2 = (y * raw.width + x + 1) * 4;
        const g1 = 0.299 * raw.data[i1]     + 0.587 * raw.data[i1 + 1] + 0.114 * raw.data[i1 + 2];
        const g2 = 0.299 * raw.data[i2]     + 0.587 * raw.data[i2 + 1] + 0.114 * raw.data[i2 + 2];
        bits += g1 > g2 ? "1" : "0";
      }
    }
    // bits.length = 8 * 8 = 64 → 16 hex
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    _hashCache.set(uri, hex);
    return hex;
  } catch {
    return null;
  }
}

/** İki dHash arasındaki Hamming mesafesi (0..64). null girdi → -1. */
export function hammingDistanceHex(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b || a.length !== b.length) return -1;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}
