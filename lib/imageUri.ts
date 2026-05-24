// PERF Level 2 — Görsel URI pipeline (TEK KAYNAK)
// ─────────────────────────────────────────────────────────────────────────
// Hem ProductImage (render hattı) hem de imagePrefetch (arka plan ısıtma)
// AYNI son URL'yi hedeflesin diye URI dönüşümleri burada konsolide edildi.
// Önceden iki dosyada birebir kopya vardı → drift riski. Artık tek kaynak.
//
// İki dönüşüm:
//   1) resolveAbsoluteUri: "/api/..." gibi göreli yolu EXPO_PUBLIC_API_BASE
//      ile absolute'a çevirir. http(s):// olanlara dokunmaz.
//   2) unwrapProxyImg: "/api/proxy-img?url=https://..." sarmalayıcı kullanılan
//      URL'lerden orijinal CDN URL'ini ayıklar — <Image> upstream'e doğrudan
//      gider, proxy round-trip ödenmez.
//
// Geri alma: bu dosyayı silip iki helper'ı eski hâliyle ProductImage.tsx ve
// imagePrefetch.ts içine geri yapıştırmak yeterli.

const _API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

/**
 * `/api/...` veya `/api/v2/...` gibi relative path'leri absolute URL'ye çevirir.
 * Zaten absolute olan URL'lere (https://, http://) dokunmaz.
 */
export function resolveAbsoluteUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/api/") && _API_BASE) return `${_API_BASE}${raw}`;
  return raw;
}

/**
 * /api/proxy-img wrapper'ını bypass — `url=` query param'ından orijinal
 * URL'i çıkarır. <Image> upstream CDN'e doğrudan istekte bulunur.
 * Synchronous, sadece string parse. Hatada giriş URI'si döner (no-op).
 */
export function unwrapProxyImg(uri: string | null | undefined): string | null {
  if (!uri) return uri ?? null;
  const idx = uri.indexOf("/api/proxy-img");
  if (idx === -1) return uri;
  const urlParamIdx = uri.indexOf("url=", idx);
  if (urlParamIdx === -1) return uri;
  const tail = uri.slice(urlParamIdx + 4);
  const ampIdx = tail.indexOf("&");
  const encoded = ampIdx === -1 ? tail : tail.slice(0, ampIdx);
  try {
    const decoded = decodeURIComponent(encoded);
    if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
    return uri;
  } catch {
    return uri;
  }
}

/**
 * URI <Image> tarafından doğrudan render edilebiliyor mu?
 * - http(s):// → CDN/Supabase görseli
 * - /api/proxy-img → kendi proxy endpoint'imiz (RN destekler)
 */
export function isDirectlyRenderable(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return (
    uri.startsWith("https://") ||
    uri.startsWith("http://")  ||
    uri.startsWith("/api/proxy-img")
  );
}

/**
 * Ecz4 — Supabase Storage Image Transform
 * Supabase Storage public URL'lerini "render/image" endpoint'ine çevirir ve
 * `?width=&quality=` parametreleri ekler. Sonuç: 1-2 MB original yerine
 * ~30-100 KB resize/encode edilmiş görsel.
 *
 * - Sadece Supabase Storage `/storage/v1/object/public/` URL'lerine uygulanır.
 * - Harici CDN URL'leri (bioderma.com.tr, ticimax.cloud, vb.) AYNEN döner.
 * - null/undefined giriş → null çıkar (no-op).
 * - Verified: HTTP/2 200, content-type: image/jpeg (curl probe ile).
 *
 * Geri alma: bu fonksiyonu silip ProductImage.tsx ve imagePrefetch.ts'teki
 * `toSupabaseThumbnail` çağrılarını da kaldırmak yeterli.
 */
export function toSupabaseThumbnail(url: string | null | undefined, size = 400): string | null {
  if (!url) return null;
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    ) + `?width=${size}&quality=70`;
  }
  return url;
}
