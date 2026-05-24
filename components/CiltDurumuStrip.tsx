/**
 * CiltDurumuStrip.tsx
 * Günlük hızlı cilt durumu girişi — tek satır 5 dokunuş
 * "Bugün cildin nasıl?" → kaydeder, rutini adapte eder
 *
 * Seçkin-exclusive. Free kullanıcılarda render edilmez.
 */

import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { hasTodaySkinEntry, moodToEntry, saveSkinState, type SkinMoodQuick } from "@/lib/retentionEngine";

const MOODS: { id: SkinMoodQuick; label: string; icon: string; color: string; bg: string; darkBg: string; darkColor: string }[] = [
  { id: "very_good", label: "Harika", icon: "sun",        color: "#7A8F6B", bg: "#EAF1EA", darkBg: "#2A3820", darkColor: "#9DB88D" },
  { id: "good",      label: "İyi",    icon: "smile",      color: "#2563EB", bg: "#EFF6FF", darkBg: "#0F172A", darkColor: "#60A5FA" },
  { id: "ok",        label: "Orta",   icon: "meh",        color: "#D97706", bg: "#FFFBEB", darkBg: "#1C1200", darkColor: "#FCD34D" },
  { id: "bad",       label: "Zor",    icon: "frown",      color: "#EA580C", bg: "#FFF7ED", darkBg: "#1C0900", darkColor: "#FB923C" },
  { id: "very_bad",  label: "Kötü",   icon: "cloud-rain", color: "#DC2626", bg: "#FFF1F2", darkBg: "#2D0A0E", darkColor: "#F87171" },
];

interface Props {
  onSaved?: (mood: SkinMoodQuick) => void;
}

export function CiltDurumuStrip({ onSaved }: Props) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const [selected, setSelected] = useState<SkinMoodQuick | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const confirmScale = useRef(new Animated.Value(0)).current;

  const bg     = isDark ? "#111827" : "#F8FAFC";
  const border = isDark ? "#1E293B" : "#E2E8F0";
  const copper = "#B87333";

  useEffect(() => {
    hasTodaySkinEntry().then(has => {
      if (has) setAlreadySaved(true);
    });
  }, []);

  const handleSelect = async (mood: SkinMoodQuick) => {
    if (saving || alreadySaved) return;
    setSelected(mood);
    setSaving(true);
    await saveSkinState(moodToEntry(mood));
    setSaving(false);
    setAlreadySaved(true);
    onSaved?.(mood);

    Animated.spring(confirmScale, {
      toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280,
    }).start();
  };

  if (alreadySaved && selected !== null) {
    const m = MOODS.find(x => x.id === selected)!;
    const color = isDark ? m.darkColor : m.color;
    return (
      <Animated.View style={[styles.strip, { backgroundColor: bg, borderColor: border }, { transform: [{ scale: confirmScale }] }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="check-circle" size={14} color={color} />
          <Text style={[styles.savedText, { color }]}>Bugünkü durum kaydedildi — {m.label}</Text>
        </View>
      </Animated.View>
    );
  }

  if (alreadySaved) {
    return (
      <View style={[styles.strip, { backgroundColor: bg, borderColor: border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="check" size={13} color={copper} />
          <Text style={[styles.doneText, { color: isDark ? "#92400E" : "#B45309" }]}>Bugünkü cilt durumu kaydedildi</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.strip, { backgroundColor: bg, borderColor: border }]}>
      {/* Başlık */}
      <View style={styles.stripHeader}>
        <View style={[styles.copperDot, { backgroundColor: `${copper}18`, borderColor: `${copper}35` }]}>
          <Feather name="activity" size={10} color={copper} />
        </View>
        <Text style={[styles.stripLabel, { color: isDark ? "#B87333" : "#92400E" }]}>
          Bugün cildin nasıl?
        </Text>
        <Text style={[styles.stripHint, { color: isDark ? "#64748B" : "#94A3B8" }]}>Günlük takip</Text>
      </View>

      {/* Mood butonları */}
      <View style={styles.moodRow}>
        {MOODS.map(m => {
          const isActive = selected === m.id;
          const color  = isDark ? m.darkColor : m.color;
          const bgClr  = isDark ? m.darkBg    : m.bg;
          return (
            <Pressable
              key={m.id}
              onPress={() => handleSelect(m.id)}
              style={({ pressed }) => [
                styles.moodBtn,
                {
                  backgroundColor: isActive ? bgClr : "transparent",
                  borderColor: isActive ? color : (isDark ? "#334155" : "#E2E8F0"),
                  borderWidth: isActive ? 1.5 : 1,
                  opacity: pressed ? 0.7 : 1,
                  ...Platform.select({
                    ios:     isActive ? { shadowColor: color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 6 } : {},
                    android: isActive ? { elevation: 2 } : {},
                  }),
                },
              ]}
            >
              <Feather name={m.icon as any} size={16} color={isActive ? color : (isDark ? "#475569" : "#94A3B8")} />
              <Text style={[styles.moodLabel, { color: isActive ? color : (isDark ? "#475569" : "#9CA3AF") }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  stripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  copperDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  stripLabel: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  stripHint: {
    fontSize: 10,
    fontWeight: "500",
  },
  moodRow: {
    flexDirection: "row",
    gap: 5,
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  moodLabel: {
    fontSize: 9,
    fontWeight: "600",
  },
  savedText: {
    fontSize: 12,
    fontWeight: "600",
  },
  doneText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
