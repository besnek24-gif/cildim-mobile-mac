/**
 * GununNotu.tsx
 * "Günün Notu" — sakin, premium, minimal günlük rehberlik kartı
 */

import { Feather } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import type { DailyInsight } from "@/lib/dailyInsightEngine";

const CREAM = {
  cardBg:     { light: "#FEF9EC", dark: "#1E190C" },
  cardBorder: { light: "rgba(217,119,6,0.16)", dark: "rgba(255,175,80,0.10)" },
  label:      { light: "#A16207", dark: "#FCD34D" },
  title:      { light: "#78350F", dark: "#FDE68A" },
  body:       { light: "#92400E", dark: "#FEF3C7" },
  iconBg:     { light: "rgba(253,186,116,0.20)", dark: "rgba(253,186,116,0.12)" },
};

interface Props {
  insight: DailyInsight;
  isPremium?: boolean;
  onPress?: () => void;
}

export function GununNotu({ insight, isPremium = false, onPress }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const m = (key: keyof typeof CREAM) => CREAM[key][isDark ? "dark" : "light"];

  const pressScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(pressScale, { toValue: 0.988, useNativeDriver: true, damping: 22, stiffness: 350 }).start();
  const onPressOut = () => Animated.spring(pressScale, { toValue: 1,     useNativeDriver: true, damping: 22, stiffness: 250 }).start();

  return (
    <Animated.View
      style={[
        { transform: [{ scale: pressScale }] },
        Platform.select({
          ios:     { shadowColor: "#C97706", shadowOffset: { width: 0, height: 3 }, shadowOpacity: isDark ? 0.14 : 0.07, shadowRadius: 14 },
          android: { elevation: 2 },
          web:     { boxShadow: isDark ? "0px 3px 14px rgba(201,119,6,0.14)" : "0px 3px 14px rgba(201,119,6,0.07)" } as any,
        }),
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPress ? onPressIn : undefined}
        onPressOut={onPress ? onPressOut : undefined}
        android_ripple={onPress ? { color: "rgba(217,119,6,0.05)" } : undefined}
        style={[styles.card, { backgroundColor: m("cardBg"), borderColor: m("cardBorder") }]}
      >
        {/* Üst satır: ikon + meta + premium rozet */}
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: m("iconBg") }]}>
            <Feather name={insight.icon as any} size={13} color={m("label")} />
          </View>
          <Text style={[styles.metaLabel, { color: m("label") }]}>İPUCU</Text>
          {isPremium && (
            <View style={[styles.premiumBadge, {
              backgroundColor: isDark ? "rgba(184,115,51,0.12)" : "#FDF2E5",
              borderColor: isDark ? "rgba(184,115,51,0.30)" : "#D4A265",
            }]}>
              <Feather name="star" size={7} color="#B87333" />
              <Text style={styles.premiumBadgeText}>Seçkin</Text>
            </View>
          )}
        </View>

        {/* Başlık */}
        <Text style={[styles.title, { color: m("title") }]} numberOfLines={1}>
          {insight.title}
        </Text>

        {/* Mesaj */}
        <Text style={[styles.message, { color: m("body") }]} numberOfLines={3}>
          {insight.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 10,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metaLabel: {
    flex: 1,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  premiumBadgeText: {
    fontSize: 8.5,
    fontWeight: "700",
    color: "#B87333",
  },

  title: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "400",
    opacity: 0.88,
  },
});
