import { Feather } from "@expo/vector-icons";
import __perf from "@/src/utils/performanceLogger";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from "react-native";
// ECZ4 IMAGE LOAD STEP 1 — react-native Image → expo-image migration.
// expo-image provides built-in memory + disk cache, smooth fade transitions,
// and a stable recyclingKey for FlatList row reuse. Public ProductImage API
// is preserved; only the underlying renderer changes. resizeMode → contentFit
// mapping is the only behavioural surface that changes (1:1 mapping for the
// values we use: contain/cover/stretch).
import { Image } from "expo-image";

const IMAGE_CACHE_POLICY = "memory-disk" as const;
const IMAGE_TRANSITION_MS = 120;

function toContentFit(rm: "contain" | "cover" | "stretch" | undefined) {
  if (rm === "cover") return "cover" as const;
  if (rm === "stretch") return "fill" as const;
  return "contain" as const;
}
import { useColors } from "@/hooks/useColors";
import { normalizeProductImage } from "@/lib/normalizeProductImage";
// PERF Level 2 — URI dönüşüm yardımcıları artık tek kaynakta:
// `lib/imageUri.ts`. ProductImage ve imagePrefetch aynı pipeline'ı paylaşır,
// böylece prefetch edilen URL ile render edilen URL birebir eşleşir (drift yok).
// Önceden bu dosyada `_API_BASE`, `resolveAbsoluteUri`, `unwrapProxyImg`
// kopyaları vardı — kaldırıldı. Davranış birebir aynı.
import { resolveAbsoluteUri, unwrapProxyImg, isDirectlyRenderable, toSupabaseThumbnail } from "@/lib/imageUri";

// ─── DEBUG ─────────────────────────────────────────────────────────────────
// PERF: [imageMemo] dev probe'larını tek noktadan kontrol eden bayrak.
// Önceden iki ayrı `if (__DEV__) console.log("[imageMemo]"...)` HER renderda
// (kart + classic varyantlarında) ateşleniyordu — büyük listelerde çok ağır.
// Üretimde her zaman kapalı (__DEV__ false). Geliştirmede de varsayılan kapalı;
// ölçüm yapacaksan tek satır `true` yap, restart et.
const DEBUG_IMAGE = false;

// ─── SAFE PERF PATCH 2 — failed URI session cache ──────────────────────────
// Bozuk/erisilemeyen URL'ler FlatList row recycle'inda her seferinde yeniden
// network deneniyordu (her remount'ta loadStart → onError → setImgError).
// Bu modul-seviyesi Set, session boyunca onError vermis URI'leri hatirlar;
// ayni URI tekrar render edilecek olursa <Image> mount edilmez, dogrudan
// placeholder gosterilir. Boylece bozuk URL retry storm'u durur.
//
// Davranis garantileri:
//  - Visual: ayni placeholder (Feather "package" icon) gosterilir; renk,
//    boyut, padding, borderRadius, arka plan dokunulmaz.
//  - Memo: comparator degismez (URI ayni kalir → ayni karar).
//  - Fade/loading: degisiklik yok.
//  - Sticky-reset useEffect korunur (rawUri degisirse imgError sifirlanir).
//
// Geri alma: bu Set'i ve `failedUriSet.has`/`failedUriSet.add` cagrilarini
// kaldir; davranis onceki haline doner.
const failedUriSet = new Set<string>();

// ─── Sabitler ─────────────────────────────────────────────────────────────────

// PERF Level 2 — `isDirectlyRenderable` artık `lib/imageUri.ts`'ten geliyor.
// Davranış birebir aynı: http(s):// veya /api/proxy-img → true.

/** Kart modu görsel arka planı — tüm ürünler için tek renk, tam simetri */
const CARD_IMG_BG  = "#FFFFFF";
/**
 * Kart modu iç boşluk — görsel kenarlara değmez.
 * ECZ4 IMAGE FIT STEP 2: 14 → 10. Eski değer uzun/dar şişeleri kare stage
 * içinde aşırı küçültüyordu (her iki yandan 28px toplam pad). 10 daha sıkı
 * oturma sağlar ama hâlâ "nefes" boşluğu bırakır → kart redesign yok, sadece
 * fit iyileşir. Kare/geniş ürünler de orantılı olarak biraz büyür ama
 * cropped olmaz (contain davranışı korunur).
 */
const CARD_IMG_PAD = 10;

