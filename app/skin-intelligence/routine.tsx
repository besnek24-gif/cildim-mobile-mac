/**
 * Skin Intelligence — Şahsi Rutin Screen
 * Layer 4: Analizden otomatik üretilen sabah/akşam rutini.
 * Maks 3-5 adım. Gereksiz aktifler yok. "Şahsi" kullanılır, "Şahsi" değil.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";
import type { RoutineStep } from "@/lib/skinIntelligence/types";

type Tab = "morning" | "evening";

const TAB_LABEL: Record<Tab, string> = { morning: "Sabah", evening: "Akşam" };

const ROLE_COLOR = { core: "#7A8F6B", active: "#2563EB", support: "#9CA3AF" } as const;
const ROLE_LABEL = { core: "Esas", active: "Aktif", support: "Destek" } as const;

// ─── Adım kartı ──────────────────────────────────────────────────────────────

function StepCard({ step, index, colors }: { step: RoutineStep; index: number; colors: any }) {
  const roleColor = ROLE_COLOR[step.role] ?? "#9CA3AF";
  return (
    <View style={[sc.card, { backgroundColor: colors.surfaceCard }]}>
      <View style={[sc.num, { backgroundColor: `${colors.primary}14` }]}>
        <Text style={[sc.numText, { color: colors.primary }]}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={sc.titleRow}>
          <Text style={[sc.label, { color: colors.text }]} numberOfLines={1}>{step.label}</Text>
          <View style={[sc.badge, { backgroundColor: `${roleColor}14` }]}>
            <Text style={[sc.badgeText, { color: roleColor }]}>{ROLE_LABEL[step.role] ?? step.role}</Text>
          </View>
        </View>
        <Text style={[sc.productType, { color: colors.textSecondary }]}>{step.productType}</Text>
        {step.why ? (
          <Text style={[sc.why, { color: colors.textMuted }]} numberOfLines={2}>{step.why}</Text>
        ) : null}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card:        { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 15, padding: 14 },
  num:         { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  numText:     { fontSize: 14, fontWeight: "700" },
  titleRow:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label:       { fontSize: 14.5, fontWeight: "700", flex: 1 },
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  badgeText:   { fontSize: 11, fontWeight: "600" },
  productType: { fontSize: 12.5, marginTop: 2 },
  why:         { fontSize: 12.5, marginTop: 5, lineHeight: 18 },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function RoutineScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("morning");

  const { routine, analysis } = useSkinIntelligence((s) => ({
    routine: s.routine,
    analysis: s.analysis,
  }));

  const steps = tab === "morning"
    ? (routine?.morningSteps ?? [])
    : (routine?.eveningSteps ?? []);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: Rutinim sekmesiyle entegrasyon (routineStore bağlantısı)
    router.push("/(tabs)/rutin" as any);
  };

  // ── Rutin yok ─────────────────────────────────────────────────────────────
  if (!routine) {
    return (
      <View style={[s.emptyWrapper, { backgroundColor: colors.background, paddingTop: top }]}>
        <View style={[s.topBar]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={s.emptyCenter}>
          <Feather name="clock" size={36} color={colors.textMuted} />
          <Text style={[s.emptyTitle, { color: colors.text }]}>Rutin hazırlanıyor</Text>
          <Text style={[s.emptyBody, { color: colors.textMuted }]}>
            Derin analiz tamamlandığında şahsi rutinin otomatik oluşturulacak.
          </Text>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: colors.surfaceCard }]}
            onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          >
            <Text style={[s.backBtnText, { color: colors.text }]}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      {/* Başlık */}
      <View style={[s.topBar, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>Şahsi Rutin</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Sabah / Akşam tab */}
      <View style={[s.tabRow, { backgroundColor: colors.surfaceCard }]}>
        {(["morning", "evening"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, t === tab && { backgroundColor: colors.primary }]}
            onPress={() => {
              setTab(t);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.82}
          >
            <Feather
              name={t === "morning" ? "sun" : "moon"}
              size={14}
              color={t === tab ? "#fff" : colors.textMuted}
            />
            <Text style={[s.tabText, { color: t === tab ? "#fff" : colors.textMuted }]}>
              {TAB_LABEL[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Adım listesi */}
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {steps.length === 0 ? (
          <Text style={[s.emptyBody, { color: colors.textMuted, textAlign: "center", marginTop: 40 }]}>
            Bu periyot için adım bulunamadı.
          </Text>
        ) : (
          steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} colors={colors} />
          ))
        )}
      </ScrollView>

      {/* Alt CTA'lar */}
      <View style={[s.bottomBar, { paddingBottom: bottom + 12, backgroundColor: colors.background, borderColor: colors.borderLight }]}>
        <View style={s.bottomRow}>
          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => router.push("/skin-intelligence/products")}
            activeOpacity={0.8}
          >
            <Feather name="shopping-bag" size={15} color={colors.textSecondary} />
            <Text style={[s.secondaryBtnText, { color: colors.textSecondary }]}>Ürünleri Gör</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.82}
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={s.saveBtnText}>Rutini Kaydet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:       { flex: 1 },
  emptyWrapper:  { flex: 1 },
  emptyCenter:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  emptyTitle:    { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyBody:     { fontSize: 14, lineHeight: 21 },
  backBtn:       { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnText:   { fontSize: 14, fontWeight: "600" },

  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  title:         { fontSize: 18, fontWeight: "800" },
  tabRow:        { flexDirection: "row", marginHorizontal: 16, borderRadius: 13, padding: 4, marginBottom: 4 },
  tab:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabText:       { fontSize: 14, fontWeight: "600" },
  scroll:        { paddingHorizontal: 16, paddingTop: 6, gap: 10 },

  bottomBar:     { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  bottomRow:     { flexDirection: "row", gap: 10 },
  secondaryBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 13, borderWidth: 1 },
  secondaryBtnText: { fontSize: 13, fontWeight: "600" },
  saveBtn:       { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 13 },
  saveBtnText:   { color: "#fff", fontWeight: "700", fontSize: 15 },
});