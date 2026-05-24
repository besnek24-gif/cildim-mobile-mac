/**
 * FilterChip — Selectable filter pill
 *
 * Rules:
 *  - Uses useTheme() from ThemeContext
 *  - Uses Feather icons only
 *  - No emojis, no AntDesign
 *  - Haptic on press
 */

import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import type { FilterChip as FilterChipType } from "@/src/search/filterModel";

interface Props {
  chip: FilterChipType;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ chip, selected, onPress }: Props) {
  const { colorScheme } = useTheme();
  const colors = useColors();
  const isDark = colorScheme === "dark";

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? chip.color
            : isDark
            ? "rgba(255,255,255,0.07)"
            : "rgba(0,0,0,0.04)",
          borderColor: selected
            ? chip.color
            : isDark
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.10)",
          opacity: pressed ? 0.82 : 1,
          // Slight elevation on selected state
          shadowColor: selected ? chip.color : "transparent",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: selected ? 0.30 : 0,
          shadowRadius: 3,
          elevation: selected ? 2 : 0,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={chip.label_tr}
    >
      <Feather
        name={chip.icon as any}
        size={11}
        color={selected ? "#FFFFFF" : chip.color}
        style={styles.icon}
      />
      <Text
        style={[
          styles.label,
          {
            color: selected
              ? "#FFFFFF"
              : isDark
              ? colors.text
              : colors.text,
          },
        ]}
        numberOfLines={1}
      >
        {chip.label_tr}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    // Prevent chips from shrinking below content
    flexShrink: 0,
  },
  icon: {
    // Slight nudge for optical alignment
    marginTop: 0.5,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
