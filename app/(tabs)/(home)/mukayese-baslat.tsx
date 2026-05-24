/**
 * mukayese-baslat.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * E4/F7 — "Kendi karşılaştırmanı yap" giriş kapısı.
 * E4/F8 — Kart UI iyileştirme + diversified discovery + quick chips.
 *
 * AMAÇ
 *  Karar Rehberleri içindeki "Kendi karşılaştırmanı yap" akışı, ürün
 *  detayındaki "Benzer ürünlerle karşılaştır" ile AYNI motoru kullansın:
 *  Bu ekran sadece BAŞLANGIÇ ürününü seçtirir, sonra mevcut çalışan
 *  /mukayese-adayi route'una geçer ve oradaki E4/F4 dedupe + E4/F5
 *  empty-state UX motorunu olduğu gibi devralır.
 *
 * KURAL — DOKUNULMAYANLAR
 *  • Search engine, Home core data flow, Supabase schema, scoring/ingredient
 *    engine, navigation architecture, F4/F5 candidate dedupe/empty-state.
 *  • Yeni Supabase sorgusu yok — sadece useSupabaseProducts().
 *  • CustomCompareSheet kodu silinmedi; bu CTA artık o sheet'i açmıyor.
 *  • Premium gate giriş noktasında çalışır (Home + /mukayese-listesi CTA);
 *    bu ekrana defense-in-depth gate de eklendi.
 *
 * AKIŞ
 *  Karar Rehberleri → "Kendi karşılaştırmanı yap" → /mukayese-baslat
 *    → ürün seç → /mukayese-adayi?productId=<id> → /mukayese-detay
 *
 * E4/F8 — Bu turda eklenenler (sadece bu ekrana özel; başka dosya değişmez):
 *   • LocalThumb: tek-katmanlı thumbnail (~80px), double-frame hissi yok.
 *   • diversifyByBrand(): round-robin marka çeşitlendirme (ilk 24'te
 *     aynı markadan max 2 hedefi). Düşük skor sona itilir.
 *   • Quick filter chips: Tümü / Temizleyici / Serum / Nemlendirici /
 *     Güneş / Göz Çevresi — sadece local UI filtre, search engine yok.
 *   • Yardımcı bilgi metni: query/chip/empty durumlarına göre kısa metin.
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { resolveAbsoluteUri, unwrapProxyImg } from "@/lib/imageUri";
import { getDisplayScore } from "@/lib/getFinalScore";
import { getScoreColors } from "@/lib/scoreColors";
import {
  resolveImageUrl,
  resolveThumbnailUrl,
  type Product,
} from "@/types/product";

// ── Sabitler ────────────────────────────────────────────────────────────────

const POPULAR_LIMIT = 40;        // query yokken ilk gösterim
const SEARCH_LIMIT  = 60;        // query varken üst sınır
const DIVERSITY_HEAD = 24;       // ilk N içinde marka clustering yumuşatılır
const DIVERSITY_PER_BRAND = 2;   // ilk N içinde marka başına ≤2 hedef
const LOW_SCORE_THRESHOLD = 30;  // bu altı skorlar listede sona itilir

// ── Yardımcılar ─────────────────────────────────────────────────────────────

function isVerified(p: Product): boolean {
  const name  = (p.name  ?? (p as any).isim  ?? "").trim();
  const brand = (p.brand ?? (p as any).marka ?? "").trim();
  return name.length > 0 && brand.length > 0;
}

function getBrandKey(p: Product): string {
  const b = (p.brand ?? (p as any).marka ?? "").toString().trim().toLowerCase();
  return b || "_unbranded";
}

function getCatHaystack(p: Product): string {
  return [
    p.category,
    (p as any).kategori,
    (p as any).subcategory,
    (p as any).subkategori,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Çok hafif lokal filtre — search engine'e dokunmaz, regex/fuzzy yok.
 * brand/name/category/subcategory ve TR alternatifleri (isim/marka/kategori)
 * tek normalize edilmiş haystack'te arar.
 */
