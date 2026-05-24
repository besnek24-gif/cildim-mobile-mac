/**
 * akilli-rutin.tsx  —  Akıllı Kişisel Rutin Ekranı
 *
 * Params: concern (SkinConcernKey)
 *
 * Motor:
 *  1. rankProductsForConcern → TieredMatchResults
 *  2. buildSmartRoutine      → SmartRoutine (ürün atanmış adımlar)
 *  3. Sabah / Akşam accordion render
 *  4. Her adım: ürün, "Neden bu adım?", alternatifler
 *  5. Zaman çizelgesi + motivasyon banner
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductImage } from "@/components/ProductImage";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useTheme } from "@/context/ThemeContext";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { resolveImageUrl, resolveThumbnailUrl } from "@/types/product";
import { rankProductsForConcern } from "@/lib/productMatchEngine";
import { buildSmartRoutine } from "@/lib/smartRoutineEngine";
import {
  getRecommendation,
  buildRecommendationProfileSig,
} from "@/lib/recommendationFlowStore";
import type { SmartRoutineStep } from "@/lib/smartRoutineEngine";
import {
  SKIN_CONCERN_LABELS,
  type SkinConcernKey,
} from "@/lib/userPreferences";
import { CONCERN_COLORS, CONCERN_ICONS } from "@/lib/productMatchEngine";

// ─── Palet ───────────────────────────────────────────────────────────────────

const LIGHT = {
  bg:        "#F5F1EB",
  cardBg:    "#FFFFFF",
  border:    "rgba(0,0,0,0.07)",
  text:      "#1A1A1A",
  textSub:   "#5A5A5A",
  textMuted: "#8C8C8C",
  sectionBg: "#FAF7F2",
  emptyBg:   "#EEE8DE",
};
const DARK = {
  bg:        "#121210",
  cardBg:    "#1C1C1A",
  border:    "rgba(255,255,255,0.07)",
  text:      "#F0EDE6",
  textSub:   "#AAA8A2",
  textMuted: "#6A6862",
  sectionBg: "#181816",
  emptyBg:   "#272521",
};

const AM_COLOR = "#C8A97E";  // altın — sabah
const PM_COLOR = "#4A6FA5";  // mavi — akşam

// ─── Expandable "Neden bu adım?" ─────────────────────────────────────────────

function WhyPanel({
  step,
  pal,
  accent,
}: {
  step: SmartRoutineStep;
  pal: typeof LIGHT;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const to = open ? 0 : 1;
    setOpen(!open);
    Animated.timing(anim, { toValue: to, duration: 200, useNativeDriver: false }).start();
  }

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={[s.whyBtn, { borderColor: `${accent}30`, backgroundColor: `${accent}0D` }]}
      >
        <Feather name="help-circle" size={13} color={accent} style={{ marginRight: 6 }} />
        <Text style={[s.whyBtnText, { color: accent, flex: 1 }]}>Neden bu adım?</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="chevron-down" size={13} color={accent} />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <View style={[s.whyBody, { backgroundColor: `${accent}07`, borderColor: `${accent}18` }]}>
          <Text style={[s.whyText, { color: pal.text }]}>{step.why}</Text>

          <View style={[s.whyDivider, { backgroundColor: `${accent}20` }]} />

          <Text style={[s.howToLabel, { color: pal.textMuted }]}>Nasıl uygulanır?</Text>
          <Text style={[s.howToText, { color: pal.textSub }]}>{step.howTo}</Text>

          {step.caution && (
            <View style={[s.cautionRow, { backgroundColor: "#FFF3CD", borderColor: "#F0C040" }]}>
              <Feather name="alert-triangle" size={12} color="#B07E00" style={{ marginTop: 2 }} />
              <Text style={[s.cautionText, { flex: 1 }]}>{step.caution}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── ECZ-4 DÖRTLÜ Step 2: empty-slot UX yardımcıları ────────────────────────
// SLOT → tum-urunler için kategori query (engine ALL_SLOTS.bucket eşlemesinden
// türetilmiş yerel sabit; engine import edilmez, dokunulmaz).
const SLOT_TO_CATEGORY_QUERY: Record<SmartRoutineStep["slot"], string> = {
  cleanser:    "cleanser",
  treatment:   "serum",
  moisturizer: "moisturizer",
  sunscreen:   "sunscreen",
  repair:      "moisturizer",
};

function getEmptyRoutineStepCopy(step: SmartRoutineStep): { title: string; hint: string } {
  if (step.noProductReason === "low_score") {
    return {
      title: `${step.stepLabel} için güçlü eşleşme bulunamadı`,
      hint: step.isEssential
        ? "Bu adım rutinin temel parçası; mevcut adaylar profilin için yeterince güçlü görünmüyor."
        : "Bu adım destekleyici olduğu için yalnızca güçlü eşleşmeleri gösteriyoruz.",
    };
  }
  return {
    title: `${step.stepLabel} kategorisinde uygun ürün bulunamadı`,
    hint: step.isEssential
      ? "Bu adım rutinin temel parçası; kataloğa bakarak uygun bir alternatif seçebilirsin."
      : "Bu adım opsiyonel; uygun ürün eklenene kadar rutini onsuz sürdürebilirsin.",
  };
}

// ─── Adım kartı ───────────────────────────────────────────────────────────────

function StepCard({
  step,
  stepNumber,
  accent,
  pal,
  isDark,
  concern,
}: {
  step:       SmartRoutineStep;
  stepNumber: number;
  accent:     string;
  pal:        typeof LIGHT;
  isDark:     boolean;
  concern?:   SkinConcernKey;
}) {
  const p    = step.product;
  const name = p ? ((p.name ?? (p as any).isim ?? "Ürün") as string) : null;
  const brand= p ? ((p.brand ?? (p as any).marka ?? "") as string)  : null;
  // MERKEZI cozumleyici — storage_image_url > image_url > thumbnail_url > legacy
  const img  = p ? resolveImageUrl(p as any) : null;
  const thumb= p ? resolveThumbnailUrl(p as any) : null;

  function handleProductPress() {
    if (!p) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prefetchProductHeroImage(p as any);
    setNavigationProduct(p);
    router.push(`/(tabs)/(home)/product/${p.id}`);
  }

  return (
    <View style={[s.stepCard, {
      backgroundColor: pal.cardBg,
      borderColor:     pal.border,
      ...Platform.select({
        ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
        android: { elevation: 2 },
        web:     { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
      }),
    }]}>
      {/* Adım başlığı */}
      <View style={s.stepHeader}>
        <View style={[s.stepNum, { backgroundColor: `${accent}18` }]}>
          <Text style={[s.stepNumText, { color: accent }]}>{stepNumber}</Text>
        </View>
        <View style={[s.stepIconBox, { backgroundColor: `${accent}12` }]}>
          <Feather name={step.icon as any} size={14} color={accent} />
        </View>
        <Text style={[s.stepLabel, { color: pal.text }]}>{step.stepLabel}</Text>
        {step.isEssential && (
          <View style={[s.essentialBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}>
            <Text style={[s.essentialText, { color: accent }]}>zorunlu</Text>
          </View>
        )}
      </View>

      {/* Ürün satırı */}
      {p ? (
        <TouchableOpacity
          onPress={handleProductPress}
          activeOpacity={0.85}
          style={[s.productRow, { backgroundColor: isDark ? "#252422" : "#F9F6F0", borderColor: pal.border }]}
        >
          <View style={[s.productImgWrap, { backgroundColor: isDark ? "#302E2A" : "#F0EBE1" }]}>
            <ProductImage imageUrl={img} thumbnailUrl={thumb} size={56} borderRadius={10} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            {brand && brand.length > 0 && (
              <Text style={[s.productBrand, { color: pal.textMuted }]} numberOfLines={1}>{brand}</Text>
            )}
            <Text style={[s.productName, { color: pal.text }]} numberOfLines={2}>{name}</Text>
          </View>
          <Feather name="chevron-right" size={15} color={pal.textMuted} />
        </TouchableOpacity>
      ) : (
        <View style={[s.noProductRow, { backgroundColor: pal.emptyBg, borderColor: pal.border, flexDirection: "column", alignItems: "flex-start" }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather
              name={step.noProductReason === "low_score" ? "alert-circle" : "package"}
              size={16}
              color={step.noProductReason === "low_score" ? accent : pal.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text style={[s.noProductText, { color: step.noProductReason === "low_score" ? pal.text : pal.textMuted }]}>
              {getEmptyRoutineStepCopy(step).title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              const category = SLOT_TO_CATEGORY_QUERY[step.slot];
              if (category) {
                router.push({
                  pathname: "/(tabs)/(home)/tum-urunler",
                  params: {
                    category,
                    ...(concern ? { concern } : {}),
                    source: "akilli-rutin",
                    slot: step.slot,
                  },
                } as any);
              } else {
                // Geriye uyumlu fallback — beklenmedik slot için eski davranış
                router.push("/(tabs)/(home)/tum-urunler" as any);
              }
            }}
            activeOpacity={0.75}
            style={{
              marginTop: 10,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: `${accent}14`,
              borderWidth: 1,
              borderColor: `${accent}35`,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: accent }}>Alternatif ara</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Alternatifler */}
      {step.alternatives.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.altLabel, { color: pal.textMuted }]}>Alternatifler</Text>
          <View style={s.altRow}>
            {step.alternatives.map((alt, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  prefetchProductHeroImage(alt.product as any);
                  setNavigationProduct(alt.product);
                  router.push(`/(tabs)/(home)/product/${alt.product.id}`);
                }}
                activeOpacity={0.8}
                style={[s.altChip, {
                  backgroundColor: `${accent}10`,
                  borderColor: `${accent}25`,
                  marginRight: i < step.alternatives.length - 1 ? 8 : 0,
                }]}
              >
                <Text style={[s.altChipText, { color: accent }]} numberOfLines={1}>
                  {alt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Neden bu adım? */}
      <WhyPanel step={step} pal={pal} accent={accent} />
    </View>
  );
}

// ─── Zaman çizelgesi ─────────────────────────────────────────────────────────

function TimelineBanner({
  routine,
  accentColor,
  pal,
}: {
  routine: ReturnType<typeof buildSmartRoutine>;
  accentColor: string;
  pal: typeof LIGHT;
}) {
  return (
    <View style={[s.timelineCard, { backgroundColor: `${accentColor}0D`, borderColor: `${accentColor}25` }]}>
      <View style={s.timelineHeader}>
        <View style={[s.timelineIconBox, { backgroundColor: `${accentColor}20` }]}>
          <Feather name="clock" size={15} color={accentColor} />
        </View>
        <Text style={[s.timelineTitle, { color: accentColor }]}>Ne zaman sonuç beklemeli?</Text>
      </View>

      <View style={s.timelinePhases}>
        {[
          { range: routine.timeline.phase1, label: "İlk iyileşme sinyalleri" },
          { range: routine.timeline.phase2, label: "Görünür değişim" },
          { range: routine.timeline.phase3, label: "Belirgin sonuç" },
        ].map((phase, i) => (
          <View key={i} style={[s.phaseRow, i < 2 && { marginBottom: 6 }]}>
            <View style={[s.phaseDot, { backgroundColor: accentColor }]} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.phaseRange, { color: accentColor }]}>{phase.range}</Text>
              <Text style={[s.phaseLabel, { color: pal.textSub }]}>{phase.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[s.timelineNote, { backgroundColor: `${accentColor}10`, borderColor: `${accentColor}20` }]}>
        <Feather name="info" size={12} color={accentColor} style={{ marginTop: 1 }} />
        <Text style={[s.timelineNoteText, { color: pal.textSub, flex: 1 }]}>{routine.timeline.note}</Text>
      </View>
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function AkilliRutinScreen() {
  const { concern: concernParam } = useLocalSearchParams<{ concern: string }>();
  const concern = concernParam as SkinConcernKey | undefined;

  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const pal = isDark ? DARK : LIGHT;

  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();

  const { preferences, ready } = useUserPreferences();
  const { products, loading }  = useSupabaseProducts();

  const accentColor = concern ? CONCERN_COLORS[concern] ?? "#7A8F6B" : "#7A8F6B";

  // ── Motor ──────────────────────────────────────────────────────────────────
  const routine = useMemo(() => {
    if (!concern || !ready || loading || products.length === 0) return null;
    // ── ECZ-4 DÖRTLÜ Step 1: bridge ──────────────────────────────────────
    // /profil-eslesme'de aynı concern + aynı profileSig için hesaplanmış
    // tiered varsa onu kullan (recompute yok). Miss/expire/sig-mismatch
    // ise mevcut path ile rankProductsForConcern çağrılır (geriye uyumlu).
    const profileSig = buildRecommendationProfileSig(preferences);
    const stored = getRecommendation(concern, profileSig);
    const tiered = stored
      ? stored.tiered
      : rankProductsForConcern(products, preferences, concern);
    return buildSmartRoutine(tiered, products, preferences, concern);
  }, [concern, ready, loading, products, preferences]);

  const isLoading = !ready || loading;

  return (
    <View style={[s.root, { backgroundColor: pal.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: pal.border }]}>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={pal.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[s.headerTitle, { color: pal.text }]}>Kişisel Rutin</Text>
          {concern && (
            <View style={s.headerConcernRow}>
              <Feather name={CONCERN_ICONS[concern] as any} size={11} color={accentColor} style={{ marginRight: 4 }} />
              <Text style={[s.headerSub, { color: accentColor }]}>
                {SKIN_CONCERN_LABELS[concern]}
              </Text>
            </View>
          )}
        </View>
        {routine && (
          <View style={[s.levelBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}>
            <Text style={[s.levelBadgeText, { color: accentColor }]}>{routine.levelLabel}</Text>
          </View>
        )}
      </View>

      {/* İçerik */}
      {isLoading ? (
        <View style={s.centerFill}>
          <ActivityIndicator color={pal.textMuted} />
          <Text style={[s.loadingText, { color: pal.textMuted }]}>Rutin oluşturuluyor…</Text>
        </View>
      ) : !routine ? (
        <View style={s.centerFill}>
          <Text style={[s.emptyText, { color: pal.textMuted }]}>Kaygı seçilmedi.</Text>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={[s.backLink, { borderColor: accentColor }]}>
            <Text style={[s.backLinkText, { color: accentColor }]}>Geri dön</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: scrollPaddingBottom() }]}
        >
          {/* Motivasyon banner */}
          <View style={[s.motivationCard, { backgroundColor: `${accentColor}10`, borderColor: `${accentColor}22` }]}>
            <View style={[s.motivIconBox, { backgroundColor: `${accentColor}20` }]}>
              <Feather name="heart" size={16} color={accentColor} />
            </View>
            <Text style={[s.motivText, { color: pal.text }]}>{routine.motivationMsg}</Text>
          </View>

          {/* Uyarı notları */}
          {routine.warningNotes.length > 0 && (
            <View style={s.warningsBlock}>
              {routine.warningNotes.map((n, i) => (
                <View key={i} style={[s.warnRow, { backgroundColor: "#FFF3CD", borderColor: "#F0C040" }]}>
                  <Feather name="alert-circle" size={13} color="#B07E00" style={{ marginTop: 1 }} />
                  <Text style={[s.warnText, { flex: 1 }]}>{n}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ☀️ Sabah */}
          <View style={[s.sectionBlock, { backgroundColor: pal.sectionBg, borderColor: `${AM_COLOR}20` }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: `${AM_COLOR}18` }]}>
                <Feather name="sun" size={15} color={AM_COLOR} />
              </View>
              <Text style={[s.sectionTitle, { color: pal.text }]}>Sabah Rutini</Text>
              <Text style={[s.sectionCount, { color: AM_COLOR }]}>{routine.morning.length} adım</Text>
            </View>
            {routine.morning.map((step, i) => (
              <View key={step.slot} style={i > 0 ? { marginTop: 10 } : {}}>
                <StepCard step={step} stepNumber={i + 1} accent={AM_COLOR} pal={pal} isDark={isDark} concern={concern} />
              </View>
            ))}
          </View>

          {/* 🌙 Akşam */}
          <View style={[s.sectionBlock, { backgroundColor: pal.sectionBg, borderColor: `${PM_COLOR}20` }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: `${PM_COLOR}18` }]}>
                <Feather name="moon" size={15} color={PM_COLOR} />
              </View>
              <Text style={[s.sectionTitle, { color: pal.text }]}>Akşam Rutini</Text>
              <Text style={[s.sectionCount, { color: PM_COLOR }]}>{routine.evening.length} adım</Text>
            </View>
            {routine.evening.map((step, i) => (
              <View key={`eve-${step.slot}`} style={i > 0 ? { marginTop: 10 } : {}}>
                <StepCard step={step} stepNumber={i + 1} accent={PM_COLOR} pal={pal} isDark={isDark} concern={concern} />
              </View>
            ))}
          </View>

          {/* Zaman çizelgesi */}
          <TimelineBanner routine={routine} accentColor={accentColor} pal={pal} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  headerConcernRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  headerSub:   { fontSize: 12, fontWeight: "600" },
  levelBadge:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  levelBadgeText: { fontSize: 11, fontWeight: "700" },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText:{ fontSize: 13, marginTop: 10 },
  emptyText:  { fontSize: 15 },
  backLink:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  backLinkText:{ fontSize: 14, fontWeight: "600" },

  // Motivasyon
  motivationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  motivIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 },
  motivText:    { fontSize: 13, lineHeight: 20, flex: 1 },

  // Uyarılar
  warningsBlock: { marginBottom: 14 },
  warnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  warnText: { fontSize: 12, color: "#7A5500", lineHeight: 17, marginLeft: 7 },

  // Bölüm
  sectionBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionIconBox:{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", flex: 1 },
  sectionCount:  { fontSize: 12, fontWeight: "600" },

  // Adım kartı
  stepCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  stepHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 6 },
  stepNumText: { fontSize: 11, fontWeight: "800" },
  stepIconBox: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 7 },
  stepLabel: { fontSize: 14, fontWeight: "700", flex: 1 },
  essentialBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  essentialText:  { fontSize: 9, fontWeight: "700" },

  // Ürün satırı
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  productImgWrap: { width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  productBrand:   { fontSize: 10, fontWeight: "500", marginBottom: 2 },
  productName:    { fontSize: 13, fontWeight: "700", lineHeight: 18 },

  noProductRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  noProductText: { fontSize: 12, lineHeight: 17, flex: 1 },

  // Alternatifler
  altLabel: { fontSize: 10, fontWeight: "600", marginBottom: 6, letterSpacing: 0.3 },
  altRow:   { flexDirection: "row" },
  altChip:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  altChipText: { fontSize: 11, fontWeight: "600" },

  // Why panel
  whyBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  whyBtnText: { fontSize: 12, fontWeight: "600" },
  whyBody: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  whyText:    { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  whyDivider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  howToLabel: { fontSize: 10, fontWeight: "700", marginBottom: 4, letterSpacing: 0.4 },
  howToText:  { fontSize: 12, lineHeight: 18 },
  cautionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginTop: 8,
  },
  cautionText:{ fontSize: 11, color: "#7A5500", lineHeight: 16, marginLeft: 6 },

  // Zaman çizelgesi
  timelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  timelineHeader:  { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  timelineIconBox: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 8 },
  timelineTitle:   { fontSize: 14, fontWeight: "700" },
  timelinePhases:  { marginBottom: 10 },
  phaseRow:        { flexDirection: "row", alignItems: "flex-start" },
  phaseDot:        { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  phaseRange:      { fontSize: 13, fontWeight: "700" },
  phaseLabel:      { fontSize: 12, marginTop: 1 },
  timelineNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  timelineNoteText: { fontSize: 12, lineHeight: 17, marginLeft: 6 },
});