/**
 * rutin/index.tsx — Tek kaynak rutin sayfası
 *
 * Kaynak önceliği: v2 aktif rutin → manuel rutin → boş durum
 * useActiveRoutine hook'u her iki kaynağı aynı arayüzde birleştirir.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { PC } from "@/local_demo_data/safe_runtime_shims_v74";
import { useActiveRoutine } from "@/hooks/useActiveRoutine";
import {
  addStep,
  clearAllSteps,
  getManualRoutine,
  type ManualStep,
  type RoutineSlot,
  type StepCategory,
} from "@/lib/routineStore";
import {
  consumeRoutineAddIntent,
  setRoutineAddIntent,
  clearRoutineAddIntent,
} from "@/lib/routineAddIntentStore";
import { classifyBucket, type ProductBucket } from "@/lib/concernFlows";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import {
  routineProgramStore,
  type SavedRoutine,
} from "@/lib/premium-skin-scan-v2/routineProgramStore";
// ECZ-FINAL-QA-FIX-1 (PART C): Geçmiş Rutinler kartına dokunulduğunda kaydedilmiş
// rutini görüntülemek için resultStore'a synthesized AnalysisResult ve permissive
// bundle yazıp routine-program ekranına yönlendiriyoruz.
import { resultStore } from "@/local_demo_data/safe_runtime_shims_v74";
import type { AnalysisResult } from "@/local_demo_data/safe_runtime_shims_v74";
import type { SkinScanContextBundle } from "@/lib/skinAnalysis/contextBundle";
// ECZ4 Step 6 · Bakım profili farkındalığı (read-only helpers)
import {
  getAvailableProfileDomains,
  getLatestRoutineProfileByDomain,
  removeSavedRoutineProfile,
} from "@/lib/concernRoutineBridgeStore";
import type { CareDomain, RoutineProfile } from "@/lib/concernRoutineBridge";
// ECZ4 Step 9 · Seçkin-only otomatik rutin CTA'sı için RBAC + auth bağlamı.
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { canUseAutoRoutine, getMaxRoutineCount } from "@/lib/accessControl";
import { isRegistered as isRegisteredUser } from "@/lib/rbac";
// ECZ4 Step 3 — Multi-routine kart bölümü için koleksiyon truth katmanı.
import {
  hydrateRoutineCollection,
  getAllRoutines,
  getPrimaryRoutine,
  setPrimaryRoutine,
  deleteRoutine,
  renameRoutine,
  ROUTINE_TITLE_MAX_LEN,
  type RoutineRecord,
  type RoutineDomain as CollectionRoutineDomain,
  type RoutineSource as CollectionRoutineSource,
} from "@/lib/routineCollection";

// ECZ4 Step 3 — Etiket sözlükleri (UI-only, tek render-time map).
const ROUTINE_SOURCE_LABEL: Record<CollectionRoutineSource, string> = {
  manual:        "Manuel",
  anket:         "Cilt Anketi",
  cilt_analizi:  "Cilt Bakım Profili",
  akilli_secim:  "Akıllı Seçim",
  rehber:        "Rehber",
  danisma:       "DermaAsistan",
};
const ROUTINE_DOMAIN_LABEL: Record<CollectionRoutineDomain, string> = {
  skin:  "Cilt",
  hair:  "Saç",
  sun:   "Güneş",
  body:  "Vücut",
  oral:  "Ağız & Diş",
  mixed: "Karma",
};

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const COPPER = PC.accent;
const GREEN  = "#7A8F6B";
const PURPLE = "#7C3AED";
const AMBER  = "#D97706";
const TEAL   = "#0891B2";
const MAX_VISIBLE_STEPS = 5;

// ─── Motivasyonel mesajlar (eczacı tonu) ──────────────────────────────────────

const MOTIVATIONAL = {
  high: [
    "Bugün iyi gidiyorsun, düzen korunuyor.",
    "Bu tempo cilt bariyerine iyi gelir.",
    "Son günlerde istikrar artmış görünüyor.",
    "Küçük devamlılık, büyük fark doğurur.",
    "Tutarlı bakım zamanla meyvesini verir.",
  ],
  mid: [
    "Akşam adımlarında küçük bir aksama var, toparlanabilir.",
    "Yarın sabah rutinine biraz daha dikkat et.",
    "Ara sıra atlanan adımlar normal — önemli olan devam etmek.",
    "Hafta ortasında biraz yavaşladın, bu haftalık seriyi koru.",
  ],
  low: [
    "Birkaç gün ara verildi. Küçük adımlarla yeniden başlamak işe yarar.",
    "Rutin, mükemmel olmak zorunda değil — bir adım bile fark yaratır.",
    "Bugün tek bir adım tamamlasan yeterli. Nereden başlayacağını seçersen yardımcı olurum.",
  ],
};

function getMotivationalMessage(progress: number, streak: number): string {
  const pool =
    progress >= 75 || streak >= 3
      ? MOTIVATIONAL.high
      : progress >= 40 || streak >= 1
      ? MOTIVATIONAL.mid
      : MOTIVATIONAL.low;
  const seed = new Date().getDate() % pool.length;
  return pool[seed];
}

// ─── Animasyonlu checkbox ──────────────────────────────────────────────────────

function CheckItem({
  step, isDone, onToggle, isDark, colors,
}: {
  step: ManualStep; isDone: boolean; onToggle: () => void;
  isDark: boolean; colors: ReturnType<typeof useColors>;
}) {
  const scale     = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(isDone ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: isDone ? 1 : 0,
      useNativeDriver: true, damping: 18, stiffness: 300,
    }).start();
  }, [isDone]);

  const handlePress = () => {
    Haptics.impactAsync(isDone ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.90, useNativeDriver: true, damping: 20, stiffness: 400 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 16, stiffness: 350 }),
    ]).start();
    onToggle();
  };

  const checkScale   = checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const checkOpacity = checkAnim;

  const bgColor = isDone
    ? (isDark ? `${GREEN}22` : `${GREEN}0F`)
    : (isDark ? "rgba(255,255,255,0.03)" : "#FAFAF8");
  const bdColor = isDone
    ? (isDark ? `${GREEN}50` : `${GREEN}35`)
    : (isDark ? "rgba(255,255,255,0.1)" : "#E2D9CC");

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Animated.View style={[ci.row, { backgroundColor: bgColor, borderColor: bdColor, transform: [{ scale }] }]}>
        <View style={[ci.box, {
          backgroundColor: isDone ? GREEN : "transparent",
          borderColor: isDone ? GREEN : (isDark ? "rgba(255,255,255,0.2)" : "#C4B9AA"),
        }]}>
          <Animated.View style={{ transform: [{ scale: checkScale }], opacity: checkOpacity }}>
            <Feather name="check" size={12} color="#fff" />
          </Animated.View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ci.label, {
            color: isDone ? colors.textMuted : colors.text,
            textDecorationLine: isDone ? "line-through" : "none",
          }]} numberOfLines={1}>{step.label}</Text>
          {step.productName && !isDone && (
            <Text style={[ci.sub, { color: colors.textMuted }]} numberOfLines={1}>
              {step.productName}
            </Text>
          )}
        </View>
        {isDone && (
          <Animated.View style={{ opacity: checkOpacity }}>
            <Text style={[ci.doneLabel, { color: `${GREEN}99` }]}>Tamam</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const ci = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13,
  },
  box: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  label:     { fontSize: 14, fontWeight: "600" },
  sub:       { fontSize: 11, marginTop: 2 },
  doneLabel: { fontSize: 11, fontWeight: "600" },
});

// ─── Slot bölümü ──────────────────────────────────────────────────────────────

function SlotSection({
  title, icon, accentColor, steps, completedIds, onToggle, onMarkAll, isDark, colors, hasV2,
}: {
  title: string; icon: string; accentColor: string;
  steps: ManualStep[]; completedIds: string[];
  onToggle: (id: string, isDone: boolean) => void;
  onMarkAll: () => void;
  isDark: boolean; colors: ReturnType<typeof useColors>;
  hasV2: boolean;
}) {
  const visible = steps.slice(0, MAX_VISIBLE_STEPS);
  const allDone = visible.length > 0 && visible.every(s => completedIds.includes(s.id));
  if (steps.length === 0) return null;

  return (
    <View style={sl.wrap}>
      <View style={sl.header}>
        <View style={[sl.iconBox, { backgroundColor: `${accentColor}18` }]}>
          <Feather name={icon as any} size={14} color={accentColor} />
        </View>
        <Text style={[sl.title, { color: accentColor }]}>{title}</Text>
        {!allDone && (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMarkAll(); }}
            style={[sl.allBtn, { borderColor: `${accentColor}35` }]}
            activeOpacity={0.75}
          >
            <Text style={[sl.allBtnText, { color: accentColor }]}>Tümü tamam</Text>
          </TouchableOpacity>
        )}
        {allDone && (
          <View style={[sl.allDone, { backgroundColor: `${accentColor}12` }]}>
            <Feather name="check-circle" size={13} color={accentColor} />
            <Text style={[sl.allDoneText, { color: accentColor }]}>Tamamlandı</Text>
          </View>
        )}
      </View>
      <View style={{ gap: 7 }}>
        {visible.map(step => (
          <CheckItem
            key={step.id} step={step}
            isDone={completedIds.includes(step.id)}
            onToggle={() => onToggle(step.id, completedIds.includes(step.id))}
            isDark={isDark} colors={colors}
          />
        ))}
        {steps.length > MAX_VISIBLE_STEPS && (
          <TouchableOpacity
            onPress={() => router.push((hasV2
              ? "/premium-skin-scan-v2/routine-program"
              : "/rutin/duzenle") as any)}
            style={[sl.moreBtn, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "#E2D9CC" }]}
          >
            <Text style={[sl.moreBtnText, { color: colors.textMuted }]}>
              {hasV2
                ? `+${steps.length - MAX_VISIBLE_STEPS} adım daha · Programı gör`
                : `+${steps.length - MAX_VISIBLE_STEPS} adım daha · Düzenle`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  wrap:       { gap: 10 },
  header:     { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox:    { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  title:      { flex: 1, fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  allBtn:     {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
  },
  allBtnText: { fontSize: 11, fontWeight: "700" },
  allDone:    { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  allDoneText:{ fontSize: 11, fontWeight: "700" },
  moreBtn:    { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  moreBtnText:{ fontSize: 12, fontWeight: "500" },
});

// ─── Haftalık / Aylık adım listesi (sadece ön izleme) ────────────────────────

function ExtraSlotCard({
  title, icon, color, steps, isDark, colors, borderColor, sectionBg,
}: {
  title: string; icon: string; color: string;
  steps: ManualStep[];
  isDark: boolean; colors: ReturnType<typeof useColors>;
  borderColor: string; sectionBg: string;
}) {
  if (steps.length === 0) return null;

  return (
    <View style={[r.section, { backgroundColor: sectionBg, borderColor }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <View style={[sl.iconBox, { backgroundColor: `${color}18` }]}>
          <Feather name={icon as any} size={14} color={color} />
        </View>
        <Text style={[sl.title, { color }]}>{title}</Text>
        <TouchableOpacity
          onPress={() => router.push("/rutin/duzenle" as any)}
          style={[sl.allBtn, { borderColor: `${color}35` }]}
          activeOpacity={0.75}
        >
          <Text style={[sl.allBtnText, { color }]}>Düzenle</Text>
        </TouchableOpacity>
      </View>
      {steps.slice(0, 4).map((step, idx) => (
        <View
          key={step.id}
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            paddingVertical: 8,
            borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
            borderColor,
          }}
        >
          <View style={[{ width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" }, { backgroundColor: `${color}15` }]}>
            <Text style={{ fontSize: 10, fontWeight: "800", color }}>{idx + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }} numberOfLines={1}>{step.label}</Text>
            {step.productName && (
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>{step.productName}</Text>
            )}
          </View>
        </View>
      ))}
      {steps.length > 4 && (
        <TouchableOpacity onPress={() => router.push("/rutin/duzenle" as any)}>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: 6 }}>
            +{steps.length - 4} adım daha
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Motivasyonel kart ────────────────────────────────────────────────────────

function MotivationCard({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <View style={[mv.wrap, {
      backgroundColor: isDark ? "rgba(122,143,107,0.07)" : "#F5F8F1",
      borderColor: isDark ? "rgba(122,143,107,0.2)" : "rgba(122,143,107,0.25)",
    }]}>
      <View style={[mv.dot, { backgroundColor: `${GREEN}50` }]} />
      <Text style={[mv.text, { color: isDark ? "#A8C49B" : "#4A6741" }]}>{message}</Text>
    </View>
  );
}

const mv = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 13,
  },
  dot:  { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  text: { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 19, fontStyle: "italic" },
});

// ─── Tamamlanma ekranı ────────────────────────────────────────────────────────

function AllDoneView({ streak, isDark, colors }: { streak: number; isDark: boolean; colors: ReturnType<typeof useColors> }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={ad.wrap}>
      <Animated.View style={[ad.iconRing, {
        backgroundColor: isDark ? `${GREEN}22` : `${GREEN}12`,
        borderColor:     isDark ? `${GREEN}50` : `${GREEN}35`,
        transform: [{ scale: pulse }],
      }]}>
        <Text style={ad.emoji}>✓</Text>
      </Animated.View>
      <Text style={[ad.main, { color: colors.text }]}>Bugün tamam.</Text>
      <Text style={[ad.sub,  { color: colors.textSecondary }]}>Devam ediyorsun.</Text>
      {streak >= 2 && (
        <View style={[ad.streakPill, {
          backgroundColor: isDark ? "rgba(217,119,6,0.12)" : "#FFFBEB",
          borderColor: "rgba(217,119,6,0.3)",
        }]}>
          <Text style={ad.streakFire}>🔥</Text>
          <Text style={[ad.streakText, { color: "#D97706" }]}>{streak} günlük seri</Text>
        </View>
      )}
    </View>
  );
}

const ad = StyleSheet.create({
  wrap:       { alignItems: "center", gap: 12, paddingVertical: 40 },
  iconRing:   { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  emoji:      { fontSize: 32, color: GREEN, fontWeight: "800" },
  main:       { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  sub:        { fontSize: 15, fontWeight: "500", textAlign: "center" },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4 },
  streakFire: { fontSize: 14 },
  streakText: { fontSize: 13, fontWeight: "700" },
});

// ─── Boş rutin durumu ─────────────────────────────────────────────────────────

function EmptyState({ colors, isDark, canUseAuto, isGuest }: { colors: ReturnType<typeof useColors>; isDark: boolean; canUseAuto: boolean; isGuest: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 14, paddingVertical: 52 }}>
      <View style={[{
        width: 68, height: 68, borderRadius: 34,
        borderWidth: 1.5, borderStyle: "dashed",
        alignItems: "center", justifyContent: "center",
      }, { borderColor: isDark ? "rgba(255,255,255,0.15)" : "#D1C9BC" }]}>
        <Feather name="activity" size={28} color={colors.textMuted} />
      </View>
      <Text style={[{ fontSize: 17, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 }, { color: colors.text }]}>
        Henüz şahsi rutin oluşturulmadı
      </Text>
      <Text style={[{ fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 260 }, { color: colors.textSecondary }]}>
        Cilt bakım profilinden şahsileştirilmiş bir rutin oluşturabilir ya da kendi rutinini kendin oluşturabilirsin.
      </Text>
      {/* ECZ4 Step A — Birincil: Cilt Analizi ile Oluştur.
          ECZ4 Step G — Free için Seçkin-only kilit. canUseAuto truth kaynağıdır
          (accessControl.canUseAutoRoutine → isSeckin). Free kullanıcı tıklarsa
          paywall route'u yerine güvenli bir Alert açılır (yeni route wiring
          yok); Seçkin için davranış değişmedi. */}
      <TouchableOpacity
        onPress={() => {
          if (canUseAuto) {
            router.push("/premium-skin-scan-v2" as any);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
              "Seçkin Üyelik Gerekiyor",
              "Bakım profili ile otomatik rutin oluşturma Seçkin üyelik ile açılır. Anketi veya manuel oluşturmayı kullanabilirsin.",
            );
          }
        }}
        style={[{
          flexDirection: "row", alignItems: "center", gap: 8,
          borderRadius: 16, paddingHorizontal: 22, paddingVertical: 13, marginTop: 4,
        }, { backgroundColor: canUseAuto ? GREEN : (isDark ? "rgba(255,255,255,0.08)" : "#E8E2D6") }]}
        activeOpacity={0.85}
      >
        <Feather name={canUseAuto ? "camera" : "lock"} size={16} color={canUseAuto ? "#fff" : (isDark ? "#A0835A" : "#92400E")} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: canUseAuto ? "#fff" : (isDark ? "#D4A56A" : "#92400E") }}>Bakım Profili ile Oluştur</Text>
      </TouchableOpacity>
      {!canUseAuto && (
        <Text style={[{ fontSize: 11.5, fontWeight: "600", marginTop: -6, letterSpacing: 0.2 }, { color: isDark ? "#A0835A" : "#B45309" }]}>
          Seçkin üyelik ile açılır
        </Text>
      )}
      {/* ECZ4 Step A — İkincil: Cilt Anketi ile Oluştur (yeni CTA, mevcut /questionnaire route'u; anket→rutin bağlantısı bu adımda yapılmaz, Step B).
          ECZ4 GLOBAL — Misafir kullanıcı kişisel rutin oluşturamaz; /giris'e yönlendirilir. */}
      <TouchableOpacity
        onPress={() => router.push((isGuest ? "/giris" : "/questionnaire?from=rutin") as any)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11,
          borderWidth: 1.5,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D8D3CC",
        }}
        activeOpacity={0.75}
      >
        <Feather name="list" size={15} color={colors.textSecondary} />
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.textSecondary }}>
          Cilt Anketi ile Oluştur
        </Text>
      </TouchableOpacity>
      {/* ECZ4 Step A — Üçüncül: Manuel Rutin Oluştur (label-only rename)
          ECZ4 GLOBAL — Misafir için /giris yönlendirmesi; manuel rutin
          kişisel veri kaydeder, kayıtlı kullanıcı gerekir. */}
      <TouchableOpacity
        onPress={() => router.push((isGuest ? "/giris" : "/rutin/duzenle?mode=create") as any)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11,
          borderWidth: 1.5,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D8D3CC",
        }}
        activeOpacity={0.75}
      >
        <Feather name="plus" size={15} color={colors.textSecondary} />
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.textSecondary }}>
          Manuel Rutin Oluştur
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ECZ4 Step 6 · Bakım Profili Farkındalığı (passive awareness UI) ─────────
//
// Bu bölüm SALT GÖRSEL — kullanıcının concern flow'larından (Rehber, Akıllı
// Seçim, Cilt Analizi) elde edilmiş bakım profillerinin farkındalığını verir.
// · onPress YOK · navigation YOK · filter YOK · routineStore mutasyonu YOK
// · paywall YOK. Sadece pasif chip'ler.
//
// Sıra: skin → hair → sun → body → oral (getAvailableProfileDomains zaten
// stabil sıraya göre döner, burada tekrar sıralama yapılmaz).

