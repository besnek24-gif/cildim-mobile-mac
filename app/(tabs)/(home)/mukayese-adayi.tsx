/**
 * mukayese-adayi.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Ürün karşılaştırması için aday seçim ekranı.
 *
 * Params: productId (mevcut ürün A)
 * Seçilen aday → mukayese-detay?idA=<productId>&idB=<adayId>
 */

import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveAbsoluteUri, unwrapProxyImg } from "@/lib/imageUri";

// ── Local thumbnail (Phase 2 / Step 2) ─────────────────────────────────────
// ProductImage'ın CLASSIC_PADDING=8 dolgusu, aday seçim ekranında
// görsellerin çerçeve içinde küçük durmasına yol açıyordu. Global
// ProductImage'a dokunmuyoruz; bu dosyaya özel, %88-92 doluluk veren
// yerel thumbnail kullanılır. resizeMode="contain" korunur, siyah border yok.
function LocalThumb({
  imageUrl,
  thumbnailUrl,
  size,
  borderRadius = 10,
  isDark,
}: {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  size: number;
  borderRadius?: number;
  isDark: boolean;
}) {
  const [err, setErr] = useState(false);
  const raw = unwrapProxyImg(
    resolveAbsoluteUri(thumbnailUrl || imageUrl || null),
  );
  useEffect(() => {
    setErr(false);
  }, [raw]);
  const PAD = 3;
  const inner = size - PAD * 2;
  const bg = isDark ? "#2A2722" : "#F5F0EA";
  const containerStyle = {
    width: size,
    height: size,
    borderRadius,
    backgroundColor: bg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };
  if (!raw || err) {
    return (
      <View style={containerStyle}>
        <Feather
          name="package"
          size={Math.round(size * 0.36)}
          color={isDark ? "#9A9A9A" : "#9CA3AF"}
        />
      </View>
    );
  }
  return (
    <View style={containerStyle}>
      <Image
        source={{ uri: raw }}
        style={{ width: inner, height: inner }}
        resizeMode="contain"
        onError={() => setErr(true)}
      />
    </View>
  );
}
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import {
  useSupabaseProducts,
  fetchSupabaseProductById,
  fetchSupabaseCompareCandidates,
} from "@/hooks/useSupabaseProducts";
import { getScoreColors } from "@/lib/scoreColors";
import {
  findComparisonCandidates,
  type ComparisonCandidate,
  type CandidateLabel,
} from "@/lib/comparisonCandidates";
import { resolveImageUrl, resolveThumbnailUrl, type Product } from "@/types/product";
import { getDisplayScore } from "@/lib/getFinalScore";
import { filterByTreatmentFocus } from "@/lib/compareWithFocus";
import { extractTreatmentFocus } from "@/lib/treatmentFocus";
import { findSimilarProducts } from "@/lib/similarProducts";
import { arePairsCompatible } from "@/lib/pairKey";
import { sameRawCategory, logCategoryGuardBlock } from "@/lib/sameRawCategory";
import { normalizeProductData } from "@/lib/normalizeProduct";
import { getEffectResult } from "@/lib/effectEngine";
import {
  dedupeCompareProducts,
  getCompareDedupeKey,
} from "@/lib/compareDedupe";

// Per-tab hard cap. Strict + similar + loose are already merged into
// extendedCandidates with a soft cap of 20; we re-cap here per tab so
// "Aynı Amaç" or "Alternatifler" can never blow past 20 individually.
const PER_TAB_CAP = 20;

/**
 * Canonical id normalization used by every Set we build in the split
 * pipeline (strictIds, sameIds, sameTakenIds, audit overlap math).
 * Mirrors lib/compareDedupe.ts so a Set built here and a key produced
 * there share the same string shape — no latent mismatch on dirty rows.
 */
function normalizeProductId(id: unknown): string {
  return String(id ?? "").trim().toLowerCase();
}

const PRIMARY = "#7A8F6B";
const ACCENT  = "#C8A97E";

/**
 * Türkçe-toleranslı normalize: case-insensitive, ç→c ğ→g ı→i ö→o ş→s ü→u
 * Yalnızca aday-içi search için lokal kullanılır (DB / global aramaya
 * değmez).
 */
function normalize(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .trim();
}

/**
 * Bir üründen anahtar kelime tarama için tek bir lowercase + TR-ASCII
 * normalize edilmiş metin çıkarır. Şu alanlar güvenli şekilde birleştirilir:
 *   short_benefit, short_description, benefits, badges, tags,
 *   category, subcategory, name
 * Diziler düzleştirilir; obje elemanlarda name/label/title/text alanları
 * okunur (badges/tags bazen `{name: "..."}` şeklinde gelebiliyor).
 * `normalize()` (üstteki helper) ç→c ğ→g ı→i ö→o ş→s ü→u + lowercase
 * dönüşümü yaptığı için anahtar kelimeler de TR-ASCII formunda yazılır
 * ("güneş" → "gunes", "yağlı" → "yagli", vb.).
 */
function getCandidateSearchText(p: any): string {
  if (!p) return "";
  const parts: string[] = [];
  const push = (v: any): void => {
    if (v == null) return;
    if (Array.isArray(v)) {
      for (const x of v) push(x);
      return;
    }
    if (typeof v === "string") {
      parts.push(v);
      return;
    }
    if (typeof v === "object") {
      if (typeof v.name === "string")  parts.push(v.name);
      if (typeof v.label === "string") parts.push(v.label);
      if (typeof v.title === "string") parts.push(v.title);
      if (typeof v.text === "string")  parts.push(v.text);
    }
  };
  push(p.short_benefit);
  push(p.short_description);
  push(p.benefits);
  push(p.badges);
  push(p.tags);
  push(p.category);
  push(p.subcategory);
  push(p.name);
  return normalize(parts.join(" "));
}

/**
 * Loose anahtar kelimeler — TR-ASCII normalize edilmiş hâlleri.
 * Bunlar her iki tarafın `getCandidateSearchText` çıktısında aranır.
 */
const LOOSE_KEYWORDS: readonly string[] = [
  "nem", "akne", "leke", "gunes", "spf", "bariyer",
  "hassas", "yagli", "kuru", "kirisik", "ton", "gozenek",
];

