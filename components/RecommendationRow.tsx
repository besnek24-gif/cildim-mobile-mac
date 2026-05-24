/**
 * RecommendationRow.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Yatay karusel — profil/hedef/davranış bazlı öneri satırı.
 *
 * Her kart:
 *   - Ürün görseli / logo
 *   - Ürün adı + marka
 *   - Sebep etiketi (yeşil/turuncu/mavi...)
 *   - Tier rozeti: Ekonomik / Pro / Seçkin
 */

import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { ProductImage } from "@/components/ProductImage";
import { SkeletonRecommendationRow } from "@/components/SkeletonCarousel";
import type { ProfileRecommendation } from "@/lib/profileRecommendationEngine";
import { type Product, resolveImageUrl, resolveThumbnailUrl } from "@/types/product";
import { trackEvent } from "@/lib/userEvents";

// ── Tier rozeti renkleri ──────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { label: string; bg: string; color: string; darkBg: string; darkColor: string }> = {
  ekonomik:    { label: "Ekonomik",    bg: "#ECFDF5", color: "#065F46", darkBg: "#062A1E", darkColor: "#6EE7B7" },
  profesyonel: { label: "Profesyonel", bg: "#EEF2FF", color: "#3730A3", darkBg: "#1E1B4B", darkColor: "#A5B4FC" },
  seçkin:      { label: "Seçkin",      bg: "#FEF3E2", color: "#92400E", darkBg: "#3D2C14", darkColor: "#FCD34D" },
};

// ── Mini Kart ─────────────────────────────────────────────────────────────────

interface RecCardProps {
  item:       ProfileRecommendation;
  onPress:    (product: Product) => void;
  isDark:     boolean;
  cardBg:     string;
  cardBorder: string;
}

function RecCard({ item, onPress, isDark, cardBg, cardBorder }: RecCardProps) {
  const { product, reasonLabel, reasonIcon, reasonBg, reasonColor, tier } = item;
  const name  = (product as any).name  ?? (product as any).isim  ?? "—";
  const brand = (product as any).brand ?? (product as any).marka ?? "";
  const tierStyle = tier ? TIER_STYLES[tier] : null;

  const handlePress = () => {
    trackEvent("recommendation_click", String((product as any).id ?? ""), {
      category: (product as any).category ?? (product as any).kategori ?? undefined,
      concern: item.reasonLabel ?? undefined,
    });
    onPress(product);
  };

  return (
    <Pressable
      style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
      onPress={handlePress}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
    >
      {/* Görsel */}
      <View style={styles.imageBox}>
        <ProductImage
          imageUrl={resolveImageUrl(product as any)}
          thumbnailUrl={resolveThumbnailUrl(product as any)}
          gorselUrl={(product as any).gorsel_url ?? (product as any).gorselUrl ?? null}
          mode="thumbnail"
          width={64}
          height={64}
          borderRadius={10}
          isDark={isDark}
          style={styles.productImage}
        />
      </View>

      {/* Tier rozeti */}
      {tierStyle && (
        <View style={[
          styles.tierBadge,
          { backgroundColor: isDark ? tierStyle.darkBg : tierStyle.bg },
        ]}>
          <Text style={[styles.tierText, { color: isDark ? tierStyle.darkColor : tierStyle.color }]}>
            {tierStyle.label}
          </Text>
        </View>
      )}

      {/* İsim + Marka */}
      <Text style={[styles.productName, { color: isDark ? "#E8E4DE" : "#1A2030" }]} numberOfLines={2}>
        {name}
      </Text>
      {!!brand && (
        <Text style={[styles.productBrand, { color: isDark ? "#7A8A9A" : "#6B7280" }]} numberOfLines={1}>
          {brand}
        </Text>
      )}

      {/* Sebep etiketi */}
      <View style={[styles.reasonTag, { backgroundColor: reasonBg }]}>
        <Feather name={reasonIcon as any} size={10} color={reasonColor} style={{ marginTop: 2, marginRight: 4 }} />
        <Text style={[styles.reasonText, { color: reasonColor }]} numberOfLines={2}>
          {reasonLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

interface RecommendationRowProps {
  recommendations: ProfileRecommendation[];
  loading?:        boolean;
  onProductPress:  (product: Product) => void;
  emptyText?:      string;
}

export function RecommendationRow({
  recommendations,
  loading = false,
  onProductPress,
  emptyText,
}: RecommendationRowProps) {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const cardBg     = isDark ? "#111827" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  // Phase C — Perceived perf: replace ActivityIndicator with skeleton cards
  // that match real card dimensions (148x188). Eliminates spinner-pop and
  // keeps vertical rhythm stable through hydration.
  if (loading) {
    return <SkeletonRecommendationRow />;
  }
  // PERF: useColors result is read only inside non-loading branch; keep import
  // for the active code path (cardBg/cardBorder consumed below).
  void colors;

  if (recommendations.length === 0) {
    if (!emptyText) return null;
    return (
      <View style={styles.emptyBox}>
        <Text style={[styles.emptyText, { color: isDark ? "#6B7A8A" : "#9CA3AF" }]}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      {recommendations.map((item, i) => (
        <RecCard
          key={`${String(item.product.id)}-${i}`}
          item={item}
          onPress={onProductPress}
          isDark={isDark}
          cardBg={cardBg}
          cardBorder={cardBorder}
        />
      ))}
    </ScrollView>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const CARD_W = 148;

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  loadingBox: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  card: {
    width: CARD_W,
    marginRight: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  imageBox: {
    alignItems: "center",
    marginBottom: 8,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  tierBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  tierText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  productName: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 11,
    fontWeight: "400",
    marginBottom: 8,
  },
  reasonTag: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  reasonText: {
    fontSize: 10,
    fontWeight: "600",
    flex: 1,
    lineHeight: 14,
  },
});
