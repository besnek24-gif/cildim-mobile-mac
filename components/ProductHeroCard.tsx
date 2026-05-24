/**
 * ProductHeroCard — vertical card for carousels / home sections.
 *
 * Premium micro-interactions:
 *  - Press: scale 0.97 on pressIn, spring back on release
 *  - Entrance: fade-in + translateY staggered by index
 *  - Score: ≥85 green · 70–84 charcoal · <70 amber
 *  - Segment badge: animated modal (spring scale + fade)
 *  - Card shadow: subtle elevation
 */
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { computeMatchScore } from "@/lib/safetyRanking";
import { getScoreColor } from "@/lib/scoreColors";
import { getFinalProductScore } from "@/lib/getFinalScore";
import { trackEvent } from "@/lib/userEvents";
import type { LearningProfile } from "@/lib/userEvents";
import { getCardLabel } from "@/lib/recommendationReason";
import {
  ProductSummary,
  resolveBrand,
  resolveProductName,
  resolveThumbnailUrl,
  resolveImageUrl,
} from "@/types/product";
// PERF E4/F2 — canonical thumbnail pipeline (mirrors components/ProductImage.tsx).
// rawUri → resolveAbsoluteUri → unwrapProxyImg → toSupabaseThumbnail(400)
// Boylece prefetch URL ile render URL ayni olur, cache hit kacirilmaz.
import { resolveAbsoluteUri, toSupabaseThumbnail } from "@/lib/imageUri";

const MATCH_THRESHOLD = 2;

// PERF: bypass /api/proxy-img wrapper — extract original URL from `url=` query
// param so <Image> hits the upstream CDN directly. Mirrors the same helper in
// components/ProductImage.tsx. Synchronous, no new logic beyond a string parse.
// Falls back to the input on any failure.
// To rollback: delete this function and remove the unwrapProxyImg(...) wrap on
// the `uri` derivation below (around line 142).
function unwrapProxyImg(uri: string | null | undefined): string | null {
  if (!uri) return uri ?? null;
  const idx = uri.indexOf("/api/proxy-img");
  if (idx === -1) return uri;
  const urlParamIdx = uri.indexOf("url=", idx);
  if (urlParamIdx === -1) return uri;
  const tail = uri.slice(urlParamIdx + 4);
  const ampIdx = tail.indexOf("&");
  const encoded = ampIdx === -1 ? tail : tail.slice(0, ampIdx);
  try {
    const decoded = decodeURIComponent(encoded);
    if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
    return uri;
  } catch {
    return uri;
  }
}

// ── Segment config ──────────────────────────────────────────────────────────

const SEGMENT: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  modalTitle: string;
  modalDesc: string;
}> = {
  seçkin: {
    label: "Seçkin",
    color: "#B87333",
    bg: "rgba(184,115,51,0.10)",
    border: "rgba(184,115,51,0.30)",
    modalTitle: "Seçkin Segment",
    modalDesc: "Üst segment ürünler. En yüksek kalite ve performans arayanlar için.",
  },
  profesyonel: {
    label: "Pro",
    color: "#5558E3",
    bg: "rgba(85,88,227,0.08)",
    border: "rgba(85,88,227,0.25)",
    modalTitle: "Profesyonel Segment",
    modalDesc: "Güçlü içerik ve performans sunar. Bilinçli kullanıcı tercihi.",
  },
  ekonomik: {
    label: "Eko",
    color: "#7A8F6B",
    bg: "rgba(122,143,107,0.08)",
    border: "rgba(122,143,107,0.25)",
    modalTitle: "Ekonomik Segment",
    modalDesc: "Günlük ihtiyaçları karşılar. Ulaşılabilir ve akıllı bir seçim.",
  },
};

// resolveScoreColor → getScoreColor (lib/scoreColors.ts) ile değiştirildi

// ── Dimensions ──────────────────────────────────────────────────────────────

const CARD_W  = 152;
const CARD_H  = 280;
const IMAGE_H = 196;
const INFO_H  = 84;
const IMG_BG  = "#F5F3F0";

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  product: ProductSummary;
  onPress: () => void;
  index?: number;
  learningProfile?: LearningProfile;
}

// ── Category accent — anlamlı renk sistemi ──────────────────────────────────

function getCategoryAccent(product: any): string {
  const cat      = (product.category ?? product.kategori ?? "").toLowerCase();
  const concerns: string[] = product.concerns_supported ?? [];
  const text     = [cat, ...concerns].join(" ").toLowerCase();

  if (/akne|sivilce|acne/.test(text))               return "#B83232";
  if (/güneş|spf|sun|uv/.test(text))               return "#C08A10";
  if (/hassas|sensitive|kızarık|rosace/.test(text))  return "#7050B8";
  if (/leke|spot|ton|hiperpig|aydın/.test(text))    return "#2D8A60";
  if (/saç|hair|skalp/.test(text))                 return "#7A5C42";
  if (/göz|eye/.test(text))                         return "#3A70C0";
  if (/nem|nemlendirici|moistur|kuru/.test(text))   return "#2E72C0";
  if (/temiz|cleanse|arındır|jel|köpük/.test(text)) return "#3A8EA8";
  return "#7A8F6B";
}

