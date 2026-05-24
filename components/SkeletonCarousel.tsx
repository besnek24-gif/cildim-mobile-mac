/**
 * SkeletonCarousel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase C — Perceived performance skeletons for Home product sections.
 *
 * Replaces the previous `<ActivityIndicator/>` spinners inside ProductCarousel
 * (HomeScreen-inline) and RecommendationRow with low-cost placeholder cards
 * that match the real card dimensions exactly. This:
 *
 *   1. Eliminates the visible "blank → full" layout jump when sections
 *      materialize after data load + InteractionManager idle.
 *   2. Communicates that content is incoming (vs an empty/broken section).
 *   3. Keeps vertical rhythm stable — section heights match real content.
 *
 * Design constraints (intentionally honored):
 *   - NO Animated / useNativeDriver  (project_goal forbidden — also keeps cost
 *     near zero on first paint, which is the hottest frame).
 *   - NO logic, NO data, NO fetching.
 *   - Pure presentational <View> tree, theme-aware via `useTheme`.
 *   - Card geometry mirrors `ProductHeroCard` (CARD_W=152) and
 *     `RecommendationRow` `RecCard` (CARD_W=148) so layout is byte-stable.
 *
 * Used by:
 *   - HomeScreen-inline `ProductCarousel` (replaces carouselLoading spinner)
 *   - components/RecommendationRow `loading` branch
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

// ── Theme tokens ─────────────────────────────────────────────────────────────
function useSkeletonColors() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  return {
    isDark,
    bone:   isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)",
    line:   isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
    border: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
  };
}

// ── ProductCarousel skeleton (matches ProductHeroCard CARD_W=152) ────────────
//
// Geometry mirrors ProductHeroCard EXACTLY:
//   - card:        152 x 280  (CARD_W x CARD_H), borderRadius 18
//   - image area:  flex 7  → ~196px tall, padding 8 → img ~136 x 180
//   - text area:   flex 3  → ~84px  tall, paddingHorizontal 12
// Container styles mirror `popularList` from HomeScreen styles
// (`gap: 12, paddingRight: 4`, NO horizontal padding) so cards line up
// byte-stable with the live carousel — preventing horizontal shift on
// loading→loaded transition.

const HERO_CARD_W = 152;
const HERO_CARD_H = 280;
const HERO_IMAGE_H = 196; // flex:7 of 280
const HERO_TEXT_H  = 84;  // flex:3 of 280

interface SkeletonProductCarouselProps {
  /** Number of placeholder cards. Default 4 — matches typical above-fold density. */
  count?: number;
}

export function SkeletonProductCarousel({ count = 4 }: SkeletonProductCarouselProps) {
  const c = useSkeletonColors();
  const cards = Array.from({ length: count });
  return (
    <View style={styles.heroRow}>
      {cards.map((_, i) => (
        <View
          key={i}
          style={[
            styles.heroCard,
            { backgroundColor: c.bone, borderColor: c.border },
          ]}
        >
          {/* Image panel — flex 7 of 280 ≈ 196px */}
          <View style={[styles.heroImagePanel, { backgroundColor: c.line }]} />
          {/* Text panel — flex 3 of 280 ≈ 84px, mirrors textArea paddings */}
          <View style={styles.heroTextPanel}>
            <View style={[styles.heroLineLong,  { backgroundColor: c.line }]} />
            <View style={[styles.heroLineShort, { backgroundColor: c.line }]} />
            <View style={[styles.heroPill,      { backgroundColor: c.line }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── RecommendationRow skeleton (matches RecCard CARD_W=148) ──────────────────

const REC_CARD_W = 148;
const REC_CARD_H = 188;

interface SkeletonRecommendationRowProps {
  count?: number;
}

export function SkeletonRecommendationRow({ count = 4 }: SkeletonRecommendationRowProps) {
  const c = useSkeletonColors();
  const cards = Array.from({ length: count });
  return (
    <View style={styles.recRow}>
      {cards.map((_, i) => (
        <View
          key={i}
          style={[
            styles.recCard,
            { backgroundColor: c.bone, borderColor: c.border },
          ]}
        >
          <View style={[styles.recImage,    { backgroundColor: c.line }]} />
          <View style={[styles.recTier,     { backgroundColor: c.line }]} />
          <View style={[styles.recLineLong, { backgroundColor: c.line }]} />
          <View style={[styles.recLineMid,  { backgroundColor: c.line }]} />
          <View style={[styles.recReason,   { backgroundColor: c.line }]} />
        </View>
      ))}
    </View>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Hero (ProductCarousel) — container mirrors `popularList` style:
  //   { gap: 12, paddingRight: 4 }   (NO horizontal padding)
  // Live ProductCarousel uses ScrollView horizontal with this contentContainer;
  // we intentionally use a flat View since skeleton doesn't need to scroll —
  // overflow children are clipped at viewport bounds, matching what the user
  // sees in the live carousel before scrolling.
  heroRow: {
    flexDirection: "row",
    paddingRight: 4,
    gap: 12,
    overflow: "hidden",
  },
  heroCard: {
    width: HERO_CARD_W,
    height: HERO_CARD_H,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroImagePanel: {
    width: HERO_CARD_W,
    height: HERO_IMAGE_H,
  },
  heroTextPanel: {
    height: HERO_TEXT_H,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    justifyContent: "flex-start",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  heroLineLong: {
    width: "70%",
    height: 9,
    borderRadius: 5,
    marginBottom: 8,
  },
  heroLineShort: {
    width: "90%",
    height: 12,
    borderRadius: 5,
    marginBottom: 10,
  },
  heroPill: {
    width: 50,
    height: 14,
    borderRadius: 7,
  },

  // Recommendation row (RecCard)
  recRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 10,
  },
  recCard: {
    width: REC_CARD_W,
    height: REC_CARD_H,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  recImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    alignSelf: "center",
    marginBottom: 8,
  },
  recTier: {
    width: 52,
    height: 14,
    borderRadius: 6,
    marginBottom: 8,
  },
  recLineLong: {
    width: "90%",
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  recLineMid: {
    width: "60%",
    height: 9,
    borderRadius: 5,
    marginBottom: 8,
  },
  recReason: {
    width: "100%",
    height: 22,
    borderRadius: 7,
  },
});