const DOMAIN_LABEL: Record<CareDomain, string> = {
  skin: "Cilt profilim",
  hair: "Saç profilim",
  sun:  "Güneş profilim",
  body: "Vücut profilim",
  oral: "Ağız & diş profilim",
};

const DOMAIN_ICON: Record<CareDomain, string> = {
  skin: "droplet",
  hair: "scissors",
  sun:  "sun",
  body: "user",
  oral: "smile",
};

// İkincil metin: profilin concern'ünü kısa bir Türkçe etiketle göster.
// Bilinmeyen / desteklenmeyen concern → ikincil metin gösterilmez.
const CONCERN_LABEL: Partial<Record<RoutineProfile["concern"], string>> = {
  acne:           "Akne odaklı",
  sensitivity:    "Hassasiyet odaklı",
  dark_spots:     "Leke odaklı",
  dryness:        "Kuruluk odaklı",
  sun:            "Güneş bakımı",
  hair_loss:      "Saç dökülmesi",
  // ECZ4 Step 13 — Body/Oral concern label'ları (Step 12 type foundation
  // sonrası anlamlı concern değerleri; suppression artık bu değerler için
  // çalışmaz, kullanıcı gerçek bilgiyi görür).
  body_care:      "Vücut bakımı",
  body_firming:   "Sıkılaştırma",
  body_cellulite: "Selülit desteği",
  oral_daily:     "Günlük ağız bakımı",
  oral_whitening: "Beyazlatma",
  oral_gum:       "Diş eti bakımı",
};

// ECZ4 Step 13 — Body/Oral concern union üyeleri. Yeni Akıllı Seçim
// kayıtlarında suppression devre dışı bırakılır; eski kayıtlar (concern
// "dryness" gibi legacy fallback) hala suppress edilip routineGoal'e düşer.
const BODY_ORAL_CONCERNS: ReadonlySet<RoutineProfile["concern"]> = new Set<RoutineProfile["concern"]>([
  "body_care", "body_firming", "body_cellulite",
  "oral_daily", "oral_whitening", "oral_gum",
]);

