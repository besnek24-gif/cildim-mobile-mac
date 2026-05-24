/**
 * RecommendationSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Akıllı Öneriler" bölümü — OverviewPipeline ⑩ adımı.
 *
 * Öneri tipleri:
 *  better_score  → Daha yüksek puanlı aynı-kategori ürün
 *  budget_up     → Üst segment (daha güçlü formül)
 *  budget_down   → Alt segment (daha ekonomik)
 *  concern       → Aynı endişe, farklı kategori
 *  similar_func  → Benzer işlev, yüksek metin örtüşmesi
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { getScoreColors } from "@/lib/scoreColors";
import type { RecommendationResult } from "@/lib/recommendations";

// ── Segment renkleri ──────────────────────────────────────────────────────────

const SEG_COLORS: Record<string, { bg: string; text: string }> = {
  "seçkin":      { bg: "#FDF4E7", text: "#B87333" },
  profesyonel:   { bg: "#EEEEFF", text: "#5558E3" },
  ekonomik:      { bg: "#EAF1EA", text: "#7A8F6B" },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  recommendations: RecommendationResult[];
  allProducts:     any[];
  isDark:          boolean;
  cardBg:          string;
  cardBorder:      string;
  textColor:       string;
  textSecondary:   string;
  textMuted:       string;
}

// ── Kart bileşeni ─────────────────────────────────────────────────────────────

interface CardProps {
  rec:           RecommendationResult;
  allProducts:   any[];
  isDark:        boolean;
  cardBg:        string;
  cardBorder:    string;
  textColor:     string;
  textSecondary: string;
  textMuted:     string;
  index:         number;
}

function RecommendationCard({
  rec,
  allProducts,
  isDark,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
  textMuted,
  index,
}: CardProps) {
  const { normalized: norm, reasonLabel, reasonIcon, reasonBg, reasonColor } = rec;

  const scoreColors = getScoreColors(norm.score);
  const segColor    = norm.segment ? (SEG_COLORS[norm.segment] ?? null) : null;

  // ── Press animation ──────────────────────────────────────────────
  const pressScale  = useRef(new Animated.Value(1)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue:         1,
      duration:        420,
      delay:           index * 65,
      useNativeDriver: true,
      easing:          Easing.out(Easing.cubic),
    }).start();
  }, []);

  const onPressIn = () => {
    Animated.timing(pressScale, {
      toValue:         0.96,
      duration:        110,
      useNativeDriver: true,
      easing:          Easing.out(Easing.quad),
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(pressScale, {
      toValue:         1,
      useNativeDriver: true,
      damping:         22,
      stiffness:       240,
      mass:            0.7,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const raw = allProducts.find((p: any) => String(p.id) === norm.id);
    if (raw) {
      prefetchProductHeroImage(raw as any);
      setNavigationProduct(raw);
    }
    router.push(`/product/${norm.id}` as any);
  };

  const imageUri: string | null =
    norm.thumbnailUrl ?? norm.imageUrl ?? null;

  return (
    <Animated.View
      style={{
        opacity:   entranceAnim,
        transform: [
          { scale: pressScale },
          {
            translateY: entranceAnim.interpolate({
              inputRange:  [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor:     cardBorder,
          },
        ]}
      >
        {/* Ürün görseli */}
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? "#27272A" : "#F4F4F5" }]}>
              <Feather name="package" size={20} color={isDark ? "#52525B" : "#A1A1AA"} />
            </View>
          )}
        </View>

        {/* Ana içerik */}
        <View style={styles.content}>
          {/* İsim + marka */}
          <Text
            style={[styles.name, { color: textColor }]}
            numberOfLines={1}
          >
            {norm.name}
          </Text>
          {norm.brand ? (
            <Text style={[styles.brand, { color: textMuted }]} numberOfLines={1}>
              {norm.brand}
            </Text>
          ) : null}

          {/* Alt satır: segment + neden etiketi */}
          <View style={styles.tagRow}>
            {segColor && norm.segment ? (
              <View style={[styles.segBadge, { backgroundColor: segColor.bg }]}>
                <Text style={[styles.segText, { color: segColor.text }]}>
                  {norm.segment === "seçkin" ? "Seçkin" : norm.segment === "profesyonel" ? "Pro" : "Eko"}
                </Text>
              </View>
            ) : null}

            <View style={[styles.reasonBadge, { backgroundColor: reasonBg }]}>
              <Feather name={reasonIcon as any} size={10} color={reasonColor} />
              <Text style={[styles.reasonText, { color: reasonColor }]}>{reasonLabel}</Text>
            </View>
          </View>
        </View>

        {/* Skor chip */}
        <View style={styles.scoreWrap}>
          {norm.score != null ? (
            <View style={[styles.scoreChip, { backgroundColor: scoreColors.bg, borderColor: scoreColors.border }]}>
              <Text style={[styles.scoreNum, { color: scoreColors.main }]}>
                {norm.score}
              </Text>
              <Text style={[styles.scoreMax, { color: scoreColors.main }]}>/100</Text>
            </View>
          ) : (
            <View style={[styles.scoreChip, { backgroundColor: isDark ? "#27272A" : "#F4F4F5", borderColor: cardBorder }]}>
              <Text style={[styles.scoreNum, { color: textMuted }]}>—</Text>
            </View>
          )}
          <Feather
            name="chevron-right"
            size={14}
            color={isDark ? "#52525B" : "#A1A1AA"}
            style={{ marginTop: 4 }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Bölüm bileşeni ────────────────────────────────────────────────────────────

export function RecommendationSection({
  recommendations,
  allProducts,
  isDark,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
  textMuted,
}: Props) {
  if (recommendations.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Başlık */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? "#1C1C1E" : "#EAF1EA" }]}>
          <Feather name="zap" size={14} color="#6B7F5D" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textColor }]}>
            Bunlar da İlginizi Çekebilir
          </Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>
            Dermatoloji verisine göre seçildi
          </Text>
        </View>
      </View>

      {/* Kartlar */}
      <View style={styles.list}>
        {recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.normalized.id}
            rec={rec}
            allProducts={allProducts}
            isDark={isDark}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
            textMuted={textMuted}
            index={i}
          />
        ))}
      </View>
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },

  header: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
    marginBottom:   14,
  },

  iconWrap: {
    width:           30,
    height:          30,
    borderRadius:    15,
    alignItems:      "center",
    justifyContent:  "center",
  },

  title: {
    fontSize:   15,
    fontWeight: "700",
    lineHeight: 20,
  },

  subtitle: {
    fontSize:   11,
    fontWeight: "500",
    marginTop:  1,
  },

  list: {
    gap: 10,
  },

  card: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            12,
    paddingVertical:   12,
    paddingHorizontal: 12,
    borderRadius:   14,
    borderWidth:    1,
  },

  imageWrap: {
    width:  52,
    height: 52,
  },

  image: {
    width:        52,
    height:       52,
    borderRadius: 8,
  },

  imagePlaceholder: {
    width:           52,
    height:          52,
    borderRadius:    8,
    alignItems:      "center",
    justifyContent:  "center",
  },

  content: {
    flex: 1,
    gap:  3,
  },

  name: {
    fontSize:   13,
    fontWeight: "700",
    lineHeight: 18,
  },

  brand: {
    fontSize:   11,
    fontWeight: "500",
  },

  tagRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    marginTop:     3,
    flexWrap:      "wrap",
  },

  segBadge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      6,
  },

  segText: {
    fontSize:   10,
    fontWeight: "700",
  },

  reasonBadge: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:   6,
  },

  reasonText: {
    fontSize:   10,
    fontWeight: "700",
  },

  scoreWrap: {
    alignItems: "center",
    gap:        2,
  },

  scoreChip: {
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:    8,
    borderWidth:     1,
  },

  scoreNum: {
    fontSize:   14,
    fontWeight: "800",
    lineHeight: 18,
  },

  scoreMax: {
    fontSize:   9,
    fontWeight: "600",
    lineHeight: 12,
    opacity:    0.7,
  },
});