function matchesQuery(p: Product, q: string): boolean {
  if (!q) return true;
  const haystack = [
    p.name,
    (p as any).isim,
    p.brand,
    (p as any).marka,
    p.category,
    (p as any).kategori,
    (p as any).subcategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * E4/F8 — Round-robin brand diversification.
 *
 * - Marka bazında grupla, her grupta düşük-skor ürünleri sona it.
 * - Round-robin pick: her turda farklı bir marka'dan 1 ürün al.
 * - Sonuç: ilk DIVERSITY_HEAD ürün boyunca aynı markadan ≤
 *   DIVERSITY_PER_BRAND ürün hedeflenir; sonrası doğal sıraya döner.
 * - products array MUTATE EDİLMEZ — internal grup array'leri lokal kopya.
 */
function diversifyByBrand(items: Product[], limit: number): Product[] {
  if (items.length === 0) return [];
  // Group + within-group score-aware order
  const groups = new Map<string, Product[]>();
  for (const p of items) {
    const k = getBrandKey(p);
    const arr = groups.get(k);
    if (arr) arr.push(p);
    else groups.set(k, [p]);
  }
  const insertionOrder = Array.from(groups.keys());
  for (const k of insertionOrder) {
    const arr = groups.get(k)!;
    arr.sort((a, b) => {
      const sa = getDisplayScore(a as any);
      const sb = getDisplayScore(b as any);
      const va = sa == null ? -1 : sa;
      const vb = sb == null ? -1 : sb;
      // Düşük skor (LOW_SCORE_THRESHOLD altı) sona itilir; geri kalanı skor desc
      const lowA = va >= 0 && va < LOW_SCORE_THRESHOLD ? 1 : 0;
      const lowB = vb >= 0 && vb < LOW_SCORE_THRESHOLD ? 1 : 0;
      if (lowA !== lowB) return lowA - lowB;
      return vb - va;
    });
  }
  // Round-robin
  const out: Product[] = [];
  let progressed = true;
  while (progressed && out.length < limit) {
    progressed = false;
    for (const k of insertionOrder) {
      const arr = groups.get(k);
      if (!arr || arr.length === 0) continue;
      out.push(arr.shift()!);
      progressed = true;
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ── Quick filter chips ──────────────────────────────────────────────────────
//
// Sadece local UI filter. Mevcut category/subcategory string'lerini lowercased
// haystack'te keyword arar. Veride farklı varyantlar olabilir, bu yüzden her
// chip için geniş bir keyword seti kullanılır (TR/EN karışık). "Tümü" pass-thru.

type ChipKey = "all" | "cleanser" | "serum" | "moisturizer" | "spf" | "eye";

const CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: "all",         label: "Tümü" },
  { key: "cleanser",    label: "Temizleyici" },
  { key: "serum",       label: "Serum" },
  { key: "moisturizer", label: "Nemlendirici" },
  { key: "spf",         label: "Güneş" },
  { key: "eye",         label: "Göz Çevresi" },
];

const CHIP_KEYWORDS: Record<Exclude<ChipKey, "all">, string[]> = {
  cleanser:    ["temizleyici", "cleanser", "yüz yıkama", "yuz yikama", "jel temizleyici", "köpük", "kopuk", "face wash", "micellar", "misel"],
  serum:       ["serum", "ampul", "essence", "esans"],
  moisturizer: ["nemlendirici", "moisturizer", "krem", "cream", "lotion", "balsam", "balm"],
  spf:         ["güneş", "gunes", "spf", "sunscreen", "sun protect", "uv "],
  eye:         ["göz çevresi", "goz cevresi", "göz kremi", "goz kremi", "eye cream", "eye contour", "eye serum"],
};

function matchesChip(p: Product, chip: ChipKey): boolean {
  if (chip === "all") return true;
  const text = getCatHaystack(p);
  const keys = CHIP_KEYWORDS[chip];
  for (const k of keys) {
    if (text.includes(k)) return true;
  }
  return false;
}

// ── LocalThumb (E4/F8) ──────────────────────────────────────────────────────
//
// Tek katmanlı thumbnail. ProductImage'ın CLASSIC_PADDING ve dış kenarlığı,
// satırın surfaceCard zeminiyle birleşince "çerçeve içinde çerçeve" hissi
// oluşturuyordu. Burada ProductDetail/Home pipeline'larına dokunmadan
// sadece bu ekran için kompakt bir thumbnail render ediliyor.
function LocalThumb({
  imageUrl,
  thumbnailUrl,
  size,
  borderRadius = 12,
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
  const PAD = 4; // ~%90 doluluk; contain için minimum nefes
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

// ── Score chip (mukayese-listesi ile aynı kaynak) ───────────────────────────

const ScoreChipMini = React.memo(function ScoreChipMini({
  score,
}: {
  score: number | null;
}) {
  if (score == null) return null;
  const tone = getScoreColors(score);
  return (
    <View style={[styles.scoreChip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.scoreNum, { color: tone.main }]}>{score}</Text>
      <Text style={[styles.scoreOf, { color: tone.main }]}>/100</Text>
    </View>
  );
});

// ── Ekran ───────────────────────────────────────────────────────────────────

export default function MukayeseBaslatScreen() {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const { isSeckin } = useAuth();
  const { products, loading, error } = useSupabaseProducts();

  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<ChipKey>("all");

  // ── Defense-in-depth Seçkin gate ──────────────────────────────────────────
  // Bu ekrana iki CTA'dan giriliyor (Home Karar Rehberleri kartı +
  // /mukayese-listesi ListHeader); ikisi de free user'ı /uyelik'e atıyor.
  // Yine de derin link / future entry-point ihtimaline karşı ekran kapısında
  // aynı kuralı uyguluyoruz: free user gelirse sessizce /uyelik'e replace
  // edilir (back stack'i kirletmez). Auth hidrate olana kadar (`isSeckin`
  // undefined) işlem yapmaz — false olduğunda yönlendirir.
  useEffect(() => {
    if (isSeckin === false) {
      router.replace("/uyelik" as any);
    }
  }, [isSeckin]);

  // Verified set — mukayese-listesi / CustomCompareSheet ile aynı kural
  // (boş isim/marka temizliği). products mutate edilmez.
  const verified = useMemo(() => products.filter(isVerified), [products]);

  // Chip-filtered pool — sadece local UI; products array'e dokunmaz.
  const chipFiltered = useMemo<Product[]>(() => {
    if (chip === "all") return verified;
    return verified.filter((p) => matchesChip(p, chip));
  }, [verified, chip]);

  // ── Discovery list (query yokken) ─────────────────────────────────────────
  // E4/F8: round-robin marka çeşitlendirmeli. POPULAR_LIMIT cap.
  const discoveryList = useMemo<Product[]>(() => {
    return diversifyByBrand(chipFiltered, POPULAR_LIMIT);
  }, [chipFiltered]);

  // ── Search list (query varken) ────────────────────────────────────────────
  // - Önce match olanları topla (SEARCH_LIMIT cap).
  // - Sonra ilk DIVERSITY_HEAD parçayı diversifyByBrand'le yumuşat;
  //   geri kalan match doğruluğunu bozmadan eklenir.
  const searchList = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matched: Product[] = [];
    for (const p of chipFiltered) {
      if (matchesQuery(p, q)) matched.push(p);
      if (matched.length >= SEARCH_LIMIT) break;
    }
    if (matched.length <= DIVERSITY_HEAD) {
      return diversifyByBrand(matched, matched.length);
    }
    const head = matched.slice(0, DIVERSITY_HEAD);
    const tail = matched.slice(DIVERSITY_HEAD);
    return [...diversifyByBrand(head, DIVERSITY_HEAD), ...tail];
  }, [chipFiltered, query]);

  const visibleList = query.trim().length > 0 ? searchList : discoveryList;

  // Yardımcı bilgi metni (kısa, sakin)
  const infoText = useMemo<string | null>(() => {
    if (query.trim().length > 0) return null;
    if (chip !== "all") return "Liste seçtiğin kategoriye göre daraltıldı.";
    return "Farklı marka ve kategorilerden ürünler gösteriliyor.";
  }, [query, chip]);

  // Ürün seçilince mevcut çalışan candidate route'a — product detail'deki
  // "Benzer ürünlerle karşılaştır" ile birebir aynı param shape.
  const handlePick = (product: Product) => {
    const id = String(product.id ?? "").trim();
    if (!id) return;
    router.push(`/mukayese-adayi?productId=${encodeURIComponent(id)}` as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/" as any);
  };

  // ── Tema-uyumlu yumuşak çerçeve ───────────────────────────────────────────
  const softBorder = isDark ? "rgba(184,115,51,0.22)" : "#E8DFD3";
  const chipActiveBg = isDark ? "#2A2218" : "#FFF4E6";
  const chipActiveBorder = isDark ? "rgba(226,183,122,0.55)" : "#E2B77A";
  const chipActiveText = isDark ? "#E2B77A" : "#9C6A2A";

  // ── Liste satırı ──────────────────────────────────────────────────────────
  const renderRow = ({ item }: { item: Product }) => {
    const name  = (item.name  ?? (item as any).isim  ?? "—") as string;
    const brand = (item.brand ?? (item as any).marka ?? "") as string;
    const cat   = ((item as any).subcategory
                ?? item.category
                ?? (item as any).kategori
                ?? "") as string;
    const score = getDisplayScore(item as any);

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: colors.surfaceCard, borderColor: softBorder },
        ]}
        activeOpacity={0.78}
        onPress={() => handlePick(item)}
      >
        <LocalThumb
          imageUrl={resolveImageUrl(item as any)}
          thumbnailUrl={resolveThumbnailUrl(item as any)}
          size={80}
          borderRadius={12}
          isDark={isDark}
        />
        <View style={styles.rowText}>
          {brand ? (
            <Text
              style={[styles.rowBrand, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {brand}
            </Text>
          ) : null}
          <Text
            style={[styles.rowName, { color: colors.text }]}
            numberOfLines={2}
          >
            {name}
          </Text>
          <View style={styles.rowMetaRow}>
            {cat ? (
              <Text
                style={[styles.rowCat, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {cat}
              </Text>
            ) : null}
            <ScoreChipMini score={score} />
          </View>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleInner}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? "rgba(251,232,208,0.16)" : "#FBE8D0" },
              ]}
            >
              <Feather
                name="git-merge"
                size={14}
                color={isDark ? "#E2B77A" : "#B9823D"}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              Kendi karşılaştırmanı yap
            </Text>
          </View>
          <View style={styles.backBtn} />
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Bir ürünü seç; aynı amaçtaki seçenekleri ve en yakın alternatifleri birlikte görelim.
        </Text>
      </View>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: softBorder },
          ]}
        >
          <Feather name="search" size={14} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ürün veya marka ara"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Quick filter chips (E4/F8) ───────────────────────────────────── */}
      {/* style={chipsScroll} flexGrow:0/flexShrink:0 — sibling FlatList'in flex
         baskısı altında horizontal ScrollView'ın dikey squish'ini engeller. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {CHIPS.map((c) => {
          const active = chip === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              activeOpacity={0.78}
              onPress={() => setChip(c.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? chipActiveBg : colors.surface,
                  borderColor: active ? chipActiveBorder : softBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? chipActiveText : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Info text ────────────────────────────────────────────────────── */}
      {infoText ? (
        <View style={styles.infoWrap}>
          <Feather name="info" size={11} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]} numberOfLines={2}>
            {infoText}
          </Text>
        </View>
      ) : null}

      {/* ── İçerik ───────────────────────────────────────────────────────── */}
      {loading && verified.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Yükleniyor...
          </Text>
        </View>
      ) : error && verified.length === 0 ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Ürünler yüklenemedi.
          </Text>
        </View>
      ) : verified.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={28} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Henüz karşılaştırılabilir ürün bulunamadı.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleList}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          // Performance — Home FlatList stabilitesini bozmadan, bu ekrana
          // özel hafif tuning. removeClippedSubviews web'de off (web'de
          // ölçüm sorunlarına neden olur).
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="search" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {query.trim().length > 0
                  ? "Aramana uygun ürün bulunamadı."
                  : "Bu kategoride ürün bulunamadı."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800" as const },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },

  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.2 },

  infoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 4,
  },
  infoText: { flex: 1, fontSize: 11, lineHeight: 15 },

  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  rowText: { flex: 1, gap: 1 },
  rowBrand: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.2 },
  rowName: { fontSize: 13.5, fontWeight: "700" as const, lineHeight: 18 },
  rowMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
    flexWrap: "wrap",
  },
  rowCat: { fontSize: 10, fontWeight: "500" as const },

  scoreChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "baseline",
  },
  scoreNum: { fontSize: 11, fontWeight: "800" as const },
  scoreOf: { fontSize: 9, fontWeight: "600" as const, marginLeft: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 13, textAlign: "center" },

  emptyBox: {
    marginTop: 60,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});