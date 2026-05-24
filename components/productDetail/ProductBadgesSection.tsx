import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

const MAX_ANIMATED_BADGES = 12;

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
}

interface BadgeChipProps {
  status: "positive" | "negative" | "unknown";
  positiveLabel: string;
  negativeLabel: string;
  unknownLabel: string;
  isDark: boolean;
  animOpacity: Animated.Value;
  animScale: Animated.Value;
}

function BadgeChip({ status, positiveLabel, negativeLabel, unknownLabel, isDark, animOpacity, animScale }: BadgeChipProps) {
  const isPos = status === "positive";
  const isUnk = status === "unknown";

  const bg = isUnk
    ? (isDark ? "#1f2937" : "#f3f4f6")
    : isPos ? (isDark ? "#2A3820" : "#EAF1EA")
    : (isDark ? "#2d1a0e" : "#fff7ed");
  const bc = isUnk
    ? (isDark ? "#374151" : "#d1d5db")
    : isPos ? (isDark ? "#3A4D30" : "#B8CEB8")
    : (isDark ? "#92400e" : "#fcd34d");
  const tc = isUnk
    ? (isDark ? "#9CA3AF" : "#6B7280")
    : isPos ? (isDark ? "#9DB88D" : "#6B7F5D")
    : (isDark ? "#fbbf24" : "#92400e");
  const icon  = isUnk ? "help-circle" : isPos ? "check-circle" : "alert-circle";
  const label = isUnk ? unknownLabel : isPos ? positiveLabel : negativeLabel;

  return (
    <Animated.View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: PD.spacing.sm,
      paddingVertical: 4,
      borderRadius: PD.radius.pill,
      borderWidth: 1,
      backgroundColor: bg,
      borderColor: bc,
      opacity: animOpacity,
      transform: [{ scale: animScale }],
    }}>
      <Feather name={icon as any} size={11} color={tc} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: tc }}>{label}</Text>
    </Animated.View>
  );
}

export function ProductBadgesSection({ product, isDark, cardBg, cardBorder, textColor }: Props) {
  // D1.1 fix: Suppress unknown chips entirely. After unified ingredient
  // truth (D1), `unknown` means resolveFeature genuinely could not decide
  // (no ingredients, no features jsonb, no contains_* signal). In that
  // case showing "Vegan Durumu Belirsiz / Alkol Durumu Belirsiz / …" adds
  // noise without information. We render ONLY positive/negative verdicts.
  // If every verdict is unknown, the whole section is hidden (returns null).
  const visibleQuick = product.quickBadges.filter(b => b.status !== "unknown");
  const visibleFull  = product.badges.filter(b => b.status !== "unknown");

  // Prefer quickBadges (ingredient-derived, finer signal) when it has any
  // known verdicts; otherwise fall back to the explicit `badges` array.
  const useQuick  = visibleQuick.length > 0;
  const badgeList = useQuick ? visibleQuick : visibleFull;
  const hasData   = badgeList.length > 0;

  // Pre-allocate MAX_ANIMATED_BADGES animated values (stable ref, never resized)
  const anims = useRef(
    Array.from({ length: MAX_ANIMATED_BADGES }, () => ({
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(0.95),
    }))
  ).current;

  useEffect(() => {
    if (!hasData) return;
    const count = Math.min(badgeList.length, MAX_ANIMATED_BADGES);
    Animated.stagger(
      50,
      Array.from({ length: count }, (_, i) =>
        Animated.parallel([
          Animated.timing(anims[i].opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(anims[i].scale,   { toValue: 1, duration: 200, useNativeDriver: true }),
        ])
      )
    ).start();
  }, [badgeList.length]);

  if (!hasData) return null;

  return (
    <View style={{
      borderRadius: PD.radius.lg,
      borderWidth: PD.card.borderWidth,
      padding: PD.card.padding,
      backgroundColor: cardBg,
      borderColor: cardBorder,
    }}>
      <Text style={[PD.font.cardTitle, { color: textColor }]}>İçerik Rozetleri</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: PD.spacing.sm }}>
        {badgeList.slice(0, MAX_ANIMATED_BADGES).map((b, i) => (
          <BadgeChip
            key={b.key}
            status={b.status}
            positiveLabel={b.positiveLabel}
            negativeLabel={b.negativeLabel}
            unknownLabel={b.unknownLabel}
            isDark={isDark}
            animOpacity={anims[i].opacity}
            animScale={anims[i].scale}
          />
        ))}
      </View>
    </View>
  );
}
