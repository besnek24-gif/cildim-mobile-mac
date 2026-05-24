/**
 * RoutineEvrimTimeline.tsx
 * "Rutin Evrimi" — Rutinin zaman içinde nasıl değiştiğini gösterir
 * Seçkin kullanıcı için rutin ekranında görünür
 *
 * Boş durum: henüz geçmiş yok → şimdiki rutini başlangıç noktası olarak göster
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import type { RoutineSnapshot } from "@/lib/routineEvolutionTracker";
import { describeEvolution } from "@/lib/routineEvolutionTracker";

interface Props {
  snapshots: RoutineSnapshot[];
  currentMorning: string[];
  currentEvening: string[];
}

function formatDate(dateStr: string): string {
  try {
    const [, m, d] = dateStr.split("-");
    const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
  } catch {
    return dateStr;
  }
}

export function RoutineEvrimTimeline({ snapshots, currentMorning, currentEvening }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const copper = "#B87333";
  const bg     = isDark ? "#0C0600" : "#FFFAF5";
  const border = isDark ? "#4D2D00" : "#E8D0B0";
  const textPrimary   = isDark ? "#D6C4A8" : "#44403C";
  const textSecondary = isDark ? "#92400E" : "#78716C";
  const textMuted     = isDark ? "#57534E" : "#A8A29E";

  const evolutionText = describeEvolution(snapshots);
  const allSnapshots = snapshots.slice(-5); // son 5 snapshot

  // Boş durum
  if (snapshots.length === 0) {
    const totalCurrent = currentMorning.length + currentEvening.length;
    return (
      <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: `${copper}15`, borderColor: `${copper}30`, borderWidth: 1 }]}>
            <Feather name="git-branch" size={11} color={copper} />
          </View>
          <Text style={[styles.sectionLabel, { color: copper }]}>RUTİN EVRİMİ</Text>
        </View>
        <View style={styles.emptyState}>
          <Feather name="clock" size={22} color={isDark ? "#57534E" : "#D6D3D1"} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Geçmiş henüz yok</Text>
          <Text style={[styles.emptyText, { color: textMuted }]}>
            Rutini değiştirdikçe burada zaman çizelgesi oluşacak. Şu an {totalCurrent} adımlı rutin aktif.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      {/* Başlık */}
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: `${copper}15`, borderColor: `${copper}30`, borderWidth: 1 }]}>
          <Feather name="git-branch" size={11} color={copper} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: copper }]}>RUTİN EVRİMİ</Text>
        </View>
        <Text style={[styles.countChip, { color: copper, backgroundColor: `${copper}12`, borderColor: `${copper}28` }]}>
          {snapshots.length} değişim
        </Text>
      </View>

      {/* Özet cümle */}
      <Text style={[styles.evolutionText, { color: textSecondary }]}>
        {evolutionText}
      </Text>

      {/* Zaman çizelgesi */}
      <View style={styles.timeline}>
        {allSnapshots.map((snap, i) => {
          const isLast = i === allSnapshots.length - 1;
          const total = snap.morningSteps.length + snap.eveningSteps.length;
          const hasMilestone = snap.milestone !== null;

          return (
            <View key={i} style={styles.timelineItem}>
              {/* Sol: çizgi + nokta */}
              <View style={styles.timelineLeft}>
                <View style={[
                  styles.timelineDot,
                  {
                    backgroundColor: hasMilestone ? copper : (isDark ? "#374151" : "#E2E8F0"),
                    borderColor: hasMilestone ? copper : (isDark ? "#4B5563" : "#D1D5DB"),
                    borderWidth: hasMilestone ? 0 : 1.5,
                    width: hasMilestone ? 10 : 8,
                    height: hasMilestone ? 10 : 8,
                  }
                ]} />
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: isDark ? "#1F2937" : "#E5E7EB" }]} />}
              </View>

              {/* Sağ: içerik */}
              <View style={[styles.timelineContent, !isLast && { marginBottom: 14 }]}>
                {/* Tarih + milestone */}
                <View style={styles.timelineMeta}>
                  <Text style={[styles.timelineDate, { color: textMuted }]}>{formatDate(snap.date)}</Text>
                  {hasMilestone && (
                    <View style={[styles.milestoneBadge, { backgroundColor: `${copper}15`, borderColor: `${copper}30` }]}>
                      <Text style={[styles.milestoneBadgeText, { color: copper }]}>{snap.milestone}</Text>
                    </View>
                  )}
                </View>
                {/* Reason + step count */}
                <Text style={[styles.timelineReason, { color: textPrimary }]}>{snap.reason}</Text>
                <Text style={[styles.timelineSteps, { color: textMuted }]}>
                  {snap.morningSteps.length > 0 ? `Sabah: ${snap.morningSteps.length} adım` : "Sabah: yok"}
                  {" · "}
                  {snap.eveningSteps.length > 0 ? `Akşam: ${snap.eveningSteps.length} adım` : "Akşam: yok"}
                  {" · "}Toplam {total}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
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
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  countChip: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  evolutionText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
  },
  timelineLeft: {
    alignItems: "center",
    width: 12,
    paddingTop: 3,
  },
  timelineDot: {
    borderRadius: 6,
    flexShrink: 0,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    marginTop: 3,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timelineDate: {
    fontSize: 10,
    fontWeight: "600",
  },
  milestoneBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  milestoneBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  timelineReason: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  timelineSteps: {
    fontSize: 11,
    lineHeight: 15,
  },
});
