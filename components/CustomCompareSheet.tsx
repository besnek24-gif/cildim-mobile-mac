/**
 * CustomCompareSheet
 * ─────────────────────────────────────────────────────────────────────────────
 * Kullanıcı kendi ürün çiftini seçip karşılaştırmaya gönderir.
 *
 * Kurallar:
 *  • compareProducts / scoring / badge / Supabase / search / splash dokunulmaz.
 *  • Aday motoru olarak yalnızca lib/comparisonCandidates kullanılır
 *    (zaten arePairsCompatible'dan geçer).
 *  • İkinci ürün seçimi öncesi ek arePairsCompatible guard'ı çalışır.
 *  • Yeni Supabase sorgusu YOK — useSupabaseProducts'tan gelen liste filtre.
 *  • Premium gating dokunulmaz; modal ücretsiz açılır, navigation
 *    mevcut /mukayese-detay yolunu kullanır.
 */

import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { findComparisonCandidates } from "@/lib/comparisonCandidates";
import { arePairsCompatible } from "@/lib/pairKey";
import { sameRawCategory, logCategoryGuardBlock } from "@/lib/sameRawCategory";
import { openCompareDetail } from "@/lib/openCompareDetail";
import { resolveAbsoluteUri, unwrapProxyImg } from "@/lib/imageUri";
import {
  resolveImageUrl,
  resolveThumbnailUrl,
  type Product,
} from "@/types/product";

// ── Local thumbnail (Phase 2 / Step 2) ─────────────────────────────────────
// ProductImage'ın CLASSIC_PADDING=8 dolgusu satır görselini çerçeve içinde
// küçük gösteriyordu. Global ProductImage dokunulmaz; bu dosyaya özel,
// %88-92 doluluk veren küçük yerel thumbnail kullanılır. resizeMode="contain"
// korunur, siyah border yok (tema-uyumlu krem/koyu zemin).
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
  const PAD = 3; // 8 → 3: image now ~%88-92 of frame
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

interface Props {
  visible: boolean;
  onClose: () => void;
  products: Product[];
}

const POPULAR_LIMIT = 24;
const SEARCH_LIMIT = 24;
const CANDIDATE_LIMIT = 12;

