/**
 * barcodeDecodeService
 * Python backend'e base64 görsel gönderir ve barkod sonucunu alır.
 * /api/scan-barcode-image (zxing-cpp, çok geçişli önişleme)
 */

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";
const ENDPOINT = `${API_BASE}/api/scan-barcode-image`;
const TIMEOUT_MS = 20_000;

export interface DecodedBarcode {
  barcode: string;
  format: string;
}

export type DecodeError =
  | "not_found"      // Barkod bulunamadı
  | "server_error"   // Sunucu hatası
  | "network_error"  // Ağ bağlantısı yok
  | "timeout";       // İstek zaman aşımı

export interface DecodeResult {
  success: true;
  data: DecodedBarcode;
}

export interface DecodeFailure {
  success: false;
  error: DecodeError;
  message: string;
}

/**
 * Base64 görsel gönder, barkod al.
 */
export async function decodeBarcode(
  base64: string
): Promise<DecodeResult | DecodeFailure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: base64 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return {
        success: false,
        error: "not_found",
        message: "Bu görselde okunabilir barkod bulunamadı.",
      };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: "server_error",
        message: body?.detail ?? `Sunucu hatası (${res.status})`,
      };
    }

    const data = await res.json();
    if (!data?.barcode) {
      return {
        success: false,
        error: "not_found",
        message: "Barkod değeri okunamadı.",
      };
    }

    const barcode = data.barcode.trim().replace(/\s+/g, "");
    return {
      success: true,
      data: { barcode, format: data.format ?? "UNKNOWN" },
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      return {
        success: false,
        error: "timeout",
        message: "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.",
      };
    }
    return {
      success: false,
      error: "network_error",
      message: "Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.",
    };
  }
}
