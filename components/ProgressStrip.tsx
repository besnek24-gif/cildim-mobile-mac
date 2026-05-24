/**
 * ProgressStrip.tsx
 * Hafif oyunlaştırma — Seçkin kullanıcı için ince ilerleme çubuğu
 *
 * Tasarım: çocuksu değil, subtle ve motive edici
 * İçerik: rutin streak + bağlılık durumu
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  streak: number;       // ardışık rutin günleri
  adherenceScore: number; // 0-100
  activeDays: number;   // bu hafta aktif gün sayısı
}

export function ProgressStrip({ streak, adherenceScore, activeDays }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const copper = "#B87333";
  const bg     = isDark ? "rgba(184,115,51,0.05)" : "rgba(184,115,51,0.04)";
  const border = isDark ? "rgba(184,115,51,0.18)" : "rgba(184,115,51,0.16)";

  const streakLabel = streak >= 14
    ? "Güçlü süreklilik"
    : streak >= 7
    ? "İyi seyir"
    : streak >= 3
    ? "İlerleme var"
    : "Başlangıç";

  const daysLabel = activeDays === 7
    ? "Mükemmel hafta"
    : activeDays >= 5
    ? "Güçlü hafta"
    : activeDays >= 3
    ? "Orta düzey hafta"
    : "Zayıf hafta";

  const streakColor = streak >= 7
    ? (isDark ? "#9DB88D" : "#7A8F6B")
    : streak >= 3
    ? copper
    : (isDark ? "#64748B" : "#94A3B8");

  const scoreColor = adherenceScore >= 70
    ? (isDark ? "#9DB88D" : "#7A8F6B")
    : adherenceScore >= 45
    ? (isDark ? "#FCD34D" : "#D97706")
    : (isDark ? "#F87171" : "#DC2626");

  return (
    <View style={[styles.strip, { backgroundColor: bg, borderColor: border }]}>
      {/* Streak */}
      <View style={styles.item}>
        <View style={[styles.iconBox, { backgroundColor: `${streakColor}18` }]}>
          <Feather name="zap" size={11} color={streakColor} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.value, { color: streakColor }]}>
            {streak > 0 ? `${streak} gün` : "—"}
          </Text>
          <Text style={[styles.label, { color: isDark ? "#64748B" : "#94A3B8" }]}>
            {streakLabel}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]} />

      {/* Bu hafta */}
      <View style={styles.item}>
        <View style={[styles.iconBox, { backgroundColor: `${scoreColor}18` }]}>
          <Feather name="calendar" size={11} color={scoreColor} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.value, { color: scoreColor }]}>{activeDays}/7 gün</Text>
          <Text style={[styles.label, { color: isDark ? "#64748B" : "#94A3B8" }]}>{daysLabel}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]} />

      {/* Bağlılık skoru */}
      <View style={styles.item}>
        <View style={[styles.iconBox, { backgroundColor: `${copper}12` }]}>
          <Feather name="bar-chart" size={11} color={copper} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.value, { color: copper }]}>{adherenceScore}%</Text>
          <Text style={[styles.label, { color: isDark ? "#64748B" : "#94A3B8" }]}>Bağlılık</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 0,
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  value: {
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 16,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "500",
    lineHeight: 12,
  },
  divider: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
    flexShrink: 0,
  },
});