/**
 * Strong intent çiftleri — kategori/subcategory uyuşmazlığı varken bile
 * her iki taraf da bu çiftin İKİ kelimesini içeriyorsa eşleşmeyi kabul
 * eder. Hepsi normalize TR-ASCII formunda.
 */
const STRONG_INTENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["gunes", "spf"],
  ["leke", "ton"],
  ["akne", "gozenek"],
  ["nem", "bariyer"],
  ["hassas", "bariyer"],
  ["kirisik", "anti aging"],
];

/**
 * ── ADDITIVE LAYER 3: gevşek (loose) aday katmanı ─────────────────────────
 * Strict (`findComparisonCandidates`) ve `findSimilarProducts` katmanlarına
 * EK olarak çalışır; onların yerine geçmez. Sadece havuzu okur, hiçbir
 * Supabase çağrısı yapmaz, pairKey/ranking mantığına dokunmaz.
 *
 * Kabul mantığı (her iki taraf için `getCandidateSearchText` metni
 * üzerinden):
 *   A) Aynı kategori + aynı subcategory:
 *        ≥ 1 paylaşılan loose keyword
 *   B) Aynı kategori, farklı subcategory  VEYA  farklı kategori:
 *        ≥ 2 paylaşılan loose keyword
 *        VEYA en az bir STRONG_INTENT_PAIRS çifti her iki tarafta da
 *        bulunuyor
 *
 * `isCross` bayrağı çağıran tarafın priority ayrımı yapmasına izin verir
 * (same-category 150, cross 180). Self ve segment kuralları korundu.
 */
type LooseHit = { product: Product; isCross: boolean };

function findLooseCandidates(
  currentProduct: Product | null,
  pool: Product[] | null | undefined,
): LooseHit[] {
  if (!currentProduct || !Array.isArray(pool) || pool.length === 0) return [];
  const cur: any = currentProduct;
  const curId = String(cur.id ?? "");
  const curCat = cur.category;
  const curSub = cur.subcategory;
  const curSeg = cur.segment;
  const aText = getCandidateSearchText(cur);
  if (!aText) return [];

  // Mevcut ürünün tetiklediği anahtar kelimeleri ve strong-pair'leri
  // bir kez hesapla.
  const aHits = LOOSE_KEYWORDS.filter((k) => aText.includes(k));
  const aStrongPairs = STRONG_INTENT_PAIRS.filter(
    ([x, y]) => aText.includes(x) && aText.includes(y),
  );
  if (aHits.length === 0 && aStrongPairs.length === 0) return [];

  const out: LooseHit[] = [];
  for (const p of pool) {
    if (!p) continue;
    const pa: any = p;
    if (String(pa.id ?? "") === curId) continue;
    if (curSeg && pa.segment && pa.segment !== curSeg) continue;
    // HARD CATEGORY GUARD — loose layer ARTIK cross-category
    // adayları üretmez. Raw kategori eşit değilse aday değil.
    if (!sameRawCategory(currentProduct as any, pa)) {
      logCategoryGuardBlock("findLooseCandidates", currentProduct as any, pa);
      continue;
    }
    const bText = getCandidateSearchText(pa);
    if (!bText) continue;

    const sameCategory    = pa.category === curCat;
    const sameSubcategory = sameCategory && pa.subcategory === curSub;

    // Paylaşılan keyword sayısı.
    const sharedCount = aHits.reduce(
      (n, k) => (bText.includes(k) ? n + 1 : n),
      0,
    );
    // Paylaşılan strong-pair (her iki taraf da çiftin iki kelimesini içerir).
    const sharedStrongPair = aStrongPairs.some(
      ([x, y]) => bText.includes(x) && bText.includes(y),
    );

    let accept = false;
    if (sameSubcategory) {
      // (A) En sıkı uyum — 1 keyword yeter.
      accept = sharedCount >= 1;
    } else {
      // (B) Cross-subcategory veya cross-category — daha güçlü sinyal şart.
      accept = sharedCount >= 2 || sharedStrongPair;
    }

    if (accept) {
      out.push({ product: p as Product, isCross: !sameSubcategory });
    }
  }
  return out;
}

function getScore(p: Product): number | null {
  // Liste, detay ve aday ekranı aynı fallback sırasını kullansın diye TEK kaynak.
  return getDisplayScore(p as any);
}

/**
 * Treatment focus benzerlik skoru (sadece UI sıralaması için, filtrasyon
 * DEĞİL). Yüksek skor → daha güçlü amaç eşleşmesi → listede önce.
 *
 *   3 → primary === primary           (örn: "acne" vs "acne")
 *   2 → primary, karşı tarafın secondary'si ile eşleşir
 *   1 → secondary ↔ secondary kesişimi
 *   0 → eşleşme yok / odak çıkarılamaz
 *
 * Hata durumunda 0 → sıralama trivial olur (regresyon yok).
 */
function getFocusScore(
  current: Product | null | undefined,
  candidate: Product | null | undefined,
): number {
  try {
    if (!current || !candidate) return 0;
    const a = extractTreatmentFocus(current);
    const b = extractTreatmentFocus(candidate);

    if (!a.primary || !b.primary) return 0;

    if (a.primary === b.primary) return 3;

    if (b.secondary?.includes(a.primary)) return 2;
    if (a.secondary?.includes(b.primary)) return 2;

    const overlap = a.secondary?.some((s) => b.secondary?.includes(s));
    if (overlap) return 1;

    return 0;
  } catch {
    return 0;
  }
}

// ── Form-awareness (UI sıralaması, filtrasyon DEĞİL) ────────────────────────
// Aynı amaca yönelik fakat farklı formdaki ürünler (örn. krem ↔ losyon)
// listeden ÇIKARILMAZ; sadece sıralama refining sinyali sağlar.

type CanonicalForm =
  | "serum"
  | "lotion"
  | "cream"
  | "spray"
  | "gel"
  | "foam"
  | "shampoo"
  | "toner"
  | "mask"
  | "oil"
  | "stick";

/**
 * Ürünün formunu (krem, losyon, sprey, …) tahmin eder.
 * Veri tabanında dedike `form` alanı yoksa name/isim/subcategory/category
 * üstünden tek-kelimelik regex ile yakalar. Eşleşme yoksa null →
 * formScore = 0 → sıralama nötr (regresyon yok, ürün gizlenmez).
 */
