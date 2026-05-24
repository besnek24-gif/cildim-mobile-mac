/**
 * SmartInterventionCard.tsx
 * "Akıllı Müdahale" kartı — cilt sinyali veya rutin pattern'e göre gösterilir
 * Sadece Seçkin kullanıcılara, sadece sinyal tespit edildiğinde.
 */

import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import type { SmartIntervention } from "@/lib/smartIntervention";

interface Props {
  intervention: SmartIntervention;
  onDismiss?: () => void;
}

const SEVERITY_PALETTE = {
  gentle: {
    light: { bg: "#FFFBEB", border: "#FDE68A", icon: "#D97706", text: "#92400E" },
    dark:  { bg: "#1C1200", border: "#92400E", icon: "#FCD34D", text: "#FDE68A" },
  },
  moderate: {
    light: { bg: "#FFF1F2", border: "#FECDD3", icon: "#DC2626", text: "#9F1239" },
    dark:  { bg: "#2D0A0E", border: "#9F1239", icon: "#F87171", text: "#FDA4AF" },
  },
};

export function SmartInterventionCard({ intervention, onDismiss }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [dismissed, setDismissed] = useState(false);
  const anim = useRef(new Animated.Value(1)).current;

  const palette = SEVERITY_PALETTE[intervention.severity][isDark ? "dark" : "light"];

  const handleDismiss = () => {
    Animated.spring(anim, {
      toValue: 0, useNativeDriver: true, damping: 18, stiffness: 300,
    }).start(() => {
      setDismissed(true);
      onDismiss?.();
    });
  };

  if (dismissed) return null;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim }] }}>
      <View style={[styles.card, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: `${palette.icon}20` }]}>
            <Feather name={intervention.icon as any} size={13} color={palette.icon} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>{intervention.title}</Text>
          <Pressable onPress={handleDismiss} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Feather name="x" size={14} color={palette.icon} />
          </Pressable>
        </View>

        {/* Mesaj */}
        <Text style={[styles.message, { color: isDark ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.60)" }]}>
          {intervention.message}
        </Text>

        {/* Aksiyon */}
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [styles.action, { borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.actionText, { color: palette.icon }]}>{intervention.action}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 9,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  message: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  action: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