// ─── ECZ4 IMAGE FIT STEP 2 — narrow/tall scale boost ─────────────────────────
// Bazı ürün görselleri (uzun şişeler, tonikler) doğal olarak dar/uzundur:
// kısa kenar / uzun kenar oranı düşüktür. `contentFit="contain"` ile 1:1 kare
// stage içinde bunlar görsel olarak ufak kalır. Aspect ratio < eşik ise hafif
// scale boost uygulanır (kart yüzeyini kırmadan, label cropping olmadan).
//
// - URI → aspect cache (modül-seviyesi Map): aynı URI ikinci kez render
//   edildiğinde onLoad beklemeden direkt boost uygulanır.
// - StandardProductImage.tsx içinde test edilmiş ve onaylanmış mantık birebir
//   port edildi: aspect = min(w,h) / max(w,h); aspect < 0.88 → 1.06.
// - Boost değeri spec aralığı içinde (1.04–1.08) korucu seçim: 1.06.
// - Kare/geniş ürünlere DOKUNMAZ (scale 1.0).
// - overflow:"hidden" container'da zaten var → boost taşma yapamaz.
//
// Geri alma: SCALE_BOOST = 1.0 yap, davranış default contain'e döner.
const SCALE_BOOST = 1.06;
const NARROW_ASPECT_THRESHOLD = 0.88;
const aspectRatioCache = new Map<string, number>();

function aspectFromCache(uri: string | null | undefined): number | null {
  if (!uri) return null;
  const v = aspectRatioCache.get(uri);
  return typeof v === "number" ? v : null;
}
function scaleForAspect(aspect: number | null): number {
  if (aspect == null) return 1.0;
  return aspect < NARROW_ASPECT_THRESHOLD ? SCALE_BOOST : 1.0;
}

/** Classic mod (thumbnail) arka plan */
const IMG_BG_LIGHT = "#F5F0EA";
const IMG_BG_DARK  = "#2A2722";
/** Classic mod iç dolgu (her kenardan) */
const CLASSIC_PADDING = 8;

// Render dışında tanımlanan sabit stil parçaları — her render'da yeni nesne üretmez
const CLASSIC_CONTAINER_BASE = {
  alignItems:     "center" as const,
  justifyContent: "center" as const,
  overflow:       "hidden" as const,
  borderWidth:    1,
};
const CARD_CONTAINER_BASE = {
  aspectRatio:     1,
  backgroundColor: CARD_IMG_BG,
  alignItems:      "center" as const,
  justifyContent:  "center" as const,
  overflow:        "hidden" as const,
};

// ─── Arayüz ───────────────────────────────────────────────────────────────────

interface ProductImageProps {
  imageUrl?:     string | null;
  thumbnailUrl?: string | null;
  /** Marka logosu — ürün resmi yüklenemezse fallback olarak kullanılır */
  gorselUrl?:    string | null;
  mode?:         "thumbnail" | "full";
  size?:         number;
  width?:        number;
  height?:       number;
  borderRadius?: number;
  style?:        object;
  resizeMode?:   "contain" | "cover" | "stretch";
  /**
   * Kart modu: true → cream zemin + normalize pipeline.
   * false (default) → bordered thumbnail.
   */
  noBorder?: boolean;
  /** Dark-mode hint — noBorder modunda krem arka planın karanlık varyantı */
  isDark?: boolean;
}

