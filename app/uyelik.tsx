/**
 * uyelik.tsx — Seçkin Üyelik (Subscription Screen)
 *
 * Clean, calm, high-conversion pricing.
 * Two plans: Aylık / Yıllık (default selected).
 * No aggressive copy, no fake urgency.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { PC } from "@/local_demo_data/safe_runtime_shims_v74";
import { setTermsAccepted } from "@/lib/termsStore";
import { supabase } from "@/local_demo_data/safe_runtime_shims_v74";

// ─────────────────────────────────────────────────────────────────────────────
// Pricing data
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id:          "yillik" as const,
    label:       "Yıllık",
    price:       "₺990",
    period:      " / yıl",
    subPrice:    "3 ay ücretsiz",
    recommended: true,
    mainLine:    "Cildin süreklilik ister",
    subLine:     "Düzenli takip ve tekrar, sonucu belirler",
  },
  {
    id:          "aylik" as const,
    label:       "Aylık",
    price:       "₺125",
    period:      " / ay",
    subPrice:    null,
    recommended: false,
    mainLine:    "Esnek başla",
    subLine:     "İstediğin zaman durdurabilirsin",
  },
] as const;

type PlanId = typeof PLANS[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// Feature list
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "message-circle", label: "DermoAsistan",  tagline: "Karar rehberi"              },
  { icon: "camera",         label: "Cilt Bakım Profili", tagline: "Fotoğrafla değerlendirme"   },
  { icon: "calendar",       label: "Rutinim",        tagline: "Planlı ilerleme"            },
  { icon: "shield",         label: "Akıllı Uyarı",  tagline: "Güvenlik katmanı"           },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function UyelikScreen() {
  const colors  = useColors();
  const { colorScheme } = useTheme();
  const isDark  = colorScheme === "dark";
  const insets  = useSafeAreaInsets();
  const { user, refresh } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [selectedPlan, setSelectedPlan] = useState<PlanId>("yillik");
  const [kullanimOnay, setKullanimOnay]  = useState(false);
  const [gizlilikOnay, setGizlilikOnay]  = useState(false);

  const canStart = user ? (kullanimOnay && gizlilikOnay) : true;

  const handleStart = async () => {
    if (!user) {
      router.push("/giris");
      return;
    }
    if (!canStart) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setTermsAccepted();

    // ── Premium aktivasyon ───────────────────────────────────────────────────
    try {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.auth.updateUser({
        data: {
          role: "seckin",
          subscription_status: "active",
          subscription_expires_at: expiresAt,
        },
      });

      if (error) {
        console.error("[uyelik] updateUser hatası:", error.message);
      } else {
        await refresh();
      }
    } catch (err) {
      console.error("[uyelik] aktivasyon hatası:", err);
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const selectPlan = (id: PlanId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlan(id);
  };

  // ── Theme shortcuts ─────────────────────────────────────────────────────
  const bg          = colors.background;
  const cardBg      = isDark ? colors.surfaceCard : colors.surface;
  const textPrimary = colors.text;
  const textSec     = colors.textSecondary;
  const textMuted   = colors.textMuted;
  const border      = colors.border;
  const copper      = PC.accent;                  // #B87333 bakır
  const premiumBg   = isDark ? PC.cardBgDark : PC.cardBgLight;
  const premiumBorder = PC.border;
  const rose        = colors.primary;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <View style={[s.navbar, { paddingTop: topPad + 8, borderBottomColor: border }]}>
        <TouchableOpacity
          style={[s.navBack, { backgroundColor: cardBg }]}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: textPrimary }]}>Seçkin Üyelik</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: botPad + 80 }]}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={[s.headerBadge, { backgroundColor: premiumBg }]}>
            <Feather name="star" size={28} color={copper} />
          </View>
          <Text style={[s.headerTitle, { color: textPrimary }]}>
            Cildini şansa bırakma.
          </Text>
          <Text style={[s.headerSub, { color: textSec }]}>
            Cildim, cildine özel karar verir.
          </Text>
        </View>

        {/* ── Plan Selector ───────────────────────────────────────────────── */}
        <View style={s.plansWrap}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isRec      = plan.recommended;

            // Yearly card gets subtle copper tint even unselected for prominence
            const unselectedBorderColor = isRec
              ? (isDark ? `${copper}35` : `${copper}28`)
              : border;

            return (
              <Pressable
                key={plan.id}
                onPress={() => selectPlan(plan.id)}
                style={[
                  s.planCard,
                  isRec && s.planCardProminent,
                  {
                    backgroundColor: isSelected
                      ? (isRec ? premiumBg : cardBg)
                      : (isDark ? `${colors.surfaceCard}CC` : colors.background),
                    borderColor: isSelected
                      ? (isRec ? premiumBorder : `${rose}55`)
                      : unselectedBorderColor,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                {/* Önerilen badge — always visible on yearly */}
                {isRec && (
                  <View style={[s.recBadge, {
                    backgroundColor: isSelected
                      ? (isDark ? `${copper}22` : `${copper}12`)
                      : (isDark ? `${copper}14` : `${copper}09`),
                    borderColor: `${copper}45`,
                  }]}>
                    <Feather name="star" size={9} color={copper} />
                    <Text style={[s.recBadgeText, { color: copper }]}>Önerilen</Text>
                  </View>
                )}

                {/* Plan header row */}
                <View style={s.planTop}>
                  {/* Radio */}
                  <View style={[s.radio, {
                    borderColor: isSelected ? (isRec ? copper : rose) : border,
                    backgroundColor: isSelected
                      ? (isRec ? copper : rose)
                      : "transparent",
                  }]}>
                    {isSelected && <View style={s.radioInner} />}
                  </View>

                  {/* Label */}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.planLabel, {
                      color: isSelected ? (isRec ? copper : textPrimary) : textSec,
                    }]}>
                      {plan.label}
                    </Text>
                  </View>

                  {/* Price block */}
                  <View style={s.priceCol}>
                    <View style={s.priceRow}>
                      <Text style={[s.price, {
                        color: isSelected ? (isRec ? copper : textPrimary) : textSec,
                      }]}>
                        {plan.price}
                      </Text>
                      <Text style={[s.pricePer, { color: textMuted }]}>
                        {plan.period}
                      </Text>
                    </View>
                    {plan.subPrice && (
                      <Text style={[s.subPrice, { color: isSelected ? copper : textMuted }]}>
                        {plan.subPrice}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Expanded copy — visible when selected */}
                {isSelected && (
                  <View style={[s.copyBlock, { borderTopColor: `${border}60` }]}>
                    <Text style={[s.mainLine, {
                      color: isRec ? copper : textPrimary,
                    }]}>
                      {plan.mainLine}
                    </Text>
                    <Text style={[s.subLine, { color: textMuted }]}>
                      {plan.subLine}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Trust line ───────────────────────────────────────────────────── */}
        <View style={s.trustWrap}>
          <Feather name="shield" size={13} color={textMuted} />
          <Text style={[s.trustText, { color: textMuted }]}>
            İptal kontrolü sende. Dilediğin zaman sonlandırabilirsin.
          </Text>
        </View>

        {/* ── What's included ─────────────────────────────────────────────── */}
        <View style={[s.featuresWrap, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[s.featuresTitle, { color: textMuted }]}>
            DAHİL OLANLAR
          </Text>
          {FEATURES.map((feat, i) => (
            <View
              key={feat.label}
              style={[
                s.featRow,
                i < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: border },
              ]}
            >
              <View style={[s.featIcon, { backgroundColor: premiumBg }]}>
                <Feather name={feat.icon as any} size={14} color={copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.featLabel, { color: textPrimary }]}>{feat.label}</Text>
                <Text style={[s.featTagline, { color: textMuted }]}>{feat.tagline}</Text>
              </View>
              <Feather name="check" size={14} color={colors.success} />
            </View>
          ))}
        </View>

        {/* ── Terms (logged-in users only) ─────────────────────────────────── */}
        {user && (
          <View style={[s.termsWrap, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[s.termsTitle, { color: textSec }]}>
              Devam etmeden önce onaylayın
            </Text>

            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setKullanimOnay(v => !v); }}
              style={s.checkRow}
            >
              <View style={[s.checkbox, {
                borderColor:     kullanimOnay ? copper : border,
                backgroundColor: kullanimOnay ? copper : "transparent",
              }]}>
                {kullanimOnay && <Feather name="check" size={11} color="#fff" />}
              </View>
              <Text style={[s.checkLabel, { color: textSec }]}>
                <Text style={{ fontWeight: "600", color: textPrimary }}>Kullanım Koşulları</Text>
                {"'nı okudum, kabul ediyorum. "}
                <Text
                  style={{ color: rose, textDecorationLine: "underline" }}
                  onPress={() => router.push("/sozlesme" as any)}
                >
                  Oku
                </Text>
              </Text>
            </Pressable>

            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGizlilikOnay(v => !v); }}
              style={s.checkRow}
            >
              <View style={[s.checkbox, {
                borderColor:     gizlilikOnay ? copper : border,
                backgroundColor: gizlilikOnay ? copper : "transparent",
              }]}>
                {gizlilikOnay && <Feather name="check" size={11} color="#fff" />}
              </View>
              <Text style={[s.checkLabel, { color: textSec }]}>
                <Text style={{ fontWeight: "600", color: textPrimary }}>Gizlilik Politikası</Text>
                {"'nı okudum, kabul ediyorum. "}
                <Text
                  style={{ color: rose, textDecorationLine: "underline" }}
                  onPress={() => router.push("/sozlesme" as any)}
                >
                  Oku
                </Text>
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            s.cta,
            {
              backgroundColor: user
                ? (canStart ? copper : border)
                : copper,
            },
          ]}
          onPress={handleStart}
          disabled={user ? !canStart : false}
          activeOpacity={0.82}
        >
          <Text style={[s.ctaText, { color: user && !canStart ? textMuted : "#FFFFFF" }]}>
            {user ? "Seçkin'e geç" : "Giriş Yap & Başlat"}
          </Text>
        </TouchableOpacity>
        {user && (
          <Text style={[s.cancelHint, { color: textMuted }]}>
            İstediğin zaman iptal et
          </Text>
        )}

        {user && !canStart && (
          <Text style={[s.ctaHint, { color: textMuted }]}>
            Devam etmek için her iki onayı da verin
          </Text>
        )}

        {/* Secondary link */}
        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          activeOpacity={0.6}
        >
          <Text style={[s.secondaryText, { color: textMuted }]}>Önce incele</Text>
        </TouchableOpacity>

        {/* ── Psycho line ─────────────────────────────────────────────────── */}
        <Text style={[s.psycho, { color: textMuted }]}>
          Zaten deniyorsun. Ama bu sefer doğru olanı dene.
        </Text>

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <Text style={[s.disclaimer, { color: textMuted }]}>
          İçerikler eczacı ve dermatoloji uzmanı rehberliğinde hazırlanmaktadır.
        </Text>

      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },

  navbar: {
    flexDirection:    "row",
    alignItems:       "center",
    paddingHorizontal: 16,
    paddingBottom:    12,
    gap:              12,
  },
  navBack: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
  },
  navTitle: {
    flex:       1,
    fontSize:   18,
    fontWeight: "700",
    textAlign:  "center",
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop:        8,
    gap:               12,
  },

  // Header
  header: {
    alignItems:    "center",
    gap:           10,
    paddingTop:    8,
    paddingBottom: 4,
  },
  headerBadge: {
    width:          64,
    height:         64,
    borderRadius:   20,
    alignItems:     "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize:   24,
    fontWeight: "800",
    textAlign:  "center",
    letterSpacing: -0.4,
    lineHeight: 30,
    marginTop:  4,
  },
  headerSub: {
    fontSize:  13,
    textAlign: "center",
    lineHeight: 18,
  },
  cancelHint: {
    fontSize:  12,
    textAlign: "center",
    marginTop: 8,
  },
  psycho: {
    fontSize:    12.5,
    textAlign:   "center",
    fontStyle:   "italic",
    paddingHorizontal: 16,
    marginTop:   12,
    lineHeight:  18,
  },

  // Plan cards
  plansWrap: { gap: 10 },

  planCard: {
    borderRadius: 18,
    padding:      18,
    gap:          10,
    overflow:     "hidden",
  },
  planCardProminent: {
    // Yearly: very slightly more padding to feel weightier
    paddingHorizontal: 18,
    paddingVertical:   19,
  },

  recBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    alignSelf:         "flex-start",
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      8,
    borderWidth:       1,
    marginBottom:      2,
  },
  recBadgeText: {
    fontSize:      11,
    fontWeight:    "600",
    letterSpacing: 0.3,
  },

  planTop: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },

  radio: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    1.5,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  radioInner: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },

  planLabel: {
    fontSize:   15,
    fontWeight: "700",
  },

  priceCol: {
    alignItems: "flex-end",
  },
  priceRow: {
    flexDirection: "row",
    alignItems:    "flex-end",
    gap:           1,
  },
  price: {
    fontSize:   22,
    fontWeight: "700",
  },
  pricePer: {
    fontSize:     12,
    marginBottom: 3,
  },
  subPrice: {
    fontSize:   11,
    marginTop:  2,
    fontWeight: "500",
  },

  // Expanded copy block (shown when selected)
  copyBlock: {
    borderTopWidth: 1,
    paddingTop:     10,
    gap:            3,
  },
  mainLine: {
    fontSize:   13,
    fontWeight: "600",
    lineHeight: 18,
  },
  subLine: {
    fontSize:   12,
    lineHeight: 17,
  },

  // Features
  featuresWrap: {
    borderRadius: 16,
    borderWidth:  1,
    overflow:     "hidden",
  },
  featuresTitle: {
    fontSize:          10,
    fontWeight:        "700",
    letterSpacing:     0.7,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     8,
  },
  featRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  featIcon: {
    width:          30,
    height:         30,
    borderRadius:   15,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  featLabel: {
    fontSize:   13,
    fontWeight: "600",
  },
  featTagline: {
    fontSize:  11,
    marginTop: 1,
  },

  // Trust
  trustWrap: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical: 2,
  },
  trustText: {
    fontSize:  12,
    textAlign: "center",
    lineHeight: 17,
    flex: 1,
  },

  // Terms
  termsWrap: {
    borderRadius: 14,
    borderWidth:  1,
    padding:      16,
    gap:          12,
  },
  termsTitle: {
    fontSize:   12,
    fontWeight: "600",
  },
  checkRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           10,
  },
  checkbox: {
    width:          20,
    height:         20,
    borderRadius:   5,
    borderWidth:    1.5,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    marginTop:      1,
  },
  checkLabel: {
    flex:       1,
    fontSize:   12,
    lineHeight: 18,
  },

  // CTA
  cta: {
    borderRadius:    16,
    paddingVertical: 17,
    alignItems:      "center",
    marginTop:       4,
  },
  ctaText: {
    fontSize:      16,
    fontWeight:    "700",
    letterSpacing: 0.2,
  },
  ctaHint: {
    fontSize:  12,
    textAlign: "center",
    marginTop: -4,
  },

  // Secondary
  secondaryBtn: {
    alignItems:     "center",
    paddingVertical: 6,
    marginTop:      -4,
  },
  secondaryText: {
    fontSize:  13,
    textDecorationLine: "underline",
  },

  // Disclaimer
  disclaimer: {
    fontSize:   11,
    textAlign:  "center",
    lineHeight: 17,
    paddingHorizontal: 12,
  },
});