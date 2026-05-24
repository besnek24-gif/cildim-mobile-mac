import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { levelToColor, type DermoScoreResult } from "@/lib/dermoScore";
import { consumeNavigationDermoResult } from "@/lib/productStore";

export default function DermoDetailScreen() {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const [dermoResult, setDermoResult] = useState<DermoScoreResult | null>(null);
  const [productName, setProductName] = useState<string | null>(null);

  useEffect(() => {
    const { result, productName: name } = consumeNavigationDermoResult();
    setDermoResult(result);
    setProductName(name);
  }, []);

  const RISK_ROWS = dermoResult
    ? [
        { label: "Faydalı İçerikler",    count: dermoResult.counts.beneficial,   color: "#7A8F6B" },
        { label: "Güvenli İçerikler",     count: dermoResult.counts.safe,         color: "#0891b2" },
        { label: "Hafif Riskli",           count: dermoResult.counts.mild,         color: "#d97706" },
        { label: "Orta Riskli",            count: dermoResult.counts.moderate,     color: "#c2410c" },
        { label: "Yüksek Dikkat",          count: dermoResult.counts.high_concern, color: "#dc2626" },
        { label: "Kaçınılması Gereken",    count: dermoResult.counts.avoid,        color: "#7f1d1d" },
      ].filter(r => r.count > 0)
    : [];

  const emoji = dermoResult
    ? dermoResult.total >= 75 ? "✅" : dermoResult.total >= 50 ? "⚠️" : "⛔"
    : "🔍";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Dermatolojik Güvenlik Puanı
          </Text>
          {productName ? (
            <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>
              {productName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {dermoResult ? (
          <>
            {/* Skor kartı */}
            <View
              style={[
                styles.scoreCard,
                {
                  backgroundColor: `${dermoResult.color}10`,
                  borderColor: `${dermoResult.color}35`,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <Text style={[styles.scoreNum, { color: dermoResult.color }]}>
                    {dermoResult.total}
                  </Text>
                  <Text style={[styles.scoreMax, { color: dermoResult.color }]}>/100</Text>
                </View>
                <Text style={[styles.scoreLabel, { color: dermoResult.color }]}>
                  {dermoResult.label}
                </Text>
                {dermoResult.analyzed > 0 && (
                  <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
                    {dermoResult.analyzed} içerik analiz edildi
                  </Text>
                )}
              </View>
              <Text style={styles.scoreEmoji}>{emoji}</Text>
            </View>

            {/* Progress bar */}
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: `${dermoResult.color}20` },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: dermoResult.color,
                    width: `${dermoResult.total}%` as any,
                  },
                ]}
              />
            </View>

            {/* Kaynak badge'leri */}
            <View style={styles.sourceBadgeRow}>
              {["EWG", "CIR", "INCI"].map(src => (
                <View
                  key={src}
                  style={[styles.sourceBadge, { backgroundColor: isDark ? "#1C2A3A" : "#EFF6FF", borderColor: isDark ? "#2563EB40" : "#BFDBFE" }]}
                >
                  <Text style={[styles.sourceBadgeText, { color: isDark ? "#60A5FA" : "#1D4ED8" }]}>{src}</Text>
                </View>
              ))}
              <Text style={[styles.sourceNote, { color: colors.textMuted }]}>veri kaynakları</Text>
            </View>

            {/* Risk Dağılımı */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RİSK DAĞILIMI</Text>
            <View style={[styles.riskTable, { borderColor: colors.border, backgroundColor: colors.surfaceCard }]}>
              {RISK_ROWS.map((r, i) => (
                <View
                  key={r.label}
                  style={[
                    styles.riskRow,
                    {
                      borderBottomWidth: i < RISK_ROWS.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.riskDot, { backgroundColor: r.color }]} />
                  <Text style={[styles.riskLabel, { color: colors.text }]}>{r.label}</Text>
                  <View style={[styles.riskBadge, { backgroundColor: `${r.color}18` }]}>
                    <Text style={[styles.riskCount, { color: r.color }]}>{r.count}</Text>
                  </View>
                </View>
              ))}
              {RISK_ROWS.length === 0 && (
                <View style={styles.riskRow}>
                  <Text style={[styles.riskLabel, { color: colors.textMuted }]}>
                    Risk dağılımı hesaplanamadı
                  </Text>
                </View>
              )}
            </View>

            {/* Dikkat Gerektiren İçerikler */}
            {dermoResult.concerns.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  DİKKAT EDİLMESİ GEREKENLER
                </Text>
                <View style={{ gap: 8 }}>
                  {dermoResult.concerns.slice(0, 8).map(({ name, entry }) => {
                    const clr = levelToColor(entry.level);
                    return (
                      <View
                        key={name}
                        style={[
                          styles.concernRow,
                          {
                            borderLeftColor: clr,
                            backgroundColor: isDark ? colors.surfaceCard : "#FAFAFA",
                            borderColor: `${clr}22`,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <View style={[styles.concernDot, { backgroundColor: clr }]} />
                          <Text style={[styles.concernName, { color: clr }]}>{name}</Text>
                        </View>
                        <Text style={[styles.concernDesc, { color: colors.textSecondary }]}>
                          {entry.tr}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              İçerik Analizi Bulunamadı
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Bu ürün için dermatolojik güvenlik analizi verisi mevcut değil.
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <View style={[styles.disclaimer, { backgroundColor: isDark ? "#1C1C1E" : "#F5F5F5" }]}>
          <Text style={styles.disclaimerIcon}>ℹ️</Text>
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            Bu puan tıbbi tanı değil, içerik güvenliği hakkında bilgilendirme amaçlıdır. EWG (Environmental Working Group) ve CIR (Cosmetic Ingredient Review) verilerine dayanır.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800" as const },
  headerSub: { fontSize: 12, marginTop: 1 },
  content: { padding: 20, gap: 0 },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 14,
  },
  scoreNum: { fontSize: 48, fontWeight: "900" as const, lineHeight: 52 },
  scoreMax: { fontSize: 16, fontWeight: "600" as const, marginBottom: 4 },
  scoreLabel: { fontSize: 18, fontWeight: "700" as const },
  scoreSub: { fontSize: 12, marginTop: 4 },
  scoreEmoji: { fontSize: 36, marginLeft: 8 },
  progressTrack: { height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 14 },
  progressFill: { height: 10, borderRadius: 5 },
  sourceBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  sourceBadgeText: { fontSize: 11, fontWeight: "700" as const },
  sourceNote: { fontSize: 11, marginLeft: 2 },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  riskTable: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 24 },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  riskLabel: { flex: 1, fontSize: 14 },
  riskBadge: { minWidth: 32, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  riskCount: { fontSize: 14, fontWeight: "800" as const },
  concernRow: { borderLeftWidth: 3, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 0 },
  concernDot: { width: 8, height: 8, borderRadius: 4 },
  concernName: { flex: 1, fontSize: 13, fontWeight: "700" as const },
  concernDesc: { fontSize: 12, lineHeight: 18, paddingLeft: 16 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22, paddingHorizontal: 24 },
  disclaimer: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, marginTop: 24 },
  disclaimerIcon: { fontSize: 14 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
});