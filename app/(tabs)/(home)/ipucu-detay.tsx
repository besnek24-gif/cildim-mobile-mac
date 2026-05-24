import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { getTipPayload } from "@/lib/tipStore";
import { getCategoryLabel } from "@/lib/dailyTips";
import type { Product } from "@/types/product";

export default function IpucuDetayScreen() {
  const payload = getTipPayload();
  const tip = payload?.tip ?? null;
  const relatedProducts = payload?.relatedProducts ?? [];

  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const navigateToProduct = (p: Product) => {
    prefetchProductHeroImage(p as any);
    setNavigationProduct(p);
    router.push(`/product/${p.id}`);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  if (!tip) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={{ paddingTop: topPad }}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>İpucu</Text>
            <View style={styles.backBtn} />
          </View>
        </View>
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>İpucu yüklenemedi.</Text>
        </View>
      </View>
    );
  }

  const catLabel = getCategoryLabel(tip.category);

  // SAFE TIP FIX — kavramsal tip'lerde (productMode === "none") "ilgili
  // ürünler" bölümünün TÜM parçaları (başlık + liste + empty state) gizlenir.
  // Geriye uyumluluk: alan undefined ise "match" davranışı (mevcut akış).
  const showProductsSection = tip.productMode !== "none";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: topPad }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            İpucu
          </Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <FlatList
        data={showProductsSection ? relatedProducts : []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad + 20 }]}
        ListHeaderComponent={
          <>
            <View
              style={[
                styles.tipCard,
                {
                  backgroundColor: isDark ? `${tip.bg}22` : tip.bg,
                  borderColor: tip.border,
                },
              ]}
            >
              <View style={styles.tipTop}>
                <View style={[styles.tipIconBox, { backgroundColor: tip.iconBg }]}>
                  <Feather name={tip.icon as any} size={20} color={tip.iconColor} />
                </View>
                <View style={styles.tipMeta}>
                  <Text style={[styles.tipCatLabel, { color: tip.titleColor, opacity: 0.7 }]}>
                    {catLabel.toLocaleUpperCase("tr-TR")}
                  </Text>
                </View>
              </View>
              <Text style={[styles.tipTitle, { color: tip.titleColor }]}>
                {tip.title}
              </Text>
              <Text
                style={[
                  styles.tipText,
                  {
                    color: isDark ? colors.textSecondary : tip.titleColor,
                    opacity: isDark ? 1 : 0.78,
                  },
                ]}
              >
                {tip.text}
              </Text>
              {Boolean(tip.microAction) && (
                <View
                  style={[
                    styles.microActionBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.04)",
                      borderColor: tip.border,
                    },
                  ]}
                >
                  <Feather
                    name="zap"
                    size={12}
                    color={tip.iconBg}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.microActionText,
                      {
                        color: isDark ? colors.textSecondary : tip.titleColor,
                        opacity: isDark ? 0.9 : 0.75,
                      },
                    ]}
                  >
                    {tip.microAction}
                  </Text>
                </View>
              )}
            </View>

            {showProductsSection && (
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Bu ipucuyla ilgili ürünler
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.productRow,
              { backgroundColor: colors.surfaceCard, borderColor: colors.border },
            ]}
            onPress={() => navigateToProduct(item)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.productAvatar,
                { backgroundColor: isDark ? `${tip.bg}33` : tip.bg },
              ]}
            >
              <Text style={[styles.avatarText, { color: tip.titleColor }]}>
                {(item.name ?? (item as any).isim ?? "?")
                  .charAt(0)
                  .toLocaleUpperCase("tr-TR")}
              </Text>
            </View>
            <View style={styles.productInfo}>
              <Text
                style={[styles.productName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name ?? (item as any).isim ?? "—"}
              </Text>
              <Text
                style={[styles.productBrand, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {item.brand ?? (item as any).marka ?? ""}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          showProductsSection ? (
            <View style={styles.emptyBox}>
              <Feather
                name="info"
                size={28}
                color={colors.textMuted}
                style={{ marginBottom: 10, opacity: 0.7 }}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Bu ipucu genel bir bilgilendirmedir.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  tipCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 24,
  },
  tipTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  tipIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipMeta: {
    flex: 1,
  },
  tipCatLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  microActionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  microActionText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  productAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 12,
    fontWeight: "400",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});