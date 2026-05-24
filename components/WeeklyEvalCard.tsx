/**
 * WeeklyEvalCard.tsx
 * "Haftalık Değerlendirme" — Seçkin kullanıcı için haftalık cilt özeti
 *
 * Tasarım: uzman ama sakin ton, veri odaklı, opsiyonel uyarı satırı
 * Streak satırı kart içine entegre — alışkanlık motoru
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import type { WeeklyEvaluation } from "@/lib/weeklyEvaluationEngine";

interface Props {
  evaluation: WeeklyEvaluation;
  streak?: number;
  hadPriorActivity?: boolean;
}

// ── Streak mikrokopisi ─────────────────────────────────────────────────────

function getStreakCopy(streak: number, hadPriorActivity: boolean): {
  count: string;
  tagline: string;
  color: string;
  showFire: boolean;
} {
  if (streak >= 7) {
    return { count: `${streak} gün devam`, tagline: "Bu hız işe yarıyor, koru.", color: "#D97706", showFire: true };
  }
  if (streak >= 2) {
    return { count: `${streak} gün devam`, tagline: "Güzel bir ritim tutturulmuş.", color: "#D97706", showFire: true };
  }
  if (streak === 1) {
    return { count: "1 gün devam", tagline: "İyi başlangıç. Yarın da olsun.", color: "#7A8F6B", showFire: true };
  }
  // streak === 0
  if (hadPriorActivity) {
    return { count: "Son günler aksadı", tagline: "Bugün yeniden başlamak için iyi bir gün.", color: "#DC2626", showFire: false };
  }
  return { count: "Henüz seri yok", tagline: "İlk adım hep en önemli olanı.", color: "#94A3B8", showFire: false };
}

// ── Bileşen ────────────────────────────────────────────────────────────────

export function WeeklyEvalCard({ evaluation, streak = 0, hadPriorActivity = false }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [expanded, setExpanded] = useState(false);

  const bg     = isDark ? "#0C1A2E" : "#F0F4FF";
  const border = isDark ? "#1E3A5F" : "#BFDBFE";
  const accent = isDark ? "#60A5FA" : "#2563EB";
  const textPrimary   = isDark ? "#E2E8F0" : "#1E293B";
  const textSecondary = isDark ? "#93C5FD" : "#1E40AF";
  const textMuted     = isDark ? "#64748B" : "#94A3B8";

  const trendBg = evaluation.trend === "improving"
    ? (isDark ? "#2A3820" : "#EAF1EA")
    : evaluation.trend === "declining"
    ? (isDark ? "#2D0A0E" : "#FFF1F2")
    : (isDark ? "#1C1200" : "#FFFBEB");
  const trendBorder = evaluation.trend === "improving"
    ? (isDark ? "#3A4D30" : "#C8D8C8")
    : evaluation.trend === "declining"
    ? (isDark ? "#9F1239" : "#FECDD3")
    : (isDark ? "#92400E" : "#FDE68A");
  const trendIcon = evaluation.trend === "improving"
    ? "trending-up" : evaluation.trend === "declining"
    ? "trending-down" : "minus";

  const streakCopy = getStreakCopy(streak, hadPriorActivity);

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: bg,
        borderColor: border,
        ...Platform.select({
          ios:     { shadowColor: "#2563EB", shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.20 : 0.07, shadowRadius: 10 },
          android: { elevation: 2 },
          web:     { boxShadow: "0 2px 10px rgba(37,99,235,0.07)" } as any,
        }),
      }
    ]}>
      {/* Başlık satırı */}
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: `${accent}18` }]}>
          <Feather name="bar-chart-2" size={13} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: accent }]}>HAFTALIK DEĞERLENDİRME</Text>
          <Text style={[styles.title, { color: textPrimary }]}>{evaluation.title}</Text>
        </View>
        {/* Trend chip */}
        <View style={[styles.trendChip, { backgroundColor: trendBg, borderColor: trendBorder }]}>
          <Feather name={trendIcon as any} size={11} color={evaluation.trendColor} />
          <Text style={[styles.trendLabel, { color: evaluation.trendColor }]}>
            {evaluation.trendLabel}
          </Text>
        </View>
      </View>

      {/* ── Streak satırı ── */}
      <View style={[
        styles.streakRow,
        {
          backgroundColor: `${streakCopy.color}10`,
          borderColor: `${streakCopy.color}28`,
        },
      ]}>
        <View style={[styles.streakIconBox, { backgroundColor: `${streakCopy.color}18` }]}>
          {streakCopy.showFire ? (
            <Text style={styles.streakFire}>🔥</Text>
          ) : (
            <Feather
              name={hadPriorActivity ? "alert-circle" : "zap"}
              size={13}
              color={streakCopy.color}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.streakCount, { color: streakCopy.color }]}>
            {streakCopy.count}
          </Text>
          <Text style={[styles.streakTagline, { color: isDark ? `${streakCopy.color}BB` : `${streakCopy.color}CC` }]}>
            {streakCopy.tagline}
          </Text>
        </View>
        {streak >= 3 && (
          <View style={[styles.streakBadge, { backgroundColor: `${streakCopy.color}18`, borderColor: `${streakCopy.color}35` }]}>
            <Text style={[styles.streakBadgeText, { color: streakCopy.color }]}>{streak}</Text>
          </View>
        )}
      </View>

      {/* Özet cümle */}
      <Text style={[styles.summary, { color: textSecondary }]}>
        {evaluation.summary}
      </Text>

      {/* Adherence bar */}
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.barLabel, { color: textMuted }]}>Rutin bağlılığı</Text>
          <Text style={[styles.barValue, { color: accent }]}>{evaluation.adherenceScore}%</Text>
        </View>
        <View style={[styles.barTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0" }]}>
          <View style={[styles.barFill, {
            width: `${evaluation.adherenceScore}%` as any,
            backgroundColor: evaluation.adherenceScore >= 70 ? "#7A8F6B" : evaluation.adherenceScore >= 45 ? "#D97706" : "#DC2626",
          }]} />
        </View>
      </View>

      {/* Maddeler (expandable) */}
      <Pressable
        onPress={() => setExpanded(v => !v)}
        style={({ pressed }) => [styles.expandRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.expandLabel, { color: accent }]}>
          {expanded ? "Daha az göster" : "Detaylı görünüm"}
        </Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={accent} />
      </Pressable>

      {expanded && (
        <View style={[styles.detailsWrap, { borderTopColor: border }]}>
          {/* Bullets */}
          <View style={{ gap: 7 }}>
            {evaluation.bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: accent }]} />
                <Text style={[styles.bulletText, { color: textSecondary }]}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Öneri */}
          <View style={[styles.suggestionBox, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#E8F4FF", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#BFDBFE" }]}>
            <Feather name="zap" size={11} color={accent} style={{ marginTop: 2 }} />
            <Text style={[styles.suggestionText, { color: textSecondary }]}>
              {evaluation.suggestion}
            </Text>
          </View>

          {/* Uyarı */}
          {evaluation.warning && (
            <View style={[styles.warningBox, { backgroundColor: isDark ? "#2D0A0E" : "#FFF1F2", borderColor: isDark ? "#9F1239" : "#FECDD3" }]}>
              <Feather name="alert-triangle" size={11} color={isDark ? "#FDA4AF" : "#BE123C"} style={{ marginTop: 2 }} />
              <Text style={[styles.warningText, { color: isDark ? "#FDA4AF" : "#9F1239" }]}>
                {evaluation.warning}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  trendLabel: {
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Streak ──────────────────────────────────────────────────────────────
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  streakIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  streakFire: {
    fontSize: 14,
    lineHeight: 18,
  },
  streakCount: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  streakTagline: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  streakBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  streakBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },

  // ── Özet & bar ──────────────────────────────────────────────────────────
  summary: {
    fontSize: 13,
    lineHeight: 19,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  barValue: {
    fontSize: 11,
    fontWeight: "700",
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  detailsWrap: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  suggestionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