function normalizeForm(
  product: Product | null | undefined,
): CanonicalForm | null {
  if (!product) return null;
  const p: any = product;
  const raw = [
    p?.form,
    p?.name,
    p?.isim,
    p?.subcategory,
    p?.category,
    p?.kategori,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/serum/.test(raw))               return "serum";
  if (/losyon|lotion/.test(raw))       return "lotion";
  if (/krem|cream/.test(raw))          return "cream";
  if (/sprey|spray/.test(raw))         return "spray";
  if (/jel|gel/.test(raw))             return "gel";
  if (/köpük|kopuk|foam/.test(raw))    return "foam";
  if (/şampuan|sampuan|shampoo/.test(raw)) return "shampoo";
  if (/tonik|toner/.test(raw))         return "toner";
  if (/maske|mask/.test(raw))          return "mask";
  if (/yağ|yag|oil/.test(raw))         return "oil";
  if (/stick|çubuk|cubuk/.test(raw))   return "stick";

  return null;
}

const FORM_COMPATIBLE_GROUPS: CanonicalForm[][] = [
  ["cream", "lotion"],
  ["gel", "foam"],
  ["toner", "serum"],
  ["spray", "lotion"],
];

/**
 * Form benzerlik skoru:
 *   2 → birebir aynı form (krem ↔ krem)
 *   1 → uyumlu form grubunda (krem ↔ losyon, jel ↔ köpük, ...)
 *   0 → form bilinmiyor / uyumsuz (yine de listeden ÇIKARILMAZ)
 */
