import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
}

export function WarningSummaryCard({ product, isDark }: Props) {
  const warnings = product.warnings;

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!warnings || warnings.length === 0) return;
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  if (!warnings || warnings.length === 0) return null;

  // Risk olanlar önce, max 3 madde göster
  const sortedWarnings = [...warnings]
    .sort((a, b) => (b.isRisk ? 1 : 0) - (a.isRisk ? 1 : 0))
    .slice(0, 3);

  const allSafe = warnings.every(w => !w.isRisk);

  if (allSafe) {
    return (
      <Animated.View style={{
        opacity,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: isDark ? "#2A3820" : "#EAF1EA",
        borderColor: isDark ? "#3A4D30" : "#C8D8C8",
      }}>
        <Feather name="check-circle" size={13} color={isDark ? "#9DB88D" : "#6B7F5D"} />
        <Text style={{
          fontSize: 13,
          color: isDark ? "#9DB88D" : "#5C7050",
          fontWeight: "500",
          flexShrink: 1,
        }}>
          Belirgin risk bulunmadı
        </Text>
      </Animated.View>
    );
  }

  const bg     = isDark ? "#1C0F00" : "#FFFBEB";
  const border = isDark ? "#78350F" : "#FDE68A";
  const titleC = isDark ? "#FCD34D" : "#92400E";
  const textC  = isDark ? "#FDE68A" : "#78350F";
  const dotC   = "#D97706";
  const safeDotC = "#6B7F5D";

  return (
    <Animated.View style={{
      borderRadius: PD.radius.md,
      borderWidth: PD.card.borderWidth,
      padding: PD.spacing.md,
      gap: PD.spacing.sm,
      backgroundColor: bg,
      borderColor: border,
      opacity,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: PD.spacing.sm }}>
        <Feather name="alert-triangle" size={14} color="#D97706" />
        <Text style={{ fontSize: 15, fontWeight: "700", color: titleC }}>Dikkat Edilmesi Gerekenler</Text>
      </View>

      {sortedWarnings.map((w, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: PD.spacing.sm, paddingLeft: 4 }}>
          <View style={{
            width: 6, height: 6, borderRadius: 3,
            marginTop: 6, flexShrink: 0,
            backgroundColor: w.isRisk ? dotC : safeDotC,
          }} />
          <Text style={{ fontSize: 13, flex: 1, lineHeight: 19, color: textC }}>{w.text}</Text>
        </View>
      ))}

      {/* Toplam uyarı sayısı fazlaysa not */}
      {warnings.filter(w => w.isRisk).length > 3 && (
        <Text style={{ fontSize: 11, color: isDark ? "#9CA3AF" : "#6B7280", marginTop: 2, fontStyle: "italic" }}>
          +{warnings.filter(w => w.isRisk).length - 3} ek madde İçerikler sekmesinde
        </Text>
      )}
    </Animated.View>
  );
}
