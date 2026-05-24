/**
 * Skin Intelligence — Capture Screen
 * Phase A "live"   → Tam ekran kamera, dairesel yüz çerçevesi, canlı uyarılar
 * Phase B "review" → 5 çekim dairesel orbit düzeni, "Analize Başla" CTA
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "@/local_demo_data/safe_runtime_shims_v74";
import Svg, { Ellipse } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";
import { evaluateScanPackage, scoreCapture } from "@/lib/skinIntelligence/captureGuard";
import type { AngleId, CaptureFrame } from "@/lib/skinIntelligence/types";
import { ANGLE_LABEL, ANGLE_ORDER } from "@/lib/skinIntelligence/types";

type Phase = "live" | "review";

const ANGLE_INSTRUCTION: Record<AngleId, string> = {
  front: "Düz bakın",
  left:  "Sola 45° dönün",
  right: "Sağa 45° dönün",
  up:    "Çenenizi kaldırın",
  down:  "Çenenizi indirin",
};

// Orbit pozisyonları (merkez = ön, diğerleri etrafında)
const ORBIT_POSITIONS: Record<AngleId, { dx: number; dy: number }> = {
  front: { dx: 0,    dy: 0 },
  left:  { dx: -110, dy: -40 },
  right: { dx: 110,  dy: -40 },
  up:    { dx: 0,    dy: -120 },
  down:  { dx: 0,    dy: 100 },
};

const genId = () => `si-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function CaptureScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("live");
  const [capturing, setCapturing] = useState(false);
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);

  // Canlı uyarı state
  const [warning, setWarning] = useState<string | null>(null);

  // Orbit hareketi animasyonu (review aşaması)
  const orbitAnim = useRef(new Animated.Value(0)).current;

  const {
    addFrame, frames, setScanPackage, setStep,
  } = useSkinIntelligence((s) => ({
    addFrame: s.addFrame,
    frames: s.frames,
    setScanPackage: s.setScanPackage,
    setStep: s.setStep,
  }));

  const currentAngle: AngleId = ANGLE_ORDER[currentAngleIdx];
  const capturedAngles = frames.map((f) => f.angle);
  const allCaptured = ANGLE_ORDER.every((a) => capturedAngles.includes(a));

  // Review'da yavaş orbit animasyonu
  useEffect(() => {
    if (phase !== "review") return;
    Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    ).start();
  }, [phase]);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setWarning(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.80,
        skipProcessing: true,
      });

      if (!photo?.base64 || !photo.uri) return;

      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const quality = scoreCapture({ width: photo.width ?? 800, height: photo.height ?? 1000 });

      if (quality.blockAnalysis) {
        setWarning(quality.blockReason ?? "Kare geçersiz — tekrar deneyin");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const frame: CaptureFrame = {
        angle: currentAngle,
        uri: photo.uri,
        base64: photo.base64,
        compressedBase64: `data:image/jpeg;base64,${compressed.base64 ?? photo.base64}`,
        quality,
        capturedAt: new Date().toISOString(),
      };

      addFrame(frame);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (currentAngleIdx < ANGLE_ORDER.length - 1) {
        setTimeout(() => setCurrentAngleIdx((i) => i + 1), 400);
      } else {
        // Tüm açılar tamamlandı → review
        setTimeout(() => setPhase("review"), 400);
      }
    } finally {
      setCapturing(false);
    }
  };

  const handleProceed = () => {
    const evaluation = evaluateScanPackage(frames);

    setScanPackage({
      id: genId(),
      frames,
      overallQuality: evaluation.overallScore,
      isReadyForAnalysis: evaluation.isReadyForAnalysis,
      createdAt: new Date().toISOString(),
    });

    if (!evaluation.isReadyForAnalysis) {
      setWarning(evaluation.warnings[0] ?? "Bazı kareler yetersiz kalitede.");
      return;
    }

    setStep("analysis_quick");
    router.push("/skin-intelligence/analysis");
  };

  // ── İzin ekranı ────────────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={[s.permBox, { backgroundColor: colors.background, paddingTop: top }]}>
        <Feather name="camera-off" size={36} color={colors.textMuted} />
        <Text style={[s.permTitle, { color: colors.text }]}>Kamera izni gerekli</Text>
        <Text style={[s.permBody, { color: colors.textSecondary }]}>
          Bakım profili için kameraya erişim izni verin.
        </Text>
        <TouchableOpacity
          style={[s.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={s.permBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE B: REVIEW — dairesel orbit
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "review") {
    const orbitRotate = orbitAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    return (
      <View style={[s.wrapper, { backgroundColor: isDark ? "#0A0A0A" : "#FAF8F5" }]}>
        {/* Başlık */}
        <View style={[s.topBar, { paddingTop: top + 12 }]}>
          <TouchableOpacity onPress={() => setPhase("live")}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.topTitle, { color: colors.text }]}>Tarama Hazır</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Orbit düzeni */}
        <View style={s.orbitArea}>
          {/* Yavaş dönen dış orbit ring */}
          <Animated.View
            style={[
              s.orbitRing,
              { borderColor: `${colors.primary}20`, transform: [{ rotate: orbitRotate }] },
            ]}
          />

          {/* Merkez (ön yüz) */}
          {(() => {
            const frontFrame = frames.find((f) => f.angle === "front");
            return (
              <View style={[s.orbitCenter]}>
                {frontFrame ? (
                  <Image source={{ uri: frontFrame.uri }} style={s.orbitCenterImg} contentFit="cover" />
                ) : (
                  <View style={[s.orbitCenterImg, { backgroundColor: colors.surfaceCard }]} />
                )}
              </View>
            );
          })()}

          {/* Çevre görseller */}
          {ANGLE_ORDER.filter((a) => a !== "front").map((angle) => {
            const frame = frames.find((f) => f.angle === angle);
            const pos = ORBIT_POSITIONS[angle];
            const done = !!frame;

            return (
              <View
                key={angle}
                style={[
                  s.orbitThumb,
                  {
                    transform: [
                      { translateX: pos.dx },
                      { translateY: pos.dy },
                    ],
                    borderColor: done ? colors.primary : colors.borderLight,
                    opacity: done ? 1 : 0.4,
                  },
                ]}
              >
                {frame ? (
                  <Image source={{ uri: frame.uri }} style={s.orbitThumbImg} contentFit="cover" />
                ) : (
                  <View style={[s.orbitThumbImg, { backgroundColor: colors.surfaceCard }]} />
                )}
                {done && (
                  <View style={[s.checkBadge, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={8} color="#fff" />
                  </View>
                )}
                {/* Kalite skoru */}
                {frame && (
                  <View style={[s.qualityBadge, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
                    <Text style={s.qualityText}>{frame.quality.score}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Açı özeti */}
        <View style={s.angleChips}>
          {ANGLE_ORDER.map((a) => {
            const done = capturedAngles.includes(a);
            return (
              <View
                key={a}
                style={[
                  s.angleChip,
                  {
                    backgroundColor: done ? `${colors.primary}18` : colors.surfaceCard,
                    borderColor: done ? colors.primary : colors.borderLight,
                  },
                ]}
              >
                {done && <Feather name="check" size={10} color={colors.primary} />}
                <Text style={[s.angleChipText, { color: done ? colors.primary : colors.textMuted }]}>
                  {ANGLE_LABEL[a]}
                </Text>
              </View>
            );
          })}
        </View>

        {warning ? (
          <Text style={[s.warningText, { color: "#EF4444" }]}>{warning}</Text>
        ) : null}

        {/* CTA */}
        <View style={[s.ctaArea, { paddingBottom: bottom + 24 }]}>
          <TouchableOpacity
            style={[
              s.proceedBtn,
              { backgroundColor: allCaptured ? colors.primary : colors.border },
            ]}
            onPress={allCaptured ? handleProceed : undefined}
            disabled={!allCaptured}
            activeOpacity={0.82}
          >
            <Text style={[s.proceedBtnText, { color: allCaptured ? "#fff" : colors.textMuted }]}>
              Analize Başla
            </Text>
            <Feather name="arrow-right" size={18} color={allCaptured ? "#fff" : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE A: LIVE CAPTURE
  // ─────────────────────────────────────────────────────────────────────────
  const currentCaptured = capturedAngles.includes(currentAngle);

  return (
    <View style={s.wrapper}>
      {/* Tam ekran kamera */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      {/* Karanlık overlay (üst & alt) */}
      <View style={[StyleSheet.absoluteFill, s.overlayShield]} pointerEvents="none" />

      {/* ── Üst çubuk ────────────────────────────────────────────────────── */}
      <View style={[s.liveTopBar, { paddingTop: top + 12 }]}>
        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          style={s.liveBackBtn}
          hitSlop={12}
        >
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>

        {/* İndikatörler */}
        <View style={s.indicators}>
          <View style={[s.indicator, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
            <View style={[s.indicatorDot, { backgroundColor: "#4ADE80" }]} />
            <Text style={s.indicatorText}>Işık İyi</Text>
          </View>
          <View style={[s.indicator, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
            <View style={[s.indicatorDot, { backgroundColor: "#4ADE80" }]} />
            <Text style={s.indicatorText}>Yüz Ortada</Text>
          </View>
        </View>

        {/* Açı sayacı */}
        <View style={[s.anglePill, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
          <Text style={s.anglePillText}>{currentAngleIdx + 1}/{ANGLE_ORDER.length}</Text>
        </View>
      </View>

      {/* ── Dairesel yüz kılavuzu (SVG oval) ────────────────────────────── */}
      <View style={s.ovalWrap} pointerEvents="none">
        <Svg width={220} height={280}>
          <Ellipse
            cx={110} cy={140} rx={100} ry={132}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={2.5}
            fill="none"
            strokeDasharray="8 5"
          />
        </Svg>

        {/* Açı yönergesi */}
        <View style={[s.instructionBox, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <Text style={s.instructionText}>{ANGLE_INSTRUCTION[currentAngle]}</Text>
        </View>
      </View>

      {/* ── Canlı uyarı ──────────────────────────────────────────────────── */}
      {warning ? (
        <View style={[s.warningBanner, { backgroundColor: "rgba(239,68,68,0.85)" }]}>
          <Feather name="alert-circle" size={14} color="#fff" />
          <Text style={s.warningBannerText}>{warning}</Text>
        </View>
      ) : null}

      {/* ── Alt çubuk ────────────────────────────────────────────────────── */}
      <View style={[s.liveBottomBar, { paddingBottom: bottom + 20 }]}>
        {/* Açı ilerleme noktaları */}
        <View style={s.angleDots}>
          {ANGLE_ORDER.map((a) => (
            <View
              key={a}
              style={[
                s.angleDot,
                capturedAngles.includes(a) && s.angleDotDone,
                a === currentAngle && !capturedAngles.includes(a) && s.angleDotActive,
              ]}
            />
          ))}
        </View>

        {/* Açı etiketi */}
        <Text style={s.angleLabel}>{ANGLE_LABEL[currentAngle]}</Text>

        {/* Çekim butonu */}
        <TouchableOpacity
          style={[
            s.shutterBtn,
            currentCaptured && { borderColor: colors.primary },
            capturing && s.shutterDisabled,
          ]}
          onPress={handleCapture}
          disabled={capturing}
          activeOpacity={0.8}
        >
          <View style={[s.shutterInner, currentCaptured && { backgroundColor: colors.primary }]} />
        </TouchableOpacity>

        {/* "Tüm açıları gözden geçir" kısa yol */}
        {capturedAngles.length > 0 && (
          <TouchableOpacity onPress={() => setPhase("review")} hitSlop={10}>
            <Text style={s.reviewLink}>Gözden geçir</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const SHUTTER = 72;
const ORBIT_CENTER_SIZE = 110;
const ORBIT_THUMB_SIZE  = 64;

const s = StyleSheet.create({
  wrapper:          { flex: 1, backgroundColor: "#000" },
  permBox:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  permTitle:        { fontSize: 18, fontWeight: "700" },
  permBody:         { fontSize: 14, textAlign: "center" },
  permBtn:          { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 8 },
  permBtnText:      { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Live overlay
  overlayShield:    { backgroundColor: "transparent" },

  // Live top bar
  liveTopBar:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, zIndex: 20 },
  liveBackBtn:      { padding: 4 },
  indicators:       { flexDirection: "row", gap: 8 },
  indicator:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  indicatorDot:     { width: 7, height: 7, borderRadius: 3.5 },
  indicatorText:    { color: "#fff", fontSize: 12, fontWeight: "500" },
  anglePill:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  anglePillText:    { color: "#fff", fontSize: 12, fontWeight: "600" },

  // Oval guide
  ovalWrap:         { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", gap: 14, zIndex: 10 },
  instructionBox:   { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  instructionText:  { color: "#fff", fontSize: 14, fontWeight: "500" },

  // Live warning
  warningBanner:    { position: "absolute", top: "42%", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, zIndex: 30 },
  warningBannerText:{ color: "#fff", fontSize: 13, fontWeight: "600" },
  warningText:      { textAlign: "center", fontSize: 13, fontWeight: "500", paddingHorizontal: 24 },

  // Live bottom bar
  liveBottomBar:    { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", gap: 12, zIndex: 20 },
  angleDots:        { flexDirection: "row", gap: 8 },
  angleDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.35)" },
  angleDotDone:     { backgroundColor: "#7A8F6B" },
  angleDotActive:   { backgroundColor: "#fff", width: 20 },
  angleLabel:       { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
  shutterBtn:       { width: SHUTTER, height: SHUTTER, borderRadius: SHUTTER / 2, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner:     { width: SHUTTER - 18, height: SHUTTER - 18, borderRadius: (SHUTTER - 18) / 2, backgroundColor: "#fff" },
  shutterDisabled:  { opacity: 0.5 },
  reviewLink:       { color: "rgba(255,255,255,0.6)", fontSize: 13, textDecorationLine: "underline" },

  // Review (orbit) phase
  topBar:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 8 },
  topTitle:         { fontSize: 17, fontWeight: "700" },
  orbitArea:        { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  orbitRing:        { position: "absolute", width: 250, height: 250, borderRadius: 125, borderWidth: 1 },
  orbitCenter:      { width: ORBIT_CENTER_SIZE, height: ORBIT_CENTER_SIZE, borderRadius: ORBIT_CENTER_SIZE / 2, overflow: "hidden", zIndex: 10 },
  orbitCenterImg:   { width: ORBIT_CENTER_SIZE, height: ORBIT_CENTER_SIZE, borderRadius: ORBIT_CENTER_SIZE / 2 },
  orbitThumb:       { position: "absolute", width: ORBIT_THUMB_SIZE, height: ORBIT_THUMB_SIZE, borderRadius: ORBIT_THUMB_SIZE / 2, overflow: "hidden", borderWidth: 2 },
  orbitThumbImg:    { width: ORBIT_THUMB_SIZE, height: ORBIT_THUMB_SIZE },
  checkBadge:       { position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qualityBadge:     { position: "absolute", top: 2, left: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  qualityText:      { color: "#fff", fontSize: 9, fontWeight: "700" },
  angleChips:       { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 20, justifyContent: "center", paddingBottom: 12 },
  angleChip:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  angleChipText:    { fontSize: 12, fontWeight: "500" },
  ctaArea:          { paddingHorizontal: 20 },
  proceedBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16 },
  proceedBtnText:   { fontSize: 17, fontWeight: "700" },
});