function getFormScore(
  current: Product | null | undefined,
  candidate: Product | null | undefined,
): number {
  try {
    const a = normalizeForm(current);
    const b = normalizeForm(candidate);
    if (!a || !b) return 0;
    if (a === b) return 2;
    const compatible = FORM_COMPATIBLE_GROUPS.some(
      (group) => group.includes(a) && group.includes(b),
    );
    return compatible ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Birleşik sıralama skoru. Amaç (focus) baskın, form yalnızca aynı
 * amaçtaki adaylar arasında ince ayar yapar.
 *   finalScore = focusScore * 10 + formScore
 * En kötü senaryo: focus 3 + form 2 = 32, en iyi nötr: 0.
 */
function getFinalRankScore(
  current: Product | null | undefined,
  candidate: Product | null | undefined,
): number {
  return getFocusScore(current, candidate) * 10 + getFormScore(current, candidate);
}

function labelStyle(label: CandidateLabel): { bg: string; fg: string } {
  if (label === "Aynı alt kategori") return { bg: PRIMARY, fg: "#fff" };
  return { bg: ACCENT, fg: "#fff" };
}

// ── Mevcut ürün mini özeti ────────────────────────────────────────────────────

function CurrentProductBar({
  product,
  colors,
  isDark,
}: {
  product: Product;
  colors: any;
  isDark: boolean;
}) {
  const name     = (product.name  ?? (product as any).isim  ?? "").trim();
  const brand    = (product.brand ?? (product as any).marka ?? "").trim();
  const imageUrl = resolveImageUrl(product as any);
  const thumbUrl = resolveThumbnailUrl(product as any);

  return (
    <View
      style={[
        styles.currentBar,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <LocalThumb
        imageUrl={imageUrl}
        thumbnailUrl={thumbUrl}
        size={56}
        borderRadius={12}
        isDark={isDark}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[styles.currentBrand, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {brand}
        </Text>
        <Text
          style={[styles.currentName, { color: colors.text }]}
          numberOfLines={2}
        >
          {name}
        </Text>
      </View>
      <View
        style={[
          styles.aBadge,
          { backgroundColor: PRIMARY + "20", borderColor: PRIMARY + "40" },
        ]}
      >
        <Text style={[styles.aBadgeText, { color: PRIMARY }]}>A</Text>
      </View>
    </View>
  );
}

// ── Aday satırı ──────────────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  onPress,
  colors,
  isDark,
}: {
  candidate: ComparisonCandidate;
  onPress: () => void;
  colors: any;
  isDark: boolean;
}) {
  const p        = candidate.product;
  const name     = (p.name  ?? p.isim  ?? "").trim();
  const brand    = (p.brand ?? p.marka ?? "").trim();
  const imageUrl = resolveImageUrl(p);
  const thumbUrl = resolveThumbnailUrl(p);
  const score    = getScore(p);
  const sc       = score != null ? getScoreColors(score) : null;
  const lStyle   = labelStyle(candidate.label);
  const usingFallback = !imageUrl && !thumbUrl;

  // Hafif "why suggested" satırı. O(1) keyword check, per-item useMemo.
  // FlatList virtualization sayesinde sadece görünen satır + buffer için
  // çağrılır. Asla filtreleme/scoring/badge mantığını etkilemez.
  const effect = useMemo(() => getEffectResult(p), [p]);

  // DEBUG — geçici
  console.log("[mukayese-adayi] aday:", name, "| image_url:", imageUrl, "| thumbnail_url:", thumbUrl, "| fallback:", usingFallback);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.candidateRow,
        { backgroundColor: colors.surfaceCard, borderColor: colors.border },
      ]}
    >
      {/* Thumbnail */}
      <LocalThumb
        imageUrl={imageUrl}
        thumbnailUrl={thumbUrl}
        size={60}
        borderRadius={12}
        isDark={isDark}
      />

      {/* Bilgi */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={[styles.candidateBrand, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {brand}
        </Text>
        <Text
          style={[styles.candidateName, { color: colors.text }]}
          numberOfLines={2}
        >
          {name}
        </Text>
        {effect.reason ? (
          <Text
            style={[styles.candidateReason, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {effect.reason}
          </Text>
        ) : null}
        <View style={[styles.labelPill, { backgroundColor: lStyle.bg }]}>
          <Text style={[styles.labelText, { color: lStyle.fg }]}>
            {candidate.label}
          </Text>
        </View>
      </View>

      {/* Puan + ok */}
      <View style={{ alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        {sc && score != null && (
          <View
            style={[styles.scoreBadge, { backgroundColor: sc.bg }]}
          >
            <Text style={[styles.scoreText, { color: sc.main }]}>
              {score}
            </Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// ── Ekran ─────────────────────────────────────────────────────────────────────

export default function MukayeseAdayiScreen() {
  const colors  = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;

  const __routeParams = useLocalSearchParams<{ productId: string }>();
  const { productId } = __routeParams;
  const { products, loading } = useSupabaseProducts();

  // ── 1000-cap bypass: single-product fallback + complete candidate pool ──
  // Home loader pages in 1000-row chunks but warm cache hydration / slow
  // refreshes can leave `products` capped at 1000 when this screen mounts.
  // Two safety nets, additive only — pairKey/filter/sort logic untouched:
  //   (a) currentProductFallback : if route id not present in `products`,
  //       fetch that single Supabase row by id (UUID-only path).
  //   (b) directCandidatesPool   : once we know currentProduct, fetch the
  //       full category+subcategory pool from Supabase (paginated, no cap)
  //       and feed it into the existing findComparisonCandidates call.
  const [currentProductFallback, setCurrentProductFallback] = useState<Product | null>(null);
  const [directCandidatesPool, setDirectCandidatesPool] = useState<Product[] | null>(null);
  const [fetchedById, setFetchedById] = useState<boolean>(false);
  const [candidateSource, setCandidateSource] = useState<"local" | "supabase-direct" | "paginated">("local");
  // Tracks the in-flight single-product fetch (Effect (a) below) so the
  // render can show a spinner instead of flashing "Ürün bulunamadı" before
  // the async fallback resolves.
  const [isResolvingCurrentProduct, setIsResolvingCurrentProduct] = useState<boolean>(false);

  const { currentProduct, candidates } = useMemo(() => {
    const pool: Product[] = directCandidatesPool ?? products;
    if (!productId || (pool.length === 0 && !currentProductFallback)) {
      return { currentProduct: null as Product | null, candidates: [] };
    }
    const normalizedId = String(productId).trim().toLowerCase();
    const fromPool = pool.find(
      (p) => String(p.id).trim().toLowerCase() === normalizedId,
    );
    const current: Product | null =
      (fromPool as Product | undefined) ?? currentProductFallback;

    if (__DEV__ && !current) {
      console.log("DEBUG productId:", productId);
      console.log(
        "DEBUG first product ids:",
        pool.slice(0, 3).map((p) => p.id),
      );
    }

    if (!current) return { currentProduct: null as Product | null, candidates: [] };
    return {
      currentProduct: current,
      candidates: findComparisonCandidates(current, pool),
    };
  }, [productId, products, directCandidatesPool, currentProductFallback, loading]);

  // (a) Fetch single product by id when route id is not in local list.
  //     Only kicks in after local list has been queried at least once
  //     (loading=false) and only for UUID-shaped ids (fetchSupabaseProductById
  //     returns null for non-UUID inputs — safe no-op).
  useEffect(() => {
    if (!productId) return;
    if (currentProductFallback) return;
    const nId = String(productId).trim().toLowerCase();
    const inLocal = products.some(
      (p) => String(p.id).trim().toLowerCase() === nId,
    );
    if (inLocal) return;
    if (loading) return;
    let cancelled = false;
    setIsResolvingCurrentProduct(true);
    fetchSupabaseProductById(String(productId))
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setCurrentProductFallback(p);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        // fetchedById marks the resolution attempt as complete (success OR
        // miss) so the empty-state can finally render. Paired with
        // isResolvingCurrentProduct=false below to gate the "Ürün
        // bulunamadı" branch behind a fully-finished async attempt.
        setFetchedById(true);
        setIsResolvingCurrentProduct(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, products, loading, currentProductFallback]);

  // (b) Fetch complete candidate pool by category+subcategory once we
  //     know what currentProduct is. Bypasses the 1000-row response cap
  //     and caches per (category|subcategory) for the session.
  //     Trigger is keyed on currentProduct?.id so it fires for both the
  //     local lookup and the fetched-by-id fallback. Any prior pool is
  //     overwritten — local → supabase-direct upgrade is desired.
  useEffect(() => {
    if (!currentProduct) return;
    const cur: any = currentProduct;
    const cat: string | undefined = cur.category ?? cur.kategori;
    const sub: string | undefined = cur.subcategory;
    if (!cat) return;
    let isMounted = true;
    (async () => {
      const data = await fetchSupabaseCompareCandidates(cat, sub);
      if (!isMounted) return;
      setDirectCandidatesPool(data);
      setCandidateSource("supabase-direct");
    })();
    return () => {
      isMounted = false;
    };
  }, [currentProduct?.id]);

  // ── ADDITIVE LAYER 1: havuzu genişlet (50'ye kadar) ─────────────────────────
  // Mevcut `candidates` listesi (≤5) DEĞİŞTİRİLMEZ. findSimilarProducts(50)
  // ile aynı kategorideki ek ürünler eklenir. Tip uyumu için her ek item
  // ComparisonCandidate şekline wrap edilir. Çakışan id'lerde BASE öncelikli
  // (similar overwrite ETMEZ).
  const extendedCandidates = useMemo<ComparisonCandidate[]>(() => {
    const base: ComparisonCandidate[] = candidates ?? [];
    if (!currentProduct) return base;
    try {
      const pool = (directCandidatesPool ?? products) as Product[];
      const seen = new Set(base.map((c) => String(c.product.id)));
      const normalizedCurrent = normalizeProductData(currentProduct as Product);
      const similar = findSimilarProducts(normalizedCurrent, pool as any, 50);

      const extras: ComparisonCandidate[] = [];
      for (const s of similar) {
        const id = String(s.product.id);
        if (seen.has(id)) continue;
        // Size-variant guard — findSimilarProducts kendi içinde
        // arePairsCompatible çağırmıyor; aynı markanın 50ml vs 100ml
        // varyantı, concern-clash veya kategori uyumsuzluğu burada
        // base'e sızmasın diye paylaşılan kuralı uyguluyoruz.
        if (!arePairsCompatible(currentProduct as any, s.product as any)) continue;
        // HARD RAW CATEGORY GUARD — defansif ek kat. findSimilarProducts
        // pairKey'siz raw category karşılaştırması yapsa da, normalize
        // edilmiş kategori farklı bir alana düşmüş olabilir; raw eşitlik
        // şart.
        if (!sameRawCategory(currentProduct as any, s.product as any)) {
          logCategoryGuardBlock("extendedCandidates.similar", currentProduct as any, s.product as any);
          continue;
        }
        extras.push({
          product:  s.product,
          label:    "Aynı kategori" as CandidateLabel,
          priority: 99, // base'in altında kalsın
        });
        seen.add(id);
      }

      // ── ADDITIVE LAYER 3 (loose) ────────────────────────────────────────
      // Strict + Similar katmanlarını DEĞİŞTİRMEZ. Genişletilmiş loose
      // matcher (keyword + strong-intent pair) ile aday üretir. Self ve
      // önceki id'ler hariç. Size-variant / concern çakışması güvenliği
      // için arePairsCompatible burada da uygulanır.
      //
      // Priority ayrımı:
      //   - same-subcategory loose hit  → 150
      //   - cross-subcategory / cross-category strong alt → 180
      //
      // CandidateLabel union şu an yalnızca iki değer kabul ediyor;
      // ranking/gruplama tamamen priority alanı üzerinden yürüdüğü için
      // label "Aynı kategori" olarak tutuluyor (lib/comparisonCandidates.ts
      // dokunulmadı). Treatment-focus split'i strict-only ID gating'i
      // kullandığından bu itemların hepsi otomatik "Alternatifler"
      // sekmesine düşer (samePurpose'a sızmaz).
      const loose = findLooseCandidates(currentProduct as Product, pool);
      const looseExtras: ComparisonCandidate[] = [];
      for (const hit of loose) {
        const p = hit.product;
        const id = String((p as any).id ?? "");
        if (!id || seen.has(id)) continue;
        if (!arePairsCompatible(currentProduct as any, p as any)) continue;
        // HARD RAW CATEGORY GUARD (defansif — findLooseCandidates kendi
        // içinde de uyguluyor; bu ekstra kat regression-safety amaçlıdır).
        if (!sameRawCategory(currentProduct as any, p as any)) {
          logCategoryGuardBlock("extendedCandidates.loose", currentProduct as any, p as any);
          continue;
        }
        looseExtras.push({
          product:  p,
          label:    "Aynı kategori" as CandidateLabel,
          priority: hit.isCross ? 180 : 150,
        });
        seen.add(id);
      }

      // Final cap (20) — strict + similar + loose toplamı 20 ile sınırlı.
      // Strict items önce gelir → priority koruması doğal sıralamayla.
      return [...base, ...extras, ...looseExtras].slice(0, 20);
    } catch {
      return base;
    }
  }, [candidates, currentProduct, products, directCandidatesPool]);

  // ── Loose id seti ─────────────────────────────────────────────────────────
  // `findLooseCandidates` çıktısının id'lerini ayrı tutuyoruz ki aşağıdaki
  // treatment-focus split'i bu id'leri ZORLA "Alternatifler" sekmesine
  // koyabilsin. ComparisonCandidate tipini (paylaşılan lib içinde) `isLoose`
  // alanıyla genişletmek istemediğimiz için flag'i bu sibling Set ile
  // dışarıda tutuyoruz — semantik olarak `c.isLoose === true` yerine
  // `looseIds.has(String(c.product.id))` okunur.
  const looseIds = useMemo<Set<string>>(() => {
    if (!currentProduct) return new Set<string>();
    try {
      const pool = (directCandidatesPool ?? products) as Product[];
      const loose = findLooseCandidates(currentProduct as Product, pool);
      return new Set(
        loose
          .map((hit) => String((hit.product as any).id ?? ""))
          .filter(Boolean),
      );
    } catch {
      return new Set<string>();
    }
  }, [currentProduct, products, directCandidatesPool]);

  // ── ADDITIVE LAYER 2: treatment focus (görev) ile gruplama ──────────────────
  // E4/F4 ARCHITECTURE FIX:
  //   • samePurpose & alternativePurpose are computed INDEPENDENTLY then
  //     cross-deduped (samePurpose wins ties).
  //   • Dedup uses BOTH id AND canonical key (brand::name-without-size).
  //   • Current product is excluded by id AND canonical key.
  //   • arePairsCompatible guard re-applied at the alt level (defensive).
  //   • Each tab capped at PER_TAB_CAP (20).
  //   • The old `primaryList = samePurpose || extendedCandidates` fallback
  //     is REMOVED — that fallback caused both tabs to render the same
  //     items whenever samePurpose was empty (the reported bug).
  //
  // filterByTreatmentFocus Product[] alır → ComparisonCandidate'ı id üzerinden
  // map'lerle yeniden eşleştirip ComparisonCandidate[] döneriz (FlatList row
  // şeklini koru). Hatada güvenli passthrough.
  const { samePurpose, alternativePurpose } = useMemo<{
    samePurpose: ComparisonCandidate[];
    alternativePurpose: ComparisonCandidate[];
  }>(() => {
    const empty = { samePurpose: [] as ComparisonCandidate[], alternativePurpose: [] as ComparisonCandidate[] };
    if (!currentProduct || extendedCandidates.length === 0) return empty;

    // Architect feedback (medium): if the split throws unexpectedly, do not
    // collapse to empty tabs — that creates a "tab counts say 0/0 but
    // visibleData still shows strict candidates" inconsistency. Instead
    // return a deduped passthrough as samePurpose so the user always sees
    // a non-empty primary tab matching the rendered data.
    const buildPassthroughOnError = (): {
      samePurpose: ComparisonCandidate[];
      alternativePurpose: ComparisonCandidate[];
    } => {
      try {
        const safeSame = dedupeCompareProducts(
          extendedCandidates,
          currentProduct as any,
        ).slice(0, PER_TAB_CAP);
        return { samePurpose: safeSame, alternativePurpose: [] };
      } catch {
        return empty;
      }
    };

    try {
      const productList = extendedCandidates.map((c) => c.product as Product);
      const split = filterByTreatmentFocus(currentProduct as Product, productList);
      const sameIds = new Set(split.samePurpose.map((p) => normalizeProductId(p.id)));
      const _altIds = new Set(split.alternativePurpose.map((p) => normalizeProductId(p.id)));
      void _altIds;

      // STRICT-ONLY ID Set — only Layer 0 (findComparisonCandidates) items
      // are eligible for "Aynı Amaç". Similar (Layer 1) and loose (Layer 3)
      // additions always fall to "Alternatifler" regardless of treatment
      // focus overlap. This keeps the primary tab tight and trustworthy.
      const strictIds = new Set(
        (candidates ?? []).map((c) => normalizeProductId(c.product?.id)),
      );

      // Pass 1: same-purpose pool (strict ∩ treatment-focus overlap),
      // dedupe by id+key, exclude current.
      const sameRaw: ComparisonCandidate[] = [];
      for (const c of extendedCandidates) {
        const id = normalizeProductId(c.product?.id);
        if (!id) continue;
        if (strictIds.has(id) && sameIds.has(id)) sameRaw.push(c);
      }
      const sameDeduped = dedupeCompareProducts(sameRaw, currentProduct as any).slice(
        0,
        PER_TAB_CAP,
      );

      // Build the "already taken" id+key sets so alternatives can never
      // duplicate a same-purpose item or the current product.
      const sameTakenIds = new Set<string>();
      const sameTakenKeys = new Set<string>();
      for (const c of sameDeduped) {
        const id = normalizeProductId(c.product?.id);
        if (id) sameTakenIds.add(id);
        const k = getCompareDedupeKey(c.product as any);
        if (k) sameTakenKeys.add(k);
      }

      // Pass 2: alternatives pool (everything else from extendedCandidates),
      // exclude same-purpose items by id+key, exclude current, re-apply
      // arePairsCompatible as a defensive guard, dedupe by id+key, cap.
      const altRaw: ComparisonCandidate[] = [];
      for (const c of extendedCandidates) {
        const id = normalizeProductId(c.product?.id);
        if (!id) continue;
        if (sameTakenIds.has(id)) continue;
        const k = getCompareDedupeKey(c.product as any);
        if (k && sameTakenKeys.has(k)) continue;
        // Defensive: even though extendedCandidates upstream already runs
        // this guard, re-apply at the split boundary so any future code
        // path that bypasses Layer 1/3 still gets clean alternatives.
        if (!arePairsCompatible(currentProduct as any, c.product as any)) continue;
        altRaw.push(c);
      }
      const altDeduped = dedupeCompareProducts(altRaw, currentProduct as any).slice(
        0,
        PER_TAB_CAP,
      );

      if (__DEV__) {
        // ── E4/F4 AUDIT LOG ────────────────────────────────────────────
        // Surface every metric the spec asks for in one row: current
        // product, raw pool, layer counts, overlap (both id AND canonical
        // key — architect-suggested), current leakage and dedup
        // before/after at a glance.
        const cur: any = currentProduct;
        const curId = normalizeProductId(cur?.id);
        const curKey = getCompareDedupeKey(cur);
        const sameIdSet = new Set(sameDeduped.map((c) => normalizeProductId(c.product?.id)));
        const altIdSet = new Set(altDeduped.map((c) => normalizeProductId(c.product?.id)));
        const sameKeySet = new Set(
          sameDeduped.map((c) => getCompareDedupeKey(c.product as any)).filter(Boolean),
        );
        const altKeySet = new Set(
          altDeduped.map((c) => getCompareDedupeKey(c.product as any)).filter(Boolean),
        );
        let overlapIds = 0;
        for (const id of sameIdSet) if (altIdSet.has(id)) overlapIds++;
        let overlapKeys = 0;
        for (const k of sameKeySet) if (altKeySet.has(k)) overlapKeys++;
        const currentLeakSame = sameDeduped.some((c) => {
          const cid = normalizeProductId(c.product?.id);
          const ck = getCompareDedupeKey(c.product as any);
          return (cid && cid === curId) || (ck && ck === curKey);
        });
        const currentLeakAlt = altDeduped.some((c) => {
          const cid = normalizeProductId(c.product?.id);
          const ck = getCompareDedupeKey(c.product as any);
          return (cid && cid === curId) || (ck && ck === curKey);
        });
        // eslint-disable-next-line no-console
        console.log("[E4F4_AUDIT]", {
          current: {
            name: cur?.name ?? cur?.isim,
            brand: cur?.brand ?? cur?.marka,
            category: cur?.category ?? cur?.kategori,
            subcategory: cur?.subcategory,
            id: curId,
            key: curKey,
          },
          rawPool: products.length,
          directPool: directCandidatesPool?.length ?? null,
          source: candidateSource,
          strict: candidates.length,
          extended: extendedCandidates.length,
          treatmentSplit: { same: split.samePurpose.length, alt: split.alternativePurpose.length },
          sameRawBeforeDedupe: sameRaw.length,
          sameAfterDedupe: sameDeduped.length,
          altRawBeforeDedupe: altRaw.length,
          altAfterDedupe: altDeduped.length,
          crossListOverlapIds: overlapIds,
          crossListOverlapKeys: overlapKeys,
          currentLeakInSame: currentLeakSame,
          currentLeakInAlt: currentLeakAlt,
        });
      }

      return { samePurpose: sameDeduped, alternativePurpose: altDeduped };
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[E4F4_AUDIT] split threw, returning passthrough:", err);
      }
      // Architect-recommended safe fallback: passthrough deduped extended
      // list as samePurpose so tab counts and rendered data stay coherent.
      return buildPassthroughOnError();
    }
  }, [currentProduct, extendedCandidates, candidates, products, directCandidatesPool, candidateSource]);

  // Step 3 — UI grupları.
  // E4/F4 FIX: removed `samePurpose.length > 0 ? samePurpose : extendedCandidates`
  // fallback. That fallback was the root cause of the duplicate-list bug —
  // when samePurpose was empty, primaryList collapsed onto the same set as
  // alternativePurpose, so both tabs rendered the identical items.
  // Now the two tabs are strictly independent.
  const primaryList     = samePurpose;
  const alternativeList = alternativePurpose;

  // Step 3.5 — UI ranking layer (filtre DEĞİL).
  // Birleşik skor:  finalScore = focusScore * 10 + formScore
  //   • Amaç (treatment focus) BASKIN sinyal — 10x ağırlık.
  //   • Form (krem/losyon/sprey/...) yalnızca aynı amaç içinde
  //     ince ayar: 0/1/2 puan.
  // Sıralama stable: identical skorlu öğeler arasında orijinal göreli
  // sıra korunur (Array.prototype.sort ES2019+ stable). Hata olursa
  // orijinal listeye fallback (asla crash, asla boş ekran).
  // Form farklı diye HİÇBİR ürün listeden çıkarılmaz — sadece sırası
  // değişir (krem ↔ losyon hâlâ görünür kalır).
  const rankedPrimaryList = useMemo<ComparisonCandidate[]>(() => {
    try {
      return [...primaryList].sort((x, y) => {
        const sx = getFinalRankScore(currentProduct as Product | null, x.product as Product);
        const sy = getFinalRankScore(currentProduct as Product | null, y.product as Product);
        return sy - sx;
      });
    } catch {
      return primaryList;
    }
  }, [primaryList, currentProduct]);

  const rankedAlternativeList = useMemo<ComparisonCandidate[]>(() => {
    try {
      return [...alternativeList].sort((x, y) => {
        const sx = getFinalRankScore(currentProduct as Product | null, x.product as Product);
        const sy = getFinalRankScore(currentProduct as Product | null, y.product as Product);
        return sy - sx;
      });
    } catch {
      return alternativeList;
    }
  }, [alternativeList, currentProduct]);

  // Step 4 — basit toggle
  const [activeTab, setActiveTab] = useState<"primary" | "alt">("primary");

  // Step 4.5 — aday içi local search (Supabase / global search'e DEĞMEZ)
  const [candidateQuery, setCandidateQuery] = useState("");

  // ── E4/F5 EMPTY-STATE UX FIX ────────────────────────────────────────────────
  //  • E4/F4 sonrası "Aynı Amaç" boş olabiliyor (örn. Lipikar Huile Lavante AP+).
  //  • Teknik olarak doğru ama UX olarak kuru.
  //  • Çözüm (additive): boş primary + dolu alt durumunda kullanıcıyı
  //    otomatik "Alternatifler" tabına al, primary tab'ı disabled göster,
  //    küçük bir eczacı tonlu bilgi metni ile durumu izah et.
  //  • Dedup / candidate resolver / pair compatibility mimarisine DOKUNMAZ.
  //  • F4 cross-list dedupe korunur, eski kötü fallback geri gelmez.
  const hasSamePurpose  = rankedPrimaryList.length > 0;
  const hasAlternatives = rankedAlternativeList.length > 0;

  useEffect(() => {
    // Primary boş + alt dolu + kullanıcı hâlâ "primary" sekmesindeyse
    // sessizce "alt" sekmesine al (boş ekran göstermeyelim).
    if (!hasSamePurpose && hasAlternatives && activeTab === "primary") {
      setActiveTab("alt");
    }
  }, [hasSamePurpose, hasAlternatives, activeTab]);

  // Bilgi metni: yalnızca primary boş + alt dolu durumunda göster.
  // Her iki liste de boşsa ListEmptyComponent zaten kapsamlı bir mesaj
  // gösterecek (aşağıda), o yüzden burada banner basmıyoruz.
  const showAltOnlyNotice = !hasSamePurpose && hasAlternatives;

  // Architect-suggested hardening (Low): keep the audit log effect-scoped
  // so it fires only when the tracked scalars change — avoids every-render
  // DEV-console spam while preserving full diagnostic coverage.
  useEffect(() => {
    if (!__DEV__) return;
    // eslint-disable-next-line no-console
    console.log("[E4F5_EMPTY_STATE]", {
      hasSamePurpose,
      hasAlternatives,
      activeTab,
      visibleCount:
        activeTab === "primary"
          ? rankedPrimaryList.length
          : rankedAlternativeList.length,
    });
  }, [
    hasSamePurpose,
    hasAlternatives,
    activeTab,
    rankedPrimaryList.length,
    rankedAlternativeList.length,
  ]);

  // Step 6 + Step 7 safety: aktif tab boş ise diğerine düş, o da boşsa orijinal
  // candidates'a fallback (asla boş ekran). Ranked versiyonları tüket ki
  // FlatList'e geçen sıralama, treatment-focus benzerliğine göre olsun.
  const visibleData: ComparisonCandidate[] = useMemo(() => {
    const picked = activeTab === "primary" ? rankedPrimaryList : rankedAlternativeList;
    if (picked.length > 0) return picked;
    const other = activeTab === "primary" ? rankedAlternativeList : rankedPrimaryList;
    if (other.length > 0) return other;
    return candidates as ComparisonCandidate[];
  }, [activeTab, rankedPrimaryList, rankedAlternativeList, candidates]);

  // Step 4.6 — query uygulanmış aday listesi.
  // Kaynak: aktif sekmenin kendi listesi (varsa); yoksa visibleData fallback.
  // Field set: name/isim, brand/marka, category/kategori, subcategory.
  // (Codebase pattern'iyle TR alternatifleri de haystack'a eklendi —
  //  CandidateRow zaten name ?? isim, brand ?? marka okuyor.)
  const filteredVisibleData = useMemo<ComparisonCandidate[]>(() => {
    const q = normalize(candidateQuery);
    const source = activeTab === "primary" ? rankedPrimaryList : rankedAlternativeList;
    const safeSource = source.length > 0 ? source : visibleData;
    if (!q) return safeSource;

    try {
      return safeSource.filter((item) => {
        const p: any = item.product;
        const haystack = normalize(
          [
            p?.name,
            p?.isim,
            p?.brand,
            p?.marka,
            p?.category,
            p?.kategori,
            p?.subcategory,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return haystack.includes(q);
      });
    } catch {
      return safeSource;
    }
  }, [candidateQuery, activeTab, rankedPrimaryList, rankedAlternativeList, visibleData]);

  // Step 4.7 — FlatList'e verilecek son liste:
  //  • Query yok          → visibleData (mevcut davranış, regresyon yok)
  //  • Query var + match  → filteredVisibleData
  //  • Query var + 0 match → boş array (özel boş-state mesajı tetiklenir)
  const listData = candidateQuery.trim()
    ? filteredVisibleData
    : visibleData;

  const handleSelect = (candidate: ComparisonCandidate) => {
    router.push(
      `/mukayese-detay?idA=${productId}&idB=${candidate.product.id}` as any
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, borderBottomColor: colors.borderLight },
        ]}
      >
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Karşılaştırma Adayı Seçin
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {(() => {
        // ── Empty-state gating (refactor v3) ───────────────────────────────
        // Show spinner whenever the local product list is still loading OR
        // the single-product async fallback is in flight OR we know the
        // route id but the fallback hasn't even started/completed yet
        // (`!fetchedById` covers the first frame after products finish
        // loading and before Effect (a) runs). "Ürün bulunamadı" only
        // renders after a fully-finished async attempt: loading=false AND
        // isResolvingCurrentProduct=false AND fetchedById=true AND still
        // no currentProduct. This eliminates the brief flash and the
        // false missing-product alert during compare candidate hydration.
        const stillResolving =
          loading ||
          isResolvingCurrentProduct ||
          (!!productId && !currentProduct && !fetchedById);
        const showNotFound =
          !stillResolving && !currentProduct && fetchedById;
        if (stillResolving) {
          return (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          );
        }
        if (showNotFound) {
          return (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Ürün bulunamadı.
              </Text>
            </View>
          );
        }
        if (!currentProduct) {
          return (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          );
        }
        return (
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.product.id)}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
            gap: 10,
          }}
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 4 }}>
              {/* Mevcut ürün */}
              <CurrentProductBar
                product={currentProduct as Product}
                colors={colors}
                isDark={isDark}
              />

              {/* Bağlayıcı ok */}
              <View style={styles.vsRow}>
                <View
                  style={[styles.vsDivider, { backgroundColor: colors.borderLight }]}
                />
                <View
                  style={[
                    styles.vsCircle,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Feather name="git-merge" size={13} color={PRIMARY} />
                </View>
                <View
                  style={[styles.vsDivider, { backgroundColor: colors.borderLight }]}
                />
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Şununla karşılaştırın:
              </Text>

              {/* ── Tab toggle: Aynı Amaç / Alternatifler ── */}
              <View
                style={[
                  styles.tabsRow,
                  { backgroundColor: colors.surface, borderColor: colors.borderLight },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setActiveTab("primary")}
                  // E4/F5: primary boş ise tab'ı pasifleştir (Option A).
                  // Görünür kalır ki kullanıcı sayıyı (0) görür ve neden
                  // "Aynı Amaç" olmadığını anlar; tıklama no-op olur,
                  // kullanıcı boş ekranda kalmaz.
                  disabled={!hasSamePurpose}
                  style={[
                    styles.tabBtn,
                    activeTab === "primary" && { backgroundColor: PRIMARY },
                    !hasSamePurpose && { opacity: 0.4 },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: activeTab === "primary" ? "#fff" : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    Aynı Amaç ({rankedPrimaryList.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab("alt")}
                  disabled={rankedAlternativeList.length === 0}
                  style={[
                    styles.tabBtn,
                    activeTab === "alt" && { backgroundColor: PRIMARY },
                    rankedAlternativeList.length === 0 && { opacity: 0.4 },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: activeTab === "alt" ? "#fff" : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    Alternatifler ({rankedAlternativeList.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── E4/F5: alt-only bilgi banner ─────────────────────────────
                   Primary boş + alt dolu: kısa, sakin, eczacı tonlu metin.
                   Mevcut tema renkleriyle uyumlu, abartısız.
              ──────────────────────────────────────────────────────────────── */}
              {showAltOnlyNotice && (
                <View
                  style={[
                    styles.noticeBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  <Feather
                    name="info"
                    size={13}
                    color={colors.textMuted}
                    style={{ marginRight: 8, marginTop: 1 }}
                  />
                  <Text
                    style={[styles.noticeText, { color: colors.textMuted }]}
                  >
                    Birebir aynı amaçta aday az. En yakın uygun alternatifleri sıraladık.
                  </Text>
                </View>
              )}

              {/* ── Aday içi local search (Supabase'e dokunmaz) ── */}
              <View
                style={[
                  styles.searchWrap,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <Feather
                  name="search"
                  size={14}
                  color={colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  value={candidateQuery}
                  onChangeText={setCandidateQuery}
                  placeholder="Karşılaştırılacak ürünü ara"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {candidateQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setCandidateQuery("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CandidateRow
              candidate={item}
              onPress={() => handleSelect(item)}
              colors={colors}
              isDark={isDark}
            />
          )}
          ListEmptyComponent={
            candidateQuery.trim() ? (
              <View style={styles.emptyBox}>
                <Feather name="search" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Bu grupta eşleşen ürün bulunamadı.
                </Text>
              </View>
            ) : (
              // E4/F5: her iki liste de boşsa kapsamlı boş-state.
              // Bu noktaya yalnızca samePurpose VE alternatives'in ikisi de
              // 0 olduğunda erişilir (visibleData fallback'i + auto-tab
              // switch sayesinde tek tarafı boş senaryoda buraya düşmeyiz).
              <View style={styles.emptyBox}>
                <Feather name="inbox" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Karşılaştırma adayı bulunamadı
                </Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Bu ürün için karşılaştırmaya uygun aday bulamadık.
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.textMuted, marginTop: 6, fontSize: 12 },
                  ]}
                >
                  Ürün havuzu genişledikçe burada daha isabetli seçenekler görünecek.
                </Text>
              </View>
            )
          }
        />
        );
      })()}
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  // Current product bar
  currentBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  currentBrand: { fontSize: 11, fontWeight: "600" },
  currentName:  { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  aBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  aBadgeText: { fontSize: 13, fontWeight: "900" },

  // VS row
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  vsDivider: { flex: 1, height: 1 },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },

  // Tab toggle (Aynı Amaç / Alternatifler)
  tabsRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginTop: 2,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },

  // In-list search (aday içi local search)
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    marginTop: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    paddingVertical: 0,
  },

  // Candidate row
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  candidateBrand: { fontSize: 11, fontWeight: "600" },
  candidateName:  { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  candidateReason: { fontSize: 11, fontWeight: "500", opacity: 0.85, marginTop: 1 },
  labelPill: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  labelText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },

  // Score
  scoreBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreText: { fontSize: 12, fontWeight: "800" },

  // States
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  // E4/F5 — alt-only bilgi banner (sakin, mute, premium ton)
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },

  emptyBox: {
    marginTop: 60,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "400",
  },
});