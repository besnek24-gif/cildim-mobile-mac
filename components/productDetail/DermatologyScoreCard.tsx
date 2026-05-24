import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, TouchableOpacity, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textMuted: string;
  onPress: () => void;
}

export function DermatologyScoreCard({ product, isDark, cardBg, cardBorder, textColor, textMuted, onPress }: Props) {
  const dr = product.dermoResult;

  const barProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dr) return;
    Animated.timing(barProgress, {
      toValue: dr.total,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dr?.total]);

  if (!dr) return null;

  const animatedWidth = barProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: PD.radius.lg,
        borderWidth: PD.card.borderWidth,
        paddingVertical: 10,
        paddingHorizontal: PD.card.padding,
        gap: 10,
        backgroundColor: cardBg,
        borderColor: cardBorder,
      }}
      onPress={onPress}
      activeOpacity={0.82}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      {/* Score */}
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: dr.color, lineHeight: 24 }}>
          {dr.total}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: "600", color: dr.color, marginBottom: 1 }}>
          /100
        </Text>
      </View>

      {/* Label */}
      <Text style={{ fontSize: 13, fontWeight: "700", color: dr.color }}>
        {dr.label}
      </Text>

      {/* Progress bar — animated from 0 → score */}
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: `${dr.color}22`, overflow: "hidden" }}>
        <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: dr.color, width: animatedWidth }} />
      </View>

      {/* Chevron */}
      <Feather name="chevron-right" size={14} color={textMuted} />
    </TouchableOpacity>
  );
}
