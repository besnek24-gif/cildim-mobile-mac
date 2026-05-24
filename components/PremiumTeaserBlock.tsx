/**
 * PremiumTeaserBlock.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Zarif premium teaser bloğu.
 *
 * Tasarım felsefesi:
 * - Agresif satış yok, bağıran kilit yok, "hemen üye ol" baskısı yok
 * - Merakı sat, tam cevabı değil
 * - Bilgi akışının doğal devamı gibi hissettirmeli
 * - ~%60 açık içerik, ~%40 seçkin derinliği
 *
 * Props:
 *   previewText   — Fade ile kesilen önizleme metni (1-3 satır)
 *   lockedLabel   — Kilit altındaki kısa açıklama
 *   ctaLabel      — CTA düğme metni
 *   onPress       — CTA aksiyonu
 *   isDark        — Tema
 *   icon          — Opsiyonel Feather icon adı (varsayılan: "star")
 *   compact       — Daha dar dikey boşluk (sidebar/küçük kartlar için)
 *   style         — Ekstra container stili
 */

import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

const SECKIN = "#B87333";

function toTrUpper(s: string): string {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

// Kart arka planı (tema bazlı)
// Hem hex hem rgba versiyonu — LinearGradient için rgba kullanılmalı
const CARD = {
  light: {
    bg:         "#FFFAF5",
    border:     "#E8D0B0",
    gradStart:  "rgba(255,250,245,0)",
    gradEnd:    "rgba(255,250,245,1)",
  },
  dark: {
    bg:         "#1A0D00",
    border:     "#4D2D00",
    gradStart:  "rgba(26,13,0,0)",
    gradEnd:    "rgba(26,13,0,1)",
  },
};

export interface PremiumTeaserBlockProps {
  previewText: string;
  lockedLabel: string;
  ctaLabel?: string;
  onPress: () => void;
  isDark: boolean;
  /** Kart başlığı — belirtilmezse "Seçkin Üyelik" yerine içerik odaklı başlık geçilmeli */
  title?: string;
  icon?: string;
  compact?: boolean;
  style?: ViewStyle;
}

export function PremiumTeaserBlock({
  previewText,
  lockedLabel,
  ctaLabel = "Değerlendirmemi Gör",
  onPress,
  isDark,
  title,
  icon = "star",
  compact = false,
  style,
}: PremiumTeaserBlockProps) {
  const theme = isDark ? CARD.dark : CARD.light;
  const textColor = isDark ? "#A8A29E" : "#78716C";

  return (
    <View style={[
      styles.wrapper,
      {
        backgroundColor: theme.bg,
        borderColor: theme.border,
        shadowColor: SECKIN,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      },
      compact && styles.wrapperCompact,
      style,
    ]}>

      {/* ── Başlık — içerik odaklı, küçük, zarif ───────────────────────── */}
      <View style={styles.header}>
        <Feather name={icon as any} size={11} color={SECKIN} />
        <Text style={[styles.headerText, { color: SECKIN }]}>
          {toTrUpper(title ?? "Derin İnceleme")}
        </Text>
      </View>

      {/* ── Preview metni + fade ─────────────────────────────────────────── */}
      <View style={styles.previewWrap}>
        <Text
          style={[styles.previewText, { color: textColor }]}
          numberOfLines={3}
        >
          {previewText}
        </Text>

        {/*
          LinearGradient'ta "transparent" kullanmak React Native web'de
          rgba(0,0,0,0) → kart rengi şeklinde yorumlanır: gri bant oluşur.
          Fix: kart arka planının tam rgba versiyonunu kullan.
        */}
        <LinearGradient
          colors={[theme.gradStart, theme.gradEnd] as any}
          style={[styles.fadeGradient, { pointerEvents: "none" }]}
        />
      </View>

      {/* ── Kilit satırı ─────────────────────────────────────────────────── */}
      <View style={styles.lockRow}>
        <Feather name="lock" size={11} color={`${SECKIN}80`} />
        <Text style={[styles.lockLabel, { color: isDark ? "#78716C" : "#A8A29E" }]}>
          {lockedLabel}
        </Text>
      </View>

      {/* ── CTA — outlined, sakin, şık ───────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [
          styles.cta,
          {
            borderColor: `${SECKIN}55`,
            backgroundColor: pressed
              ? (isDark ? "rgba(184,115,51,0.12)" : "rgba(184,115,51,0.06)")
              : "transparent",
          },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <Text style={[styles.ctaText, { color: SECKIN }]}>{ctaLabel}</Text>
        <Feather name="arrow-right" size={12} color={SECKIN} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  wrapperCompact: {
    padding: 12,
    gap: 9,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  headerText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  previewWrap: {
    position: "relative",
    overflow: "hidden",
    // 3 satır metin = yaklaşık 19 * 3 = 57px; maks biraz altında kesilsin
    maxHeight: 52,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 19,
  },
  fadeGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    // Gradient yüksekliği metnin yarısını kaplamalı → doğal kesim hissi
    height: 36,
  },

  lockRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 2,
  },
  lockLabel: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "stretch",
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
});
