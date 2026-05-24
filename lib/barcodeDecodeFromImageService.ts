/**
 * barcodeDecodeFromImageService — Barkod Çözme Motoru
 *
 * Katman 1 — Hızlı native deneme (tek geçiş):
 *   QR kodlar için mükemmel, EAN/UPC için Android'de çalışabilir.
 *   iOS'ta static görsellerden EAN/UPC okuma güvenilmez.
 *
 * Katman 2 — Python API (zxing-cpp, 20+ önişleme geçişi):
 *   EAN-13, UPC-A, Code128 ve diğer tüm formatlar için güvenilir.
 *   Hem iOS hem Android'de çalışır.
 */

import { scanFromURLAsync } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";
const PYTHON_ENDPOINT = `${API_BASE}/api/scan-barcode-image`;
const PYTHON_TIMEOUT_MS = 30_000;

// Desteklenen tüm formatlar — tek hızlı native geçiş için
const ALL_TYPES: Array<
  "aztec" | "ean13" | "ean8" | "qr" | "pdf417" | "upc_e" |
  "datamatrix" | "code39" | "code93" | "itf14" | "codabar" | "code128" | "upc_a"
> = ["aztec","ean13","ean8","qr","pdf417","upc_e","datamatrix","code39","code93","itf14","codabar","code128","upc_a"];

export interface DecodedBarcode {
  barcode: string;
  format: string;
  pass: number;
  allFound: Array<{ barcode: string; format: string }>;
}

export type DecodeErrorType =
  | "not_found"
  | "native_error";

export interface DecodeSuccess {
  success: true;
  data: DecodedBarcode;
}

export interface DecodeFailure {
  success: false;
  error: DecodeErrorType;
  message: string;
}

export type BarcodeDecodeResult = DecodeSuccess | DecodeFailure;

/**
 * Görsel URI'ından barkod çözer.
 *
 * Katman 1 — 1 hızlı native geçiş (scanFromURLAsync, tüm formatlar)
 * Katman 2 — Python API (zxing-cpp, base64 gönderim) — asıl güvenilir katman
 *
 * @param uri         File URI (image picker veya manipulator çıktısı)
 * @param imageWidth  Görsel genişliği (kullanılmıyor, uyumluluk için)
 * @param imageHeight Görsel yüksekliği (kullanılmıyor, uyumluluk için)
 * @param base64      Ham base64 (Python API için zorunlu)
 */
export async function decodeBarcodeFromImage(
  uri: string,
  imageWidth: number = 0,
  imageHeight: number = 0,
  base64: string = ""
): Promise<BarcodeDecodeResult> {
  if (!uri) {
    return { success: false, error: "native_error", message: "Geçersiz görsel URI." };
  }

  // ── Katman 1: Tek hızlı native geçiş (QR ve Android EAN için) ──────────
  try {
    const results: BarcodeScanningResult[] = await scanFromURLAsync(uri, ALL_TYPES as any);
    if (results && results.length > 0) {
      const best = selectBestBarcode(results);
      const barcode = normalize(best.data ?? "");
      if (barcode) {
        console.log(`[BarcodeDecoder] ✅ Native geçiş 1: ${barcode} (${best.type})`);
        return {
          success: true,
          data: {
            barcode,
            format: best.type ?? "unknown",
            pass: 1,
            allFound: [{ barcode, format: best.type ?? "unknown" }],
          },
        };
      }
    }
  } catch (e) {
    console.log(`[BarcodeDecoder] Native geçiş başarısız:`, e);
  }

  console.log("[BarcodeDecoder] Native başarısız — Python API (zxing-cpp) deneniyor...");

  // ── Katman 2: Python API (zxing-cpp) — birincil güvenilir katman ────────
  if (!base64) {
    console.log("[BarcodeDecoder] base64 yok — Python API çağrılamıyor");
    return {
      success: false,
      error: "not_found",
      message: "Bu görselde okunabilir barkod bulunamadı.",
    };
  }

  const pythonResult = await tryPythonApi(base64);
  if (pythonResult) {
    console.log(`[BarcodeDecoder] ✅ Python API: ${pythonResult.barcode} (${pythonResult.format})`);
    return {
      success: true,
      data: {
        barcode: pythonResult.barcode,
        format: pythonResult.format,
        pass: 2,
        allFound: [{ barcode: pythonResult.barcode, format: pythonResult.format }],
      },
    };
  }

  return {
    success: false,
    error: "not_found",
    message: "Bu görselde okunabilir barkod bulunamadı.",
  };
}

// ─── Python API ────────────────────────────────────────────────────────────

interface ScanHit {
  barcode: string;
  format: string;
}

async function tryPythonApi(base64: string): Promise<ScanHit | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PYTHON_TIMEOUT_MS);
  try {
    console.log(`[BarcodeDecoder] Python API çağrılıyor: ${PYTHON_ENDPOINT}`);
    const res = await fetch(PYTHON_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: base64 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(`[BarcodeDecoder] Python API HTTP ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (!data?.barcode) return null;
    const barcode = data.barcode.trim().replace(/\s+/g, "");
    return { barcode, format: data.format ?? "UNKNOWN" };
  } catch (e) {
    clearTimeout(timer);
    console.log(`[BarcodeDecoder] Python API hata:`, e);
    return null;
  }
}

// ─── Yardımcılar ───────────────────────────────────────────────────────────

function selectBestBarcode(results: BarcodeScanningResult[]): BarcodeScanningResult {
  if (results.length === 1) return results[0];
  let best = results[0];
  let bestArea = boxArea(results[0]);
  for (let i = 1; i < results.length; i++) {
    const a = boxArea(results[i]);
    if (a > bestArea) { bestArea = a; best = results[i]; }
  }
  return best;
}

function boxArea(r: BarcodeScanningResult): number {
  const b = (r as any).bounds;
  if (!b?.size) return 0;
  return (b.size.width ?? 0) * (b.size.height ?? 0);
}

function normalize(v: string): string {
  return v.trim().replace(/\s+/g, "");
}
