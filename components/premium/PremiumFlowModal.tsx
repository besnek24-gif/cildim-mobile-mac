/**
 * PremiumFlowModal
 *
 * 2-step contextual premium conversion flow:
 *   Step 1 — Contextual value screen  (calm, specific to the feature tapped)
 *   Step 2 — Seçkin subscription screen (only after "Devam et")
 *
 * Props come directly from usePremiumFlow().
 *
 * UX rules:
 *  - No aggressive copy, no fake urgency, no flashing
 *  - Bottom sheet, rounded top, soft backdrop
 *  - Pure RN Animated API (no Easing import, no AntDesign)
 *  - Backdrop: TouchableWithoutFeedback + absolute View (NOT Pressable absoluteFill)
 *  - Page transition: fade cross-dissolve (no horizontal pager)
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import type { PremiumFlowAPI, PremiumFlowStep } from "@/src/premium/usePremiumFlow";
import {
  getContextualEntry,
  PREMIUM_FEATURE_SUMMARIES,
} from "@/src/premium/usePremiumFlow";

// ─────────────────────────────────────────────────────────────────────────────
// Module icon map
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_ICON: Record<string, string> = {
  dermaAssistant: "message-circle",
  skinAnalysis:   "camera",
  rutinim:        "calendar",
  smartWarnings:  "shield",
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Props = PremiumFlowAPI;

export default function PremiumFlowModal(props: Props) {
  const { visible, moduleId, step, advance, dismiss } = props;

  const colors      = useColors();
  const { colorScheme } = useTheme();
  const isDark      = colorScheme === "dark";
  const router      = useRouter();

  // ── Sheet + backdrop animations ──────────────────────────────────────────
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim    = useRef(new Animated.Value(600)).current;

  // ── Page cross-fade ──────────────────────────────────────────────────────
  // `displayStep` is what's actually rendered; lags behind `step` by one fade.
  const [displayStep, setDisplayStep] = useState<PremiumFlowStep>("contextual");
  const contentAnim = useRef(new Animated.Value(1)).current;

  // ── Open / close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setDisplayStep("contextual");
      contentAnim.setValue(1);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1, duration: 240, useNativeDriver: true,
        }),
        Animated.spring(sheetAnim, {
          toValue: 0, tension: 68, friction: 11, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0, duration: 180, useNativeDriver: true,
        }),
        Animated.timing(sheetAnim, {
          toValue: 600, duration: 210, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ── Step change → cross-fade ─────────────────────────────────────────────
  useEffect(() => {
    if (step === displayStep) return;
    // Fade out → swap → fade in
    Animated.timing(contentAnim, {
      toValue: 0, duration: 140, useNativeDriver: true,
    }).start(() => {
      setDisplayStep(step);
      Animated.timing(contentAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  }, [step]);

  if (!moduleId) return null;

  const entry = getContextualEntry(moduleId);
  const icon  = MODULE_ICON[moduleId] ?? "star";

  // ── Colors ───────────────────────────────────────────────────────────────
  const sheetBg       = colors.surface;
  const textPrimary   = colors.text;
  const textSecondary = colors.textSecondary;
  const textMuted     = colors.textMuted;
  const borderColor   = colors.border;
  const accentColor   = colors.primary;
  const premiumColor  = colors.premium;
  const premiumBg     = colors.premiumBg;
  const cardBg        = isDark ? colors.surfaceCard : colors.background;

  const goToUyelik = () => {
    dismiss();
    setTimeout(() => router.push("/uyelik" as any), 280);
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={dismiss}
    >
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.45)", opacity: backdropAnim },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* ── Sheet ─────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          ss.sheet,
          { backgroundColor: sheetBg, transform: [{ translateY: sheetAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={ss.handleWrap}>
          <View style={[ss.handle, { backgroundColor: borderColor }]} />
        </View>

        {/* Cross-fading content area */}
        <Animated.View style={{ opacity: contentAnim }}>
          {displayStep === "contextual" ? (
            /* ══════════════════════════════════════════════════════════
               PAGE 1 — Contextual Value Screen
            ══════════════════════════════════════════════════════════ */
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={ss.content}
            >
              {/* Module icon */}
              <View style={[ss.iconBadge, { backgroundColor: premiumBg }]}>
                <Feather name={icon as any} size={26} color={premiumColor} />
              </View>

              {/* Title */}
              <Text style={[ss.ctxTitle, { color: textPrimary }]}>
                {entry.title}
              </Text>

              {/* Subtitle */}
              <Text style={[ss.ctxSubtitle, { color: textSecondary }]}>
                {entry.subtitle}
              </Text>

              {/* Divider */}
              <View style={[ss.divider, { backgroundColor: borderColor }]} />

              {/* 3 bullets */}
              {entry.bullets.map((bullet, i) => (
                <View key={i} style={ss.bulletRow}>
                  <View style={[ss.bulletIcon, { backgroundColor: premiumBg }]}>
                    <Feather
                      name={entry.bulletIcons[i] as any}
                      size={14}
                      color={premiumColor}
                    />
                  </View>
                  <Text style={[ss.bulletText, { color: textPrimary }]}>
                    {bullet}
                  </Text>
                </View>
              ))}

              {/* Divider */}
              <View style={[ss.divider, { backgroundColor: borderColor }]} />

              {/* Trust line */}
              <Text style={[ss.trustLine, { color: textMuted }]}>
                {entry.trustLine}
              </Text>

              <View style={ss.spacer} />

              {/* Primary CTA */}
              <TouchableOpacity
                style={[ss.primaryBtn, { backgroundColor: accentColor }]}
                onPress={advance}
                activeOpacity={0.82}
              >
                <Text style={ss.primaryBtnText}>Devam et</Text>
              </TouchableOpacity>

              {/* Secondary CTA */}
              <TouchableOpacity
                style={ss.secondaryBtn}
                onPress={dismiss}
                activeOpacity={0.6}
              >
                <Text style={[ss.secondaryBtnText, { color: textMuted }]}>
                  Önce incele
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* ══════════════════════════════════════════════════════════
               PAGE 2 — Seçkin Premium Screen
            ══════════════════════════════════════════════════════════ */
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={ss.content}
            >
              {/* Header */}
              <View style={ss.premiumHeader}>
                <View style={[ss.premiumBadge, { backgroundColor: premiumBg }]}>
                  <Feather name="star" size={18} color={premiumColor} />
                </View>
                <Text style={[ss.premiumTitle, { color: textPrimary }]}>
                  Seçkin Üyelik
                </Text>
              </View>

              {/* Feature rows */}
              {PREMIUM_FEATURE_SUMMARIES.map((feat) => (
                <View
                  key={feat.moduleId}
                  style={[ss.featureRow, { backgroundColor: cardBg, borderColor }]}
                >
                  <View style={[ss.featureIcon, { backgroundColor: premiumBg }]}>
                    <Feather name={feat.icon as any} size={16} color={premiumColor} />
                  </View>
                  <View style={ss.featureText}>
                    <Text style={[ss.featureLabel, { color: textPrimary }]}>
                      {feat.label}
                    </Text>
                    <Text style={[ss.featureTagline, { color: textSecondary }]}>
                      {feat.tagline}
                    </Text>
                  </View>
                  {feat.moduleId === moduleId && (
                    <View style={[ss.activeTag, { backgroundColor: premiumBg }]}>
                      <Text style={[ss.activeTagText, { color: premiumColor }]}>
                        Şu an
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Trust note */}
              <Text style={[ss.premiumNote, { color: textMuted }]}>
                Eczacı denetiminde hazırlanmış içerik mantığı
              </Text>

              <View style={ss.spacer} />

              {/* Primary CTA */}
              <TouchableOpacity
                style={[ss.primaryBtn, { backgroundColor: premiumColor }]}
                onPress={goToUyelik}
                activeOpacity={0.82}
              >
                <Text style={ss.primaryBtnText}>Seçkin Üyeliği Başlat</Text>
              </TouchableOpacity>

              {/* Secondary CTA */}
              <TouchableOpacity
                style={ss.secondaryBtn}
                onPress={dismiss}
                activeOpacity={0.6}
              >
                <Text style={[ss.secondaryBtnText, { color: textMuted }]}>
                  Kullanmaya devam et
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  sheet: {
    position:             "absolute",
    bottom:               0,
    left:                 0,
    right:                0,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    maxHeight:            "88%",
    overflow:             "hidden",
    shadowColor:          "#000",
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.12,
    shadowRadius:         16,
    elevation:            20,
  },

  handleWrap: {
    alignItems:    "center",
    paddingTop:    12,
    paddingBottom: 4,
  },

  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
  },

  content: {
    paddingHorizontal: 24,
    paddingBottom:     44,
    paddingTop:        8,
  },

  // ── Contextual screen ────────────────────────────────────────────────────

  iconBadge: {
    alignSelf:      "center",
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      10,
    marginBottom:   18,
  },

  ctxTitle: {
    fontSize:     22,
    fontWeight:   "700",
    textAlign:    "center",
    lineHeight:   30,
    marginBottom: 8,
  },

  ctxSubtitle: {
    fontSize:   13,
    textAlign:  "center",
    lineHeight: 18,
  },

  divider: {
    height:         1,
    marginVertical: 18,
    opacity:        0.45,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems:    "center",
    marginBottom:  14,
    gap:           12,
  },

  bulletIcon: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  bulletText: {
    flex:       1,
    fontSize:   14,
    lineHeight: 20,
  },

  trustLine: {
    fontSize:   12,
    textAlign:  "center",
    fontStyle:  "italic",
    lineHeight: 17,
  },

  spacer: { height: 22 },

  primaryBtn: {
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      "center",
    marginBottom:    10,
  },

  primaryBtnText: {
    color:         "#FFFFFF",
    fontSize:      16,
    fontWeight:    "700",
    letterSpacing: 0.3,
  },

  secondaryBtn: {
    paddingVertical: 10,
    alignItems:      "center",
  },

  secondaryBtnText: {
    fontSize:   14,
    fontWeight: "500",
  },

  // ── Premium screen ───────────────────────────────────────────────────────

  premiumHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    marginBottom:  20,
    marginTop:     10,
  },

  premiumBadge: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },

  premiumTitle: {
    fontSize:   20,
    fontWeight: "700",
  },

  featureRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               12,
    borderRadius:      14,
    borderWidth:       1,
    paddingVertical:   14,
    paddingHorizontal: 14,
    marginBottom:      10,
  },

  featureIcon: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  featureText: { flex: 1 },

  featureLabel: {
    fontSize:     14,
    fontWeight:   "600",
    marginBottom: 2,
  },

  featureTagline: {
    fontSize: 12,
  },

  activeTag: {
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },

  activeTagText: {
    fontSize:   11,
    fontWeight: "600",
  },

  premiumNote: {
    fontSize:   12,
    textAlign:  "center",
    fontStyle:  "italic",
    marginTop:  6,
    lineHeight: 17,
  },
});
