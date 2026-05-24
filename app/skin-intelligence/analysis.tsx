/**
 * Skin Intelligence — Analysis Screen
 * Layer 3: Hızlı + Derin paralel analiz.
 * Yüz fotoğrafı hafif blur, dönen progress mesajları, max 8-10s görünüm.
 */

import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { extractRoutineFromDeepResult, runDeepAnalysis, runQuickAnalysis } from "@/lib/skinIntelligence/api";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";

const STEPS = [
  "Cilt yüzeyi inceleniyor",
  "Ton dengesi analiz ediliyor",
  "Nem ve yağ dengesi ölçülüyor",
  "Şahsi rapor hazırlanıyor",
];

export default function AnalysisScreen() {
  const { top } = useSafeAreaInsets();
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const { getAuthHeaders } = useAuth();
  const startedRef = useRef(false);

  const [stepIdx, setStepIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.96)).current;

  const {
    scanPackage,
    analysisStatus,
    setAnalysisStatus,
    setQuickAnalysis,
    setDeepAnalysis,
    setAnalysisError,
    setRoutine,
    setStep,
  } = useSkinIntelligence((s) => ({
    scanPackage: s.scanPackage,
    analysisStatus: s.analysisStatus,
    setAnalysisStatus: s.setAnalysisStatus,
    setQuickAnalysis: s.setQuickAnalysis,
    setDeepAnalysis: s.setDeepAnalysis,
    setAnalysisError: s.setAnalysisError,
    setRoutine: s.setRoutine,
    setStep: s.setStep,
  }));

  // Step döngüsü
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setStepIdx((i) => (i + 1) % STEPS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Pulse animasyonu
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.96, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Analiz pipeline
  useEffect(() => {
    if (!scanPackage || startedRef.current) return;
    startedRef.current = true;
    runPipeline();
  }, [scanPackage]);

  const runPipeline = async () => {
    if (!scanPackage) return;
    const authHeaders = await getAuthHeaders();

    const ANGLE_MAP: Record<string, string> = {
      front: "ön", left: "sol 45°", right: "sağ 45°", up: "çene yukarı", down: "çene aşağı",
    };

    const frontFrame = scanPackage.frames.find((f) => f.angle === "front") ?? scanPackage.frames[0];
    const frontImage = frontFrame.compressedBase64 ?? `data:image/jpeg;base64,${frontFrame.base64}`;
    const images = scanPackage.frames.map((f) => f.compressedBase64 ?? `data:image/jpeg;base64,${f.base64}`);
    const angles = scanPackage.frames.map((f) => ANGLE_MAP[f.angle] ?? "ön");

    setAnalysisStatus("quick_pending");

    const quickPromise = runQuickAnalysis(frontImage, authHeaders);
    const deepPromise = runDeepAnalysis(images, angles, authHeaders);

    // Hızlı sonuç
    try {
      const quick = await quickPromise;
      if (quick) {
        setQuickAnalysis(quick);
        setStep("result");
        router.replace("/skin-intelligence/result");
      }
    } catch { /* derin devam ediyor */ }

    // Derin sonuç (arka planda)
    try {
      const deep = await deepPromise;
      if (!deep?.analiz) return;

      const raw = deep.analiz as any;
      const deepResult = {
        id: `deep-${Date.now()}`,
        scanId: scanPackage.id,
        createdAt: new Date().toISOString(),
        isQuickResult: false,
        skinType: raw.cilt_tipi ?? "normal",
        skinTone: raw.cilt_tonu ?? "orta",
        skinScore: raw.puan ?? 50,
        moistureLevel: raw.nem_seviyesi ?? 50,
        uvDamage: raw.uv_hasarı ?? "none",
        ageEstimate: raw.yas_tahmini,
        signals: (raw.concerns_structured ?? []).slice(0, 4).map((c: any) => ({
          key: c.key ?? String(Math.random()),
          title: c.title ?? "",
          severity: c.severity === "yüksek" ? "significant" : c.severity === "orta" ? "moderate" : "mild",
          confidence: "high" as const,
          zone: c.zone,
          description: c.explanation ?? "",
          careDirection: c.careDirection ?? "",
        })),
        strengths: (raw.strengths_structured ?? []).slice(0, 3).map((st: any) => ({
          key: st.key ?? String(Math.random()),
          title: st.title ?? "",
          description: st.description ?? "",
        })),
        summary: raw.analiz_ozeti ?? "",
        confidence: "high" as const,
        qualityWarning: undefined,
      };

      setDeepAnalysis(deepResult);

      if (deep.routine_tiered) {
        const routine = extractRoutineFromDeepResult(deep, deepResult.id);
        if (routine) setRoutine(routine);
      }

      router.replace("/skin-intelligence/result");
    } catch (err: any) {
      if (err?.message === "PREMIUM_REQUIRED") {
        if (!useSkinIntelligence.getState().analysis) {
          setAnalysisError("Bu özellik Seçkin üyelik gerektirir.");
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/");
          }
        }
      }
    }
  };

  const frontUri = scanPackage?.frames.find((f) => f.angle === "front")?.uri;

  return (
    <View style={[s.wrapper, { backgroundColor: isDark ? "#0A0A0A" : "#FAF8F5" }]}>
      {/* Merkez — blur yüz */}
      <View style={s.center}>
        <Animated.View style={[s.photoWrap, { transform: [{ scale: pulseAnim }] }]}>
          {frontUri ? (
            <>
              <Image source={{ uri: frontUri }} style={s.photo} contentFit="cover" />
              <BlurView
                intensity={22}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View style={[s.photoPlaceholder, { backgroundColor: colors.surfaceCard }]} />
          )}

          {/* Tarama çizgisi */}
          <Animated.View
            style={[
              s.scanLine,
              { backgroundColor: colors.primary, opacity: pulseAnim },
            ]}
          />
        </Animated.View>

        {/* Dinamik mesaj */}
        <Animated.Text
          style={[s.stepText, { color: colors.text, opacity: fadeAnim }]}
        >
          {STEPS[stepIdx]}
        </Animated.Text>

        <Text style={[s.subText, { color: colors.textMuted }]}>
          İlk sonuçlar birkaç saniye içinde hazır
        </Text>
      </View>
    </View>
  );
}

const PHOTO_SIZE = 200;

const s = StyleSheet.create({
  wrapper:         { flex: 1, alignItems: "center", justifyContent: "center" },
  center:          { alignItems: "center", gap: 28 },
  photoWrap:       { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, overflow: "hidden", position: "relative" },
  photo:           { width: PHOTO_SIZE, height: PHOTO_SIZE },
  photoPlaceholder:{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 },
  scanLine:        { position: "absolute", left: 0, right: 0, height: 2, top: "50%" },
  stepText:        { fontSize: 18, fontWeight: "600", textAlign: "center" },
  subText:         { fontSize: 13, textAlign: "center" },
});