// ── Component ───────────────────────────────────────────────────────────────

export function ProductHeroCard({ product, onPress, index = 0, learningProfile }: Props) {
  const colors    = useColors();
  const { colorScheme: scheme } = useTheme();
  const brandColor  = scheme === "dark" ? "#8BA8BC" : "#6B7280";
  const cardAccent  = getCategoryAccent(product);
  const { preferences } = useUserPreferences();
  const [segModal, setSegModal] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  const { effectiveRole } = useAuth();
  const isPremium    = effectiveRole === "seckin";
  // Single source of truth: same getFinalProductScore the Detail screen uses.
  // useMemo keyed on the product reference so the resolver runs at most once
  // per render. Returns null when no score field is available — pill below is
  // hidden entirely (no "—" placeholder).
  const score        = useMemo(() => getFinalProductScore(product as any), [product]);
  const matchScore   = computeMatchScore(product as any, preferences.skinType, preferences.skinConcerns);
  const showBadge    = matchScore >= MATCH_THRESHOLD;
  const showPaywall  = !isPremium && index % 5 === 4;
  const reason       = !showPaywall
    ? getCardLabel(product as any)
    : null;
  const rawUri       = resolveThumbnailUrl(product) || resolveImageUrl(product) || null;
  // PERF E4/F2 — canonical pipeline (matches ProductImage.tsx exactly):
  //   resolveAbsoluteUri → unwrapProxyImg → toSupabaseThumbnail(400)
  // Onceden sadece unwrapProxyImg uygulaniyordu, full-size CDN URL render
  // ediliyor, prefetch ile eslesmiyor, cache hit kaciriliyordu. Local
  // unwrapProxyImg helper'i (yukarida) korundu — fonksiyonel olarak ayni,
  // sadece render zinciri canonical'a hizalandi.
  const uri          = rawUri
    ? toSupabaseThumbnail(unwrapProxyImg(resolveAbsoluteUri(rawUri)), 400)
    : null;
  const displayName  = resolveProductName(product);
  const displayBrand = resolveBrand(product);
  const segment      = (product as any).segment as string | undefined;
  const seg          = segment ? (SEGMENT[segment] ?? null) : null;
  const scoreColor   = getScoreColor(score);

  // ── Press animation — zoom-in lift effect ────────────────────────────────
  const pressScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(pressScale, {
      toValue: 1.03,
      duration: 110,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 240,
      mass: 0.7,
    }).start();
  };

  // ── Entrance animation — scale-in + fade + stagger ────────────────────────
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      delay: index * 65,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, []);

  const cardAnimStyle = {
    opacity: entranceAnim,
    transform: [
      { scale: pressScale },
      {
        scale: entranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  // ── Modal animations ────────────────────────────────────────────────────
  const modalScale   = useRef(new Animated.Value(0.88)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const openModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSegModal(true);
    modalScale.setValue(0.88);
    modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 260,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalScale,   { toValue: 0.92, duration: 110, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0,    duration: 110, useNativeDriver: true }),
    ]).start(() => setSegModal(false));
  };

  return (
    <>
      {/* ── Card ── */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: scheme === "dark" ? "#242E45" : "#FFFFFF",
            ...Platform.select({
              ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: scheme === "dark" ? 0.3 : 0.06, shadowRadius: 8 },
              android: { elevation: 3 },
              web:     { boxShadow: scheme === "dark" ? "0px 4px 12px rgba(0,0,0,0.30)" : "0px 4px 8px rgba(0,0,0,0.06)" } as any,
            }),
          },
          cardAnimStyle,
        ]}
      >
        <Pressable
          onPress={() => { trackEvent("product_click", String(product.id)); onPress(); }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={{ flex: 1 }}
        >
          {/* ── IMAGE PANEL — white background, padded, centered ── */}
          <View style={[styles.imageWrapper, {
            backgroundColor: scheme === "dark" ? "#242E45" : "#FFFFFF",
          }]}>
            {!uri || imgError ? (
              <View style={styles.imgPlaceholder}>
                <Text style={{ fontSize: 34 }}>📦</Text>
              </View>
            ) : (
              <>
                {!loaded && (
                  <View style={StyleSheet.absoluteFill}>
                    <View style={styles.loadCenter}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  </View>
                )}
                <Image
                  source={{ uri }}
                  style={styles.img}
                  resizeMode="contain"
                  onLoad={() => setLoaded(true)}
                  onError={() => { setImgError(true); setLoaded(true); }}
                />
              </>
            )}
          </View>

          {/* ── INFO PANEL — grey background, visual separation ── */}
          <View style={[styles.textArea, {
            backgroundColor: scheme === "dark" ? "#1E2840" : "#F5F3F0",
          }]}>

            {/* Row: Brand · Segment badge · Score */}
            <View style={styles.metaRow}>
              {displayBrand ? (
                <Text style={[styles.brand, { color: brandColor }]} numberOfLines={1}>
                  {displayBrand}
                </Text>
              ) : null}

              {seg ? (
                <Pressable
                  onPress={openModal}
                  style={[styles.segPill, { backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.10)" : "#FFFFFF", borderColor: seg.border }]}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Text style={[styles.segPillText, { color: seg.color }]}>{seg.label}</Text>
                </Pressable>
              ) : null}

              {score != null ? (
                <View style={[
                  styles.scorePill,
                  {
                    backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.10)" : "#FFFFFF",
                    borderColor: `${scoreColor}45`,
                  },
                ]}>
                  <Text style={[styles.scorePillText, { color: scoreColor }]}>
                    {`${score} puan`}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Product name — sabit 36px konteyner, 2 satır rezerv */}
            <View style={styles.nameContainer}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                {displayName}
              </Text>
            </View>

            {/* Alt bilgi satırı — sabit yükseklik (layout shift önlemi) */}
            <View style={{ height: 18, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
              {showBadge ? (
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgeText}>Sana Uygun</Text>
                </View>
              ) : showPaywall ? (
                <TouchableOpacity style={styles.paywallRow} onPress={() => {}} activeOpacity={0.7}>
                  <Ionicons name="lock-closed-outline" size={9} color="#A78BFA" />
                  <Text style={styles.paywallText} numberOfLines={1}>Neden sana uygun?</Text>
                  <Ionicons name="chevron-forward" size={9} color="#A78BFA" />
                </TouchableOpacity>
              ) : reason ? (
                <View style={styles.reasonRow}>
                  <View style={styles.reasonDot} />
                  <Text
                    style={[styles.recommendReason, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {reason}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* ── Segment modal — spring scale + fade ── */}
      {seg && (
        <Modal visible={segModal} transparent animationType="none" onRequestClose={closeModal}>
          <Pressable style={styles.backdrop} onPress={closeModal}>
            <Animated.View
              style={[
                styles.modalBox,
                { backgroundColor: colors.surfaceCard, borderColor: colors.border },
                { opacity: modalOpacity, transform: [{ scale: modalScale }] },
              ]}
            >
              <View style={[styles.modalBar, { backgroundColor: seg.color }]} />
              <View style={styles.modalBody}>
                <View style={[styles.modalPill, { backgroundColor: `${seg.color}1A` }]}>
                  <Text style={[styles.modalPillText, { color: seg.color }]}>{seg.label}</Text>
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{seg.modalTitle}</Text>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>{seg.modalDesc}</Text>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: seg.color }]}
                  onPress={closeModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalBtnText}>Tamam</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  // ── IMAGE PANEL ─────────────────────────────────────────────────────────
  imageWrapper: {
    flex: 7,
    width: CARD_W,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  imgBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  img: {
    width: CARD_W - 16,
    height: IMAGE_H - 16,
  },
  imgPlaceholder: {
    width: CARD_W - 16,
    height: IMAGE_H - 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loadCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── INFO PANEL ──────────────────────────────────────────────────────────
  textArea: {
    flex: 3,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "column" as const,
    justifyContent: "space-between" as const,
    overflow: "hidden" as const,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },

  // Meta row
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 4,
  },
  brand: {
    fontSize: 10,
    fontWeight: "400" as const,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  segPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
  },
  segPillText: {
    fontSize: 8,
    fontWeight: "600" as const,
    letterSpacing: 0.1,
  },
  scorePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  scorePillText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  nameContainer: {
    minHeight: 36,
    maxHeight: 36,
    justifyContent: "flex-start" as const,
    overflow: "hidden" as const,
  },
  name: {
    fontSize: 13,
    fontWeight: "600" as const,
    lineHeight: 18,
  },

  // Şahsileştirme etiketi
  matchBadge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#EEF2FF",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  matchBadgeText: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: "#4338CA",
    letterSpacing: 0.1,
  },

  // Soft paywall teaser
  paywallRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 4,
    opacity: 0.72,
    backgroundColor: "rgba(139,92,246,0.06)",
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: "rgba(139,92,246,0.22)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: "stretch" as const,
  },
  paywallText: {
    flex: 1,
    fontSize: 9,
    fontWeight: "500" as const,
    color: "#7C3AED",
  },

  // Neden önerildi — kısa, şahsi, soluk ama okunabilir
  reasonRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 4,
  },
  reasonDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#A78BFA",
    flexShrink: 0,
    marginTop: 1,
  },
  recommendReason: {
    flex: 1,
    fontSize: 10,
    fontWeight: "500" as const,
    lineHeight: 13,
    opacity: 0.88,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  modalBox: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalBar:  { height: 5 },
  modalBody: { padding: 24, alignItems: "center", gap: 12 },
  modalPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10 },
  modalPillText: { fontSize: 13, fontWeight: "700" as const },
  modalTitle: { fontSize: 15, fontWeight: "700" as const },
  modalDesc:  { fontSize: 14, textAlign: "center", lineHeight: 21 },
  modalBtn:   { marginTop: 4, paddingHorizontal: 32, paddingVertical: 10, borderRadius: 12 },
  modalBtnText: { fontSize: 14, fontWeight: "700" as const, color: "#fff" },
});
