// PERF Level 2 — Görsel prefetch + bellek içi URI cache
// ─────────────────────────────────────────────────────────────────────────
// HEDEF: Liste/grid ekranlarında ürünler henüz scroll'a girmeden görselleri
// arka planda indirip CDN cache'ine ısıtmak. Sonuç: kart göründüğünde
// <Image> dosyayı zaten cache'ten alır → "boş kutu → görsel" geçişi
// görünür şekilde kısalır, beyaz flicker azalır.
//
// KURAL (kullanıcı, PERF L2):
// • Mantığa, skor/ingredient/badge/search akışlarına dokunulmaz.
// • Sadece görseller için minimal, reversible değişiklik.
// • Tüm katalog değil, sadece görünür/yakın görünür ürünler prefetch edilir.
// • Aynı URI birden fazla kez prefetch edilmez (in-memory Set guard).
//
// Geri alma: tek satır `prefetchProductImages(...)` çağrılarını sil ve bu
// dosyayı kaldır. ProductImage davranışı etkilenmez.

import { Platform } from "react-native";
// ECZ4 IMAGE LOAD STEP 1 — expo-image prefetch ile memory + disk cache.
// react-native Image.prefetch yalnızca runtime memory cache yazıyordu;
// expo-image Image.prefetch(uris, "memory-disk") kalıcı disk cache'i de
// ısıtır → uygulama yeniden açılışlarında görseller anında gelir.
// Önceki davranış (web no-op, in-flight dedupe, success-only persist)
// korundu; sadece backend swap.
import { Image as ExpoImage } from "expo-image";
import { resolveImageUrl, resolveThumbnailUrl } from "@/types/product";
import { resolveAbsoluteUri, unwrapProxyImg, toSupabaseThumbnail } from "@/lib/imageUri";

// ─── URI dönüşümleri ──────────────────────────────────────────────────────
// `resolveAbsoluteUri` + `unwrapProxyImg` artık `lib/imageUri.ts`'ten geliyor.
// ProductImage ile AYNI dosyayı paylaşıyoruz → prefetch ile <Image> birebir
// aynı son URL'yi hedefliyor (drift imkânsız).

// ─── Cache'ler ──────────────────────────────────────────────────────────
// prefetchedUris: bu oturumda zaten Image.prefetch çağrılmış URI'lar.
// uriCache: ürün id → son çözümlenmiş thumbnail URI. Şimdilik sadece
// debug/observability amaçlı tutuluyor; ProductImage kendi rawUri
// pipeline'ını her render'da yeniden çalıştırmaya devam ediyor (Fast
// Refresh güvenliği için useMemo'su KASTEN kaldırılmıştı). Map sınırlı
// kalsın diye kapağı 2000 girdide tutuyoruz.
const prefetchedUris = new Set<string>();
const inFlightUris = new Set<string>();
const uriCache = new Map<string, string>();
const URI_CACHE_CAP = 2000;

function rememberCacheEntry(productId: string, uri: string) {
  if (uriCache.size >= URI_CACHE_CAP) {
    // FIFO trim — Map insertion order'ı garanti, en eski 200 girdiyi at.
    const trim = 200;
    let i = 0;
    for (const k of uriCache.keys()) {
      if (i++ >= trim) break;
      uriCache.delete(k);
    }
  }
  uriCache.set(productId, uri);
}

/** Daha önce prefetch edilmiş URI sayısı (debug/test için). */
export function prefetchedCount(): number {
  return prefetchedUris.size;
}

/** Bellekteki id → URI cache'inden hızlı okuma (debug/test için). */
export function getCachedThumbnailUri(productId: string | number): string | undefined {
  return uriCache.get(String(productId));
}

/**
 * Görünür/yakın görünür ürünlerin thumbnail URI'larını arka planda indir.
 *
 * Çağıran sorumluluğu: kayan listenin İLK N elemanını ver. Tüm katalog
 * değil — kullanıcı isteği gereği sadece "yakın görünür" set.
 *
 * Davranış:
 * - Web'de Image.prefetch yok / no-op olabilir → guard ile atlanır.
 * - data: / file: URI'larında prefetch anlamsız → atlanır.
 * - Aynı URI bir kez işlenir; tekrar çağrı no-op (Set guard).
 * - Hatalar yutulur (bağlantı yoksa <Image> normal akışta placeholder
 *   gösterir, regresyon olmaz).
 */
