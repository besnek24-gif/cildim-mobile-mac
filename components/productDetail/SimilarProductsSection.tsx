/**
 * SimilarProductsSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Conversion-focused benzer ürün önerileri — OverviewPipeline ⑨ adımı.
 *
 * Sıralama: Önerilen → Aynı segment → Ekonomik → Premium
 * Önerilen kart: hafif border glow + köşede "Önerilen" badge
 * Segment hint : ekonomik→"Uygun fiyatlı" | seçkin→"Daha güçlü formül"
 * Karar metni  : "Benzer etki, daha sade içerik" vb.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PD } from "@/constants/productDetailTokens";
import {
  type SimilarResult,
  resolveSectionTitle,
  resolveTopBadge,
  resolveMicroTrust,
  resolveSegmentHint,
} from "@/lib/similarProducts";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  currentId:           string;
  currentCategory:     string | null;
  currentShortBenefit: string | null;
  similar:             SimilarResult[];
  allProducts:         any[];
  isDark:              boolean;
  cardBg:              string;
  cardBorder:          string;
  textColor:           string;
  textSecondary:       string;
  textMuted:           string;
  primary:             string;
}

// ── Bölüm bileşeni ────────────────────────────────────────────────────────────

export function SimilarProductsSection({
  currentId,
  currentCategory,
  currentShortBenefit,
  similar,
  allProducts,
  isDark,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
  textMuted,
  primary,
}: Props) {
  if (similar.length === 0) return null;

  const sectionTitle = resolveSectionTitle(currentCategory, currentShortBenefit);

  const handleNavigate = (normId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const raw = allProducts.find((p: any) => String(p.id) === normId);
    if (raw) {
      prefetchProductHeroImage(raw as any);
      setNavigationProduct(raw);
    }
    router.push(`/product/${normId}?ref=similar` as any);
  };

  const handleCompare = (normId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/mukayese-detay?idA=${currentId}&idB=${normId}` as any);
  };

  return (
    <View>
      {/* ── Başlık ── */}
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: isDark ? "#0A1520" : "#E0F2FE" }]}>
          <Feather name="git-branch" size={13} color="#0369A1" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: textColor }]}>{sectionTitle}</Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>{similar.length} seçenek</Text>
        </View>
      </View>

      {/* ── Kartlar ── */}
      <View style={styles.list}>
        {similar.map(({ normalized: norm, differentiator, isRecommended }) => (
          <SimilarCard
            key={norm.id}
            norm={norm}
            differentiator={differentiator}
            isRecommended={isRecommended}
            isDark={isDark}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
            textMuted={textMuted}
            primary={primary}
            onPress={() => handleNavigate(norm.id)}
            onCompare={() => handleCompare(norm.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ── SimilarCard ───────────────────────────────────────────────────────────────

interface CardProps {
  norm:           SimilarResult["normalized"];
  differentiator: string;
  isRecommended:  boolean;
  isDark:         boolean;
  cardBg:         string;
  cardBorder:     string;
  textColor:      string;
  textSecondary:  string;
  textMuted:      string;
  primary:        string;
  onPress:        () => void;
  onCompare:      () => void;
}

// Önerilen kart için border rengi — primary rose
const RECOMMEND_COLOR = "#C5847A";

function SimilarCard({
  norm,
  differentiator,
  isRecommended,
  isDark,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
  textMuted,
  primary,
  onPress,
  onCompare,
}: CardProps) {
  const uri         = norm.thumbnailUrl || norm.imageUrl || null;
  const badge       = resolveTopBadge(differentiator);
  const microText   = resolveMicroTrust(differentiator);
  const segmentHint = resolveSegmentHint(norm.segment ?? null);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isRecommended ? RECOMMEND_COLOR : cardBorder,
        },
        isRecommended && (Platform.OS !== "web" ? styles.cardGlow : styles.cardGlowWeb),
      ]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      {/* ── Önerilen köşe badge — absolute, top-right ── */}
      {isRecommended && (
        <View style={styles.recommendedPill}>
          <View style={styles.recommendedDot} />
          <Text style={styles.recommendedText}>Önerilen</Text>
        </View>
      )}

      {/* ── Görsel ── */}
      <TinyImage uri={uri} primary={primary} />

      {/* ── İçerik sütunu ── */}
      <View style={[styles.content, isRecommended && styles.contentWithBadge]}>

        {/* 1. Üst badge satırı */}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.borderColor }]}>
            <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        ) : null}

        {/* 2. Segment hint — sadece ekonomik / seçkin */}
        {segmentHint ? (
          <Text style={[styles.segmentHint, { color: textMuted }]}>{segmentHint}</Text>
        ) : null}

        {/* 3. Ürün adı */}
        <Text style={[styles.name, { color: textColor }]} numberOfLines={2} ellipsizeMode="tail">
          {norm.name}
        </Text>

        {/* 4. short_benefit */}
        {norm.shortBenefit ? (
          <Text style={[styles.benefit, { color: textSecondary }]} numberOfLines={2}>
            {norm.shortBenefit}
          </Text>
        ) : null}

        {/* 5. Karar metni + Karşılaştır */}
        <View style={styles.footer}>
          <Text style={[styles.microTrust, { color: textMuted }]} numberOfLines={1}>
            {microText}
          </Text>
          <TouchableOpacity
            style={[
              styles.compareBtn,
              {
                borderColor: isDark ? "#334155" : "#CBD5E1",
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
              },
            ]}
            onPress={onCompare}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Feather name="bar-chart-2" size={10} color={isDark ? "#94A3B8" : "#64748B"} />
            <Text style={[styles.compareBtnText, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              Karşılaştır
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── TinyImage ─────────────────────────────────────────────────────────────────

function TinyImage({ uri, primary }: { uri: string | null; primary: string }) {
  const [err, setErr]       = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!uri || err) {
    return (
      <View style={styles.imgPlaceholder}>
        <Feather name="package" size={18} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <View style={styles.imgWrapper}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, styles.imgLoading]}>
          <ActivityIndicator size="small" color={primary} />
        </View>
      )}
      <Image
        source={{ uri }}
        style={styles.img}
        resizeMode="contain"
        onLoad={() => setLoaded(true)}
        onError={() => setErr(true)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: "700" as const,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500" as const,
    marginTop: 1,
  },

  list: { gap: 8 },

  // ── Kart ──
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: PD.radius.md,
    borderWidth: 1,
    padding: 11,
    gap: 11,
    overflow: "visible",
  },
  // Native glow (iOS shadow)
  cardGlow: {
    shadowColor: RECOMMEND_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  // Web fallback — box-shadow via elevation
  cardGlowWeb: {
    elevation: 3,
  },

  // ── "Önerilen" köşe badge ──
  recommendedPill: {
    position: "absolute",
    top: 7,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FDF0EB",
    borderWidth: 1,
    borderColor: RECOMMEND_COLOR,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 10,
  },
  recommendedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: RECOMMEND_COLOR,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: RECOMMEND_COLOR,
    letterSpacing: 0.3,
  },

  // ── Görsel ──
  imgWrapper: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#F5F3F1",
    overflow: "hidden",
    flexShrink: 0,
    marginTop: 2,
  },
  imgPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  imgLoading: {
    backgroundColor: "#F5F3F1",
    alignItems: "center",
    justifyContent: "center",
  },
  img: { width: 60, height: 60 },

  // ── İçerik ──
  content: {
    flex: 1,
    gap: 3,
  },
  // Önerilen badge ile çakışmasın diye sağ boşluk
  contentWithBadge: {
    paddingRight: 56,
  },

  // ── Top badge ──
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 1,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.1,
  },

  // ── Segment hint ──
  segmentHint: {
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.1,
    marginBottom: 1,
  },

  // ── Ürün metinleri ──
  name: {
    fontSize: 12,
    fontWeight: "700" as const,
    lineHeight: 16,
  },
  benefit: {
    fontSize: 11,
    lineHeight: 15,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
    gap: 6,
  },
  microTrust: {
    fontSize: 10,
    fontWeight: "500" as const,
    flex: 1,
  },

  // ── Karşılaştır butonu ──
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  compareBtnText: {
    fontSize: 9,
    fontWeight: "600" as const,
  },
});
