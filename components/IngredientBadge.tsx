import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { IngredientEntry, lookupIngredient, levelToColor } from "@/lib/dermoScore";

interface Ingredient {
  isim: string;
  inci_adi?: string;
  kategori?: string;
  guvenlik_skoru?: number;
  aciklama?: string;
  uyari?: string;
}

interface Props {
  ingredient: Ingredient;
}

export function IngredientBadge({ ingredient }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState<boolean>(false);

  // Önce DB'den dermo verisi çek
  const dermoKey = (ingredient.inci_adi ?? ingredient.isim).toLowerCase().trim();
  const dermoEntry: IngredientEntry | null = lookupIngredient(dermoKey);

  // Renk/ikon önceliği: dermo DB > Python API skoru
  let tagColor: string;
  let bgColor: string;
  let icon: "check-circle" | "alert-triangle" | "x-circle" | "info" | "star";
  let levelLabel: string | null = null;

  if (dermoEntry) {
    tagColor = levelToColor(dermoEntry.level);
    bgColor = `${tagColor}18`;
    switch (dermoEntry.level) {
      case "beneficial":
        icon = "star"; levelLabel = "Faydalı"; break;
      case "safe":
        icon = "check-circle"; levelLabel = "Güvenli"; break;
      case "mild":
        icon = "info"; levelLabel = "Hafif Endişe"; break;
      case "moderate":
        icon = "alert-triangle"; levelLabel = "Orta Endişe"; break;
      case "high_concern":
        icon = "x-circle"; levelLabel = "Yüksek Endişe"; break;
      case "avoid":
      default:
        icon = "x-circle"; levelLabel = "Kaçınılmalı"; break;
    }
  } else {
    // Fallback: Python API skoru
    const score = ingredient.guvenlik_skoru;
    if (score != null) {
      if (score >= 70) {
        tagColor = colors.scoreHigh; icon = "check-circle";
      } else if (score >= 40) {
        tagColor = colors.scoreMid; icon = "alert-triangle";
      } else {
        tagColor = colors.scoreLow; icon = "x-circle";
      }
    } else {
      tagColor = colors.secondary; icon = "info";
    }
    bgColor = `${tagColor}18`;
  }

  const description = dermoEntry?.tr ?? ingredient.aciklama ?? ingredient.uyari;
  const concern = dermoEntry?.concern;
  const hasDetail = Boolean(description || concern);

  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: bgColor, borderColor: `${tagColor}35` }]}
      onPress={() => hasDetail && setExpanded(!expanded)}
      activeOpacity={hasDetail ? 0.7 : 1}
    >
      <View style={styles.row}>
        <Feather name={icon as any} size={13} color={tagColor} />
        <Text style={[styles.name, { color: tagColor }]} numberOfLines={expanded ? undefined : 1}>
          {ingredient.isim}
        </Text>
        {levelLabel ? (
          <Text style={[styles.levelTag, { color: tagColor, borderColor: `${tagColor}40` }]}>
            {levelLabel}
          </Text>
        ) : null}
        {hasDetail ? (
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={11}
            color={tagColor}
            style={{ marginLeft: 2 }}
          />
        ) : null}
      </View>
      {expanded && description ? (
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {description}
          {concern ? `\n⚠ ${concern}` : ""}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: "600" as const,
    flex: 1,
  },
  levelTag: {
    fontSize: 10,
    fontWeight: "600" as const,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  desc: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
});
