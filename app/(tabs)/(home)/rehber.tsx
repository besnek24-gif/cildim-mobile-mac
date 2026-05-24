import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { FLOW_CONFIGS } from "@/lib/concernFlows";
import { setConcernProfile } from "@/lib/concernFlowStore";
import {
  markFlowStarted,
  updateFlowProgress,
  clearFlowRecord,
  getFlowRecord,
  FLOW_RECOVERY_META,
} from "@/lib/flowRecoveryStore";
// ECZ4 / FINAL-RUNTIME-TRUTH-AND-HARD-FIX — PART B:
// Eski dynamic import (`await import("@/lib/notificationService")`) Metro
// asyncRequire.importAll yolu ile chunk içindeki react-native barrel'in
// PushNotificationIOS getter'ını tetikleyip Expo Go'da
// "Cannot read property 'default' of undefined" crash'ine neden oluyordu.
// Çözüm: notificationService zaten pure no-op olduğundan STATİK import yap;
// asyncRequire path'i devreye girmesin. Ayrıca metro.config.js
// PushNotificationIOS ve expo-notifications için no-op stub aliası kurar.
import {
  scheduleFlowRecoveryNotification as _scheduleFlowRecoveryNotification,
  cancelFlowRecoveryNotification   as _cancelFlowRecoveryNotification,
} from "@/lib/notificationService";

function scheduleFlowRecoveryNotification(flowId: string, title: string, hours: number): void {
  try { void _scheduleFlowRecoveryNotification(flowId, title, hours); } catch { /* no-op */ }
}
function cancelFlowRecoveryNotification(flowId: string): void {
  try { void _cancelFlowRecoveryNotification(flowId); } catch { /* no-op */ }
}

const { width: SCREEN_W } = Dimensions.get("window");

