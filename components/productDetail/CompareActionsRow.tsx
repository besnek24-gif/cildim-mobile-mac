/**
 * CompareActionsRow.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Benzer Ürünler" aksiyonu.
 * Tıklanınca SimilarProductsScreen'e yönlendirir (productId + category).
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
}

export function CompareActionsRow({ product, isDark }: Props) {
  const color = isDark ? "#60A5FA" : "#2563EB";
  const bg    = isDark ? "#0C1929" : "#EFF6FF";
  const border = isDark ? "#1E40AF" : "#BFDBFE";

  const handleSimilar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const params = new URLSearchParams({ productId: product.id });
    if (product.category)    params.set("category", product.category);
    if (product.subcategory) params.set("subcategory", product.subcategory);
    router.push(`/product/similar?${params.toString()}` as any);
  };

  return (
    <View style={{ flexDirection: "row" }}>
      <TouchableOpacity
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 9,
          borderRadius: PD.radius.md,
          borderWidth: 1,
          backgroundColor: bg,
          borderColor: border,
        }}
        onPress={handleSimilar}
        activeOpacity={0.75}
        hitSlop={{ top: 6, bottom: 6 }}
      >
        <Feather name="git-branch" size={13} color={color} />
        <Text style={{ fontSize: 13, fontWeight: "600", color }}>
          Benzer Ürünler
        </Text>
      </TouchableOpacity>
    </View>
  );
}
