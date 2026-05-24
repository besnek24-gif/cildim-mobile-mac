/**
 * imageBarcodeService
 * Fotoğraftan barkod okuma servisi.
 * Python backend'deki /api/scan-barcode-image endpoint'ini kullanır (zxing-cpp).
 */

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

export interface BarcodeResult {
  barcode: string;
  format: string;
}

export type ImageSource = {
  base64: string;
  uri?: string;
  width?: number;
  height?: number;
};

/**
 * Görselden barkodu tespit et.
 * Başarılıysa { barcode, format } döner.
 * Bulunamazsa null döner.
 * Hata olursa throw eder.
 */
export async function detectBarcodeFromImage(
  image: ImageSource
): Promise<BarcodeResult | null> {
  if (!image.base64) {
    throw new Error("Görsel base64 verisi eksik.");
  }

  const res = await fetch(`${API_BASE}/api/scan-barcode-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: image.base64 }),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.detail ?? `Sunucu hatası: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.barcode) return null;

  return { barcode: data.barcode, format: data.format ?? "UNKNOWN" };
}

/**
 * Barkod değerini normalize et.
 * Boşluk ve görünmez karakterleri temizle.
 */
export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}
