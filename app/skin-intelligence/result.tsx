/**
 * Skin Intelligence — Result Screen
 * Skor + cilt tipi + bulgular (klinik kısa format) + hızlı yorum + aksiyonlar
 * Yüz işaretleri YOK. Uzun paragraflar YOK.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScoreRing } from "@/components/ScoreRing";
import { useColors } from "@/hooks/useColors";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";
import type { SkinSignal, SkinType } from "@/lib/skinIntelligence/types";

// ─── Veri etiketleri ─────────────────────────────────────────────────────────

const SKIN_TYPE_TR: Record<SkinType, string> = {
  yağlı:   "Yağlı Cilt",
  kuru:    "Kuru Cilt",
  karma:   "Karma Cilt",
  normal:  "Normal Cilt",
  hassas:  "Hassas Cilt",
};

const SEVERITY_DOT: Record<string, string> = {
  significant: "#EF4444",
  moderate:    "#F97316",
  mild:        "#EAB308",
};

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function FindingRow({ sig, colors }: { sig: SkinSignal; colors: any }) {
  const dotColor = SEVERITY_DOT[sig.severity] ?? "#EAB308";
  const label = sig.zone
    ? `${sig.zone} → ${sig.title}`
    : sig.title;

  return (
    <View style={fr.row}>
      <View style={[fr.dot, { backgroundColor: dotColor }]} />
      <Text style={[fr.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const fr = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 10 },
  dot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  label: { fontSize: 14, fontWeight: "500", flex: 1 },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const colors = useColors();

  const { analysis, isDeepEnhancing, routine } = useSkinIntelligence((s) => ({
    analysis: s.analysis,
    isDeepEnhancing: s.isDeepEnhancing,
    routine: s.routine,
  }));

  // Yükleniyor
  if (!analysis) {
    return (
      <View style={[s.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const topFindings = analysis.signals
    .filter((sig) => sig.confidence !== "low")
    .slice(0, 4);

  const handleRoutine = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/skin-intelligence/routine");
  };

  const handleProducts = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/skin-intelligence/products");
  };

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/skin-intelligence/capture");
  };

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: top + 12, paddingBottom: bottom + 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Derin analiz banner (sessiz) */}
        {isDeepEnhancing && (
          <View style={[s.enhanceBanner, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[s.enhanceText, { color: colors.primary }]}>
              Derin analiz devam ediyor...
            </Text>
          </View>
        )}

        {/* ── Skor kartı ──────────────────────────────────────────────── */}
        <View style={[s.scoreCard, { backgroundColor: colors.surfaceCard }]}>
          <ScoreRing score={analysis.skinScore} size={96} />
          <View style={s.scoreRight}>
            <Text style={[s.skinTypeLabel, { color: colors.text }]}>
              {SKIN_TYPE_TR[analysis.skinType] ?? analysis.skinType}
            </Text>
            {analysis.ageEstimate ? (
              <Text style={[s.metaMini, { color: colors.textMuted }]}>
                Tahmini yaş {analysis.ageEstimate}
              </Text>
            ) : null}
            {analysis.qualityWarning ? (
              <View style={[s.warnChip, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="alert-triangle" size={11} color="#D97706" />
                <Text style={[s.warnChipText, { color: "#D97706" }]}>{analysis.qualityWarning}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Bulgular ────────────────────────────────────────────────── */}
        {topFindings.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.surfaceCard }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Bulgular</Text>
            {topFindings.map((sig) => (
              <FindingRow key={sig.key} sig={sig} colors={colors} />
            ))}
          </View>
        )}

        {/* ── Hızlı yorum (maks 2 satır) ──────────────────────────────── */}
        {analysis.summary ? (
          <View style={[s.card, { backgroundColor: colors.surfaceCard }]}>
            <Text style={[s.summaryText, { color: colors.textSecondary }]} numberOfLines={3}>
              {analysis.summary}
            </Text>
          </View>
        ) : null}

        {/* ── Güçlü yönler (compact) ──────────────────────────────────── */}
        {analysis.strengths.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.surfaceCard }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Olumlu</Text>
            {analysis.strengths.map((st) => (
              <View key={st.key} style={fr.row}>
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={[fr.label, { color: colors.text }]}>{st.title}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Aksiyonlar ──────────────────────────────────────────────────── */}
      <View style={[s.actionBar, { paddingBottom: bottom + 12, backgroundColor: colors.background, borderColor: colors.borderLight }]}>
        {/* Üst satır */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={handleProducts}
            activeOpacity={0.8}
          >
            <Feather name="shopping-bag" size={15} color={colors.textSecondary} />
            <Text style={[s.actionBtnText, { color: colors.textSecondary }]}>Ürünleri İncele</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Feather name="refresh-ccw" size={15} color={colors.textSecondary} />
            <Text style={[s.actionBtnText, { color: colors.textSecondary }]}>Tekrar Analiz</Text>
          </TouchableOpacity>
        </View>

        {/* Ana CTA */}
        <TouchableOpacity
          style={[s.primaryCta, { backgroundColor: colors.primary }]}
          onPress={handleRoutine}
          activeOpacity={0.82}
        >
          <Feather name="layers" size={17} color="#fff" />
          <Text style={s.primaryCtaText}>
            {routine ? "Şahsi Rutini Gör" : "Şahsi Rutini Oluştur"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:        { flex: 1 },
  loading:        { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:         { paddingHorizontal: 16, gap: 12 },

  enhanceBanner:  { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 12, borderWidth: 1 },
  enhanceText:    { fontSize: 13, fontWeight: "500" },

  scoreCard:      { flexDirection: "row", alignItems: "center", gap: 18, borderRadius: 18, padding: 20 },
  scoreRight:     { flex: 1, gap: 6 },
  skinTypeLabel:  { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  metaMini:       { fontSize: 12 },
  warnChip:       { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  warnChipText:   { fontSize: 11, fontWeight: "500" },

  card:           { borderRadius: 18, padding: 16, gap: 12 },
  cardTitle:      { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 2 },
  summaryText:    { fontSize: 14.5, lineHeight: 22 },

  actionBar:      { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  actionRow:      { flexDirection: "row", gap: 10 },
  actionBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 13, borderWidth: 1 },
  actionBtnText:  { fontSize: 13, fontWeight: "600" },
  primaryCta:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 15, borderRadius: 15 },
  primaryCtaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});