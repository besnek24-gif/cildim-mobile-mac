/**
 * GizliInsight.tsx
 * "Gizli İçgörü" — Seçkin kullanıcı için sürpriz, değerli bir gözlem
 *
 * Her 3 uygulama açılışında bir kez gösterilir.
 * Cilt log analizi veya rutin pattern'ine dayanır.
 * Tone: surprising, accurate, calm.
 */

import { Feather } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  insight: string;
  onDismiss?: () => void;
}

export function GizliInsight({ insight, onDismiss }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const dismissAnim = useRef(new Animated.Value(1)).current;

  const copper = "#B87333";
  const bg     = isDark ? "#1A0D00" : "#FFFAF5";
  const border = isDark ? "#4D2D00" : "#E8D0B0";

  const handleDismiss = () => {
    Animated.spring(dismissAnim, {
      toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300,
    }).start(() => onDismiss?.());
  };

  return (
    <Animated.View style={[styles.wrapper, { opacity: dismissAnim, transform: [{ scale: dismissAnim }] }]}>
      <View style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: border,
          ...Platform.select({
            ios:     { shadowColor: copper, shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.15 : 0.06, shadowRadius: 8 },
            android: { elevation: 2 },
            web:     { boxShadow: `0 2px 8px rgba(184,115,51,${isDark ? "0.15" : "0.06"})` } as any,
          }),
        }
      ]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: `${copper}15`, borderColor: `${copper}30`, borderWidth: 1 }]}>
            <Feather name="eye" size={11} color={copper} />
          </View>
          <Text style={[styles.label, { color: copper }]}>GİZLİ İÇGÖRÜ</Text>
          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Feather name="x" size={14} color={isDark ? "#78716C" : "#A8A29E"} />
          </Pressable>
        </View>

        {/* İçgörü metni */}
        <Text style={[styles.insightText, { color: isDark ? "#D6C4A8" : "#44403C" }]}>
          {insight}
        </Text>

        {/* Alt satır */}
        <View style={[styles.footerRow, { borderTopColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }]}>
          <Feather name="activity" size={10} color={isDark ? "#57534E" : "#A8A29E"} />
          <Text style={[styles.footerText, { color: isDark ? "#57534E" : "#A8A29E" }]}>
            Cilt takip verilerinden üretildi · Seçkin Analiz
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: "hidden" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    flex: 1,
  },
  insightText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: -0.1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 10,
    fontWeight: "500",
  },
});