function toTrUpper(s: string): string {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

export default function RehberScreen() {
  const { flow: flowId, resume } = useLocalSearchParams<{ flow: string; resume?: string }>();
  const { colorScheme } = useTheme();
  const { isRegistered } = useAuth();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom, ctaBarBottom } = useTabBarInset();

  // Ecz4 Defense-in-Depth — deep-link ile gelen misafiri /giris'e yönlendir
  useEffect(() => {
    if (!isRegistered) {
      router.replace("/giris" as any);
    }
  }, [isRegistered]);

  const config = flowId ? FLOW_CONFIGS[flowId] : undefined;

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Flow Recovery: başlatma & devam etme ────────────────────────────────────
  useEffect(() => {
    if (!flowId || !config) return;
    let cancelled = false;

    if (resume === "1") {
      // Kaydedilmiş ilerlemeyi geri yükle
      getFlowRecord(flowId).then(record => {
        if (cancelled || !record) return;
        setStepIndex(record.lastStepIndex);
        setAnswers(record.answersSnapshot);
      });
    } else {
      // Yeni başlangıç — kayıt yarat + bildirim planla
      markFlowStarted(flowId, config.steps.length);
      const meta = FLOW_RECOVERY_META[flowId];
      if (meta) {
        scheduleFlowRecoveryNotification(flowId, meta.title, 4);
      }
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!config) {
    return (
      <View style={[s.center, { backgroundColor: isDark ? "#141414" : "#FAFAF8" }]}>
        <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16 }}>Akış bulunamadı.</Text>
      </View>
    );
  }

  const steps = config.steps;
  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];
  const currentAnswers = answers[currentStep.id] ?? [];
  const canContinue = currentAnswers.length > 0;

  const accent = config.accentColor;
  const bg = isDark ? "#141414" : "#FAFAF8";
  const cardBg = isDark ? "#1C2535" : "#FFFFFF";
  const textPrimary = isDark ? "#F0F4F8" : "#111827";
  const textSecondary = isDark ? "#94A3B8" : "#6B7280";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const progressBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const animateTransition = (dir: "forward" | "back", callback: () => void) => {
    const toX = dir === "forward" ? -20 : 20;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: toX, useNativeDriver: true, speed: 30, bounciness: 0 }),
    ]).start(() => {
      callback();
      slideAnim.setValue(dir === "forward" ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ]).start();
    });
  };

  const toggleOption = useCallback((stepId: string, optId: string, allowMultiple: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => {
      const current = prev[stepId] ?? [];
      if (!allowMultiple) return { ...prev, [stepId]: [optId] };
      if (optId === "none") return { ...prev, [stepId]: ["none"] };
      const withoutNone = current.filter(x => x !== "none");
      if (withoutNone.includes(optId)) {
        const next = withoutNone.filter(x => x !== optId);
        return { ...prev, [stepId]: next };
      }
      return { ...prev, [stepId]: [...withoutNone, optId] };
    });
  }, []);

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (stepIndex < totalSteps - 1) {
      const nextStep = stepIndex + 1;
      updateFlowProgress(flowId, nextStep, answers); // Recovery takibi
      animateTransition("forward", () => setStepIndex(nextStep));
    } else {
      clearFlowRecord(flowId);                       // Tamamlandı — kaydı sil
      cancelFlowRecoveryNotification(flowId);        // Planlı bildirimi iptal et
      const profile = config.buildProfile(answers);
      setConcernProfile(config.id, profile);
      router.push(`/rehber-sonuc?flow=${config.id}` as any);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stepIndex === 0) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    } else {
      animateTransition("back", () => setStepIndex(i => i - 1));
    }
  };

  const progress = (stepIndex + 1) / totalSteps;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={textPrimary} />
        </Pressable>
        <Text style={[s.stepLabel, { color: textSecondary }]}>
          {stepIndex + 1} / {totalSteps}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress bar */}
      <View style={[s.progressTrack, { backgroundColor: progressBg }]}>
        <Animated.View
          style={[
            s.progressFill,
            { backgroundColor: accent, width: `${progress * 100}%` as any },
          ]}
        />
      </View>

      {/* Title (static) */}
      <View style={[s.titleBlock, { paddingHorizontal: 20 }]}>
        <Text style={[s.flowTitle, { color: accent }]}>{config.title}</Text>
      </View>

      {/* Question + Options (animated) */}
      <Animated.View
        style={[
          s.stepWrap,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        ]}
      >
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: scrollPaddingBottom(88) }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Question card */}
          <View style={[s.questionCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[s.questionText, { color: textPrimary }]}>{currentStep.question}</Text>
            {currentStep.subtitle && (
              <Text style={[s.questionSub, { color: textSecondary }]}>{currentStep.subtitle}</Text>
            )}
          </View>

          {/* Options */}
          <View style={s.optionsList}>
            {currentStep.options.map(opt => {
              const isSelected = currentAnswers.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggleOption(currentStep.id, opt.id, !!currentStep.allowMultiple)}
                  style={({ pressed }) => [
                    s.optionCard,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? `${accent}22` : `${accent}12`)
                        : cardBg,
                      borderColor: isSelected ? accent : borderColor,
                      borderWidth: isSelected ? 1.5 : 1,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <View style={[
                    s.optionRadio,
                    {
                      borderColor: isSelected ? accent : (isDark ? "#4B5563" : "#D1D5DB"),
                      backgroundColor: isSelected ? accent : "transparent",
                    },
                  ]}>
                    {isSelected && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={[s.optionText, { color: isSelected ? (isDark ? "#fff" : textPrimary) : textPrimary }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Bottom CTA — absolute so it's always visible on iOS */}
      <View
        style={[
          s.bottomBar,
          {
            backgroundColor: bg,
            borderTopColor: borderColor,
            paddingBottom: 14,
            bottom: ctaBarBottom,
          },
        ]}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => [
            s.ctaBtn,
            {
              backgroundColor: canContinue ? accent : (isDark ? "#2A3548" : "#E5E7EB"),
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Text style={[s.ctaText, { color: canContinue ? "#fff" : (isDark ? "#4B5563" : "#9CA3AF") }]}>
            {stepIndex < totalSteps - 1 ? "Devam Et" : "Sonuçları Gör"}
          </Text>
          <Feather name="arrow-right" size={16} color={canContinue ? "#fff" : (isDark ? "#4B5563" : "#9CA3AF")} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 12,
  },
  stepLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  progressTrack: {
    height: 4,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2 },
  titleBlock: { paddingTop: 16, paddingBottom: 4 },
  flowTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  stepWrap: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  questionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
    }),
  },
  questionText: { fontSize: 17, fontWeight: "700", lineHeight: 24, letterSpacing: -0.2 },
  questionSub: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  optionsList: { gap: 10 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" } as any,
    }),
  },
  optionRadio: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  optionText: { flex: 1, fontSize: 14.5, fontWeight: "500", lineHeight: 20 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  ctaText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.1 },
});