export function prefetchProductImages(
  products: ReadonlyArray<{ id: string | number } & Record<string, any>> | null | undefined,
  count: number = 12,
): void {
  if (!products || products.length === 0) return;
  if (Platform.OS === "web") return;
  // expo-image Image.prefetch(uris, cachePolicy?) — defansif kontrol.
  const prefetchFn = (ExpoImage as any).prefetch as
    | ((uris: string | string[], cachePolicy?: "memory" | "memory-disk" | "disk") => Promise<boolean>)
    | undefined;
  if (typeof prefetchFn !== "function") return;

  const slice = products.slice(0, Math.max(0, count));
  for (const p of slice) {
    const raw = resolveThumbnailUrl(p as any);
    const baseUri = unwrapProxyImg(resolveAbsoluteUri(raw));
    // Ecz4 — Supabase Storage URL'lerini render/image transform ile küçült.
    // ProductImage thumbnail mode aynı dönüşümü uygular → cache anahtarları
    // birebir eşleşir, prefetch gerçekten kullanılır.
    const uri = toSupabaseThumbnail(baseUri, 400);
    if (!uri) continue;
    rememberCacheEntry(String(p.id), uri);
    if (uri.startsWith("data:") || uri.startsWith("file:")) continue;
    if (prefetchedUris.has(uri) || inFlightUris.has(uri)) continue;
    // PERF L2: in-flight guard ayrı; başarı GELDİĞİNDE prefetchedUris'e yaz.
    // Önceden hata alınsa bile "done" işaretliyorduk → transient ağ hatası
    // sonrasında bir daha denemiyorduk. Şimdi başarılıda kalıcı dedupe,
    // hatada in-flight'tan düşürülür → sonraki kullanıcı tetiği retry yapar.
    inFlightUris.add(uri);
    prefetchFn(uri, "memory-disk")
      .then((ok) => {
        if (ok) prefetchedUris.add(uri);
      })
      .catch(() => {})
      .finally(() => {
        inFlightUris.delete(uri);
      });
  }
}

/**
 * ECZ4 NAV STEP A — Ürün detay HERO görselini disk cache'e ısıt.
 *
 * Kök neden: Home/Favori kartları thumbnail_url (toSupabaseThumbnail width=400)
 * URL'ini cache'e alıyor; Detay sayfası ise hero için ProductImage `mode="full"`
 * kullanıyor → tam-boy `image_url` istiyor. İki URI farklı cache anahtarı →
 * hero soğuk indirilir → "sayfa açılır + görsel geç gelir" hissi.
 *
 * Çözüm: tap anında (router.push'tan önce/sonra fark etmez, await EDİLMEZ),
 * tek bir hero URI'sini fire-and-forget memory-disk cache'e indir. Navigation
 * GECİKTİRİLMEZ; başarısızlıkta sessiz, ProductImage normal akışıyla devam eder.
 *
 * URI çözümü: ProductImage `mode="full"` ile birebir aynı pipeline:
 *   resolveImageUrl(p) → resolveAbsoluteUri → unwrapProxyImg.
 * `toSupabaseThumbnail` UYGULANMAZ (kasten — hero tam-boy kullanır, drift yok).
 *
 * Mevcut prefetchedUris/inFlightUris dedupe set'leri paylaşılır → kart hâlâ
 * görünmeden tap edilirse iki yarış tetiği tek indirmeye birleşir.
 */
export function prefetchProductHeroImage(
  product: Partial<{ image_url: string | null; imageUrl: string | null; thumbnail_url: string | null; thumbnailUrl: string | null; storage_image_url: string | null; storageImageUrl: string | null; gorsel_url: string | null; gorsel: string | null; normalized_image_url: string | null }> & Record<string, any> | null | undefined,
): void {
  if (!product) return;
  if (Platform.OS === "web") return;
  const prefetchFn = (ExpoImage as any).prefetch as
    | ((uris: string | string[], cachePolicy?: "memory" | "memory-disk" | "disk") => Promise<boolean>)
    | undefined;
  if (typeof prefetchFn !== "function") return;

  // ProductImage mode="full" ile birebir: imageUrl önce, fallback thumbnailUrl.
  // resolveImageUrl önceliği (storage_image_url → image_url → thumbnail_url →
  // legacy) tam olarak hero'nun talep ettiği URL'i verir.
  const raw = resolveImageUrl(product as any) ?? resolveThumbnailUrl(product as any);
  const uri = unwrapProxyImg(resolveAbsoluteUri(raw));
  if (!uri) return;
  if (uri.startsWith("data:") || uri.startsWith("file:")) return;
  if (prefetchedUris.has(uri) || inFlightUris.has(uri)) return;

  inFlightUris.add(uri);
  prefetchFn(uri, "memory-disk")
    .then((ok) => {
      if (ok) prefetchedUris.add(uri);
    })
    .catch(() => {})
    .finally(() => {
      inFlightUris.delete(uri);
    });
}
