/**
 * similar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Benzer Ürünler" tam ekranı — conversion-focused kartlar.
 *
 * Hiyerarşi: Badge → Ürün adı → short_benefit → mikro güven → Karşılaştır
 * Kart tamamı → ürün detayına gider
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import {
  findSimilarProducts,
  resolveSectionTitle,
  resolveTopBadge,
  resolveMicroTrust,
  type SimilarResult,
} from "@/lib/similarProducts";

import { normalizeProductData } from "@/lib/normalizeProduct";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { trackSimilarClick } from "@/lib/productMetrics";

// ── Ekran ─────────────────────────────────────────────────────────────────────

export default function SimilarProductsScreen() {
  const { productId, category, subcategory } = useLocalSearchParams<{
    productId: string;
    category:  string;
    subcategory?: string;
  }>();

  const colors    = useColors();
  const { colorScheme } = useTheme();
  const isDark    = colorScheme === "dark";
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top;

  const { products, loading } = useSupabaseProducts();

  const currentNorm = useMemo(() => {
    if (!productId || products.length === 0) return null;
    const found = products.find(p => String(p.id) === productId);
    if (found) return normalizeProductData(found);
    return normalizeProductData({
      id:          productId,
      category:    category ?? null,
      subcategory: subcategory ?? null,
    } as any);
  }, [productId, products]);

  const similar: SimilarResult[] = useMemo(() => {
    if (!currentNorm || products.length === 0) return [];
    return findSimilarProducts(currentNorm, products, 20);
  }, [currentNorm, products]);

  const sectionTitle = resolveSectionTitle(category ?? null, null);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Kart render ──────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: SimilarResult }) => {
    const { normalized: norm, differentiator } = item;
    const uri       = norm.thumbnailUrl || norm.imageUrl || null;
    const badge     = resolveTopBadge(differentiator);
    const microText = resolveMicroTrust(differentiator);

    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      trackSimilarClick(norm.id);
      const raw = products.find(p => String(p.id) === norm.id);
      if (raw) {
        prefetchProductHeroImage(raw as any);
        setNavigationProduct(raw);
      }
      // ECZ4 Step 2: source="similar" — back label "Benzer Ürünler" doğru.
      router.push({
        pathname: `/product/${norm.id}` as any,
        params: { source: "similar" },
      });
    };

    const handleCompare = () => {
      // Same-product guard (refactor v2): aynı ürün-kendisi rotasını engelle.
      if (String(productId) === String(norm.id)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/mukayese-detay?idA=${productId}&idB=${norm.id}` as any);
    };

    return (
      <TouchableOpacity
        style={[styles.card, {
          backgroundColor: colors.surfaceCard,
          borderColor:     colors.border,
        }]}
        onPress={handlePress}
        activeOpacity={0.78}
      >
        {/* Görsel */}
        <ProductThumb uri={uri} primary={colors.primary} />

        {/* İçerik */}
        <View style={styles.content}>

          {/* 1. Top badge */}
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.borderColor }]}>
              <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          ) : null}

          {/* 2. Ürün adı */}
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {norm.name}
          </Text>

          {/* 3. short_benefit */}
          {norm.shortBenefit ? (
            <Text style={[styles.benefit, { color: colors.textSecondary }]} numberOfLines={2}>
              {norm.shortBenefit}
            </Text>
          ) : null}

          {/* 4. Mikro güven + Karşılaştır */}
          <View style={styles.footer}>
            <Text style={[styles.microTrust, { color: colors.textMuted }]}>{microText}</Text>
            <TouchableOpacity
              style={[
                styles.compareBtn,
                {
                  borderColor:     isDark ? "#334155" : "#CBD5E1",
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                },
              ]}
              onPress={handleCompare}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Feather name="bar-chart-2" size={10} color={isDark ? "#94A3B8" : "#64748B"} />
              <Text style={[styles.compareBtnText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
                Karşılaştır
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Benzer Ürünler</Text>
          {similar.length > 0 && (
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>{sectionTitle}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Liste ── */}
      {similar.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="search" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Benzer ürün bulunamadı</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Bu ürünle aynı kategoride başka ürün yok.
          </Text>
        </View>
      ) : (
        <FlatList
          data={similar}
          keyExtractor={item => item.normalized.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

// ── ProductThumb ───────────────────────────────────────────────────────────────

function ProductThumb({ uri, primary }: { uri: string | null; primary: string }) {
  const [err, setErr]       = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!uri || err) {
    return (
      <View style={styles.imgPlaceholder}>
        <Feather name="package" size={20} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <View style={styles.imgWrapper}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, styles.imgLoading]}>
          <ActivityIndicator size="small" color={primary} />
        </View>
      )}
      <Image
        source={{ uri }}
        style={styles.img}
        resizeMode="contain"
        onLoad={() => setLoaded(true)}
        onError={() => setErr(true)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn:      { width: 40, alignItems: "flex-start" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 17, fontWeight: "700" as const },
  headerSub:    { fontSize: 11, fontWeight: "500" as const, marginTop: 1 },

  // List
  list: { padding: 14 },

  // Card — tüm kart tıklanabilir
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },

  // Image
  imgWrapper: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#F5F3F1",
    overflow: "hidden",
    flexShrink: 0,
    marginTop: 2,
  },
  imgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  imgLoading: {
    backgroundColor: "#F5F3F1",
    alignItems: "center",
    justifyContent: "center",
  },
  img: { width: 64, height: 64 },

  // Content column
  content: { flex: 1, gap: 4 },

  // Badge — top priority signal
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 2,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.1,
  },

  // Text hierarchy
  name: {
    fontSize: 13,
    fontWeight: "700" as const,
    lineHeight: 17,
  },
  benefit: {
    fontSize: 11,
    lineHeight: 15,
  },

  // Bottom row
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
    gap: 6,
  },
  microTrust: {
    fontSize: 10,
    fontWeight: "500" as const,
    flex: 1,
  },

  // Compare — secondary outline only
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  compareBtnText: {
    fontSize: 9,
    fontWeight: "600" as const,
  },

  // Empty state
  emptyTitle: { fontSize: 16, fontWeight: "700" as const, marginTop: 8 },
  emptyText:  { fontSize: 13, textAlign: "center", lineHeight: 19 },
});