// ─── ECZ4 Step 7d · Profil kaynağı etiketi (additive) ────────────────────────
// Bakım profilinin nereden geldiğini gösteren kısa Türkçe ek metin. Mevcut
// concern etiketinin önüne " · " ile birleştirilir. Eksik source ya da
// bilinmeyen değer → kaynak etiketi gösterilmez (concern fallback'i çalışır).
const SOURCE_LABEL: Partial<Record<NonNullable<RoutineProfile["source"]>, string>> = {
  rehber:        "Rehber’den",
  akilli_secim:  "Akıllı Seçim’den",
  cilt_analizi:  "Bakım Profili’nden",
  manual:        "Manuel",
};

interface ProfileAwarenessItem {
  domain:    CareDomain;
  label:     string;
  icon:      string;
  secondary: string | null;
  // ECZ4 Step 9 — Otomatik rutin CTA'sı için flowId. Yoksa CTA gösterilmez.
  flowId:    string | null;
  // ECZ4 Step 13.1 — body/oral domain'lerinde CTA güvenliği. Step 12 öncesi
  // persist edilmiş kayıtlar concern: "dryness" gibi legacy fallback taşır;
  // generator bunları gördüğünde cilt rutini üretir. Bu flag legacy kayıtlar
  // için false döner ve CTA gizlenir. skin/hair/sun chip'lerinde her zaman
  // true (mevcut Step 9 davranışını korur).
  autoSafe:  boolean;
}

// ECZ4 Step 13 — Otomatik rutin CTA'sı şu domain'lerde aktif. Step 12'de
// concern union'a body/oral değerleri eklendi, Step 13'te free generator ve
// premium safe path body/oral için domain-uygun çıktı üretir hale geldi;
// dolayısıyla CTA'yı bu iki domain için de güvenle açıyoruz.
const AUTO_ROUTINE_SAFE_DOMAINS: ReadonlySet<CareDomain> = new Set<CareDomain>([
  "skin",
  "hair",
  "sun",
  "body",
  "oral",
]);

