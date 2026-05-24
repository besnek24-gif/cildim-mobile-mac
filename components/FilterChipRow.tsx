/**
 * FilterChipRow — Horizontal scrolling chip row with clear button and empty-state
 *
 * Rules:
 *  - Uses useTheme() from ThemeContext
 *  - ScrollView (not FlatList) for horizontal chip row — chips are few and static
 *  - NEVER uses flex:1 inside container with only maxHeight
 *  - NEVER uses Pressable absoluteFill backdrop
 *  - Uses Feather/Ionicons — no AntDesign
 *  - Haptic feedback via expo-haptics (handled inside FilterChip)
 */

import React, { memo } from "react";
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { FilterChip } from "@/components/FilterChip";
import type { FilterChip as FilterChipType } from "@/src/search/filterModel";

interface Props {
  chips: FilterChipType[];
  activeChipIds: Set<string>;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  suggestToRemove: FilterChipType[];
  onToggle: (chipId: string) => void;
  onClear: () => void;
}

export const FilterChipRow = memo(function FilterChipRow({
  chips,
  activeChipIds,
  hasActiveFilters,
  filteredCount,
  totalCount,
  suggestToRemove,
  onToggle,
  onClear,
}: Props) {
  const { colorScheme } = useTheme();
  const colors = useColors();
  const isDark = colorScheme === "dark";

  if (chips.length === 0) return null;

  const isNarrowEmpty = hasActiveFilters && filteredCount === 0;

  return (
    <View style={styles.wrapper}>
      {/* ── Chip scroll row ─────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        directionalLockEnabled
        decelerationRate="fast"
      >
        {chips.map((chip) => (
          <FilterChip
            key={chip.id}
            chip={chip}
            selected={activeChipIds.has(chip.id)}
            onPress={() => onToggle(chip.id)}
          />
        ))}

        {/* ── Clear button — only visible when filters active ─────────────── */}
        {hasActiveFilters && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClear();
            }}
            activeOpacity={0.75}
            style={[
              styles.clearBtn,
              {
                backgroundColor: isDark
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(239,68,68,0.09)",
                borderColor: isDark
                  ? "rgba(239,68,68,0.35)"
                  : "rgba(239,68,68,0.22)",
              },
            ]}
          >
            <Feather name="x" size={11} color="#EF4444" />
            <Text style={[styles.clearLabel, { color: "#EF4444" }]}>
              Temizle
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Active filter summary row ──────────────────────────────────────── */}
      {hasActiveFilters && !isNarrowEmpty && (
        <View style={styles.summaryRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            {filteredCount} ürün gösteriliyor
            {filteredCount < totalCount && ` · ${totalCount - filteredCount} gizlendi`}
          </Text>
        </View>
      )}

      {/* ── Narrow empty state ────────────────────────────────────────────── */}
      {isNarrowEmpty && (
        <View
          style={[
            styles.emptyBanner,
            {
              backgroundColor: isDark
                ? "rgba(234,179,8,0.12)"
                : "rgba(234,179,8,0.08)",
              borderColor: isDark
                ? "rgba(234,179,8,0.30)"
                : "rgba(234,179,8,0.22)",
            },
          ]}
        >
          <Feather name="alert-circle" size={13} color="#CA8A04" />
          <View style={styles.emptyTextCol}>
            <Text style={[styles.emptyTitle, { color: isDark ? "#FCD34D" : "#92400E" }]}>
              Bu filtrelerle sonuç daraldı
            </Text>
            {suggestToRemove.length > 0 && (
              <Text style={[styles.emptySub, { color: isDark ? "#A16207" : "#B45309" }]}>
                {"Şunu kaldırmayı dene: "}
                {suggestToRemove.map((c, i) => (
                  <Text
                    key={c.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggle(c.id);
                    }}
                    style={styles.suggestLink}
                  >
                    {c.label_tr}
                    {i < suggestToRemove.length - 1 ? " · " : ""}
                  </Text>
                ))}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClear();
            }}
            activeOpacity={0.75}
            style={styles.clearAllBtn}
          >
            <Text style={[styles.clearAllLabel, { color: "#CA8A04" }]}>
              Tümünü sıfırla
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 4,
    paddingBottom: 2,
    gap: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 7,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  clearLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 17,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  summaryText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  emptyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  emptyTextCol: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 11.5,
    fontWeight: "500",
    lineHeight: 16,
  },
  suggestLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  clearAllBtn: {
    alignSelf: "flex-start",
    paddingTop: 1,
  },
  clearAllLabel: {
    fontSize: 11.5,
    fontWeight: "600",
  },
});
