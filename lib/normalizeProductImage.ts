/**
 * Thumbnail Normalization Pipeline
 *
 * Farklı oranlarda ve boşluklarla gelen ürün görsellerini
 * tek tip 400×400 kare canvas içine yerleştirir:
 *   - Nötr ılık arka plan (#F8F6F2)
 *   - Ürün canvas'ın %75'ini kaplayan ortalanmış alan
 *   - Orijinal oran korunur, kırpma yok
 *
 * Sadece web'de çalışır (HTML Canvas API).
 * Native'de orijinal URI döndürülür — product frame zaten yeterli.
 *
 * Sonuç module-level Map'e cache'lenir:
 *   → aynı URI için bir kez normalize edilir, sonra önbellekten döner.
 */

import { Platform } from "react-native";

/** Canvas boyutu (px) — tüm ürünler bu kareye normalize edilir */
const CANVAS_SIZE = 400;

/** Ürünün canvas içindeki max kapladığı alan oranı */
const PRODUCT_FILL = 0.75;

/** Normalized canvas arka plan rengi */
const BG_COLOR = "#F8F6F2";

/** Module-level önbellek — render'dan bağımsız, session boyunca yaşar */
const _cache = new Map<string, string>();

/**
 * Verilen görsel URI'sini normalize eder.
 * Web: 400×400 data URL döner (canvas normalize)
 * Native: orijinal URI döner
 *
 * Hata durumunda orijinal URI fallback olarak döner.
 */
export async function normalizeProductImage(uri: string): Promise<string> {
  if (!uri) return uri;

  // Native: normalizasyona gerek yok, product frame yeterli
  if (Platform.OS !== "web") return uri;

  // Önbellekte varsa direkt döndür
  const cached = _cache.get(uri);
  if (cached) return cached;

  return new Promise<string>((resolve) => {
    const img = new (window as any).Image() as HTMLImageElement;
    // crossOrigin="anonymous": proxy sunucumuz Access-Control-Allow-Origin:* header'ı gönderiyor.
    // Bu olmadan canvas "tainted" sayılır → toDataURL() SecurityError → fallback URI döner
    // ama <Image src=proxyUrl> de iframe/CSP kısıtlarından etkilenebilir.
    // CORS desteklemeyen CDN'ler için img.onerror ateşlenir → güvenli fallback.
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(uri); return; }

        // 1) Nötr arka plan
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // 2) Ürünü ortalanmış, oranı korunan biçimde yerleştir
        const maxDim = CANVAS_SIZE * PRODUCT_FILL;
        const scale  = Math.min(
          maxDim / (img.naturalWidth  || img.width  || 1),
          maxDim / (img.naturalHeight || img.height || 1),
        );
        const drawW = (img.naturalWidth  || img.width)  * scale;
        const drawH = (img.naturalHeight || img.height) * scale;
        const x = (CANVAS_SIZE - drawW) / 2;
        const y = (CANVAS_SIZE - drawH) / 2;

        ctx.drawImage(img, x, y, drawW, drawH);

        // toDataURL cross-origin canvas için güvenlik hatası fırlatır → catch ile yakala
        const dataUrl = canvas.toDataURL("image/png", 0.92);
        _cache.set(uri, dataUrl);
        resolve(dataUrl);
      } catch {
        // Cross-origin canvas taint — orijinal URI ile devam et (normal img tag çalışır)
        _cache.set(uri, uri);
        resolve(uri);
      }
    };

    img.onerror = () => {
      _cache.set(uri, uri);
      resolve(uri);
    };

    img.src = uri;
  });
}

/** Cache'i temizle (ör: dev hot-reload) */
export function clearNormalizedImageCache(): void {
  _cache.clear();
}