function ProfileAwarenessSection({
  items, isDark, colors, sectionBg, borderColor, canCreateAutoRoutine,
  onRequestDelete,
}: {
  items: ReadonlyArray<ProfileAwarenessItem>;
  isDark: boolean;
  colors: ReturnType<typeof useColors>;
  sectionBg: string;
  borderColor: string;
  // ECZ4 Step 9 — true ise eligible chip'lerde "Akıllı rutin oluştur" CTA'sı
  // render olur. false (free / guest) ise hiçbir CTA gösterilmez.
  canCreateAutoRoutine: boolean;
  // Chip üzerindeki X butonu için silme callback'i. flowId taşır;
  // ana ekranın openDeleteConfirm("profile:<flowId>") akışını tetikler.
  onRequestDelete: (flowId: string, label: string) => void;
}) {
  if (items.length === 0) return null;

  const chipBg     = isDark ? "rgba(255,255,255,0.04)" : "#FAF7F2";
  const chipBorder = isDark ? "rgba(255,255,255,0.08)" : "#EDE6DA";
  const accent     = isDark ? `${COPPER}CC` : COPPER;

  return (
    <View style={[r.section, { backgroundColor: sectionBg, borderColor }]}>
      <View style={pa.header}>
        <View style={[pa.headerIcon, { backgroundColor: `${COPPER}14` }]}>
          <Feather name="user-check" size={13} color={accent} />
        </View>
        <Text style={[pa.headerTitle, { color: colors.text }]}>
          Bakım Profillerim
        </Text>
      </View>

      <View style={pa.chipRow}>
        {items.map((it) => {
          // ECZ4 Step 9 + Step 13.1 — Eligibility dört koşulla AND'lenir:
          //   1) Kullanıcı Seçkin (canUseAutoRoutine RBAC)
          //   2) Domain auto routine için güvenli (skin/hair/sun/body/oral)
          //   3) Persist'li flowId mevcut (rutin-olustur okuyacak)
          //   4) (Step 13.1) Profil concern'i auto-safe (legacy body/oral
          //      "dryness" fallback'ini taşıyan eski kayıtlarda CTA gizlenir;
          //      kullanıcı Akıllı Seçim'i tekrar tamamlarsa concern güncellenir
          //      ve CTA otomatik geri gelir). skin/hair/sun chip'lerinde
          //      autoSafe her zaman true → mevcut Step 9 davranışı korunur.
          const showAutoCTA =
            canCreateAutoRoutine &&
            AUTO_ROUTINE_SAFE_DOMAINS.has(it.domain) &&
            !!it.flowId &&
            it.autoSafe;

          // ── Chip clickability (audit fix) ─────────────────────────────
          // Chip eskiden plain View'di → tıklanamıyordu. flowId mevcutsa
          // (Akıllı Seçim/Rehber kaynaklı tüm profillerde mevcut) chip
          // Pressable olur ve mevcut rutin-olustur ekranına gider —
          // RBAC orada ?premium=1 olmadan free fallback render eder, Seçkin
          // ise premium akış görür. Yeni route YARATILMADI; mevcut
          // ekran/parametreler kullanıldı. flowId yoksa chip plain View.
          // Inner CTA TouchableOpacity (premium) gesture'ı önce yakalar →
          // chip onPress ile çakışma yok (RN nested touchable davranışı).
          const chipFlowId = it.flowId;
          const onChipPress = chipFlowId
            ? () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // ── Step 3 — Back target fix ───────────────────────────
                // Bakım Profillerim chip'i Rutinim ekranından açılır; bu yüzden
                // `from=rutin` geçilir. Rutin Rehberi (rutin-olustur) içindeki
                // resolveRutinOlusturBack(from) tablosu "rutin" → "/(tabs)/rutin"
                // map'ler. Hem üst-sol back oku hem alt "Geri dön" butonu aynı
                // goBackSourceAware(from, backFallback) çağrısını kullandığı
                // için tek param değişikliği iki kontrolü de Rutinim'e yöneltir.
                // Önceki `from=profile` yanlışlıkla "/(tabs)/profil" tab'ına
                // düşürüyordu (KNOWN_BACK_SOURCES.profile case'i). Diğer
                // çağrıcılar (Anket, Akıllı Seçim, Danışma, vb.) kendi `from`
                // değerlerini geçer; resolver'a ve diğer case'lere dokunulmadı.
                router.push(
                  `/(tabs)/(home)/rutin-olustur?flow=${encodeURIComponent(
                    chipFlowId,
                  )}&from=rutin`,
                );
              }
            : null;
          const ChipWrapper: React.ComponentType<any> = onChipPress
            ? TouchableOpacity
            : View;
          const chipExtraProps = onChipPress
            ? {
                onPress: onChipPress,
                activeOpacity: 0.78,
                accessibilityRole: "button" as const,
                accessibilityLabel: `${it.label} bakım profilini aç`,
              }
            : {};

          return (
            <ChipWrapper
              key={it.domain}
              style={[pa.chip, { backgroundColor: chipBg, borderColor: chipBorder }]}
              {...chipExtraProps}
            >
              <Feather name={it.icon as any} size={12} color={accent} />
              <View style={{ flexShrink: 1 }}>
                <Text
                  style={[pa.chipLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {it.label}
                </Text>
                {it.secondary && (
                  <Text
                    style={[pa.chipSub, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {it.secondary}
                  </Text>
                )}
              </View>
              {showAutoCTA && (
                <TouchableOpacity
                  onPress={() => {
                    // ECZ4 Step 9 — Step 5c çift katman koruyor: rutin-olustur
                    // ekranı `canUseAutoRoutine(user)` doğrulamadan premium
                    // mode render etmez, free fallback'e düşer.
                    router.push(
                      `/(tabs)/(home)/rutin-olustur?flow=${encodeURIComponent(
                        it.flowId!,
                      )}&premium=1`,
                    );
                  }}
                  activeOpacity={0.75}
                  hitSlop={8}
                  style={[
                    pa.ctaBtn,
                    {
                      backgroundColor: `${COPPER}14`,
                      borderColor: `${COPPER}33`,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.label} için akıllı rutin oluştur`}
                >
                  <Feather name="zap" size={11} color={accent} />
                  <Text style={[pa.ctaText, { color: accent }]} numberOfLines={1}>
                    Akıllı rutin oluştur
                  </Text>
                </TouchableOpacity>
              )}
              {/* Sil (X). Sadece kayıtlı profillerde (flowId varken) görünür.
                  Nested TouchableOpacity gesture'ı önce yakalar → chip ana
                  onPress (navigation) tetiklenmez. */}
              {chipFlowId && (
                <TouchableOpacity
                  onPress={() => onRequestDelete(chipFlowId, it.label)}
                  hitSlop={10}
                  activeOpacity={0.7}
                  style={[pa.delBtn, {
                    backgroundColor: isDark ? "rgba(220,50,50,0.12)" : "rgba(220,50,50,0.08)",
                    borderColor:     isDark ? "rgba(220,50,50,0.30)" : "rgba(220,50,50,0.20)",
                  }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.label} bakım profilini sil`}
                >
                  <Feather name="x" size={11} color="#DC3232" />
                </TouchableOpacity>
              )}
            </ChipWrapper>
          );
        })}
      </View>
    </View>
  );
}

const pa = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  headerIcon:  { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 13.5, fontWeight: "700", letterSpacing: -0.2 },
  chipRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:        {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 8,
    maxWidth: "100%",
  },
  chipLabel:   { fontSize: 12.5, fontWeight: "600" },
  chipSub:     { fontSize: 10.5, fontWeight: "500", marginTop: 1 },
  // ECZ4 Step 9 — Inline CTA. Compact, chip yüksekliğini bozmayacak boyutta.
  ctaBtn:      {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 9, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5,
    marginLeft: 4,
  },
  ctaText:     { fontSize: 10.5, fontWeight: "700", letterSpacing: -0.1 },
  // Profil chip'i sağ tarafına yerleşen küçük X silme butonu. Chip yüksekliğini
  // bozmayacak boyutta; nested touchable gesture'ı yakalar → chip onPress'i
  // tetiklenmez.
  delBtn:      {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginLeft: 4,
  },
});

// ─── Hızlı Yol Kartı (ScrollView'ın en üstünde her zaman görünür) ─────────────

function QuickPathsCard({
  isDark, colors, hasV2,
}: {
  isDark: boolean; colors: ReturnType<typeof useColors>; hasV2: boolean;
}) {
  const wrapStyle = [qp.wrap, {
    backgroundColor: isDark ? "#151A12" : "#F4F7F0",
    borderColor: isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.20)",
  }];

  if (hasV2) {
    return (
      <View style={wrapStyle}>
        {/* Ana aksiyon: Analiz programını görüntüle */}
        <TouchableOpacity
          style={qp.primary}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/premium-skin-scan-v2/routine-program" as any); }}
          activeOpacity={0.84}
        >
          <View style={qp.primaryIcon}>
            <Feather name="layers" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={qp.primaryLabel}>Analiz programını görüntüle</Text>
            <Text style={qp.primarySub}>Sabah · Akşam · Haftalık plan</Text>
          </View>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* İkincil: haftalık/aylık ek bakım */}
        <TouchableOpacity
          style={[qp.secondary, {
            borderColor: isDark ? "rgba(122,143,107,0.35)" : "rgba(122,143,107,0.30)",
            backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "rgba(122,143,107,0.07)",
          }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/rutin/duzenle" as any); }}
          activeOpacity={0.78}
        >
          <Feather name="plus" size={15} color={GREEN} />
          <Text style={[qp.secondaryLabel, { color: isDark ? "#9DB88C" : GREEN }]}>
            Haftalık/aylık ek bakım ekle
          </Text>
          <Feather name="chevron-right" size={13} color={isDark ? "#6A8C5A" : `${GREEN}88`} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      {/* Ana aksiyon: Kendi rutinini oluştur */}
      <TouchableOpacity
        style={qp.primary}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/rutin/duzenle?mode=create" as any); }}
        activeOpacity={0.84}
      >
        <View style={qp.primaryIcon}>
          <Feather name="plus-circle" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={qp.primaryLabel}>Kendi rutinini oluştur</Text>
          <Text style={qp.primarySub}>Sabah · Akşam · Haftalık · Aylık</Text>
        </View>
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
}

const qp = StyleSheet.create({
  wrap: {
    borderRadius: 18, borderWidth: 1, overflow: "hidden", gap: 0,
  },
  primary: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 14,
  },
  primaryIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  primaryLabel: { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: -0.2 },
  primarySub:   { fontSize: 11.5, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  secondary: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryLabel: { flex: 1, fontSize: 13, fontWeight: "700" },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function RutinScreen() {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();

  // ECZ4 Step 9 — Seçkin (auto routine) yetkisi. Misafir / free kullanıcılar
  // false döner; CTA hiç render edilmez. Kararlı bir scalar — useMemo dep'i
  // olarak güvenle kullanılabilir, profil chip'i her render'da yeniden
  // hesaplanmaz.
  // ECZ4 — Logout state-leak guard. authLoading false + user yok ise misafir.
  // Tüm hook'lar çağrıldıktan sonra (Rules of Hooks) erken render'da guest
  // bloğuna düşer — önceki user'ın v2 / manuel rutin verisi storage'da
  // kalmış olsa bile UI'ye SIZMAZ. AuthContext.logout `clearAllOnLogout()`
  // ile storage'ı zaten siler; bu render guard ek savunma katmanıdır.
  const { user, loading: authLoading } = useAuth();
  const canCreateAutoRoutine = canUseAutoRoutine(user);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    v2Routine, morning, evening, weekly, monthly,
    completedIds, hasRoutine, streak, loading,
    toggleStep, markAllSlot, reload,
  } = useActiveRoutine();

  const [savedHistory,    setSavedHistory]    = useState<SavedRoutine[]>([]);
  // ECZ4 Step 3 — Çoklu rutin koleksiyonu state'i. useActiveRoutine'i bozmaz;
  // sadece "Rutinlerim" kart bölümünü beslemek için yan-okuma yapar.
  const [routinesAll,     setRoutinesAll]     = useState<RoutineRecord[]>([]);
  const [primaryRoutineId, setPrimaryRoutineId] = useState<string | null>(null);

  // ── Free plan görünür rutin sınırı ────────────────────────────────────────
  // Üyelik truth tek kaynak: getMaxRoutineCount (lib/accessControl.ts).
  // Free=1, Seçkin=4. Display-level cap: storage'tan rutin SİLMEZ; sadece
  // RUTİNLERİM listesinde gösterilen kart sayısını cap'ler. Önceliklendirme:
  //   1) primary (ANA RUTİN) — varsa ilk
  //   2) en yeni updatedAt
  //   3) en yeni createdAt
  // Seçkin için cap=4 zaten mevcut davranış (collection max'tan büyük olamaz).
  const maxRoutineCount = useMemo(() => getMaxRoutineCount(user), [user]);
  const visibleRoutines = useMemo(() => {
    if (maxRoutineCount <= 0 || routinesAll.length <= maxRoutineCount) {
      return routinesAll;
    }
    const sorted = [...routinesAll].sort((a, b) => {
      if (a.id === primaryRoutineId && b.id !== primaryRoutineId) return -1;
      if (b.id === primaryRoutineId && a.id !== primaryRoutineId) return 1;
      const aT = a.updatedAt || a.createdAt || 0;
      const bT = b.updatedAt || b.createdAt || 0;
      if (bT !== aT) return bT - aT;
      return 0;
    });
    return sorted.slice(0, maxRoutineCount);
  }, [routinesAll, maxRoutineCount, primaryRoutineId]);
  const [deleteTarget,    setDeleteTarget]    = useState<"active" | string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  // ECZ4 Step 5 — Rutin yeniden adlandırma modalı.
  const [renameTargetId,  setRenameTargetId]  = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  const [renameInputError, setRenameInputError] = useState<string | null>(null);
  const [renaming,        setRenaming]        = useState(false);
  const [toastMsg,        setToastMsg]        = useState("");
  const [toastVisible,    setToastVisible]    = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // ECZ4 Step 6 — Bakım profili farkındalığı tick'i.
  // Bridge store fire-and-forget hydrate ediyor; ilk mount'ta AsyncStorage
  // okuması henüz tamamlanmamış olabilir. Tek bir gecikmeli tick ile gerçek
  // state'i yakala. Focus refresh için ayrıca aşağıdaki useFocusEffect içinde
  // de bu tick artırılır (tek satır, mevcut reload davranışı bozulmaz).
  const [profileTick, setProfileTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setProfileTick((v) => v + 1), 200);
    return () => clearTimeout(t);
  }, []);

  // ECZ4 Step 3 — Koleksiyon refresh helper. hydrate + read snapshot.
  // Mutator-queue replay-safe: Step 1'deki saveRoutineAsNew/setPrimaryRoutine
  // hydrate sırasında çağrılırsa replay ile aynı sonucu üretir.
  const refreshRoutineCollection = useCallback(async () => {
    await hydrateRoutineCollection();
    setRoutinesAll(getAllRoutines());
    setPrimaryRoutineId(getPrimaryRoutine()?.id ?? null);
  }, []);

  useFocusEffect(useCallback(() => {
    reload();
    routineProgramStore.loadHistory().then((h) => setSavedHistory(h));
    // Bakım profili farkındalığını ekran her odaklandığında tazele
    // (kullanıcı Rehber/Akıllı Seçim'den dönmüşse yeni profili yakala).
    setProfileTick((v) => v + 1);
    // ECZ4 Step 3 — Çoklu rutin listesi: ekran her odaklandığında tazele.
    void refreshRoutineCollection();
  }, [reload, refreshRoutineCollection]));

  // ── ECZ4 — "Rutinime Ekle" intent consumer ─────────────────────────────────
  // Ürün detayından gelen intent'i v2/manual durumuna göre işler.
  // Tek kaynak: routineAddIntentStore (TTL 2dk). v2 aktif iken sessiz manual
  // yazım YAPILMAZ — Alert ile düzenleme ekranına yönlendirir.
  // ECZ4 logout guard: misafir / authLoading durumunda intent tüketilmez —
  // guest manuel rutin oluşturamaz, intent yine duzenle'de /giris guard'ına
  // takılırdı; burada erken bail intent'i sonraki login için canlı tutar.
  const intentHandledRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (authLoading || !user) return;
    if (intentHandledRef.current) return;

    const intent = consumeRoutineAddIntent();
    if (!intent) { intentHandledRef.current = true; return; }
    intentHandledRef.current = true;

    const goBackToProduct = () => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      // ECZ4 back continuity fallback: sourceRoute artık full Expo Router
      // path (örn. "/product/<id>"). Direkt push; sourceParams sadece
      // bilgi amaçlı tutulur (path zaten id içerir).
      const sr = intent.sourceRoute;
      if (sr) {
        router.push(sr as any);
      }
    };

    // — v2 aktif rutin: sessiz manual yazma yok, kullanıcıyı yönlendir.
    if (v2Routine) {
      Alert.alert(
        "Aktif analiz rutinin var",
        `"${intent.productName ?? "Bu ürün"}" v2 analiz rutinine doğrudan eklenemez. Yeni bir manuel rutine eklemek ister misin?`,
        [
          // ECZ4 back continuity: Vazgeç → ürün detayına geri dön. Intent
          // closure'da yakalı; clearRoutineAddIntent sourceRoute'u
          // etkilemez (intent değişkeni stale snapshot).
          { text: "Vazgeç", style: "cancel", onPress: () => { clearRoutineAddIntent(); goBackToProduct(); } },
          { text: "Yeni manuel rutine ekle", onPress: () => {
              setRoutineAddIntent({ ...intent, ts: Date.now() });
              router.push("/(tabs)/rutin/duzenle?mode=create&fromProductAdd=1" as any);
            } },
        ],
      );
      return;
    }

    // — Manual / no-routine dalı: bucket sınıflandır.
    const bucket: ProductBucket = classifyBucket({
      name:     intent.productName ?? "",
      isim:     intent.productName ?? "",
      category: intent.productCategory ?? "",
      kategori: intent.productCategory ?? "",
    });

    // ECZ4 — Intent katmanı ek kuralı (engine'e dokunmaz):
    // Toner/tonik ürünleri auto-bind etmez (slot anlamı belirsiz);
    // kullanıcı Düzenle ekranından kategori seçer.
    const nameLow = `${intent.productName ?? ""} ${intent.productCategory ?? ""}`.toLowerCase();
    const isToner = /\btonik\b|\btoner\b/.test(nameLow);

    const map: { cat: StepCategory; slot: RoutineSlot } | null = isToner ? null :
      bucket === "cleanser"    ? { cat: "cleanser",    slot: "evening" } :
      bucket === "serum"       ? { cat: "serum",       slot: "evening" } :
      bucket === "moisturizer" ? { cat: "moisturizer", slot: "evening" } :
      bucket === "sunscreen"   ? { cat: "sunscreen",   slot: "morning" } :
      null;

    if (!map) {
      Alert.alert(
        "Otomatik eklenemedi",
        `"${intent.productName ?? "Bu ürün"}" için uygun rutin adımı otomatik bulunamadı. Düzenle ekranından manuel olarak ekleyebilirsin.`,
        [
          // ECZ4 back continuity: Vazgeç → ürün detayına geri dön (Rutinim'de
          // strand etmez). Intent closure'da yakalı; clearRoutineAddIntent
          // sourceRoute'u etkilemez.
          { text: "Vazgeç", style: "cancel", onPress: () => { clearRoutineAddIntent(); goBackToProduct(); } },
          { text: "Düzenle'yi aç", onPress: () => {
              setRoutineAddIntent({ ...intent, ts: Date.now() });
              router.push("/(tabs)/rutin/duzenle?fromProductAdd=1" as any);
            } },
        ],
      );
      return;
    }

    // — Duplicate guard
    const current = getManualRoutine();
    const slotSteps =
      map.slot === "morning" ? current.morning :
      map.slot === "evening" ? current.evening :
      map.slot === "weekly"  ? current.weekly  : current.monthly;
    const dup = slotSteps.some(s => s.productId === intent.productId);
    const slotLbl = map.slot === "morning" ? "sabah" : "akşam";
    if (dup) {
      Alert.alert(
        "Zaten ekli",
        `"${intent.productName ?? "Bu ürün"}" ${slotLbl} rutininde zaten var.`,
        [{ text: "Tamam", style: "cancel" }],
      );
      return;
    }

    addStep({
      slot:         map.slot,
      category:     map.cat,
      label:        intent.productName ?? "Ürün",
      productId:    intent.productId,
      productName:  intent.productName,
      productBrand: intent.productBrand,
    });
    // Manuel store değişti — görünür state'i tazele.
    void reload();

    Alert.alert(
      "Eklendi",
      `"${intent.productName ?? "Ürün"}" ${slotLbl} rutinine eklendi.`,
      [
        { text: "Tamam", style: "cancel" },
        { text: "Ürüne dön", onPress: goBackToProduct },
      ],
    );
  }, [loading, authLoading, user, v2Routine, reload]);

  // Ekran her odaklandığında consumer flag'ini sıfırla (sonraki intent için).
  useFocusEffect(useCallback(() => {
    intentHandledRef.current = false;
    return () => {};
  }, []));

  // ECZ4 Step 6 — Bakım profilleri (read-only, useMemo cache).
  // Helper'lar salt-okunur ve hafif (Map iteration); tick değiştiğinde
  // yeniden hesaplanır. Render içinde tekrar çağrı yapılmaz.
  const careProfiles = useMemo<ProfileAwarenessItem[]>(() => {
    const domains = getAvailableProfileDomains();
    return domains.map<ProfileAwarenessItem>((d) => {
      const latest = getLatestRoutineProfileByDomain(d);
      const concern = latest?.routineProfile.concern;
      const source  = latest?.routineProfile.source;

      // ECZ4 Step 7d — kaynak ve concern etiketlerini güvenli birleştir.
      // Format: "Akıllı Seçim'den · Akne odaklı". Biri eksikse var olan
      // kısım gösterilir; ikisi de eksikse secondary null kalır.
      const sourceLbl  = (source  && SOURCE_LABEL[source])   ?? null;
      // ECZ4 Step 7f (Step 13 güncel) — body/oral × Akıllı Seçim için
      // suppression yalnızca LEGACY kayıtlarda devrede kalır: Step 12 öncesi
      // mapper "dryness" fallback'i üretiyordu ve persist'li eski kayıtlarda
      // hâlâ bu değer olabilir. Yeni kayıtlar artık body_*/oral_* concern
      // değerleri taşır — bunları bastırmıyoruz, gerçek bilgi gösteriliyor.
      const suppressConcern =
        (d === "body" || d === "oral") && source === "akilli_secim" &&
        !!concern && !BODY_ORAL_CONCERNS.has(concern);
      const concernLbl = !suppressConcern && concern
        ? (CONCERN_LABEL[concern] ?? null)
        : null;

      // ECZ4 Step 7g — body/oral × Akıllı Seçim için anlamlı bir tail metni
      // sağla. Mapper purpose-bazlı `routineGoal` üretir (örn. "Vücut için
      // günlük nemlendirme"). Sadece concern bastırıldığında devreye girer;
      // generic "Akıllı Seçim profili" fallback'i okunmaz (anlamsız tekrar).
      const goal = latest?.routineProfile.routineGoal;
      const goalLbl =
        suppressConcern && goal && goal !== "Akıllı Seçim profili"
          ? goal
          : null;
      const tailLbl = concernLbl ?? goalLbl;

      const secondary =
        sourceLbl && tailLbl
          ? `${sourceLbl} · ${tailLbl}`
          : (sourceLbl ?? tailLbl);

      // ECZ4 Step 13.1 — autoSafe: body/oral chip'leri için CTA güvenliği.
      // Body/oral domain'inde ancak concern body_*/oral_* set'indeyse CTA
      // açılır (legacy "dryness" fallback'ini taşıyan eski kayıtlar gizli
      // kalır, kullanıcı Akıllı Seçim'i tekrar tamamlarsa concern güncellenir).
      // skin/hair/sun chip'lerinde her zaman true.
      const autoSafe =
        (d === "body" || d === "oral")
          ? !!concern && BODY_ORAL_CONCERNS.has(concern)
          : true;

      return {
        domain: d,
        label: DOMAIN_LABEL[d],
        icon:  DOMAIN_ICON[d],
        secondary,
        // ECZ4 Step 9 — flowId Step 7a-b'den beri persist'li (akilli_<domain>
        // veya rehber concern key'i). rutin-olustur ekranı bu key ile
        // getSavedRoutineProfile çağırarak profili çözer.
        flowId: latest?.flowId ?? null,
        autoSafe,
      };
    });
    // profileTick: mount sonrası hydration + focus refresh trigger
  }, [profileTick]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  }, [toastAnim]);

  const openDeleteConfirm = (target: "active" | string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteTarget(target);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget === "active") {
        if (v2Routine) {
          await routineProgramStore.deleteActive();
          routineProgramStore.invalidate();
        } else {
          clearAllSteps();
        }
        await reload();
      } else if (deleteTarget.startsWith("routine:")) {
        // ECZ4 Step 3 — Koleksiyon rutin silme. Silinen primary ise koleksiyon
        // ilk kalanı otomatik primary yapar (deleteRoutine içinde).
        const id = deleteTarget.slice("routine:".length);
        deleteRoutine(id);
        await refreshRoutineCollection();
        // Eğer silinen primary ise adapter'a bağlı useActiveRoutine de
        // tazelenmeli (yeni primary'yi yansıtsın).
        await reload();
      } else if (deleteTarget.startsWith("profile:")) {
        // Bakım Profillerim chip'inden silme. Sadece ilgili bridge kaydı
        // silinir; rutinler / progress / ürün verisi DOKUNULMAZ.
        const flowId = deleteTarget.slice("profile:".length);
        removeSavedRoutineProfile(flowId);
        // Profile awareness section'ı tazele (useMemo profileTick'e bağlı).
        setProfileTick((v) => v + 1);
      } else {
        await routineProgramStore.deleteFromHistory(deleteTarget);
        const updated = await routineProgramStore.loadHistory();
        setSavedHistory(updated);
      }
      showToast(deleteTarget.startsWith("profile:") ? "Profil silindi." : "Rutin silindi.");
    } catch {
      showToast("Bir hata oluştu, lütfen tekrar dene.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handleToggle = async (id: string, wasDone: boolean) => {
    if (!wasDone) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleStep(id, wasDone);
  };

  const handleMarkAll = async (slot: "morning" | "evening") => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markAllSlot(slot);
  };

  // Tamamlanma hesabı
  const allSteps   = [...morning, ...evening];
  const totalCount = allSteps.length;
  const doneCount  = allSteps.filter((s) => completedIds.includes(s.id)).length;
  const remaining  = totalCount - doneCount;
  const allDone    = totalCount > 0 && remaining === 0;
  const progress   = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Page bg: Home ekranıyla hizalı taban için colors.background (cream #E8ECE4
  // light). Home implementasyonu DOKUNULMADI — sadece mevcut shared token'ın
  // değeri okunup pageBg'ye atandı.
  const pageBg    = colors.background;
  // Color refinement: sage-gray (#EEF1EA) → cool aqua/water-green (#D6ECEA).
  // Premium soft, cooler, daha modern. Border + semantic tonlar (yeşil status,
  // kırmızı sil, copper ANA RUTİN) korundu.
  const sectionBg = isDark ? "#1A1A1A" : "#D6ECEA";
  // Inner bar / inner surface — section içindeki yumuşak iç paneller için
  // çok açık aqua tonu (#F4FBFB). Şu an inline kullanım yok; gelecek iç panel
  // ihtiyacında tek leverage noktası.
  const _innerBg  = isDark ? "rgba(255,255,255,0.04)" : "#F4FBFB"; void _innerBg;
  // Border: sıcak bej (#EDE8E0) → cool soft aqua (#97C3BE). Tüm section/card
  // border'ları aynı anda yeni aqua tonunu alır.
  const bdColor   = isDark ? "rgba(255,255,255,0.09)" : "#97C3BE";
  // Subtitle readability — aqua paletine uyumlu cool slate (#4F6472). Font
  // size SABİT, sadece renk. Daha güçlü kontrast için #42596B (stronger)
  // kullanılabilir.
  const mutedStrong = isDark ? colors.textSecondary : "#4F6472";

  const motivationMsg = getMotivationalMessage(progress, streak);

  const hasWeeklyOrMonthly = weekly.length > 0 || monthly.length > 0;

  // ── Step 2 — Section sırası kararı için tek scalar truth ─────────────
  // hasAnyRoutine: kullanıcının aktif veya kayıtlı bir rutini var mı?
  // - Aktif rutin (sabah/akşam) varsa true
  // - Haftalık veya aylık planı varsa true
  // - Koleksiyonda görünür rutin kartı varsa true
  // Bu boolean Bakım Profillerim bölümünün konumunu belirler:
  //   true  → Profiller, rutin içeriğinin ALTINDA render olur
  //   false → Profiller, "Yeni rutin oluştur" CTA'sının ALTINDA render olur
  // Bağımlılıklar tüm scalar/length değerleri — referans değişikliği yok.
  const hasAnyRoutine = useMemo(
    () => hasRoutine || hasWeeklyOrMonthly || visibleRoutines.length > 0,
    [hasRoutine, hasWeeklyOrMonthly, visibleRoutines.length],
  );

  // Tek node — iki konumdan SADECE biri runtime'da render eder, diğeri
  // false branch ile elenir. Duplicate JSX çağrısı yok, profil verisi
  // (careProfiles) ve delete davranışı (openDeleteConfirm + onRequestDelete)
  // Step 1'deki gibi korunur.
  const profileAwarenessNode = (
    <ProfileAwarenessSection
      items={careProfiles}
      isDark={isDark}
      colors={colors}
      sectionBg={sectionBg}
      borderColor={bdColor}
      canCreateAutoRoutine={canCreateAutoRoutine}
      onRequestDelete={(flowId) => openDeleteConfirm(`profile:${flowId}`)}
    />
  );

  // ── ECZ4 — Misafir guard (render-time, tüm hook'lardan SONRA) ─────────────
  // Auth çözüldü ve user yok ise: önceki user'ın storage kalıntısını render
  // ETME. EmptyState `isGuest={true}` zaten mevcut — CTA'lar `/giris`'e
  // yönlendirir. Storage temizliği AuthContext.logout tarafında yapılır
  // (defense-in-depth: render guard + storage clear). Tüm hook'lar üstte
  // çağrıldıktan sonra erken return — Rules of Hooks bozulmaz.
  if (!authLoading && !user) {
    return (
      <View style={[r.container, { backgroundColor: pageBg }]}>
        <View style={[r.header, {
          paddingTop: topPad + 12,
          backgroundColor: sectionBg,
          borderBottomColor: bdColor,
        }]}>
          <Text style={[r.headerTitle, { color: colors.text }]}>Rutinim</Text>
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: tabBarInset.scrollPaddingBottom(24),
          }}
        >
          <EmptyState
            colors={colors}
            isDark={isDark}
            canUseAuto={false}
            isGuest={true}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[r.container, { backgroundColor: pageBg }]}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[r.header, {
        paddingTop: topPad + 12,
        backgroundColor: sectionBg,
        borderBottomColor: bdColor,
      }]}>
        <View style={{ flex: 1 }}>
          <Text style={[r.headerTitle, { color: colors.text }]}>Rutinim</Text>
          {hasRoutine && !allDone && (
            <Text style={[r.headerSub, { color: mutedStrong }]}>
              {remaining > 0 ? `Bugün ${remaining} adım kaldı` : "Hepsi tamamlandı"}
            </Text>
          )}
          {v2Routine && (
            <Text style={[{ fontSize: 11, marginTop: 2, fontWeight: "600" }, { color: isDark ? `${GREEN}99` : `${GREEN}BB` }]}>
              {new Date(v2Routine.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} analizinden
            </Text>
          )}
        </View>

        {/* Streak pill */}
        {streak > 0 && (
          <View style={[r.streakPill, {
            backgroundColor: isDark ? "rgba(217,119,6,0.1)" : "#FFFBEB",
            borderColor: "rgba(217,119,6,0.28)",
          }]}>
            <Text style={r.streakFire}>🔥</Text>
            <Text style={[r.streakNum, { color: "#D97706" }]}>{streak} gün</Text>
          </View>
        )}

        {/* Analiz programı butonu */}
        {v2Routine ? (
          <TouchableOpacity
            onPress={() => router.push("/premium-skin-scan-v2/routine-program" as any)}
            style={[r.editBtn, { borderColor: `${GREEN}40`, backgroundColor: `${GREEN}0D` }]}
            activeOpacity={0.75}
          >
            <Feather name="layers" size={15} color={GREEN} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/rutin/duzenle" as any)}
            style={[r.editBtn, { borderColor: bdColor }]}
            activeOpacity={0.75}
          >
            <Feather name="edit-2" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Aktif rutini sil */}
        {hasRoutine && (
          <TouchableOpacity
            onPress={() => openDeleteConfirm("active")}
            style={[r.editBtn, {
              borderColor: isDark ? "rgba(220,50,50,0.30)" : "rgba(220,50,50,0.20)",
              backgroundColor: isDark ? "rgba(220,50,50,0.08)" : "rgba(220,50,50,0.05)",
            }]}
            activeOpacity={0.75}
          >
            <Feather name="trash-2" size={15} color="#DC3232" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── İçerik ───────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[r.scroll, { paddingBottom: tabBarInset.scrollPaddingBottom(32) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Üst giriş kartı (v2 detection bitene kadar bekle) ──
             ECZ4 Step 5.1 — Eski "Kendi rutinini oluştur" → /rutin/duzenle
             yönlendiren manuel-only paralel yol KALDIRILDI. Artık unified
             "Yeni rutin oluştur" 3-CTA bloğu burada (hasV2 olmayan ve
             registered kullanıcılar için) gösteriliyor; misafir EmptyState
             prompt'unu görmeye devam ediyor; v2 skin-scan kullanıcıları için
             QuickPathsCard'ın "Analiz programını görüntüle" kısayolu (farklı
             use-case) korundu. Save-limit / overwrite alert'i alt akışlarda
             (rutin-olustur, manual editör, rehber save) merkezi kalır;
             burada DUPLICATE EDİLMEZ. */}
        {!loading && v2Routine && (
          <QuickPathsCard isDark={isDark} colors={colors} hasV2={true} />
        )}
        {/* v2 kullanıcıları için bile registered ise 3-CTA görünür — yeni
            (non-v2) rutin oluşturma yolu keşfedilebilir kalır. QuickPathsCard
            v2 kısayolunun ALTINDA render olur; iki blok aynı kullanıcıda
            beraber durabilir (farklı use-case). */}
        {!loading && isRegisteredUser(user) && (
          <View style={{
            backgroundColor: sectionBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: bdColor,
            padding: 16,
            gap: 12,
          }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", letterSpacing: -0.2, color: colors.text }}>
                Yeni rutin oluştur
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: "500", lineHeight: 18, color: colors.textSecondary }}>
                Bakım profili, anket veya manuel seçimle yeni bakım planı hazırla.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (canCreateAutoRoutine) {
                  router.push("/premium-skin-scan-v2" as any);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Alert.alert(
                    "Seçkin Üyelik Gerekiyor",
                    "Bakım profili ile otomatik rutin oluşturma Seçkin üyelik ile açılır. Anketi veya manuel oluşturmayı kullanabilirsin.",
                  );
                }
              }}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: canCreateAutoRoutine ? GREEN : (isDark ? "rgba(255,255,255,0.08)" : "#E8E2D6"),
                borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
              }}
              activeOpacity={0.85}
            >
              <Feather name={canCreateAutoRoutine ? "camera" : "lock"} size={15}
                color={canCreateAutoRoutine ? "#fff" : (isDark ? "#A0835A" : "#92400E")} />
              <Text style={{
                fontSize: 13.5, fontWeight: "700",
                color: canCreateAutoRoutine ? "#fff" : (isDark ? "#D4A56A" : "#92400E"),
              }}>
                Bakım Profili ile Oluştur
              </Text>
            </TouchableOpacity>
            {!canCreateAutoRoutine && (
              <Text style={{
                fontSize: 11, fontWeight: "600", marginTop: -6, letterSpacing: 0.2, textAlign: "center",
                color: isDark ? "#A0835A" : "#B45309",
              }}>
                Seçkin üyelik ile açılır
              </Text>
            )}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/questionnaire?from=rutin" as any);
              }}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11,
                borderWidth: 1.5,
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D8D3CC",
              }}
              activeOpacity={0.78}
            >
              <Feather name="list" size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                Cilt Anketi ile Oluştur
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/rutin/duzenle?mode=create" as any);
              }}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11,
                borderWidth: 1.5,
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "#D8D3CC",
              }}
              activeOpacity={0.78}
            >
              <Feather name="plus" size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                Manuel Rutin Oluştur
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ECZ4 Step 6 · Bakım Profili Farkındalığı (passive UI) ──
              · Sadece domain.length > 0 ise render olur.
              · Pasif: hiçbir aksiyon, navigation veya mutasyon içermez.
              · Step 2 — Konum: Rutin YOKKEN burada (CTA altında) gösterilir.
                Rutin VARKEN bu blok elenir; aynı node aşağıda RUTİNLERİM
                bölümünden sonra render olur. Tek JSX çağrısı (variable),
                duplicate yok. */}
        {!hasAnyRoutine && profileAwarenessNode}

        {/* Rutin yok */}
        {!hasRoutine && !hasWeeklyOrMonthly && (
          <EmptyState colors={colors} isDark={isDark} canUseAuto={canCreateAutoRoutine} isGuest={!user} />
        )}

        {/* Tüm adımlar tamamlandı */}
        {hasRoutine && allDone && (
          <AllDoneView streak={streak} isDark={isDark} colors={colors} />
        )}

        {/* Motivasyonel mesaj (rutin varken ve tamamlanmamışken) */}
        {hasRoutine && !allDone && (
          <MotivationCard message={motivationMsg} isDark={isDark} />
        )}

        {/* ── Analiz tabanlı rutin (v2 varsa) ── */}
        {v2Routine && hasRoutine && !allDone && (
          <View style={[r.sectionHeader, { borderColor: bdColor }]}>
            <Feather name="layers" size={12} color={GREEN} />
            <Text style={[r.sectionHeaderText, { color: isDark ? `${GREEN}99` : `${GREEN}CC` }]}>
              ANALİZ BAZLI RUTİN
            </Text>
          </View>
        )}

        {/* Sabah adımları */}
        {hasRoutine && !allDone && morning.length > 0 && (
          <View style={[r.section, { backgroundColor: sectionBg, borderColor: bdColor }]}>
            <SlotSection
              title="SABAH" icon="sun" accentColor={GREEN}
              steps={morning} completedIds={completedIds}
              onToggle={handleToggle}
              onMarkAll={() => handleMarkAll("morning")}
              isDark={isDark} colors={colors}
              hasV2={!!v2Routine}
            />
          </View>
        )}

        {/* Akşam adımları */}
        {hasRoutine && !allDone && evening.length > 0 && (
          <View style={[r.section, { backgroundColor: sectionBg, borderColor: bdColor }]}>
            <SlotSection
              title="AKŞAM" icon="moon" accentColor={PURPLE}
              steps={evening} completedIds={completedIds}
              onToggle={handleToggle}
              onMarkAll={() => handleMarkAll("evening")}
              isDark={isDark} colors={colors}
              hasV2={!!v2Routine}
            />
          </View>
        )}

        {/* ── Haftalık adımlar (varsa) ── */}
        {weekly.length > 0 && (
          <>
            <View style={[r.sectionHeader, { borderColor: bdColor }]}>
              <Feather name="calendar" size={12} color={AMBER} />
              <Text style={[r.sectionHeaderText, { color: isDark ? `${AMBER}99` : `${AMBER}CC` }]}>
                HAFTALİK BAKIM
              </Text>
            </View>
            <ExtraSlotCard
              title="Bu hafta yapılacaklar"
              icon="calendar" color={AMBER}
              steps={weekly}
              isDark={isDark} colors={colors}
              borderColor={bdColor} sectionBg={sectionBg}
            />
          </>
        )}

        {/* ── Aylık adımlar (varsa) ── */}
        {monthly.length > 0 && (
          <>
            <View style={[r.sectionHeader, { borderColor: bdColor }]}>
              <Feather name="refresh-cw" size={12} color={TEAL} />
              <Text style={[r.sectionHeaderText, { color: isDark ? `${TEAL}99` : `${TEAL}CC` }]}>
                AYLIK BAKIM
              </Text>
            </View>
            <ExtraSlotCard
              title="Bu ay yapılacaklar"
              icon="refresh-cw" color={TEAL}
              steps={monthly}
              isDark={isDark} colors={colors}
              borderColor={bdColor} sectionBg={sectionBg}
            />
          </>
        )}

        {/* ── Tamamlanma sonrası alt bilgi ── */}
        {hasRoutine && allDone && (
          <View style={{ gap: 10 }}>
            <View style={[r.section, {
              backgroundColor: isDark ? `${GREEN}09` : `${GREEN}07`,
              borderColor:     isDark ? `${GREEN}30` : `${GREEN}22`,
              alignItems: "center",
            }]}>
              <Text style={{ fontSize: 13, color: isDark ? `${GREEN}CC` : GREEN, fontWeight: "600", textAlign: "center" }}>
                Cilt bakımı birikimli çalışır. Yarın da buradayım.
              </Text>
            </View>
            {v2Routine && (
              <TouchableOpacity
                onPress={() => router.push("/premium-skin-scan-v2/routine-program" as any)}
                style={[r.editLink, { borderColor: bdColor }]}
                activeOpacity={0.75}
              >
                <Feather name="layers" size={14} color={colors.textMuted} />
                <Text style={[{ fontSize: 13, fontWeight: "500" }, { color: colors.textMuted }]}>Analiz programını görüntüle</Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Alt bağlantılar (tamamlanmadıysa) ── */}
        {hasRoutine && !allDone && (
          <View style={{ gap: 8 }}>
            {v2Routine && (
              <TouchableOpacity
                onPress={() => router.push("/premium-skin-scan-v2/routine-program" as any)}
                style={[r.editLink, { borderColor: bdColor, marginTop: 0 }]}
                activeOpacity={0.75}
              >
                <Feather name="layers" size={14} color={colors.textMuted} />
                <Text style={[{ fontSize: 13, fontWeight: "500" }, { color: colors.textMuted }]}>
                  Ürün alternatifleri ve haftalık plan
                </Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── ECZ4 Step 5.1 — Step 4'teki alt "Yeni rutin oluştur" 3-CTA bölümü
             KALDIRILDI. DUPLIKE göstermemek için tek görünür 3-CTA mimarisi
             artık ScrollView başındaki üst karttır (yukarıda). ── */}

        {/* ── ECZ4 Step 3 — Rutinlerim (çoklu rutin yönetim kartları) ──
             Koleksiyondaki tüm rutinler listelenir. Tek truth: routineCollection.
             Aktif rutin gösterimi (yukarıdaki morning/evening blokları) primary'yi
             zaten render eder; bu bölüm yönetim arayüzüdür (set primary, edit, sil).
             Boş veya tek-rutin durumlarında bile gösterilir — kullanıcı silme/yeniden
             adlandırma erişimi için tek noktadan yönetebilsin. */}
        {visibleRoutines.length > 0 && (
          <View>
            <View style={[r.sectionHeader, { borderColor: bdColor, marginBottom: 8 }]}>
              <Feather name="layers" size={12} color={COPPER} />
              <Text style={[r.sectionHeaderText, { color: isDark ? `${COPPER}99` : `${COPPER}CC` }]}>
                RUTİNLERİM
              </Text>
            </View>
            {/* Üyelik bilgilendirme satırı (read-only — kayıt kapısı değil).
                Display-cap'li sayım: visibleRoutines.length kullanılır →
                free kullanıcı için "(1/1)", asla "(2/1)" göstermez. */}
            {!!user && maxRoutineCount > 0 && (
              <Text style={{
                fontSize: 11.5, fontWeight: "500", letterSpacing: 0.1,
                color: colors.textMuted, marginBottom: 10, marginTop: -2,
              }}>
                {maxRoutineCount === 1
                  ? "Ücretsiz üyelikte 1 rutin oluşturabilirsin."
                  : `En fazla ${maxRoutineCount} rutin oluşturabilirsin.`}
                {" "}({visibleRoutines.length}/{maxRoutineCount})
              </Text>
            )}
            {visibleRoutines.map((item) => {
              const isPrimary = item.id === primaryRoutineId;
              const sourceLabel = ROUTINE_SOURCE_LABEL[item.source] ?? "Manuel";
              const domainLabel = ROUTINE_DOMAIN_LABEL[item.domain] ?? "Cilt";
              const stepCount =
                (item.morning?.length ?? 0) +
                (item.evening?.length ?? 0) +
                (item.weekly?.length  ?? 0) +
                (item.monthly?.length ?? 0);
              return (
                <View
                  key={item.id}
                  style={[r.historyCard, {
                    backgroundColor: sectionBg,
                    borderColor: isPrimary
                      ? (isDark ? `${COPPER}55` : `${COPPER}66`)
                      : bdColor,
                    marginBottom: 10,
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 10,
                  }]}
                >
                  {/* Üst satır — başlık + (kalem) rename ikonu + Ana rutin badge.
                       ECZ4 Step 5.1 — "Adını değiştir" buton bloğu kaldırıldı;
                       eylem satırının yatay alanını bölmemek için title'ın
                       hemen yanında kompakt bir kalem ikonu sunuluyor.
                       Double-tap RN'de güvenilir değil (timing race + native
                       gesture conflict ScrollView içinde) — pencil tek-tap
                       en sağlam mobil UX. hitSlop ile dokunma alanı genişledi. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[r.historyTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[r.historyMeta, { color: mutedStrong }]} numberOfLines={1}>
                        {sourceLabel} · {domainLabel} · {stepCount} adım
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRenameTargetId(item.id);
                        setRenameInputValue(item.title);
                        setRenameInputError(null);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{
                        width: 32, height: 32, borderRadius: 999,
                        alignItems: "center", justifyContent: "center",
                        borderWidth: 1, borderColor: bdColor,
                        backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Rutin adını değiştir"
                    >
                      <Feather name="edit-2" size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {isPrimary && (
                      <View style={{
                        paddingHorizontal: 9, paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: isDark ? `${COPPER}22` : `${COPPER}1A`,
                        borderWidth: 1,
                        borderColor: isDark ? `${COPPER}55` : `${COPPER}40`,
                      }}>
                        <Text style={{
                          fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4,
                          color: isDark ? `${COPPER}EE` : COPPER,
                        }}>
                          ANA RUTİN
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Eylemler */}
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {!isPrimary && (
                      <TouchableOpacity
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const ok = setPrimaryRoutine(item.id);
                          if (ok) {
                            await refreshRoutineCollection();
                            await reload();
                            showToast("Ana rutin güncellendi.");
                          } else {
                            // Race: rutin başka akıştan silinmiş olabilir.
                            // Stale kartı self-heal et + kullanıcıya bildir.
                            await refreshRoutineCollection();
                            showToast("Rutin bulunamadı, liste yenilendi.");
                          }
                        }}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 6,
                          paddingHorizontal: 12, paddingVertical: 8,
                          borderRadius: 10, borderWidth: 1, borderColor: bdColor,
                        }}
                        activeOpacity={0.75}
                      >
                        <Feather name="star" size={13} color={colors.textSecondary} />
                        <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.textSecondary }}>
                          Ana rutin yap
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // ECZ4 Step 7 — Multi-routine edit. Editör artık
                        // mode=edit + routineId paramlarını alıp hedef rutini
                        // geçici olarak primary yapar ve çıkışta orijinali
                        // restore eder. Burada manuel primary swap dance'i
                        // ARTIK GEREKLİ DEĞİL — non-primary rutin kalıcı
                        // promote edilmeden düzenlenir.
                        router.push(`/rutin/duzenle?mode=edit&routineId=${encodeURIComponent(item.id)}` as any);
                      }}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 10, borderWidth: 1, borderColor: bdColor,
                      }}
                      activeOpacity={0.75}
                    >
                      <Feather name="edit-3" size={13} color={colors.textSecondary} />
                      <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.textSecondary }}>
                        Düzenle
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openDeleteConfirm(`routine:${item.id}`)}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 10, borderWidth: 1,
                        borderColor: isDark ? "rgba(220,50,50,0.28)" : "rgba(220,50,50,0.18)",
                        backgroundColor: isDark ? "rgba(220,50,50,0.07)" : "rgba(220,50,50,0.04)",
                      }}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather name="trash-2" size={13} color="#DC3232" />
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#DC3232" }}>
                        Sil
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Kayıtlı Geçmiş Rutinler ── */}
        {savedHistory.length > 0 && (
          <View>
            <View style={[r.sectionHeader, { borderColor: bdColor, marginBottom: 8 }]}>
              <Feather name="archive" size={12} color={COPPER} />
              <Text style={[r.sectionHeaderText, { color: isDark ? `${COPPER}99` : `${COPPER}CC` }]}>
                GEÇMİŞ RUTİNLER
              </Text>
            </View>
            {savedHistory.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.78}
                onPress={() => {
                  // ── ECZ-FINAL-QA-FIX-1 (PART C) ───────────────────────────
                  // SavedRoutine, görüntüleme amaçlı AnalysisResult'a sentezlenir.
                  // Eski kayıtlarda skor/comment yoksa nötr varsayılanlar
                  // kullanılır (sahte iddia içermez). Bundle, kayıt sırasında
                  // zaten save-gate'i geçmiş olduğu için view-only permissive
                  // olarak set edilir; aksi halde SAFE_FALLBACK_BUNDLE
                  // adımları minimal moda kırpar ve kullanıcı kayıtlı tüm
                  // rutini göremez.
                  const synthesized: AnalysisResult = {
                    id:        item.analysisId ?? item.id,
                    timestamp: item.createdAt,
                    skinType:  item.skinType ?? "Karma",
                    score:     75,
                    concerns:  Array.isArray(item.concerns) && item.concerns.length > 0
                                 ? item.concerns
                                 : ["Kayıtlı rutin görüntüleniyor"],
                    comment:   "Bu, daha önce kaydettiğiniz rutindir.",
                    morning:   item.morning ?? [],
                    evening:   item.evening ?? [],
                    weekly:    item.weekly ?? [],
                    products:  item.products ?? { ekonomik: [], profesyonel: [], seckin: [] },
                  };
                  // View-only mode: kayıtlı rutin açılışında SAHTE güven
                  // üretmeyiz. cannotDetermineFields'a "viewing_saved_routine"
                  // eklenir; routine-program save-gate bu sentineli görüp
                  // re-save'i engeller (bkz. routine-program handleSave).
                  // Eligibility "full" verilir ki sadece görüntüleme amacıyla
                  // kayıtlı tüm adımlar gösterilsin (SAFE_FALLBACK_BUNDLE
                  // adımları "minimal" moda kırpar). Skor/score iddiaları
                  // yapılmaz (synthesized.score nötr 75, comment Türkçe disclaimer).
                  const viewBundle: SkinScanContextBundle = {
                    ageGroup:                 "adult",
                    selectedConcerns:         [],
                    imageQualityScore:        0,
                    minImageQualityScore:     0,
                    poseComplianceScore:      0,
                    visualConfidence:         0,
                    detectedVisibleConcerns:  [],
                    contradictionWarnings:    [],
                    cannotDetermineFields:    ["viewing_saved_routine"],
                    riskMode:                 "normal",
                    resultReliabilityLevel:   "medium",
                    routineEligibility:       "full",
                    safetyMessages:           [],
                    computedAt:               new Date().toISOString(),
                    bundleVersion:            1,
                  };
                  resultStore.set(synthesized);
                  resultStore.setContextBundle(viewBundle);
                  router.push("/premium-skin-scan-v2/routine-program" as any);
                }}
                style={[r.historyCard, {
                  backgroundColor: sectionBg,
                  borderColor: bdColor,
                  marginBottom: 8,
                }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[r.historyTitle, { color: colors.text }]}>
                    {item.skinType ?? "Analiz Rutini"}
                  </Text>
                  <Text style={[r.historyMeta, { color: colors.textMuted }]}>
                    {new Date(item.createdAt).toLocaleDateString("tr-TR", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                    {"  ·  "}
                    {(item.morning?.length ?? 0) + (item.evening?.length ?? 0)} adım
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    openDeleteConfirm(item.id);
                  }}
                  style={[r.historyDeleteBtn, {
                    borderColor: isDark ? "rgba(220,50,50,0.28)" : "rgba(220,50,50,0.18)",
                    backgroundColor: isDark ? "rgba(220,50,50,0.07)" : "rgba(220,50,50,0.04)",
                  }]}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={15} color="#DC3232" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Step 2 — Bakım Profillerim (rutin VARKEN buraya iner) ──
              Aktif/kayıtlı rutin varsa profil kartları, rutin içeriğinin
              ve RUTİNLERİM listesinin ALTINDA destekleyici bilgi olarak
              gösterilir. Yukarıdaki `!hasAnyRoutine` branch'i ile mutually
              exclusive — runtime'da yalnızca biri render eder. */}
        {hasAnyRoutine && profileAwarenessNode}

      </ScrollView>

      {/* ── Silme Onay Modalı ─────────────────────────────────────────────── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
        statusBarTranslucent
      >
        <Pressable
          style={r.modalBackdrop}
          onPress={handleCancelDelete}
        >
          <Pressable style={[r.modalCard, {
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
          }]}>
            <View style={[r.modalIconWrap, {
              backgroundColor: isDark ? "rgba(220,50,50,0.12)" : "rgba(220,50,50,0.08)",
            }]}>
              <Feather name="trash-2" size={22} color="#DC3232" />
            </View>
            <Text style={[r.modalTitle, { color: colors.text }]}>
              {deleteTarget?.startsWith("profile:") ? "Profili sil" : "Rutini sil"}
            </Text>
            <Text style={[r.modalBody, { color: colors.textSecondary }]}>
              {deleteTarget === "active"
                ? "Bu rutini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
                : deleteTarget?.startsWith("profile:")
                ? "Bu bakım profilini silmek istediğinizden emin misiniz? Rutinleriniz ve ilerlemeniz korunur."
                : "Bu geçmiş rutini kalıcı olarak silmek istediğinizden emin misiniz?"}
            </Text>
            <View style={r.modalBtns}>
              <TouchableOpacity
                onPress={handleCancelDelete}
                style={[r.modalBtnCancel, { borderColor: isDark ? "rgba(255,255,255,0.15)" : "#E0DAD2" }]}
                activeOpacity={0.75}
                disabled={deleting}
              >
                <Text style={[r.modalBtnCancelTxt, { color: colors.textSecondary }]}>
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDelete}
                style={r.modalBtnDelete}
                activeOpacity={0.8}
                disabled={deleting}
              >
                <Text style={r.modalBtnDeleteTxt}>
                  {deleting ? "Siliniyor…" : "Sil"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── ECZ4 Step 5 — Yeniden Adlandırma Modalı ──────────────────────── */}
      <Modal
        visible={renameTargetId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!renaming) { setRenameTargetId(null); setRenameInputError(null); } }}
        statusBarTranslucent
      >
        <Pressable
          style={r.modalBackdrop}
          onPress={() => { if (!renaming) { setRenameTargetId(null); setRenameInputError(null); } }}
        >
          <Pressable style={[r.modalCard, {
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
          }]}>
            <View style={[r.modalIconWrap, {
              backgroundColor: isDark ? "rgba(122,143,107,0.15)" : "rgba(122,143,107,0.10)",
            }]}>
              <Feather name="type" size={20} color="#7A8F6B" />
            </View>
            <Text style={[r.modalTitle, { color: colors.text }]}>
              Rutinin adını değiştir
            </Text>
            <Text style={[r.modalBody, { color: colors.textSecondary }]}>
              Rutinim listende görünecek isim. Boş olamaz, en fazla {ROUTINE_TITLE_MAX_LEN} karakter.
            </Text>
            <View style={{ width: "100%", gap: 6 }}>
              <TextInput
                value={renameInputValue}
                onChangeText={(t) => {
                  setRenameInputValue(t);
                  if (renameInputError) setRenameInputError(null);
                }}
                placeholder="Rutin adı"
                placeholderTextColor={isDark ? "#6F6F6F" : "#A8A8A8"}
                maxLength={ROUTINE_TITLE_MAX_LEN}
                autoFocus
                returnKeyType="done"
                editable={!renaming}
                style={{
                  borderWidth: 1.2,
                  borderColor: renameInputError
                    ? "#DC3232"
                    : (isDark ? "rgba(255,255,255,0.15)" : "#D8D3CC"),
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
                  fontSize: 14, fontWeight: "600",
                  color: colors.text,
                  backgroundColor: isDark ? "#252525" : "#FAFAF8",
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{
                  fontSize: 11, fontWeight: "600",
                  color: renameInputError ? "#DC3232" : colors.textSecondary,
                  flex: 1,
                }}>
                  {renameInputError ?? " "}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>
                  {renameInputValue.trim().length}/{ROUTINE_TITLE_MAX_LEN}
                </Text>
              </View>
            </View>
            <View style={r.modalBtns}>
              <TouchableOpacity
                onPress={() => { setRenameTargetId(null); setRenameInputError(null); }}
                style={[r.modalBtnCancel, { borderColor: isDark ? "rgba(255,255,255,0.15)" : "#E0DAD2" }]}
                activeOpacity={0.75}
                disabled={renaming}
              >
                <Text style={[r.modalBtnCancelTxt, { color: colors.textSecondary }]}>
                  Vazgeç
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const id = renameTargetId;
                  if (!id) return;
                  const trimmed = renameInputValue.trim();
                  if (!trimmed) {
                    setRenameInputError("Rutin adı boş olamaz.");
                    return;
                  }
                  if (trimmed.length > ROUTINE_TITLE_MAX_LEN) {
                    setRenameInputError(`En fazla ${ROUTINE_TITLE_MAX_LEN} karakter olabilir.`);
                    return;
                  }
                  setRenaming(true);
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const ok = renameRoutine(id, trimmed);
                    if (!ok) {
                      // Race: rutin başka akıştan silinmiş olabilir.
                      await refreshRoutineCollection();
                      setRenameTargetId(null);
                      showToast("Rutin bulunamadı, liste yenilendi.");
                      return;
                    }
                    await refreshRoutineCollection();
                    // Primary'nin başlığı değiştiyse aktif rutin tüketicilerini
                    // tazele (Home modal başlığı dahil).
                    if (id === primaryRoutineId) {
                      await reload();
                    }
                    setRenameTargetId(null);
                    setRenameInputError(null);
                    showToast("Rutin adı güncellendi.");
                  } catch {
                    showToast("Bir hata oluştu, lütfen tekrar dene.");
                  } finally {
                    setRenaming(false);
                  }
                }}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: "#7A8F6B",
                  alignItems: "center",
                  opacity: renaming ? 0.6 : 1,
                }}
                activeOpacity={0.8}
                disabled={renaming}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#fff" }}>
                  {renaming ? "Kaydediliyor…" : "Kaydet"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[r.toast, {
            backgroundColor: isDark ? "#2A2A2A" : "#1C1C1E",
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }]}
        >
          <Feather name="check-circle" size={15} color="#7A8F6B" />
          <Text style={r.toastTxt}>{toastMsg}</Text>
        </Animated.View>
      )}

    </View>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const r = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, fontWeight: "600", marginTop: 2 },

  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
  },
  streakFire: { fontSize: 13 },
  streakNum:  { fontSize: 12, fontWeight: "700" },

  editBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  scroll:   { padding: 16, gap: 12 },

  section:  { borderRadius: 18, borderWidth: 1, padding: 16 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 4, paddingBottom: 2,
  },
  sectionHeaderText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8 },

  editLink: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, borderStyle: "dashed", padding: 14,
  },

  // Geçmiş rutin kartı
  historyCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  historyTitle: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  historyMeta:  { fontSize: 12, fontWeight: "600", marginTop: 3 },
  historyDeleteBtn: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginLeft: 10,
  },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width: "100%", borderRadius: 22,
    padding: 24, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  modalTitle:  { fontSize: 18, fontWeight: "800", letterSpacing: -0.4, marginBottom: 8 },
  modalBody:   { fontSize: 13.5, lineHeight: 20, textAlign: "center", marginBottom: 22 },
  modalBtns:   { flexDirection: "row", gap: 10, width: "100%" },
  modalBtnCancel: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: 13, alignItems: "center",
  },
  modalBtnCancelTxt: { fontSize: 14, fontWeight: "600" },
  modalBtnDelete: {
    flex: 1, borderRadius: 14,
    paddingVertical: 13, alignItems: "center",
    backgroundColor: "#DC3232",
  },
  modalBtnDeleteTxt: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  // Toast
  toast: {
    position: "absolute", bottom: 100, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastTxt: { fontSize: 13.5, fontWeight: "600", color: "#FFFFFF" },
});