function ProductImageInner({
  imageUrl,
  thumbnailUrl,
  gorselUrl,
  mode        = "thumbnail",
  size,
  width,
  height,
  borderRadius = 10,
  style,
  resizeMode,
  noBorder     = false,
  isDark       = false,
}: ProductImageProps) {
  const colors = useColors();
  const [imgError, setImgError] = useState(false);

  // FIX: rawUri is computed inline (no useMemo) on every render. The previous
  // useMemo cached its result by [mode, thumbnailUrl, imageUrl]; under Fast
  // Refresh that cache survived helper-code updates, so already-mounted
  // ProductImage instances kept returning the OLD pre-unwrap value (a
  // /api/proxy-img URL) even after unwrapProxyImg was patched in. The cost of
  // recomputing is a single string parse per render — negligible compared to
  // the bug it caused. Do not re-introduce useMemo here.
  // Ecz4 — Supabase Storage URL'leri thumbnail mode'da `render/image` +
  // `?width=400&quality=70` ile dönüştürülür. Harici CDN URL'leri aynen kalır.
  // Original `rawUri` (proxy unwrap + absolute) önce hesaplanır, sonra mode
  // === "thumbnail" ise tek ek dönüşüm uygulanır.
  const baseUri = unwrapProxyImg(
    resolveAbsoluteUri(
      mode === "thumbnail"
        ? thumbnailUrl || imageUrl || null
        : imageUrl || thumbnailUrl || null
    )
  );
  const rawUri = mode === "thumbnail"
    ? toSupabaseThumbnail(baseUri, 400)
    : baseUri;

  // FIX: imgError is sticky — once an <Image> fired onError (e.g. during the
  // brief window when /api/proxy-img was unreachable), the flag stayed true
  // and the placeholder kept showing even after the URL was fixed and the
  // upstream became reachable. Also matters for FlatList row recycling: when
  // a slot is reused for a different product (rawUri changes), the previous
  // product's error state must not leak into the new one. Reset on URL change.
  // SAFE PERF PATCH 2: rawUri yeni geldiyse, eger session icinde daha once
  // bu URI onError vermisse direkt sticky-error ile basla — gereksiz network
  // denemesini onler. Aksi halde sifirlanir (eski davranis).
  useEffect(() => {
    if (rawUri && failedUriSet.has(rawUri)) {
      setImgError(true);
    } else {
      setImgError(false);
    }
  }, [rawUri]);

  // [imageMemo] dev probe — DEBUG_IMAGE bayrağı açıkken ProductImage'in gerçek render sayısını ölçer.
  if (__DEV__ && DEBUG_IMAGE) console.log("[imageMemo]", rawUri ?? "(null)", noBorder ? "(card)" : "(classic)");

  const stageW = width  ?? size ?? 60;
  const stageH = height ?? size ?? 60;

  // ── KART MODU: normalize pipeline, cream zemin, tam stage doldur ──────────
  if (noBorder) {
    return (
      <CardImage
        uri={rawUri}
        stageW={stageW}
        stageH={stageH}
        borderRadius={borderRadius}
        isDark={isDark}
        style={style}
        colors={colors}
        imgError={imgError}
        setImgError={setImgError}
      />
    );
  }

  // ── KLASİK MOD: bordered thumbnail, iç dolgu, contain ────────────────────
  const imgBg      = isDark ? IMG_BG_DARK : IMG_BG_LIGHT;
  const imgW       = stageW - CLASSIC_PADDING * 2;
  const imgH       = stageH - CLASSIC_PADDING * 2;
  const iconSize   = Math.round(Math.min(stageW, stageH) * 0.38);

  // Konteyner stili: aynı boyutlar/renkler ile aynı referans
  const containerStyle = useMemo<object[]>(
    () => [
      {
        ...CLASSIC_CONTAINER_BASE,
        width:           stageW,
        height:          stageH,
        borderRadius,
        backgroundColor: imgBg,
        borderColor:     isDark ? "rgba(255,255,255,0.10)" : "#E8E2DB",
      },
      style ?? {},
    ],
    [stageW, stageH, borderRadius, imgBg, isDark, style]
  );

  // Image iç stili: boyutlar değişmedikçe aynı referans
  const imageStyle = useMemo(
    () => ({
      width:  imgW > 0 ? imgW : stageW,
      height: imgH > 0 ? imgH : stageH,
    }),
    [imgW, imgH, stageW, stageH]
  );

  // Image source nesnesi: uri değişmedikçe aynı referans → React Native aynı kaynağı yeniden indirmez
  const imageSource = useMemo(() => ({ uri: rawUri ?? "" }), [rawUri]);

  if (!rawUri || imgError) {
    return (
      <View style={containerStyle}>
        <Feather name="package" size={iconSize} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Image
        source={imageSource}
        style={imageStyle}
        contentFit={toContentFit(resizeMode)}
        cachePolicy={IMAGE_CACHE_POLICY}
        transition={IMAGE_TRANSITION_MS}
        recyclingKey={rawUri ?? undefined}
        onLoadStart={() => __perf.event("image.loadStart", { variant: "ProductImage", uri: rawUri })}
        onLoadEnd={() => __perf.event("image.loadEnd", { variant: "ProductImage", uri: rawUri })}
        onError={() => {
          __perf.event("image.error", { variant: "ProductImage", uri: rawUri });
          // SAFE PERF PATCH 2: bu URI'yi session cache'e ekle — gelecek
          // remount'larda dogrudan placeholder, network denemesi yok.
          if (rawUri) failedUriSet.add(rawUri);
          setImgError(true);
        }}
      />
    </View>
  );
}

/**
 * Memoize edilmiş dış API. Aynı props referanslarıyla parent yeniden render olduğunda
 * ProductImage yeniden çalışmaz → aynı URI tekrar tekrar Image.loadStart tetiklemez.
 *
 * Karşılaştırma: prop'ların _referans_ eşitliği. style için inline obje gönderilirse
 * memo bypass olur; çağıranlar style nesnelerini stabil tutmalı.
 */
export const ProductImage = React.memo(ProductImageInner, (prev, next) => (
  prev.imageUrl     === next.imageUrl     &&
  prev.thumbnailUrl === next.thumbnailUrl &&
  prev.gorselUrl    === next.gorselUrl    &&
  prev.mode         === next.mode         &&
  prev.size         === next.size         &&
  prev.width        === next.width        &&
  prev.height       === next.height       &&
  prev.borderRadius === next.borderRadius &&
  prev.resizeMode   === next.resizeMode   &&
  prev.noBorder     === next.noBorder     &&
  prev.isDark       === next.isDark       &&
  prev.style        === next.style
));

// ── CardImage: normalize pipeline içeren kart görseli ───────────────────────

interface CardImageProps {
  uri:          string | null;
  stageW:       number;
  stageH:       number;
  borderRadius: number;
  isDark:       boolean;
  style?:       object;
  colors:       any;
  imgError:     boolean;
  setImgError:  (v: boolean) => void;
}

function CardImageInner({
  uri, stageW, stageH, borderRadius, isDark, style, colors, imgError, setImgError,
}: CardImageProps) {
  const iconSize = Math.round(Math.min(stageW, stageH) * 0.30);

  // PERF: skip the async normalizeProductImage step for URIs that are already
  // directly renderable by <Image> (absolute http(s):// URLs and our own
  // /api/proxy-img path). Those are ~100% of Home product images, and forcing
  // them through a Promise tick caused a visible white-box + spinner flash on
  // first paint of every card. Non-http schemes (gs://, data:, etc.) still go
  // through normalizeProductImage as before. Lazy useState initializers seed
  // displayUri synchronously so <Image> mounts on the very first render.
  // To rollback: replace the two useState lines + the useEffect early-return
  // with the previous always-async version.
  const [displayUri, setDisplayUri]   = useState<string | null>(
    () => (isDirectlyRenderable(uri) ? uri! : null)
  );
  const [normalizing, setNormalizing] = useState<boolean>(
    () => !!uri && !isDirectlyRenderable(uri)
  );

  // ECZ4 IMAGE FIT STEP 2 — aspect ratio state.
  // Lazy init: cache hit varsa render-1'de direkt doğru scale uygulanır
  // (FlatList scroll-back senaryosunda flicker olmaz). Cache miss → null
  // başlar, scale=1.0 (default contain), expo-image onLoad sonrası gerçek
  // aspect okunur ve cache'lenir.
  const [aspect, setAspect] = useState<number | null>(
    () => aspectFromCache(displayUri ?? uri),
  );

  useEffect(() => {
    if (!uri) { setNormalizing(false); setDisplayUri(null); return; }
    if (isDirectlyRenderable(uri)) {
      // Already a valid renderable URL — paint immediately, no spinner.
      setDisplayUri(uri);
      setNormalizing(false);
      return;
    }
    setNormalizing(true);
    normalizeProductImage(uri)
      .then(normalized => { setDisplayUri(normalized); setNormalizing(false); })
      .catch(()        => { setDisplayUri(uri);        setNormalizing(false); });
  }, [uri]);

  // [imageMemo] dev probe — DEBUG_IMAGE bayrağı açıkken CardImage gerçek render sayısı.
  if (__DEV__ && DEBUG_IMAGE) console.log("[imageMemo]", displayUri ?? uri ?? "(null)", "(card-inner)");

  const isLoading = normalizing;
  const showError = !uri || imgError;

  // Görsel boyutu: iç padding çıkarılmış — kenarlara değmez, her ürün simetrik
  const imgInner = stageW - CARD_IMG_PAD * 2;

  // Konteyner stili: aynı boyutlar ile aynı referans
  // PERF/UX: arka planı tema-uyumlu `colors.skeleton` ile override ediyoruz
  // (light: #EDE8E4 sıcak krem, dark: #2E2E2E nötr koyu). Eskiden hardcoded
  // beyaz `CARD_IMG_BG = "#FFFFFF"` görsel ağ üzerinden yüklenirken sert beyaz
  // bir flash bırakıyordu — özellikle koyu modda göze batıyordu. Skeleton tonu
  // kart ile akıcı şekilde harmanlanır, kayıp görsel hissini yumuşatır.
  // To rollback: kaldır `backgroundColor: colors.skeleton` satırını ve
  // `colors.skeleton`'ı dependency array'den çıkar.
  const containerStyle = useMemo<object[]>(
    () => [
      {
        ...CARD_CONTAINER_BASE,
        backgroundColor: colors.skeleton,
        width:        stageW,
        height:       stageW,        // her zaman kare (aspect 1:1)
        borderRadius,
      },
      style ?? {},
    ],
    [stageW, borderRadius, style, colors.skeleton]
  );

  // Image iç stili. ECZ4 IMAGE FIT STEP 2: aspect biliniyorsa narrow/tall
  // ürünlere hafif scale boost. Kare/geniş ürünler için scale 1.0 (no-op).
  const scale = scaleForAspect(aspect);
  const imageStyle = useMemo(
    () => (
      scale === 1.0
        ? { width: imgInner, height: imgInner }
        : { width: imgInner, height: imgInner, transform: [{ scale }] as const }
    ),
    [imgInner, scale]
  );

  // Image source nesnesi: displayUri değişmedikçe aynı referans
  const imageSource = useMemo(
    () => ({ uri: displayUri ?? "" }),
    [displayUri]
  );

  return (
    <View style={containerStyle}>
      {isLoading && (
        <ActivityIndicator size="small" color={colors.primary} />
      )}

      {!isLoading && showError && (
        <Feather name="package" size={iconSize} color={colors.textMuted} />
      )}

      {!isLoading && !showError && displayUri && (
        <Image
          source={imageSource}
          style={imageStyle}
          contentFit="contain"
          cachePolicy={IMAGE_CACHE_POLICY}
          transition={IMAGE_TRANSITION_MS}
          recyclingKey={displayUri ?? undefined}
          onLoad={(e: any) => {
            // ECZ4 IMAGE FIT STEP 2 — expo-image onLoad event'inden gerçek
            // boyutları oku, aspect (kısa/uzun) hesapla, modül cache'ine yaz.
            // expo-image v3 event şekli: { source: { width, height, ... } }.
            // Eski react-native şeklini de güvenli şekilde destekle (defansif).
            try {
              const src = e?.source ?? e?.nativeEvent?.source;
              const w = Number(src?.width);
              const h = Number(src?.height);
              if (w > 0 && h > 0) {
                const a = Math.min(w, h) / Math.max(w, h);
                if (displayUri) aspectRatioCache.set(displayUri, a);
                setAspect(a);
              }
            } catch {}
          }}
          onLoadStart={() => __perf.event("image.loadStart", { variant: "CardImage", uri: displayUri })}
          onLoadEnd={() => __perf.event("image.loadEnd", { variant: "CardImage", uri: displayUri })}
          onError={() => {
            __perf.event("image.error", { variant: "CardImage", uri: displayUri });
            // SAFE PERF PATCH 2: failedUriSet'e ekle (CardImage variant'i de
            // ayni session cache'i paylasir). uri prop'u dogrudan ham
            // kaynak — failedUriSet PRoductImage girisinde rawUri ile
            // anahtarlandigi icin, burada hem `uri` (source) hem
            // `displayUri` (normalize sonrasi) eklenir; sonraki render'da
            // ProductImage'in useEffect'i sticky-error ile baslar.
            if (uri) failedUriSet.add(uri);
            if (displayUri) failedUriSet.add(displayUri);
            // Ürün fotoğrafı yüklenemedi → direkt placeholder göster (marka logosu ürün görseli yerine geçmez)
            setImgError(true);
          }}
        />
      )}
    </View>
  );
}

/**
 * CardImage memo: aynı uri/boyut/style ile parent yeniden render olduğunda yeniden çalışmaz.
 * `colors` referans olarak useColors() tarafından tema değişmedikçe sabittir.
 * `setImgError` React'ın garanti ettiği stabil bir state setter referansıdır.
 */
const CardImage = React.memo(CardImageInner, (prev, next) => (
  prev.uri          === next.uri          &&
  prev.stageW       === next.stageW       &&
  prev.stageH       === next.stageH       &&
  prev.borderRadius === next.borderRadius &&
  prev.isDark       === next.isDark       &&
  prev.style        === next.style        &&
  prev.imgError     === next.imgError
));

// ECZ4 IMAGE FIT STEP 2 — internal test-only export (aspect cache erişimi
// gerekirse). Üretim API'si değişmedi: ProductImage tek public default.
export { aspectRatioCache as __aspectRatioCacheForTests };