function isVerified(p: Product): boolean {
  const name = (p.name ?? (p as any).isim ?? "").trim();
  const brand = (p.brand ?? (p as any).marka ?? "").trim();
  return name.length > 0 && brand.length > 0;
}

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
    (p as any).short_benefit,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CustomCompareSheet({ visible, onClose, products }: Props) {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const [firstProduct, setFirstProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const verified = useMemo(() => products.filter(isVerified), [products]);

  const handleClose = () => {
    setFirstProduct(null);
    setQuery("");
    setWarning(null);
    onClose();
  };

  // ── Adım 1 — A seçimi listesi ───────────────────────────────────────────
  const firstList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return verified.slice(0, POPULAR_LIMIT);
    const filtered: Product[] = [];
    for (const p of verified) {
      if (matchesQuery(p, q)) filtered.push(p);
      if (filtered.length >= SEARCH_LIMIT) break;
    }
    return filtered;
  }, [verified, query]);

  // ── Adım 2 — A için aday önerileri (mevcut motor) ───────────────────────
  const candidates = useMemo(() => {
    if (!firstProduct) return [];
    return findComparisonCandidates(firstProduct, verified, {
      maxCount: CANDIDATE_LIMIT,
      minSubCount: 3,
    }).map((c) => c.product as Product);
  }, [firstProduct, verified]);

  // Kullanıcı arama yaptıysa adaylar yerine filtre sonucunu göster.
  const secondList = useMemo(() => {
    if (!firstProduct) return [];
    const q = query.trim().toLowerCase();
    const firstId = String(firstProduct.id ?? "");
    if (!q) return candidates.filter((p) => String(p.id ?? "") !== firstId);
    const filtered: Product[] = [];
    for (const p of verified) {
      if (String(p.id ?? "") === firstId) continue;
      if (matchesQuery(p, q)) filtered.push(p);
      if (filtered.length >= SEARCH_LIMIT) break;
    }
    return filtered;
  }, [firstProduct, candidates, verified, query]);

  const handleFirstPick = (p: Product) => {
    setFirstProduct(p);
    setQuery("");
    setWarning(null);
  };

  const handleSecondPick = (p: Product) => {
    if (!firstProduct) return;
    if (!arePairsCompatible(firstProduct as any, p as any)) {
      setWarning(
        "Bu iki ürün sağlıklı karşılaştırma için uygun değil. Aynı kategori ve benzer amaçtaki ürünleri seçmelisin.",
      );
      return;
    }
    // HARD RAW CATEGORY GUARD — manuel seçim de raw kategori eşitliğini
    // zorunlu kılar. pairKey isim-fallback'inin (örn. "krem" → "nemlendirici")
    // farklı kategorileri köprülemesini engeller.
    if (!sameRawCategory(firstProduct as any, p as any)) {
      logCategoryGuardBlock("CustomCompareSheet", firstProduct as any, p as any);
      setWarning(
        "Bu iki ürün farklı kategorilerden. Aynı kategorideki bir ürün seçmelisin.",
      );
      return;
    }
    openCompareDetail(firstProduct.id as any, p.id as any);
    handleClose();
  };

  const handleClearFirst = () => {
    setFirstProduct(null);
    setQuery("");
    setWarning(null);
  };

  // ── Tema-uyumlu yumuşak çerçeve (siyah border'dan kaçın) ────────────────
  const softBorder = isDark
    ? "rgba(184,115,51,0.22)" // copper-tinted, dark için
    : "#E8DFD3"; // warm beige, light için

  // ── Liste satırı ────────────────────────────────────────────────────────
  const renderRow = ({ item }: { item: Product }) => {
    const name = (item.name ?? (item as any).isim ?? "—") as string;
    const brand = (item.brand ?? (item as any).marka ?? "") as string;
    const cat = (item.category ?? (item as any).kategori ?? "") as string;
    const onPress = firstProduct ? () => handleSecondPick(item) : () => handleFirstPick(item);

    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: colors.surfaceCard,
            borderColor: softBorder,
          },
        ]}
        activeOpacity={0.78}
        onPress={onPress}
      >
        <LocalThumb
          imageUrl={resolveImageUrl(item as any)}
          thumbnailUrl={resolveThumbnailUrl(item as any)}
          size={52}
          borderRadius={10}
          isDark={isDark}
        />
        <View style={styles.rowText}>
          {brand ? (
            <Text style={[styles.rowBrand, { color: colors.textMuted }]} numberOfLines={1}>
              {brand}
            </Text>
          ) : null}
          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={2}>
            {name}
          </Text>
          {cat ? (
            <Text style={[styles.rowCat, { color: colors.textMuted }]} numberOfLines={1}>
              {cat}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceCard,
              borderColor: softBorder,
              paddingBottom: (insets.bottom || 12) + 12,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: isDark ? "#3A3A3A" : "#E5DDD6" }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Kendi karşılaştırmanı yap</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                İki ürünü seç, farklarını birlikte görelim.
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Adım: First pick */}
          {!firstProduct ? (
            <>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                Önce 1. ürünü seç
              </Text>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Ürün veya marka ara…"
                colors={colors}
                softBorder={softBorder}
              />
              <FlatList
                data={firstList}
                keyExtractor={(p) => String(p.id)}
                renderItem={renderRow}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.textMuted }]}>
                    Eşleşen ürün yok.
                  </Text>
                }
              />
            </>
          ) : (
            <>
              {/* Selected first chip */}
              <View
                style={[
                  styles.firstChip,
                  {
                    backgroundColor: isDark ? "#1F2A1A" : "#EAF1EA",
                    borderColor: isDark ? "rgba(122,143,107,0.45)" : "#C8D8C8",
                  },
                ]}
              >
                <LocalThumb
                  imageUrl={resolveImageUrl(firstProduct as any)}
                  thumbnailUrl={resolveThumbnailUrl(firstProduct as any)}
                  size={40}
                  borderRadius={8}
                  isDark={isDark}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.firstChipBrand, { color: colors.textMuted }]} numberOfLines={1}>
                    {(firstProduct.brand ?? (firstProduct as any).marka ?? "") as string}
                  </Text>
                  <Text style={[styles.firstChipName, { color: colors.text }]} numberOfLines={1}>
                    {(firstProduct.name ?? (firstProduct as any).isim ?? "") as string}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClearFirst} hitSlop={10}>
                  <Feather name="refresh-cw" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 10 }]}>
                Şimdi buna en yakın ürünü seç.
              </Text>

              {warning ? (
                <View
                  style={[
                    styles.warnBox,
                    {
                      backgroundColor: isDark ? "#2A1F0E" : "#FFFBEB",
                      borderColor: isDark ? "rgba(217,119,6,0.45)" : "#FDE68A",
                    },
                  ]}
                >
                  <Feather name="alert-triangle" size={14} color="#D97706" />
                  <Text style={[styles.warnText, { color: isDark ? "#F4D58D" : "#92400E" }]}>
                    {warning}
                  </Text>
                </View>
              ) : null}

              <SearchField
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setWarning(null);
                }}
                placeholder="Aday içinde ara veya yeni ürün ara…"
                colors={colors}
                softBorder={softBorder}
              />

              {!query && candidates.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  Bu ürün için güvenli bir karşılaştırma adayı bulamadık.
                  Aramadan benzer kategori seçebilirsin.
                </Text>
              ) : (
                <FlatList
                  data={secondList}
                  keyExtractor={(p) => String(p.id)}
                  renderItem={renderRow}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  contentContainerStyle={styles.list}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={[styles.empty, { color: colors.textMuted }]}>
                      Eşleşen ürün yok.
                    </Text>
                  }
                />
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── SearchField ────────────────────────────────────────────────────────────

function SearchField({
  value,
  onChange,
  placeholder,
  colors,
  softBorder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colors: any;
  softBorder: string;
}) {
  return (
    <View
      style={[
        styles.searchWrap,
        { backgroundColor: colors.background, borderColor: softBorder },
      ]}
    >
      <Feather name="search" size={14} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.searchInput, { color: colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChange("")} hitSlop={8}>
          <Feather name="x" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    minHeight: "60%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handleWrap: { alignItems: "center", paddingVertical: 6 },
  handle: { width: 40, height: 4, borderRadius: 2 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "800" as const },
  subtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  closeBtn: { padding: 4 },

  stepLabel: { fontSize: 12, fontWeight: "700" as const, marginBottom: 8, letterSpacing: 0.2 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },

  list: { paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  rowImg: { alignSelf: "center" },
  rowText: { flex: 1, gap: 1 },
  rowBrand: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.2 },
  rowName: { fontSize: 13, fontWeight: "700" as const, lineHeight: 17 },
  rowCat: { fontSize: 10, fontWeight: "500" as const, marginTop: 1 },

  firstChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  firstChipBrand: { fontSize: 10, fontWeight: "600" as const },
  firstChipName: { fontSize: 13, fontWeight: "700" as const },

  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  warnText: { flex: 1, fontSize: 12, lineHeight: 16 },

  empty: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    lineHeight: 17,
  },
});
