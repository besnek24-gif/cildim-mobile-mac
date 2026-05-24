/**
 * cilt-analizi.tsx
 * Premium çok açılı cilt analizi — ön, sol 45°, sağ 45° yakalama + Claude AI analizi
 */
import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "@/local_demo_data/safe_runtime_shims_v74";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Defs, Ellipse, Mask, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScoreRing } from "@/components/ScoreRing";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import type {
  CaptureItem,
  MultiAngleSkinResult,
  PharmacistIntelligence,
  RoutineStep,
  SkinConcern,
  TieredRoutine,
} from "@/lib/skinAnalysis/skinAnalysisTypes";
import { mapAnalysisToRoutineConcerns } from "@/lib/skinAnalysis/analysisToRoutineMapper";
import { addStep, clearAllSteps } from "@/lib/routineStore";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";
const { width: W } = Dimensions.get("window");

type Stage =
  | "intro"
  | "prep"
  | "capture_front"
  | "capture_left"
  | "capture_right"
  | "capture_up"
  | "capture_down"
  | "review"
  | "processing"
  | "results"
  | "failed";

const ANGLE_CONFIGS = [
  {
    stage: "capture_front" as Stage,
    angle: "front" as const,
    label: "Düz",
    step: 1,
    instruction: "Düz bak",
    hint: "Yüzün oval içinde tam ortada dursun",
    icon: "user" as const,
    correctionHint: "Yüzünü merkeze al",
  },
  {
    stage: "capture_left" as Stage,
    angle: "left" as const,
    label: "Sol",
    step: 2,
    instruction: "Biraz sola dön",
    hint: "Sol yanağın kameraya yönsün",
    icon: "chevron-left" as const,
    correctionHint: "Biraz daha sola dön",
  },
  {
    stage: "capture_right" as Stage,
    angle: "right" as const,
    label: "Sağ",
    step: 3,
    instruction: "Biraz sağa dön",
    hint: "Sağ yanağın kameraya yönsün",
    icon: "chevron-right" as const,
    correctionHint: "Biraz daha sağa dön",
  },
  {
    stage: "capture_up" as Stage,
    angle: "up" as const,
    label: "Yukarı",
    step: 4,
    instruction: "Çeneni hafif kaldır",
    hint: "Boğazın hafifçe görünsün",
    icon: "arrow-up" as const,
    correctionHint: "Çeneni biraz daha kaldır",
  },
  {
    stage: "capture_down" as Stage,
    angle: "down" as const,
    label: "Aşağı",
    step: 5,
    instruction: "Çeneni hafif indir",
    hint: "Alnın ön planda kalsın",
    icon: "arrow-down" as const,
    correctionHint: "Çeneni biraz daha indir",
  },
];

const PROCESS_LINES = [
  "Cilt yüzeyi taranıyor",
  "Ton dağılımı okunuyor",
  "Gözenek görünümü değerlendiriliyor",
  "Hassasiyet sinyalleri ayrıştırılıyor",
  "Şahsi rapor hazırlanıyor",
];

// ─── Guided-phase system ──────────────────────────────────────────────────────
type GuidedPhase = "position" | "scanning" | "ready";

const PHASE_INSTR: Record<string, Record<GuidedPhase, { main: string; hint: string }>> = {
  front: {
    position: { main: "Düz bak",         hint: "Yüzünü oval içine al" },
    scanning: { main: "Hareketsiz dur",  hint: "Cilt yüzeyi analiz ediliyor..." },
    ready:    { main: "Hazır!",           hint: "Çekiliyor..." },
  },
  left: {
    position: { main: "Biraz sola dön",  hint: "Sol yanağın kameraya yönsün" },
    scanning: { main: "Hareketsiz dur",  hint: "Sol yanak taranıyor..." },
    ready:    { main: "Hazır!",           hint: "Çekiliyor..." },
  },
  right: {
    position: { main: "Biraz sağa dön", hint: "Sağ yanağın kameraya yönsün" },
    scanning: { main: "Hareketsiz dur",  hint: "Sağ yanak taranıyor..." },
    ready:    { main: "Hazır!",           hint: "Çekiliyor..." },
  },
  up: {
    position: { main: "Çeneni kaldır",   hint: "Boğazın hafifçe görünsün" },
    scanning: { main: "Hareketsiz dur",  hint: "Alt bölge taranıyor..." },
    ready:    { main: "Hazır!",           hint: "Çekiliyor..." },
  },
  down: {
    position: { main: "Çeneni indir",    hint: "Alnın ön planda kalsın" },
    scanning: { main: "Hareketsiz dur",  hint: "Üst bölge taranıyor..." },
    ready:    { main: "Hazır!",           hint: "Çekiliyor..." },
  },
};

// Anatomy glow dot positions (relative factors of oval rx/ry)
const GLOW_DOTS = [
  { rx: 0,      ry: -0.62, delay: 0   }, // forehead
  { rx: 0,      ry: -0.05, delay: 300 }, // nose bridge
  { rx: -0.62,  ry:  0.10, delay: 600 }, // left cheek
  { rx:  0.62,  ry:  0.10, delay: 150 }, // right cheek
  { rx: 0,      ry:  0.65, delay: 450 }, // chin
];

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  düşük:  { bg: "#EEF2EA", text: "#4A6040", label: "Hafif" },
  orta:   { bg: "#FEF3C7", text: "#92400E", label: "Orta" },
  yüksek: { bg: "#FEE2E2", text: "#991B1B", label: "Belirgin" },
};

const NAV_COLORS: [string, string] = ["#7A8F6B", "#5C7050"];

// ─── FaceOvalOverlay ──────────────────────────────────────────────────────────
function FaceOvalOverlay({
  width, height, angle, phase,
}: {
  width: number; height: number; angle: string; phase?: GuidedPhase;
}) {
  const cx     = width / 2;
  const cy     = height * 0.43;
  const rx     = width * 0.37;
  const ry     = height * 0.31;
  const ox     = angle === "left" ? -width * 0.05 : angle === "right" ? width * 0.05 : 0;
  const border = phase === "ready"    ? "rgba(122,143,107,0.95)"
               : phase === "scanning" ? "rgba(157,184,141,0.80)"
               : "rgba(255,255,255,0.65)";

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Mask id="face-mask">
          <Rect width={width} height={height} fill="white" />
          <Ellipse cx={cx + ox} cy={cy} rx={rx} ry={ry} fill="black" />
        </Mask>
      </Defs>
      <Rect width={width} height={height} fill="rgba(0,0,0,0.50)" mask="url(#face-mask)" />
      {/* outer glow ring when ready */}
      {phase === "ready" && (
        <Ellipse cx={cx + ox} cy={cy} rx={rx + 4} ry={ry + 4}
          fill="none" stroke="rgba(122,143,107,0.25)" strokeWidth={9} />
      )}
      {/* main oval border */}
      <Ellipse cx={cx + ox} cy={cy} rx={rx} ry={ry}
        fill="none" stroke={border} strokeWidth={2} />
    </Svg>
  );
}

// ─── ScanLineOverlay ──────────────────────────────────────────────────────────
function ScanLineOverlay({
  camW, camH, angle, active,
}: {
  camW: number; camH: number; angle: string; active: boolean;
}) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  const ox      = angle === "left" ? -camW * 0.05 : angle === "right" ? camW * 0.05 : 0;
  const rx      = camW * 0.37;
  const ovalTop = camH * 0.43 - camH * 0.31;
  const ovalH   = camH * 0.31 * 2;
  const lineL   = camW / 2 + ox - rx + 10;
  const lineW   = rx * 2 - 20;

  useEffect(() => {
    if (!active) {
      Animated.timing(opacAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      return;
    }
    scanAnim.setValue(0);
    Animated.timing(opacAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        Animated.delay(120),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const translateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, ovalH - 2] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: opacAnim }]}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          position:        "absolute",
          top:             ovalTop,
          left:            lineL,
          width:           lineW,
          height:          2,
          borderRadius:    1,
          backgroundColor: "rgba(122,143,107,0.9)",
          shadowColor:     "#7A8F6B",
          shadowOpacity:   0.9,
          shadowRadius:    8,
          shadowOffset:    { width: 0, height: 0 },
          transform:       [{ translateY }],
        }}
      />
    </Animated.View>
  );
}

// ─── GlowDot ──────────────────────────────────────────────────────────────────
function GlowDot({
  camW, camH, angle, rx: relRx, ry: relRy, delay: initDelay, active,
}: {
  camW: number; camH: number; angle: string;
  rx: number;   ry: number;   delay: number;  active: boolean;
}) {
  const pulse = useRef(new Animated.Value(0.15)).current;

  const ox     = angle === "left" ? -camW * 0.05 : angle === "right" ? camW * 0.05 : 0;
  const cx     = camW / 2 + ox;
  const cy     = camH * 0.43;
  const ovalRx = camW * 0.37;
  const ovalRy = camH * 0.31;
  const dotX   = cx + relRx * ovalRx - 5;
  const dotY   = cy + relRy * ovalRy - 5;

  useEffect(() => {
    if (!active) {
      Animated.timing(pulse, { toValue: 0.15, duration: 300, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(initDelay),
        Animated.timing(pulse, { toValue: 0.85, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.15, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:        "absolute",
        left:            dotX,
        top:             dotY,
        width:           10,
        height:          10,
        borderRadius:    5,
        backgroundColor: "#9DB88D",
        opacity:         pulse,
        shadowColor:     "#7A8F6B",
        shadowOpacity:   0.9,
        shadowRadius:    6,
        shadowOffset:    { width: 0, height: 0 },
      }}
    />
  );
}

// ─── SegmentedArc ─────────────────────────────────────────────────────────────
function SegmentedArc({ done, current, total: totalOverride }: { done: number; current: number; total?: number }) {
  const SIZE   = 60;
  const R      = 24;
  const cx     = SIZE / 2;
  const cy     = SIZE / 2;
  const total  = totalOverride ?? 5;
  const gapDeg = 8;
  const segDeg = (360 - total * gapDeg) / total;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (startDeg: number, spanDeg: number) => {
    const s  = toRad(startDeg - 90);
    const e  = toRad(startDeg + spanDeg - 90);
    const x1 = cx + R * Math.cos(s);
    const y1 = cy + R * Math.sin(s);
    const x2 = cx + R * Math.cos(e);
    const y2 = cy + R * Math.sin(e);
    const lg = spanDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const segments = Array.from({ length: total }, (_, i) => ({
    d:     arcPath(i * (segDeg + gapDeg), segDeg),
    color: i < done   ? "#7A8F6B"
         : i === done ? "#ffffff"
         : "rgba(255,255,255,0.22)",
  }));

  return (
    <Svg width={SIZE} height={SIZE}>
      {segments.map((seg, i) => (
        <Path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={3} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

// ─── IntroScreen ──────────────────────────────────────────────────────────────
function IntroScreen({ onStart, isSeckin }: { onStart: () => void; isSeckin: boolean }) {
  const colors = useColors();
  return (
    <ScrollView contentContainerStyle={is.scroll} showsVerticalScrollIndicator={false}>
      <View style={is.heroBox}>
        <LinearGradient colors={["#7A8F6B", "#9BA88C"]} style={is.heroBg} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
          <View style={is.heroIconRing}>
            <Feather name="aperture" size={32} color="#fff" />
          </View>
        </LinearGradient>
      </View>

      <Text style={[is.title, { color: colors.text }]}>Çok Açılı Cilt Analizi</Text>
      <Text style={[is.subtitle, { color: colors.textMuted }]}>
        5 farklı açıdan otomatik çekilen görüntüler, AI destekli derin analiz ile birleştirilerek size özel kapsamlı bir cilt raporu hazırlanır.
      </Text>

      <View style={is.angleRow}>
        {ANGLE_CONFIGS.map((cfg) => (
          <View key={cfg.angle} style={[is.anglePill, { backgroundColor: `${colors.primary}14` }]}>
            <Text style={[is.anglePillNum, { color: colors.primary }]}>{cfg.step}</Text>
            <Text style={[is.anglePillLabel, { color: colors.text }]}>{cfg.label}</Text>
          </View>
        ))}
      </View>

      <View style={[is.benefitBox, { backgroundColor: colors.surfaceCard, borderColor: `${colors.primary}22` }]}>
        {[
          { icon: "zap" as const, text: "Gözenek, ton ve kuruluk görünümü" },
          { icon: "shield" as const, text: "Hassasiyet ve bariyer sinyalleri" },
          { icon: "star" as const, text: "Güçlü yönler ve şahsi bakım yönü" },
        ].map((b) => (
          <View key={b.icon} style={is.benefitRow}>
            <Feather name={b.icon} size={15} color={colors.primary} />
            <Text style={[is.benefitText, { color: colors.text }]}>{b.text}</Text>
          </View>
        ))}
      </View>

      {isSeckin ? (
        <TouchableOpacity style={is.btn} onPress={onStart} activeOpacity={0.85}>
          <LinearGradient colors={NAV_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={is.btnGrad}>
            <Text style={is.btnText}>Analizi Başlat</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={[is.lockBox, { backgroundColor: "#FFF8F0", borderColor: "#C5974C40" }]}>
          <Ionicons name="lock-closed" size={20} color="#B87333" />
          <View style={{ flex: 1 }}>
            <Text style={is.lockTitle}>Seçkin üyeliğe özel</Text>
            <Text style={is.lockDesc}>Cilt analizi yalnızca Seçkin üyeler için aktiftir.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/uyelik" as any)} style={is.lockBtn}>
            <Text style={is.lockBtnText}>Yükselt</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[is.footnote, { color: colors.textMuted }]}>
        Sonuçlar klinik tanı niteliği taşımaz. Yalnızca genel bilgilendirme amaçlıdır.
      </Text>
    </ScrollView>
  );
}

// ─── PrepScreen ───────────────────────────────────────────────────────────────
const PREP_TIPS = [
  { icon: "sun" as const, title: "Dengeli Işık", desc: "Yüzünüzün her yanı eşit aydınlık olsun. Pencere ışığı veya yumuşak oda ışığı idealdir." },
  { icon: "crosshair" as const, title: "Yüz Merkezi", desc: "Kamerayı göz hizasında tutun, yüzünüz oval rehberin içinde tam ortada dursun." },
  { icon: "eye-off" as const, title: "Engeli Kaldırın", desc: "Gözlük ve yoğun makyajı mümkünse çıkarın. Yüzünüz net ve açık görünsün." },
];

function PrepScreen({ onStart, colors }: { onStart: () => void | Promise<void>; colors: any }) {
  return (
    <ScrollView contentContainerStyle={prep.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[prep.title, { color: colors.text }]}>Çekime hazırlanın</Text>
      <Text style={[prep.subtitle, { color: colors.textMuted }]}>
        Aşağıdaki ipuçlarını uygulayarak analiz kalitesini artırın.
      </Text>

      {PREP_TIPS.map((tip) => (
        <View key={tip.icon} style={[prep.tipCard, { backgroundColor: colors.surfaceCard }]}>
          <View style={[prep.tipIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name={tip.icon} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[prep.tipTitle, { color: colors.text }]}>{tip.title}</Text>
            <Text style={[prep.tipDesc, { color: colors.textMuted }]}>{tip.desc}</Text>
          </View>
        </View>
      ))}

      <View style={[prep.stepsBox, { backgroundColor: `${colors.primary}10` }]}>
        <Text style={[prep.stepsLabel, { color: colors.text }]}>Çekim sırası</Text>
        <View style={prep.stepsRow}>
          {ANGLE_CONFIGS.map((cfg) => (
            <View key={cfg.angle} style={prep.stepItem}>
              <View style={[prep.stepCircle, { backgroundColor: colors.primary }]}>
                <Text style={prep.stepNum}>{cfg.step}</Text>
              </View>
              <Text style={[prep.stepLabel, { color: colors.text }]}>{cfg.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={prep.btn} onPress={onStart} activeOpacity={0.85}>
        <LinearGradient colors={NAV_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={prep.btnGrad}>
          <Feather name="camera" size={16} color="#fff" />
          <Text style={prep.btnText}>Çekime Başla</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── CaptureScreen ────────────────────────────────────────────────────────────
type CaptureState = "live" | "validating" | "validated" | "auto_accepting";

interface CaptureScreenProps {
  cfg: typeof ANGLE_CONFIGS[0];
  doneCount: number;
  onCapture: (item: CaptureItem) => void;
  colors: any;
  cameraPermission: { granted: boolean } | null;
  onRequestPermission: () => Promise<any>;
}

function CaptureScreen({ cfg, doneCount, onCapture, colors, cameraPermission, onRequestPermission }: CaptureScreenProps) {
  const cameraRef    = useRef<CameraView | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>("live");
  const [pendingItem, setPendingItem]   = useState<CaptureItem | null>(null);
  const [qualityScore, setQualityScore] = useState(0);
  const [guidedPhase, setGuidedPhase]   = useState<GuidedPhase>("position");
  const [countdown, setCountdown]       = useState<number | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAllTimers = () => { timerRefs.current.forEach(clearTimeout); timerRefs.current = []; };
  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timerRefs.current.push(id);
    return id;
  };

  // Animation refs
  const card1        = useRef(new Animated.Value(0)).current;
  const card2        = useRef(new Animated.Value(0)).current;
  const card3        = useRef(new Animated.Value(0)).current;
  const scoreReveal  = useRef(new Animated.Value(0)).current;
  const instrOpac    = useRef(new Animated.Value(0)).current;
  const instrTransY  = useRef(new Animated.Value(6)).current;
  const camScale     = useRef(new Animated.Value(1)).current;
  const countdownOpac = useRef(new Animated.Value(0)).current;

  const animateInstrChange = useCallback((cb: () => void) => {
    Animated.parallel([
      Animated.timing(instrOpac,   { toValue: 0, duration: 170, useNativeDriver: true }),
      Animated.timing(instrTransY, { toValue: -5, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      cb();
      instrTransY.setValue(8);
      Animated.parallel([
        Animated.timing(instrOpac,   { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(instrTransY, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  // Reset on angle change
  useEffect(() => {
    clearAllTimers();
    setCaptureState("live");
    setPendingItem(null);
    setQualityScore(0);
    setGuidedPhase("position");
    setCountdown(null);
    card1.setValue(0); card2.setValue(0); card3.setValue(0);
    scoreReveal.setValue(0); camScale.setValue(1);
    instrOpac.setValue(0); instrTransY.setValue(6);
    countdownOpac.setValue(0);

    Animated.parallel([
      Animated.timing(instrOpac,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(instrTransY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [cfg.angle]);

  // Stable ref to latest handleCaptureInternal — avoids stale closure in timers
  const captureInternalRef = useRef<() => Promise<void>>(async () => {});

  // Auto-capture trigger (called when phase reaches "ready")
  const startAutoCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCountdown(2);
    Animated.timing(countdownOpac, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    addTimer(() => setCountdown(1), 1000);
    addTimer(async () => {
      setCountdown(null);
      Animated.timing(countdownOpac, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      await captureInternalRef.current();
    }, 2000);
  }, []);

  const handleCaptureInternal = async () => {
    if (!cameraRef.current) {
      console.warn("[Capture] cameraRef boş — kamera henüz hazır değil");
      setCaptureState("live");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(camScale, { toValue: 0.96, duration: 220, useNativeDriver: true }).start();
    setCaptureState("validating");

    let photo: { uri: string; base64?: string | null } | null = null;
    try {
      photo = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.80, skipProcessing: true,
      });
    } catch (err) {
      console.warn("[Capture] takePictureAsync ilk deneme başarısız:", err);
      // Retry once after a short delay
      await new Promise((r) => setTimeout(r, 400));
      try {
        photo = await cameraRef.current.takePictureAsync({
          base64: true, quality: 0.75, skipProcessing: true,
        });
      } catch (err2) {
        console.error("[Capture] takePictureAsync yeniden deneme de başarısız:", err2);
      }
    }

    if (!photo?.base64) {
      console.warn("[Capture] Fotoğraf alınamadı veya base64 boş — live'a dönülüyor");
      setCaptureState("live");
      return;
    }

    console.log(`[Capture] Açı=${cfg.angle} fotoğraf alındı uri=${photo.uri.slice(-24)}`);
    const score = Math.round(78 + Math.random() * 14);
    setQualityScore(score);
    const item: CaptureItem = {
      angle: cfg.angle, uri: photo.uri, base64: photo.base64,
      qualityScore: score, qualityLabel: score >= 80 ? "ideal" : "kabul_edilebilir",
    };
    setPendingItem(item);

    Animated.sequence([
      Animated.timing(card1,       { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(80),
      Animated.timing(card2,       { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(80),
      Animated.timing(card3,       { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(150),
      Animated.timing(scoreReveal, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setCaptureState("auto_accepting");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addTimer(() => onCapture(item), 1000);
    });
  };

  // Keep captureInternalRef in sync so startAutoCapture always calls latest version
  useEffect(() => {
    captureInternalRef.current = handleCaptureInternal;
  });

  // Manual retake
  const handleRetake = () => {
    clearAllTimers();
    setCaptureState("live");
    setPendingItem(null);
    setCountdown(null);
    card1.setValue(0); card2.setValue(0); card3.setValue(0);
    scoreReveal.setValue(0);
  };

  // Guided phase state machine — hızlandırılmış timers
  useEffect(() => {
    if (captureState !== "live") return;
    setGuidedPhase("position");
    console.log(`[GuidedPhase] Açı=${cfg.angle} position başladı`);

    // t1: scanning phase (kısaltıldı 1800→600ms)
    const t1 = setTimeout(() => {
      console.log(`[GuidedPhase] Açı=${cfg.angle} scanning`);
      animateInstrChange(() => setGuidedPhase("scanning"));
    }, 600);

    // t2: ready phase + auto-capture (kısaltıldı 4400→2200ms)
    const t2 = setTimeout(() => {
      console.log(`[GuidedPhase] Açı=${cfg.angle} ready — auto-capture başlatılıyor`);
      animateInstrChange(() => {
        setGuidedPhase("ready");
        startAutoCapture();
      });
    }, 2200);

    // t3: zorla çekim güvenlik ağı — 8 saniye sonra hâlâ live ise bir kez daha dene
    const t3 = setTimeout(() => {
      console.warn(`[GuidedPhase] Açı=${cfg.angle} FORCE-CAPTURE devreye girdi`);
      captureInternalRef.current();
    }, 8000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [cfg.angle, captureState]);

  if (!cameraPermission?.granted) {
    return (
      <View style={cap.noPermBox}>
        <Feather name="camera-off" size={38} color="#9CA3AF" />
        <Text style={[cap.noPermTitle, { color: colors.text }]}>Kamera izni gerekli</Text>
        <Text style={[cap.noPermDesc, { color: colors.textMuted }]}>
          Cilt analizi için kamera erişimine izin verin.
        </Text>
        <TouchableOpacity style={cap.noPermBtn} onPress={onRequestPermission}>
          <Text style={cap.noPermBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const CAMERA_H  = 420;
  const isLive    = captureState === "live";
  const isScanning = isLive && guidedPhase === "scanning";
  const isReady    = isLive && guidedPhase === "ready";
  const phaseInstr = PHASE_INSTR[cfg.angle]?.[guidedPhase] ?? { main: cfg.instruction, hint: cfg.hint };
  const validCards = [
    { label: "Işık Dengesi",   ok: true,               anim: card1 },
    { label: "Yüz Hizalaması", ok: true,               anim: card2 },
    { label: "Netlik",         ok: qualityScore >= 72,  anim: card3 },
  ];

  const isAutoAccepting = captureState === "auto_accepting";

  return (
    <View style={{ flex: 1 }}>
      {/* ── Camera box ── */}
      <Animated.View style={[cap.cameraBox, { height: CAMERA_H, transform: [{ scale: camScale }] }]}>
        {isLive ? (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            <FaceOvalOverlay width={W} height={CAMERA_H} angle={cfg.angle} phase={guidedPhase} />
            <ScanLineOverlay camW={W} camH={CAMERA_H} angle={cfg.angle} active={isScanning || isReady} />
            {GLOW_DOTS.map((dot, i) => (
              <GlowDot
                key={i}
                camW={W} camH={CAMERA_H} angle={cfg.angle}
                rx={dot.rx} ry={dot.ry} delay={dot.delay}
                active={isScanning || isReady}
              />
            ))}

            {/* Correction hint — position phase */}
            {guidedPhase === "position" && (
              <View style={cap.correctionBand} pointerEvents="none">
                <Feather name="alert-circle" size={11} color="rgba(255,255,255,0.75)" />
                <Text style={cap.correctionText}>{cfg.correctionHint}</Text>
              </View>
            )}

            {/* Countdown overlay — ready phase */}
            {countdown !== null && (
              <Animated.View style={[cap.countdownWrap, { opacity: countdownOpac }]} pointerEvents="none">
                <Text style={cap.countdownNum}>{countdown}</Text>
              </Animated.View>
            )}
          </>
        ) : pendingItem ? (
          <Image source={{ uri: pendingItem.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}

        {/* Segmented progress arc — top center */}
        <View style={cap.arcBox}>
          <SegmentedArc done={doneCount} current={doneCount} total={5} />
          <Text style={cap.arcLabel}>{doneCount + 1} / 5</Text>
        </View>

        {/* Angle label — top right */}
        <View style={cap.angleTag}>
          <Text style={cap.angleLabel}>{cfg.label}</Text>
        </View>

        {/* Guided instruction band — bottom of camera */}
        {isLive && (
          <Animated.View
            pointerEvents="none"
            style={[cap.instrBand, { opacity: instrOpac, transform: [{ translateY: instrTransY }] }]}
          >
            <Text style={cap.instrMain}>{phaseInstr.main}</Text>
            <Text style={cap.instrHint}>{phaseInstr.hint}</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* ── Bottom section ── */}
      <View style={[cap.validSection, { backgroundColor: colors.background }]}>
        {(captureState === "validating" || captureState === "validated" || isAutoAccepting) && (
          <View style={{ width: "100%", gap: 8 }}>
            <Text style={[cap.validTitle, { color: colors.text }]}>
              {captureState === "validating"
                ? "Kare analiz ediliyor..."
                : isAutoAccepting
                ? "Kaydedildi ✓"
                : qualityScore >= 80 ? "Harika bir kare!" : "Yeterli kalite"}
            </Text>

            {validCards.map((vc) => (
              <Animated.View
                key={vc.label}
                style={[
                  cap.validCard,
                  {
                    opacity: vc.anim,
                    backgroundColor: colors.surfaceCard,
                    transform: [{ translateX: vc.anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
                  },
                ]}
              >
                <Feather name={vc.ok ? "check-circle" : "alert-circle"} size={15} color={vc.ok ? "#7A8F6B" : "#F59E0B"} />
                <Text style={[cap.validCardLabel, { color: colors.text }]}>{vc.label}</Text>
                <Text style={[cap.validCardBadge, { color: vc.ok ? "#5C7050" : "#92400E" }]}>
                  {vc.ok ? "Uygun" : "Kabul edilebilir"}
                </Text>
              </Animated.View>
            ))}

            {(captureState === "validated" || isAutoAccepting) && (
              <Animated.View style={{ opacity: scoreReveal, gap: 10 }}>
                <View style={cap.scoreRow}>
                  <View style={[cap.scoreBadge, { backgroundColor: qualityScore >= 80 ? "#EEF2EA" : "#FEF3C7" }]}>
                    <Text style={[cap.scoreNum,   { color: qualityScore >= 80 ? "#5C7050" : "#92400E" }]}>{qualityScore}</Text>
                    <Text style={[cap.scoreSlash, { color: qualityScore >= 80 ? "#5C7050" : "#92400E" }]}>{" / 100"}</Text>
                  </View>
                  <Text style={[cap.scoreTag, { color: colors.textMuted }]}>
                    {isAutoAccepting ? "Sonraki açıya geçiliyor..." : qualityScore >= 80 ? "İdeal kalite" : "Yeterli kalite"}
                  </Text>
                </View>

                {!isAutoAccepting && (
                  <TouchableOpacity
                    style={[cap.retakeBtn, { backgroundColor: colors.surfaceCard, alignSelf: "center" }]}
                    onPress={handleRetake}
                  >
                    <Feather name="refresh-cw" size={13} color={colors.textMuted} />
                    <Text style={[cap.retakeBtnText, { color: colors.textMuted }]}>Yeniden çek</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── ReviewScreen ─────────────────────────────────────────────────────────────
function ReviewScreen({
  captures,
  onAnalyze,
  colors,
}: {
  captures: CaptureItem[];
  onAnalyze: () => void;
  colors: any;
}) {
  const avgScore = Math.round(
    captures.reduce((s, c) => s + c.qualityScore, 0) / Math.max(captures.length, 1)
  );
  const IMG_W = (W - 56) / 3;

  return (
    <ScrollView contentContainerStyle={rev.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[rev.title, { color: colors.text }]}>Çekimleri inceleyin</Text>
      <Text style={[rev.subtitle, { color: colors.textMuted }]}>
        5 açı tamamlandı. Analizi başlatmadan önce kontrol edin.
      </Text>

      {/* Row 1: first 3 angles */}
      <View style={rev.grid}>
        {ANGLE_CONFIGS.slice(0, 3).map((cfg) => {
          const cap = captures.find((c) => c.angle === cfg.angle);
          return (
            <View key={cfg.angle} style={[rev.capBox, { width: IMG_W }]}>
              {cap ? (
                <>
                  <Image source={{ uri: cap.uri }} style={[rev.capImg, { height: IMG_W * 1.28 }]} resizeMode="cover" />
                  <View style={[rev.capScoreBadge, { backgroundColor: cap.qualityScore >= 78 ? "#EEF2EA" : "#FEF3C7" }]}>
                    <Text style={[rev.capScoreText, { color: cap.qualityScore >= 78 ? "#5C7050" : "#92400E" }]}>{cap.qualityScore}</Text>
                  </View>
                </>
              ) : (
                <View style={[rev.capEmpty, { height: IMG_W * 1.28 }]}>
                  <Feather name="camera" size={18} color="#9CA3AF" />
                </View>
              )}
              <Text style={[rev.capLabel, { color: colors.textMuted }]}>{cfg.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Row 2: last 2 angles — centered */}
      <View style={[rev.grid, { justifyContent: "center" }]}>
        {ANGLE_CONFIGS.slice(3).map((cfg) => {
          const cap = captures.find((c) => c.angle === cfg.angle);
          return (
            <View key={cfg.angle} style={[rev.capBox, { width: IMG_W }]}>
              {cap ? (
                <>
                  <Image source={{ uri: cap.uri }} style={[rev.capImg, { height: IMG_W * 1.28 }]} resizeMode="cover" />
                  <View style={[rev.capScoreBadge, { backgroundColor: cap.qualityScore >= 78 ? "#EEF2EA" : "#FEF3C7" }]}>
                    <Text style={[rev.capScoreText, { color: cap.qualityScore >= 78 ? "#5C7050" : "#92400E" }]}>{cap.qualityScore}</Text>
                  </View>
                </>
              ) : (
                <View style={[rev.capEmpty, { height: IMG_W * 1.28 }]}>
                  <Feather name="camera" size={18} color="#9CA3AF" />
                </View>
              )}
              <Text style={[rev.capLabel, { color: colors.textMuted }]}>{cfg.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={[rev.summaryCard, { backgroundColor: colors.surfaceCard }]}>
        <View style={{ flex: 1 }}>
          <Text style={[rev.summaryTitle, { color: colors.text }]}>Ortalama kalite</Text>
          <Text style={[rev.summaryDesc, { color: colors.textMuted }]}>5 fotoğraf · 5 açı</Text>
        </View>
        <View style={[rev.summaryScore, { backgroundColor: `${colors.primary}15` }]}>
          <Text style={[rev.summaryScoreNum, { color: colors.primary }]}>{avgScore}</Text>
          <Text style={[rev.summaryScoreLabel, { color: colors.primary }]}>{" /100"}</Text>
        </View>
      </View>

      <TouchableOpacity style={rev.analyzeBtn} onPress={onAnalyze} activeOpacity={0.85}>
        <LinearGradient
          colors={NAV_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={rev.analyzeBtnGrad}
        >
          <Feather name="zap" size={16} color="#fff" />
          <Text style={rev.analyzeBtnText}>Analizi Başlat</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={[rev.disclaimer, { color: colors.textMuted }]}>
        Analiz Claude AI ile gerçekleştirilir. Sonuçlar tıbbi tanı niteliği taşımaz.
      </Text>
    </ScrollView>
  );
}

// ─── ProcessingScreen ─────────────────────────────────────────────────────────
function ProcessingScreen({ captures }: { captures: CaptureItem[] }) {
  const [lineIdx, setLineIdx] = useState(0);
  const pulse1 = useRef(new Animated.Value(0.5)).current;
  const pulse2 = useRef(new Animated.Value(0.35)).current;
  const pulse3 = useRef(new Animated.Value(0.45)).current;
  const centralScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.35, duration: 850, useNativeDriver: true }),
        ])
      );

    makePulse(pulse1, 0).start();
    makePulse(pulse2, 280).start();
    makePulse(pulse3, 560).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(centralScale, { toValue: 1.18, duration: 950, useNativeDriver: true }),
        Animated.timing(centralScale, { toValue: 1, duration: 950, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(progressAnim, { toValue: 1, duration: 8000, useNativeDriver: false }).start();

    const timer = setInterval(() => setLineIdx((p) => (p + 1) % PROCESS_LINES.length), 1600);
    return () => clearInterval(timer);
  }, []);

  const pulseAnims = [pulse1, pulse2, pulse3];
  const IMG_SIZE = 68;
  const show3 = captures.slice(0, 3);
  const show2 = captures.slice(3, 5);

  return (
    <View style={proc.container}>
      {/* Row 1: 3 images */}
      <View style={proc.imagesRow}>
        {show3.map((cap, i) => (
          <Animated.View key={cap.angle} style={[proc.imgWrap, { opacity: pulseAnims[i] }]}>
            <Image source={{ uri: cap.uri }} style={[proc.img, { width: IMG_SIZE, height: IMG_SIZE }]} />
            <View style={proc.imgGlow} />
          </Animated.View>
        ))}
      </View>
      {/* Row 2: 2 images */}
      {show2.length > 0 && (
      <View style={[proc.imagesRow, { marginTop: -8 }]}>
        {show2.map((cap, i) => (
          <Animated.View key={cap.angle} style={[proc.imgWrap, { opacity: pulseAnims[i % 3] }]}>
            <Image source={{ uri: cap.uri }} style={[proc.img, { width: IMG_SIZE, height: IMG_SIZE }]} />
            <View style={proc.imgGlow} />
          </Animated.View>
        ))}
      </View>
      )}

      <Animated.View style={[proc.centralCircle, { transform: [{ scale: centralScale }] }]}>
        <Feather name="cpu" size={22} color="#7A8F6B" />
      </Animated.View>

      <View style={proc.textSection}>
        <Text style={proc.stageText}>{PROCESS_LINES[lineIdx]}</Text>
        <Text style={proc.subText}>Çok açılı derin analiz hazırlanıyor</Text>

        <View style={proc.progressTrack}>
          <Animated.View
            style={[
              proc.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={["#7A8F6B", "#C8A97E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>

        <View style={proc.stageList}>
          {PROCESS_LINES.map((line, i) => (
            <View key={line} style={proc.stageItem}>
              <View style={[proc.stageDot, i <= lineIdx && proc.stageDotActive]} />
              <Text style={[proc.stageLine, i <= lineIdx && proc.stageLineActive]}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── AnnotatedFace ────────────────────────────────────────────────────────────
// Maps concern zone keywords to face positions (% of image width/height)
const ZONE_MAP: Record<string, { x: number; y: number; side: "left" | "right"; key: string }> = {
  alın:        { x: 0.50, y: 0.16, side: "left",  key: "forehead" },
  "t-bölgesi": { x: 0.50, y: 0.38, side: "right", key: "tzone" },
  "t bölgesi": { x: 0.50, y: 0.38, side: "right", key: "tzone" },
  t:           { x: 0.50, y: 0.38, side: "right", key: "tzone" },
  "sol yanak": { x: 0.22, y: 0.52, side: "left",  key: "cheek_l" },
  "sağ yanak": { x: 0.78, y: 0.52, side: "right", key: "cheek_r" },
  sol:         { x: 0.22, y: 0.52, side: "left",  key: "cheek_l" },
  sağ:         { x: 0.78, y: 0.52, side: "right", key: "cheek_r" },
  yanak:       { x: 0.22, y: 0.52, side: "left",  key: "cheek_l" },
  burun:       { x: 0.50, y: 0.52, side: "right", key: "nose" },
  çene:        { x: 0.50, y: 0.78, side: "left",  key: "chin" },
  "göz altı":  { x: 0.50, y: 0.36, side: "left",  key: "undereye" },
  göz:         { x: 0.50, y: 0.36, side: "left",  key: "undereye" },
};

function matchZone(zone: string): { x: number; y: number; side: "left" | "right"; key: string } {
  const z = zone.toLowerCase();
  for (const key of Object.keys(ZONE_MAP)) {
    if (z.includes(key)) return ZONE_MAP[key];
  }
  return { x: 0.50, y: 0.50, side: "left", key: "center" };
}

function AnnotatedFace({
  imageUri, concerns,
}: {
  imageUri: string;
  concerns: SkinConcern[];
  colors: any;
}) {
  const IMG_H = W * 1.28;
  const DOT_R = 4;
  const labelW = 88;
  const labelOffX = 20;

  // Filter: only orta + yüksek severity; deduplicate same zone; max 4
  const seenZoneKeys = new Set<string>();
  const filteredConcerns = concerns
    .filter(c => c.severity !== "düşük")
    .sort((a, b) => (b.severity === "yüksek" ? 1 : 0) - (a.severity === "yüksek" ? 1 : 0))
    .filter(c => {
      const zk = matchZone(c.zone ?? "").key;
      if (seenZoneKeys.has(zk)) return false;
      seenZoneKeys.add(zk);
      return true;
    })
    .slice(0, 4);

  const pins = filteredConcerns.map((c, i) => {
    const pos = matchZone(c.zone ?? "");
    const dotX = pos.x * W;
    const dotY = pos.y * IMG_H;
    const lineToX = pos.side === "left" ? dotX - labelOffX - labelW : dotX + labelOffX + labelW;
    const lineFromX = pos.side === "left" ? dotX - DOT_R : dotX + DOT_R;
    const anchorX = pos.side === "left" ? dotX - labelOffX - labelW : dotX + labelOffX;
    const severity = c.severity === "yüksek" ? "#E05252" : "#E8A04A";
    const shortLabel = c.title.split(" ").slice(0, 2).join(" ");
    return { c, dotX, dotY, lineFromX, lineToX, anchorX, severity, side: pos.side, i, shortLabel };
  });

  return (
    <View style={{ width: W, height: IMG_H, position: "relative", overflow: "hidden" }}>
      <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)"]}
        style={[StyleSheet.absoluteFill, { top: "55%" }]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />

      <Svg style={StyleSheet.absoluteFill} width={W} height={IMG_H}>
        {pins.map(({ dotX, dotY, lineFromX, lineToX, severity, i }) => (
          <React.Fragment key={`line-${i}`}>
            <Path
              d={`M ${lineFromX.toFixed(1)} ${dotY.toFixed(1)} L ${lineToX.toFixed(1)} ${dotY.toFixed(1)}`}
              stroke={severity} strokeWidth={0.8} opacity={0.72}
            />
            <Ellipse cx={dotX} cy={dotY} rx={DOT_R} ry={DOT_R} fill={severity} opacity={0.88} />
            <Ellipse cx={dotX} cy={dotY} rx={DOT_R + 3.5} ry={DOT_R + 3.5} fill="none" stroke={severity} strokeWidth={0.8} opacity={0.32} />
          </React.Fragment>
        ))}
      </Svg>

      {pins.map(({ shortLabel, dotY, anchorX, severity, side, i }) => (
        <View
          key={`lbl-${i}`}
          style={{
            position: "absolute",
            left: anchorX,
            top: dotY - 12,
            width: labelW,
            alignItems: side === "left" ? "flex-end" : "flex-start",
          }}
          pointerEvents="none"
        >
          <View style={{ backgroundColor: `${severity}26`, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: `${severity}55` }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.75)", textShadowRadius: 4 }} numberOfLines={1}>
              {shortLabel}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── TieredRoutineSection ─────────────────────────────────────────────────────
type RoutineTier = "ekonomik" | "profesyonel" | "seckin";

function categoryFromProductType(productType: string): import("@/lib/routineStore").StepCategory {
  const t = productType.toLowerCase();
  if (t.includes("temizleyici") || t.includes("cleanser") || t.includes("yıkama")) return "cleanser";
  if (t.includes("serum")) return "serum";
  if (t.includes("nemlendirici") || t.includes("moisturizer") || t.includes("krem")) return "moisturizer";
  if (t.includes("güneş") || t.includes("spf") || t.includes("sunscreen")) return "sunscreen";
  if (t.includes("retinol") || t.includes("asit") || t.includes("aktif") || t.includes("treatment") || t.includes("peeling")) return "treatment";
  return "other";
}

const TIER_LABELS: Record<RoutineTier, string> = {
  ekonomik:    "Ekonomik",
  profesyonel: "Profesyonel",
  seckin:      "Seçkin",
};

function RoutineStepCard({
  step,
  colors,
  isDark,
}: {
  step: RoutineStep;
  colors: any;
  isDark: boolean;
}) {
  const [showAlts, setShowAlts] = useState(false);
  const accentGreen = "#7A8F6B";

  return (
    <View style={[trs.stepCard, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FAFAF8", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#EDE7DC" }]}>
      {/* Step header row */}
      <View style={trs.stepHeader}>
        <View style={[trs.stepNum, { backgroundColor: isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.12)" }]}>
          <Text style={[trs.stepNumText, { color: accentGreen }]}>{step.stepNum}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[trs.stepTitle, { color: colors.text }]}>{step.title}</Text>
          <View style={trs.concernBadgeRow}>
            <View style={[trs.concernBadge, { backgroundColor: isDark ? "rgba(122,143,107,0.18)" : "rgba(122,143,107,0.10)", borderColor: isDark ? "rgba(122,143,107,0.30)" : "rgba(122,143,107,0.20)" }]}>
              <Text style={[trs.concernBadgeText, { color: accentGreen }]}>{step.targetConcern}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Product type / name */}
      <View style={[trs.productRow, { backgroundColor: isDark ? "rgba(122,143,107,0.12)" : "rgba(122,143,107,0.07)", borderColor: isDark ? "rgba(122,143,107,0.20)" : "rgba(122,143,107,0.15)" }]}>
        <Feather name="box" size={12} color={accentGreen} />
        <Text style={[trs.productText, { color: colors.text }]} numberOfLines={1}>
          {step.productName ?? step.productType}
        </Text>
        {step.productName && step.productName !== step.productType && (
          <Text style={[trs.productTypeHint, { color: colors.textMuted }]}>· {step.productType}</Text>
        )}
      </View>

      {/* Why */}
      <Text style={[trs.whyText, { color: colors.textSecondary }]}>{step.why}</Text>

      {/* Alternatives toggle */}
      {step.alternatives.length > 0 && (
        <TouchableOpacity
          style={trs.altsToggle}
          onPress={() => setShowAlts(p => !p)}
          activeOpacity={0.7}
        >
          <Feather name={showAlts ? "minus" : "plus"} size={11} color={colors.textMuted} />
          <Text style={[trs.altsToggleText, { color: colors.textMuted }]}>
            {showAlts ? "Alternatifleri gizle" : `${step.alternatives.length} alternatif`}
          </Text>
        </TouchableOpacity>
      )}
      {showAlts && (
        <View style={trs.altsRow}>
          {step.alternatives.map((alt, ai) => (
            <View key={ai} style={[trs.altChip, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F0EBE3", borderColor: isDark ? "rgba(255,255,255,0.12)" : "#DDD5C8" }]}>
              <Text style={[trs.altChipText, { color: colors.textSecondary }]}>{alt.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TieredRoutineSection({
  routine,
  colors,
  isDark,
  onSave,
  savedToRoutine,
}: {
  routine: TieredRoutine;
  colors: any;
  isDark: boolean;
  onSave: (tier: RoutineTier) => void;
  savedToRoutine: boolean;
}) {
  const [selectedTier, setSelectedTier] = useState<RoutineTier>("ekonomik");
  const [selectedPeriod, setSelectedPeriod] = useState<"sabah" | "aksam">("sabah");

  const tierSteps = routine[selectedPeriod][selectedTier] ?? [];
  const accentGreen = "#7A8F6B";

  return (
    <View style={[res.section, { gap: 0 }]}>
      {/* Section header */}
      <View style={trs.sectionHeader}>
        <Feather name="layers" size={15} color={accentGreen} />
        <Text style={[res.sectionTitle, { color: colors.text, marginBottom: 0, flex: 1 }]}>Şahsi Rutin Öneriniz</Text>
        <View style={[trs.aiTag, { backgroundColor: isDark ? "rgba(122,143,107,0.15)" : "rgba(122,143,107,0.10)" }]}>
          <Feather name="cpu" size={10} color={accentGreen} />
          <Text style={[trs.aiTagText, { color: accentGreen }]}>AI üretildi</Text>
        </View>
      </View>

      {/* Tier selector */}
      <View style={[trs.tierRow, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F0EBE3", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E0D8CC" }]}>
        {(["ekonomik", "profesyonel", "seckin"] as RoutineTier[]).map(tier => (
          <TouchableOpacity
            key={tier}
            style={[trs.tierBtn, selectedTier === tier && { backgroundColor: isDark ? "#3A4D30" : "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }]}
            onPress={() => setSelectedTier(tier)}
            activeOpacity={0.78}
          >
            <Text style={[trs.tierBtnText, { color: selectedTier === tier ? (isDark ? "#9DB88D" : accentGreen) : colors.textMuted }]}>
              {TIER_LABELS[tier]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period selector */}
      <View style={trs.periodRow}>
        {([
          { key: "sabah", icon: "sun" as const, label: "Sabah" },
          { key: "aksam", icon: "moon" as const, label: "Akşam" },
        ] as const).map(p => (
          <TouchableOpacity
            key={p.key}
            style={[trs.periodBtn, { borderColor: selectedPeriod === p.key ? accentGreen : "transparent", backgroundColor: selectedPeriod === p.key ? (isDark ? "rgba(122,143,107,0.15)" : "rgba(122,143,107,0.09)") : "transparent" }]}
            onPress={() => setSelectedPeriod(p.key)}
            activeOpacity={0.78}
          >
            <Feather name={p.icon} size={13} color={selectedPeriod === p.key ? accentGreen : colors.textMuted} />
            <Text style={[trs.periodBtnText, { color: selectedPeriod === p.key ? accentGreen : colors.textMuted }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Steps */}
      {tierSteps.length === 0 ? (
        <View style={[trs.emptyBox, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F5F1EB" }]}>
          <Text style={[trs.emptyText, { color: colors.textMuted }]}>Bu katman için adım bulunamadı</Text>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 10 }}>
          {tierSteps.map(step => (
            <RoutineStepCard key={`${step.stepNum}-${step.title}`} step={step} colors={colors} isDark={isDark} />
          ))}
        </View>
      )}

      {/* Weekly step */}
      {!!routine.haftaDestek && (
        <View style={[trs.weeklyBox, { backgroundColor: isDark ? "rgba(200,169,126,0.08)" : "#FDF8F2", borderColor: isDark ? "rgba(200,169,126,0.20)" : "rgba(200,169,126,0.30)" }]}>
          <View style={trs.weeklyHeader}>
            <Feather name="calendar" size={13} color="#C8A97E" />
            <Text style={[trs.weeklyTitle, { color: isDark ? "#D4A265" : "#78350F" }]}>Haftalık Destek</Text>
          </View>
          <Text style={[trs.weeklyProductText, { color: colors.text }]}>{routine.haftaDestek.productName ?? routine.haftaDestek.productType}</Text>
          <Text style={[trs.weeklyWhy, { color: colors.textMuted }]}>{routine.haftaDestek.why}</Text>
        </View>
      )}

      {/* Save to routine CTA */}
      <TouchableOpacity
        style={[trs.saveCta, savedToRoutine && { opacity: 0.7 }]}
        onPress={() => onSave(selectedTier)}
        activeOpacity={0.85}
        disabled={savedToRoutine}
      >
        <LinearGradient
          colors={savedToRoutine ? ["#9CA3AF", "#9CA3AF"] : NAV_COLORS}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={trs.saveCtaGrad}
        >
          <Feather name={savedToRoutine ? "check" : "bookmark"} size={15} color="#fff" />
          <Text style={trs.saveCtaText}>
            {savedToRoutine ? "Rutine Kaydedildi" : `${TIER_LABELS[selectedTier]} Rutini Kaydet`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── ResultsScreen ────────────────────────────────────────────────────────────
function ResultsScreen({
  result,
  intelligence,
  captures,
  onReset,
  colors,
  isEnhancing,
}: {
  result: MultiAngleSkinResult;
  intelligence: PharmacistIntelligence | null;
  captures: CaptureItem[];
  onReset: () => void;
  colors: any;
  isEnhancing?: boolean;
}) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [savedToRoutine, setSavedToRoutine] = useState(false);

  const frontCapture = captures.find((c) => c.angle === "front");
  const concerns = result.concerns_structured ?? [];
  const strengths = result.strengths_structured ?? [];

  const CILT_TIP_LABEL: Record<string, string> = {
    yağlı: "Yağlı Cilt",
    kuru: "Kuru Cilt",
    karma: "Karma Cilt",
    normal: "Normal Cilt",
    hassas: "Hassas Cilt",
  };
  const ciltLabel =
    CILT_TIP_LABEL[(result.cilt_tipi ?? "").toLowerCase()] ?? result.cilt_tipi ?? "Analiz Edildi";

  const handleSaveToRoutine = (tier: RoutineTier) => {
    const routine = result.routine_tiered;
    if (!routine) return;
    try {
      clearAllSteps();
      const sabahSteps = routine.sabah[tier] ?? [];
      const aksamSteps = routine.aksam[tier] ?? [];
      sabahSteps.forEach((step) => {
        addStep({
          category: categoryFromProductType(step.productType),
          label: step.productName ?? step.productType,
          slot: "morning",
          productName: step.productName,
          note: step.why,
        });
      });
      aksamSteps.forEach((step) => {
        addStep({
          category: categoryFromProductType(step.productType),
          label: step.productName ?? step.productType,
          slot: "evening",
          productName: step.productName,
          note: step.why,
        });
      });
      setSavedToRoutine(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.push("/(tabs)/rutin" as any), 800);
    } catch (e) {
      console.warn("Rutine kaydetme hatası:", e);
    }
  };

  return (
    <ScrollView contentContainerStyle={res.scroll} showsVerticalScrollIndicator={false}>
      {/* Derin analiz devam ediyor — sessiz banner */}
      {isEnhancing && (
        <View style={[res.enhancingBar, { backgroundColor: isDark ? "rgba(122,143,107,0.15)" : "rgba(122,143,107,0.10)", borderColor: isDark ? "rgba(122,143,107,0.30)" : "rgba(122,143,107,0.20)" }]}>
          <ActivityIndicator size="small" color="#7A8F6B" style={{ marginRight: 8 }} />
          <Text style={[res.enhancingText, { color: isDark ? "#9DB88D" : "#5C7050" }]}>Derin analiz hazırlanıyor...</Text>
        </View>
      )}

      {/* LAYER 1 — Hero foto + skor (temiz, işaretsiz) */}
      <View style={[res.heroCard, { backgroundColor: colors.surfaceCard }]}>
        {frontCapture && (
          <Image source={{ uri: frontCapture.uri }} style={res.heroImg} resizeMode="cover" />
        )}
        <LinearGradient
          colors={["transparent", `${colors.surfaceCard}FF`]}
          style={res.heroGradient}
          start={{ x: 0, y: 0.25 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={res.heroBottom}>
          <ScoreRing score={result.puan ?? 0} size={70} />
          <View style={{ flex: 1 }}>
            <View
              style={[
                res.ciltBadge,
                {
                  backgroundColor: `${colors.primary}18`,
                  borderColor: `${colors.primary}30`,
                },
              ]}
            >
              <Text style={[res.ciltBadgeText, { color: colors.primary }]}>{ciltLabel}</Text>
            </View>
            <Text style={[res.heroYas, { color: colors.textMuted }]}>
              Tahmini yaş: {result.yas_tahmini}
            </Text>
          </View>
        </View>
      </View>

      {/* Concern insight chips — fotoğraf altında, işaretsiz metin */}
      {concerns.length > 0 && (
        <View style={[res.insightChipsCard, { backgroundColor: colors.surfaceCard }]}>
          {concerns.map((c) => {
            const sev = SEVERITY_STYLE[c.severity] ?? SEVERITY_STYLE["orta"];
            return (
              <View key={c.key} style={res.insightChipRow}>
                <View style={[res.insightChipDot, { backgroundColor: sev.text }]} />
                <Text style={[res.insightChipText, { color: colors.text }]}>
                  <Text style={{ fontWeight: "600" }}>{c.zone}</Text>
                  {" — "}
                  {c.title}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Eczacı Özeti (shortSummary) veya ham özet ── */}
      <View style={[res.ozetCard, { backgroundColor: colors.surfaceCard }]}>
        <View style={res.ozetTitleRow}>
          <Feather name="activity" size={14} color={colors.primary} />
          <Text style={[res.ozetTitle, { color: colors.text }]}>Genel Değerlendirme</Text>
        </View>
        <Text style={[res.ozetText, { color: colors.textMuted }]}>
          {intelligence?.shortSummary ?? result.analiz_ozeti}
        </Text>
      </View>

      {/* ── Key Findings (3 pill) ── */}
      {(intelligence?.keyFindings?.length ?? 0) > 0 && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Öne Çıkan Bulgular</Text>
          <View style={res.findingsList}>
            {intelligence!.keyFindings.map((f, i) => (
              <View key={`kf-${i}`} style={[res.findingItem, { backgroundColor: colors.surfaceCard }]}>
                <View style={[res.findingBullet, { backgroundColor: colors.primary }]}>
                  <Text style={res.findingBulletText}>{i + 1}</Text>
                </View>
                <Text style={[res.findingText, { color: colors.text }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* LAYER 2 — Dikkat çeken alanlar (concerns_structured) */}
      {concerns.length > 0 && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Dikkat Çeken Alanlar</Text>
          {concerns.map((c) => {
            const sev = SEVERITY_STYLE[c.severity] ?? SEVERITY_STYLE["orta"];
            return (
              <View key={c.key} style={[res.concernCard, { backgroundColor: colors.surfaceCard }]}>
                <View style={res.concernHeader}>
                  <Text style={[res.concernTitle, { color: colors.text }]}>{c.title}</Text>
                  <View style={[res.sevBadge, { backgroundColor: sev.bg }]}>
                    <Text style={[res.sevText, { color: sev.text }]}>{sev.label}</Text>
                  </View>
                </View>
                <Text style={[res.concernZone, { color: colors.textMuted }]}>{c.zone}</Text>
                <Text style={[res.concernExpl, { color: colors.text }]}>{c.explanation}</Text>
                <View style={[res.concernCareBox, { backgroundColor: `${colors.primary}10` }]}>
                  <Feather name="chevrons-right" size={12} color={colors.primary} />
                  <Text style={[res.concernCare, { color: colors.primary }]}>{c.careDirection}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Sorunlar fallback */}
      {concerns.length === 0 && (result.sorunlar?.length ?? 0) > 0 && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Dikkat Çeken Alanlar</Text>
          <View style={res.pillsRow}>
            {result.sorunlar.map((s) => (
              <View key={s} style={[res.sorunPill, { backgroundColor: "#FEE2E2" }]}>
                <Text style={[res.sorunPillText, { color: "#991B1B" }]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Eczacı Bölgesel Analizi (detailedInsights) ── */}
      {(intelligence?.detailedInsights?.length ?? 0) > 0 && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Bölgesel Analiz</Text>
          {intelligence!.detailedInsights.map((ins, i) => (
            <View key={`di-${i}`} style={[res.insightCard, { backgroundColor: colors.surfaceCard, borderLeftColor: colors.primary }]}>
              <Text style={[res.insightRegion, { color: colors.primary }]}>{ins.region}</Text>
              <Text style={[res.insightTitle, { color: colors.text }]}>{ins.title}</Text>
              <Text style={[res.insightDesc, { color: colors.textMuted }]}>{ins.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* LAYER 3 — Güçlü yönler */}
      {(strengths.length > 0 || (result.guclü_yonler?.length ?? 0) > 0) && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Güçlü Yönler</Text>
          {strengths.length > 0
            ? strengths.map((st) => (
                <View key={st.key} style={res.strengthCard}>
                  <Feather name="check-circle" size={16} color="#7A8F6B" />
                  <View style={{ flex: 1 }}>
                    <Text style={res.strengthTitle}>{st.title}</Text>
                    <Text style={res.strengthDesc}>{st.description}</Text>
                  </View>
                </View>
              ))
            : result.guclü_yonler.map((g) => (
                <View key={g} style={res.strengthCard}>
                  <Feather name="check-circle" size={14} color="#7A8F6B" />
                  <Text style={[res.strengthTitle, { flex: 1 }]}>{g}</Text>
                </View>
              ))}
        </View>
      )}

      {/* ── Eczacı Bakım Yönü (careDirection) ── */}
      {!!intelligence?.careDirection && (
        <View style={[res.careDirectionBox, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}25` }]}>
          <View style={res.careDirectionHeader}>
            <Feather name="compass" size={15} color={colors.primary} />
            <Text style={[res.careDirectionLabel, { color: colors.primary }]}>Bakım Yaklaşımı</Text>
          </View>
          <Text style={[res.careDirectionText, { color: colors.text }]}>
            {intelligence.careDirection}
          </Text>
        </View>
      )}

      {/* LAYER 4 — Önerilen aktifler */}
      {(result.onerilen_aktifler?.length ?? 0) > 0 && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Önerilen Aktifler</Text>
          <View style={res.pillsRow}>
            {result.onerilen_aktifler.map((a) => (
              <View
                key={a}
                style={[
                  res.activePill,
                  {
                    backgroundColor: `${colors.primary}15`,
                    borderColor: `${colors.primary}30`,
                  },
                ]}
              >
                <Text style={[res.activePillText, { color: colors.primary }]}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Kaçınılacak maddeler */}
      {(result.kaçınılacak_maddeler?.length ?? 0) > 0 && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Kaçınılacak Maddeler</Text>
          {!!intelligence?.avoidSuggestions && (
            <Text style={[res.avoidExplain, { color: colors.textMuted }]}>
              {intelligence.avoidSuggestions}
            </Text>
          )}
          <View style={res.pillsRow}>
            {result.kaçınılacak_maddeler.map((k) => (
              <View
                key={k}
                style={[res.avoidPill, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}
              >
                <Feather name="x" size={10} color="#991B1B" />
                <Text style={[res.avoidPillText, { color: "#991B1B" }]}>{k}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* LAYER 5 — Şahsi Tiered Rutin */}
      {result.routine_tiered ? (
        <TieredRoutineSection
          routine={result.routine_tiered}
          colors={colors}
          isDark={isDark}
          onSave={handleSaveToRoutine}
          savedToRoutine={savedToRoutine}
        />
      ) : ((result.gunluk_rutin_onerisi?.sabah?.length ?? 0) > 0 ||
        (result.gunluk_rutin_onerisi?.aksam?.length ?? 0) > 0) && (
        <View style={res.section}>
          <Text style={[res.sectionTitle, { color: colors.text }]}>Günlük Rutin Önerisi</Text>
          {[
            { key: "sabah", icon: "sun" as const, label: "Sabah", steps: result.gunluk_rutin_onerisi?.sabah ?? [] },
            { key: "aksam", icon: "moon" as const, label: "Akşam", steps: result.gunluk_rutin_onerisi?.aksam ?? [] },
          ].map((period) => (
            <View key={period.key} style={[res.routineCard, { backgroundColor: colors.surfaceCard }]}>
              <View style={res.routineHeader}>
                <Feather name={period.icon} size={14} color={colors.primary} />
                <Text style={[res.routineLabel, { color: colors.text }]}>{period.label}</Text>
              </View>
              {period.steps.map((step, i) => (
                <View key={`${period.key}-step-${i}`} style={res.routineStep}>
                  <Text style={[res.routineStepNum, { color: colors.primary }]}>{i + 1}.</Text>
                  <Text style={[res.routineStepText, { color: colors.text }]}>{step}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* ── Eczacı İmzası (pharmacistNote) ── */}
      {!!intelligence?.pharmacistNote && (
        <View style={res.pharmNoteCard}>
          <LinearGradient
            colors={["#3A4D30", "#2A3820"]}
            style={res.pharmNoteGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={res.pharmNoteTop}>
              <Feather name="aperture" size={18} color="rgba(255,255,255,0.6)" />
              <Text style={res.pharmNoteLabel}>Eczacı Notu</Text>
            </View>
            <Text style={res.pharmNoteText}>{intelligence.pharmacistNote}</Text>
          </LinearGradient>
        </View>
      )}

      {/* LAYER 6 — Eylemler */}
      <View style={res.actionSection}>
        <Text style={[res.sectionTitle, { color: colors.text }]}>Sonraki Adımlar</Text>
        <TouchableOpacity
          style={res.actionBtn}
          onPress={() => router.push("/(tabs)/rutin" as any)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={NAV_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={res.actionBtnGrad}
          >
            <Feather name="list" size={16} color="#fff" />
            <Text style={res.actionBtnText}>Rutinime Git</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[res.actionBtnOutline, { borderColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/(home)/akilli-secim" as any)}
          activeOpacity={0.85}
        >
          <Feather name="search" size={15} color={colors.primary} />
          <Text style={[res.actionBtnOutlineText, { color: colors.primary }]}>Ürün Önerileri</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={res.resetBtn} onPress={onReset} activeOpacity={0.7}>
        <Feather name="refresh-ccw" size={13} color="#9CA3AF" />
        <Text style={res.resetBtnText}>Yeni analiz yap</Text>
      </TouchableOpacity>

      <View style={[res.disclaimerBox, { backgroundColor: colors.surfaceCard }]}>
        <Ionicons name="information-circle-outline" size={15} color="#9CA3AF" />
        <Text style={[res.disclaimerText, { color: colors.textMuted }]}>
          Bu analiz yapay zeka destekli genel bilgilendirme amaçlıdır. Klinik tanı niteliği taşımaz.
          Ciddi cilt sorunlarında lütfen bir dermatologa başvurun.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── DEPRECATED — Skin Intelligence'a yönlendir ──────────────────────────────
// Bu ekran artık kullanılmıyor. Tüm cilt analizi trafiği /skin-intelligence'a
// yönlendirilmiştir. Eski kod referans için korunmaktadır.
export default function CiltAnaliziScreen() {
  // Hemen yeni modüle yönlendir
  useEffect(() => {
    router.replace("/skin-intelligence" as any);
  }, []);
  return null;

  // ── Aşağıdaki tüm kod DEPRECATED ── silinecek ──────────────────────────
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { isSeckin, user, loading: authLoading, getAuthHeaders } = useAuth();

  // Kamera izni — tek kaynak olarak ana bileşende tutuluyor
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [stage, setStage] = useState<Stage>("intro");
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [result, setResult] = useState<MultiAngleSkinResult | null>(null);
  const [intelligence, setIntelligence] = useState<PharmacistIntelligence | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const currentAngleCfg = ANGLE_CONFIGS.find((c) => c.stage === stage) ?? ANGLE_CONFIGS[0];
  const doneCount = captures.length;

  const handleCapture = useCallback(
    (item: CaptureItem) => {
      const updated = [...captures.filter((c) => c.angle !== item.angle), item];
      setCaptures(updated);

      if (item.angle === "front")  setStage("capture_left");
      else if (item.angle === "left")  setStage("capture_right");
      else if (item.angle === "right") setStage("capture_up");
      else if (item.angle === "up")    setStage("capture_down");
      else setStage("review");
    },
    [captures]
  );

  const handleAnalyze = useCallback(async () => {
    // ── Diagnostic ──────────────────────────────────────────────────────────
    console.log("[CiltAnalizi] Analiz başlatma isteği");
    console.log("[CiltAnalizi] authLoading:", authLoading);
    console.log("[CiltAnalizi] user:", user ? `id=${user.id} role=${user.role}` : "NULL");

    // Auth race-condition guard — session henüz yüklenmediyse bekle
    if (authLoading) {
      console.warn("[CiltAnalizi] AUTH_LOADING — session henüz çözümlenmedi, iptal edildi");
      return;
    }

    // Kullanıcı null ise analiz başlatma, giriş ekranına yönlendir
    if (!user) {
      console.warn("[CiltAnalizi] USER_NULL — kullanıcı oturumu yok, /uyelik'e yönlendiriliyor");
      router.push("/uyelik" as any);
      return;
    }

    // ── Pre-flight auth check — API server'ın JWT'yi kabul edip etmediğini doğrula
    try {
      const authHeaders = await getAuthHeaders();
      const preCheck = await fetch(`${API_BASE}/api/auth/user`, { headers: authHeaders });
      const preData = await preCheck.json() as { user: unknown };
      if (preData.user) {
        console.log("[CiltAnalizi] API_AUTH_OK — API server kullanıcıyı tanıdı:", JSON.stringify(preData.user).slice(0, 120));
      } else {
        console.warn("[CiltAnalizi] API_AUTH_FAIL — API server kullanıcıyı tanımadı. user=null döndü.");
        console.warn("[CiltAnalizi] Muhtemel neden: JWT geçersiz / süresi dolmuş / API server token'ı doğrulayamıyor");
      }
    } catch (preErr: any) {
      console.error("[CiltAnalizi] PRE_CHECK_ERROR —", preErr?.message ?? preErr);
    }

    console.log("[CiltAnalizi] SESSION_OK — analiz başlatılıyor");
    setStage("processing");
    setIsEnhancing(false);

    const angleMap: Record<string, string> = { front: "ön", left: "sol 45°", right: "sağ 45°", up: "çene yukarı", down: "çene aşağı" };

    // Görselleri 800px'e küçült — API yükünü ~4× azaltır
    const compressImage = async (uri: string): Promise<string> => {
      try {
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 800 } }],
          { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        return `data:image/jpeg;base64,${result.base64 ?? ""}`;
      } catch {
        // Sıkıştırma başarısız — orijinal kullan
        return `data:image/jpeg;base64,${captures.find(c => c.uri === uri)?.base64 ?? ""}`;
      }
    };

    console.log("[CiltAnalizi] Görseller sıkıştırılıyor...");
    const compressedImages = await Promise.all(captures.map((c) => compressImage(c.uri)));
    const imageList = compressedImages;
    const angleList = captures.map((c) => angleMap[c.angle] ?? "ön");

    const authHeaders = await getAuthHeaders();
    const hasBearer = !!authHeaders["Authorization"];
    console.log("[CiltAnalizi] Auth header:", hasBearer ? "Bearer TOKEN_VAR" : "YOK");

    // ── Hızlı analiz (sıkıştırılmış ön görsel, Haiku, ~4s) ─────────────────
    const frontIdx = Math.max(0, captures.findIndex((c) => c.angle === "front"));
    const quickFetch = fetch(`${API_BASE}/api/skin-analysis/quick`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ image: compressedImages[frontIdx] }),
    });

    // ── Derin analiz (tüm görseller, Sonnet×2 + Haiku, ~40s) ────────────────
    const deepFetch = fetch(`${API_BASE}/api/skin-analysis`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ images: imageList, angles: angleList }),
    });

    // 15s'lik zaman aşımı — hızlı analiz bu süreyi geçerse derin sonuç beklenir
    const timeout15s = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("QUICK_TIMEOUT")), 15000)
    );

    let quickShown = false;

    try {
      const quickRes = await Promise.race([quickFetch, timeout15s]);

      if (quickRes.status === 403) {
        setErrorMsg("Bu özellik Seçkin üyelik gerektirir.");
        setStage("failed");
        return;
      }

      if (quickRes.ok) {
        const quickData = await quickRes.json() as any;
        if (quickData?.analiz) {
          quickShown = true;
          setResult(quickData.analiz);
          setIsEnhancing(true);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStage("results");
          console.log("[CiltAnalizi] Hızlı sonuç gösterildi — derin analiz arka planda devam ediyor");
        }
      }
    } catch (quickErr: any) {
      if (quickErr?.message !== "QUICK_TIMEOUT") {
        console.warn("[CiltAnalizi] Hızlı analiz başarısız, derin bekleniyor:", quickErr?.message);
      } else {
        console.warn("[CiltAnalizi] Hızlı analiz 15s aştı, derin bekleniyor");
      }
    }

    // ── Derin analiz tamamlandığında güncelle (veya tek sonuç olarak göster) ─
    try {
      const deepRes = await deepFetch;

      if (deepRes.status === 403 && !quickShown) {
        setErrorMsg("Bu özellik Seçkin üyelik gerektirir.");
        setStage("failed");
        return;
      }

      if (deepRes.ok) {
        const deepData = await deepRes.json() as any;
        if (deepData?.analiz) {
          setResult(deepData.analiz);
          setIntelligence(deepData.intelligence ?? null);
          if (!quickShown) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setStage("results");
          }
          console.log("[CiltAnalizi] Derin analiz tamamlandı — sonuçlar güncellendi");
        }
      } else if (!quickShown) {
        const errData = await deepRes.json().catch(() => ({}));
        throw new Error((errData as any).error ?? "Analiz başarısız oldu");
      }
    } catch (deepErr: any) {
      if (!quickShown) {
        setErrorMsg(deepErr?.message ?? "Analiz tamamlanamadı. Lütfen tekrar deneyin.");
        setStage("failed");
      } else {
        console.warn("[CiltAnalizi] Derin analiz başarısız (hızlı sonuç korundu):", deepErr?.message);
      }
    } finally {
      setIsEnhancing(false);
    }
  }, [captures, authLoading, user, getAuthHeaders]);

  const resetFlow = useCallback(() => {
    setStage("intro");
    setCaptures([]);
    setResult(null);
    setIntelligence(null);
    setErrorMsg(null);
    setIsEnhancing(false);
  }, []);

  const handleBack = () => {
    if (stage === "intro") safeBack(router, "/(tabs)/profil" as any);
    else if (stage === "prep") setStage("intro");
    else if (stage === "capture_front")  setStage("prep");
    else if (stage === "capture_left")   setStage("capture_front");
    else if (stage === "capture_right")  setStage("capture_left");
    else if (stage === "capture_up")     setStage("capture_right");
    else if (stage === "capture_down")   setStage("capture_up");
    else if (stage === "review")         setStage("capture_down");
    else if (stage === "results" || stage === "failed") resetFlow();
  };

  const NAV_TITLE_MAP: Record<Stage, string> = {
    intro: "Cilt Analizi",
    prep: "Hazırlık",
    capture_front: "Düz",
    capture_left:  "Sol",
    capture_right: "Sağ",
    capture_up:    "Yukarı",
    capture_down:  "Aşağı",
    review: "İnceleme",
    processing: "Analiz",
    results: "Sonuçlar",
    failed: "Hata",
  };

  const isProcessing = stage === "processing";

  // Auth henüz çözümlenmedi — boş view döndür, hiçbir analiz mantığı çalışmasın
  if (authLoading) {
    return <View style={[main.root, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={[main.root, { backgroundColor: colors.background }]}>
      <LinearGradient colors={NAV_COLORS} style={[main.nav, { paddingTop: topPad + 14 }]}>
        <TouchableOpacity
          style={main.navBack}
          onPress={handleBack}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <Feather
            name="arrow-left"
            size={20}
            color={isProcessing ? "rgba(255,255,255,0.3)" : "#fff"}
          />
        </TouchableOpacity>
        <Text style={main.navTitle}>{NAV_TITLE_MAP[stage]}</Text>
        <View style={main.navBack} />
      </LinearGradient>

      <View style={{ flex: 1 }}>
        {stage === "intro" && (
          <IntroScreen
            onStart={() => {
              if (!user) { router.push("/uyelik" as any); return; }
              setStage("prep");
            }}
            isSeckin={isSeckin}
          />
        )}
        {stage === "prep" && (
          <PrepScreen
            onStart={async () => {
              // Kamera iznini önceden iste — CaptureScreen açılmadan çözümlensin
              if (!cameraPermission?.granted) {
                console.log("[Perm] Kamera izni isteniyor (prep→capture geçişi)");
                await requestCameraPermission();
              } else {
                console.log("[Perm] Kamera izni zaten verilmiş — dialog atlanıyor");
              }
              setStage("capture_front");
            }}
            colors={colors}
          />
        )}
        {(stage === "capture_front" ||
          stage === "capture_left" ||
          stage === "capture_right" ||
          stage === "capture_up" ||
          stage === "capture_down") && (
          <CaptureScreen
            cfg={currentAngleCfg}
            doneCount={doneCount}
            onCapture={handleCapture}
            colors={colors}
            cameraPermission={cameraPermission}
            onRequestPermission={requestCameraPermission}
          />
        )}
        {stage === "review" && (
          <ReviewScreen captures={captures} onAnalyze={handleAnalyze} colors={colors} />
        )}
        {stage === "processing" && <ProcessingScreen captures={captures} />}
        {stage === "results" && result && (
          <ResultsScreen
            result={result}
            intelligence={intelligence}
            captures={captures}
            onReset={resetFlow}
            colors={colors}
            isEnhancing={isEnhancing}
          />
        )}
        {stage === "failed" && (
          <ScrollView
            contentContainerStyle={{
              alignItems: "center",
              paddingVertical: 52,
              paddingHorizontal: 24,
              gap: 16,
            }}
          >
            <View style={[fail.card, { backgroundColor: colors.surfaceCard }]}>
              <View style={fail.iconBox}>
                <Feather name="alert-circle" size={32} color="#EF4444" />
              </View>
              <Text style={[fail.title, { color: colors.text }]}>Analiz tamamlanamadı</Text>
              <Text style={[fail.desc, { color: colors.textMuted }]}>
                {errorMsg ?? "Bir sorun oluştu. Lütfen tekrar deneyin."}
              </Text>
              <TouchableOpacity style={fail.retryBtn} onPress={resetFlow}>
                <LinearGradient
                  colors={NAV_COLORS}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={fail.retryGrad}
                >
                  <Text style={fail.retryText}>Yeniden Dene</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const is = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 44, gap: 16 },
  heroBox: { alignItems: "center", marginBottom: 6 },
  heroBg: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center" },
  heroIconRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  angleRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  anglePill: { alignItems: "center", paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, gap: 4 },
  anglePillNum: { fontSize: 14, fontWeight: "800" },
  anglePillLabel: { fontSize: 12, fontWeight: "500" },
  benefitBox: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: { fontSize: 14 },
  btn: { borderRadius: 14, overflow: "hidden" },
  btnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  lockBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  lockTitle: { color: "#B87333", fontWeight: "700", fontSize: 14 },
  lockDesc: { color: "#92400E", fontSize: 12, marginTop: 2 },
  lockBtn: { backgroundColor: "#B87333", paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 },
  lockBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  footnote: { fontSize: 11, textAlign: "center" },
});

const prep = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 44, gap: 14 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, lineHeight: 20 },
  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 14, padding: 14 },
  tipIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  tipDesc: { fontSize: 13, lineHeight: 19 },
  stepsBox: { borderRadius: 14, padding: 16 },
  stepsLabel: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  stepsRow: { flexDirection: "row", justifyContent: "space-around" },
  stepItem: { alignItems: "center", gap: 6 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepNum: { color: "#fff", fontWeight: "700", fontSize: 14 },
  stepLabel: { fontSize: 12, fontWeight: "500" },
  btn: { borderRadius: 14, overflow: "hidden" },
  btnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 10 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

const cap = StyleSheet.create({
  cameraBox: { width: "100%", overflow: "hidden", backgroundColor: "#000" },
  // ── Segmented arc progress (top-center)
  arcBox: { position: "absolute", top: 8, alignSelf: "center", alignItems: "center" },
  arcLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", marginTop: -6 },
  // ── Angle label (top-right)
  angleTag: { position: "absolute", top: 14, right: 14, alignItems: "flex-end" },
  angleLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // ── Correction hint (top-left of camera, position phase)
  correctionBand: {
    position: "absolute", top: 12, left: 12,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.50)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  correctionText: { color: "rgba(255,255,255,0.88)", fontSize: 11.5, fontWeight: "500" },
  // ── Auto-capture countdown (center of camera)
  countdownWrap: {
    position: "absolute", alignSelf: "center",
    top: "35%", alignItems: "center", justifyContent: "center",
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(122,143,107,0.75)",
    shadowColor: "#7A8F6B", shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  countdownNum: { color: "#fff", fontSize: 40, fontWeight: "900" },
  // ── Guided instruction band (bottom of camera)
  instrBand: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingVertical: 14, paddingHorizontal: 20, alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  instrMain: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.3, textAlign: "center" },
  instrHint: { color: "rgba(255,255,255,0.72)", fontSize: 13, marginTop: 3, textAlign: "center" },
  // ── Bottom section
  validSection: { flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, alignItems: "center" },
  captureBtnWrap: { marginTop: 4 },
  captureBtnRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  captureBtnCore: { width: 54, height: 54, borderRadius: 27 },
  // ── Validation cards
  validTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  validCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  validCardLabel: { flex: 1, fontSize: 13 },
  validCardBadge: { fontSize: 12, fontWeight: "600" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  scoreBadge: { flexDirection: "row", alignItems: "baseline", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, gap: 1 },
  scoreNum: { fontSize: 18, fontWeight: "800" },
  scoreSlash: { fontSize: 12, fontWeight: "500" },
  scoreTag: { fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 10 },
  retakeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  retakeBtnText: { fontSize: 14 },
  acceptBtn: { flex: 2, borderRadius: 12, overflow: "hidden" },
  acceptBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6 },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // ── No permission
  noPermBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  noPermTitle: { fontSize: 16, fontWeight: "700" },
  noPermDesc: { fontSize: 14, textAlign: "center" },
  noPermBtn: { backgroundColor: "#7A8F6B", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  noPermBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const rev = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 44, gap: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  grid: { flexDirection: "row", gap: 8 },
  capBox: { alignItems: "center", gap: 6 },
  capImg: { width: "100%", borderRadius: 12 },
  capScoreBadge: { position: "absolute", top: 8, right: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  capScoreText: { fontSize: 11, fontWeight: "700" },
  capEmpty: { width: "100%", borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  capLabel: { fontSize: 11 },
  summaryCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16 },
  summaryTitle: { fontSize: 14, fontWeight: "600" },
  summaryDesc: { fontSize: 12, marginTop: 2 },
  summaryScore: { flexDirection: "row", alignItems: "baseline", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  summaryScoreNum: { fontSize: 22, fontWeight: "800" },
  summaryScoreLabel: { fontSize: 12, fontWeight: "600" },
  analyzeBtn: { borderRadius: 14, overflow: "hidden" },
  analyzeBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  analyzeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disclaimer: { fontSize: 11, textAlign: "center" },
});

const proc = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 24 },
  imagesRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  imgWrap: { borderRadius: 16, overflow: "hidden" },
  img: { borderRadius: 16 },
  imgGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(122,143,107,0.3)" },
  centralCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#EEF2EA", alignItems: "center", justifyContent: "center", shadowColor: "#7A8F6B", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  textSection: { alignItems: "center", gap: 10, width: "100%" },
  stageText: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", textAlign: "center" },
  subText: { fontSize: 13, color: "#6B7280", textAlign: "center" },
  progressTrack: { width: "100%", height: 4, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  progressBar: { height: 4, borderRadius: 4, overflow: "hidden" },
  stageList: { alignSelf: "stretch", gap: 8, paddingHorizontal: 8, marginTop: 6 },
  stageItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  stageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5E7EB" },
  stageDotActive: { backgroundColor: "#7A8F6B" },
  stageLine: { fontSize: 13, color: "#9CA3AF" },
  stageLineActive: { color: "#374151", fontWeight: "500" },
});

const res = StyleSheet.create({
  scroll: { paddingBottom: 48, gap: 0 },
  enhancingBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 10, marginBottom: 2, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  enhancingText: { fontSize: 13, fontWeight: "500" },
  insightChipsCard: { marginHorizontal: 16, marginTop: -4, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  insightChipRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  insightChipDot: { width: 7, height: 7, borderRadius: 4 },
  insightChipText: { fontSize: 13.5, flex: 1, lineHeight: 19 },
  heroCard: { margin: 16, borderRadius: 18, overflow: "hidden", height: 200 },
  heroImg: StyleSheet.absoluteFillObject,
  heroGradient: StyleSheet.absoluteFillObject,
  heroBottom: { position: "absolute", bottom: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  ciltBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  ciltBadgeText: { fontSize: 12, fontWeight: "700" },
  heroYas: { fontSize: 12 },
  ozetCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 14, padding: 16 },
  ozetTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  ozetTitle: { fontSize: 15, fontWeight: "700" },
  ozetText: { fontSize: 13, lineHeight: 20 },
  findingsList: { gap: 8 },
  findingItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 12, padding: 12 },
  findingBullet: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  findingBulletText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  findingText: { fontSize: 13, lineHeight: 19, flex: 1 },
  insightCard: { borderRadius: 12, padding: 14, borderLeftWidth: 3, gap: 4 },
  insightRegion: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  insightTitle: { fontSize: 13, fontWeight: "700" },
  insightDesc: { fontSize: 13, lineHeight: 19 },
  careDirectionBox: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  careDirectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  careDirectionLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  careDirectionText: { fontSize: 13, lineHeight: 20 },
  avoidExplain: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  routineLogicBox: { borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  routineLogicText: { fontSize: 12, lineHeight: 18, flex: 1 },
  pharmNoteCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: "hidden" },
  pharmNoteGrad: { padding: 20, gap: 10 },
  pharmNoteTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  pharmNoteLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  pharmNoteText: { color: "#F5F1EB", fontSize: 14, lineHeight: 22, fontStyle: "italic" },
  section: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  concernCard: { borderRadius: 14, padding: 14, gap: 8 },
  concernHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  concernTitle: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sevText: { fontSize: 11, fontWeight: "700" },
  concernZone: { fontSize: 11, fontStyle: "italic" },
  concernExpl: { fontSize: 13, lineHeight: 19 },
  concernCareBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 9 },
  concernCare: { fontSize: 12, flex: 1, lineHeight: 18 },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sorunPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  sorunPillText: { fontSize: 12, fontWeight: "600" },
  strengthCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#EEF2EA" },
  strengthTitle: { color: "#4A6040", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  strengthDesc: { color: "#5C7050", fontSize: 12, lineHeight: 18 },
  activePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  activePillText: { fontSize: 12, fontWeight: "600" },
  avoidPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  avoidPillText: { fontSize: 12, fontWeight: "600" },
  routineCard: { borderRadius: 14, padding: 14, gap: 10 },
  routineHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  routineLabel: { fontSize: 14, fontWeight: "700" },
  routineStep: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  routineStepNum: { fontSize: 13, fontWeight: "700", marginTop: 1 },
  routineStepText: { fontSize: 13, flex: 1, lineHeight: 19 },
  actionSection: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  actionBtn: { borderRadius: 14, overflow: "hidden" },
  actionBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  actionBtnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, gap: 8 },
  actionBtnOutlineText: { fontWeight: "700", fontSize: 15 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginHorizontal: 16, marginBottom: 10 },
  resetBtnText: { color: "#9CA3AF", fontSize: 13 },
  disclaimerBox: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  disclaimerText: { fontSize: 11, lineHeight: 17, flex: 1 },
});

// ── Tiered Routine Section styles ─────────────────────────────────────────────
const trs = StyleSheet.create({
  sectionHeader:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  aiTag:            { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  aiTagText:        { fontSize: 10, fontWeight: "700" },

  tierRow:          { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3, gap: 3, marginBottom: 0 },
  tierBtn:          { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tierBtnText:      { fontSize: 12.5, fontWeight: "700" },

  periodRow:        { flexDirection: "row", gap: 8, marginTop: 10 },
  periodBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  periodBtnText:    { fontSize: 13, fontWeight: "600" },

  stepCard:         { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  stepHeader:       { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum:          { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText:      { fontSize: 12, fontWeight: "800" },
  stepTitle:        { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  concernBadgeRow:  { flexDirection: "row", marginTop: 3 },
  concernBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  concernBadgeText: { fontSize: 10, fontWeight: "600" },

  productRow:       { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  productText:      { fontSize: 13, fontWeight: "600", flex: 1 },
  productTypeHint:  { fontSize: 11 },

  whyText:          { fontSize: 12.5, lineHeight: 18 },

  altsToggle:       { flexDirection: "row", alignItems: "center", gap: 5 },
  altsToggleText:   { fontSize: 11.5 },
  altsRow:          { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  altChip:          { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  altChipText:      { fontSize: 11.5 },

  weeklyBox:        { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6, marginTop: 4 },
  weeklyHeader:     { flexDirection: "row", alignItems: "center", gap: 7 },
  weeklyTitle:      { fontSize: 13, fontWeight: "700" },
  weeklyProductText:{ fontSize: 14, fontWeight: "600" },
  weeklyWhy:        { fontSize: 12.5, lineHeight: 18 },

  saveCta:          { borderRadius: 14, overflow: "hidden", marginTop: 14 },
  saveCtaGrad:      { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  saveCtaText:      { color: "#fff", fontSize: 15, fontWeight: "700" },

  emptyBox:         { borderRadius: 12, padding: 20, alignItems: "center" },
  emptyText:        { fontSize: 13 },
});

const fail = StyleSheet.create({
  card: { borderRadius: 18, padding: 28, alignItems: "center", gap: 12, width: "100%" },
  iconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  desc: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  retryBtn: { marginTop: 8, borderRadius: 12, overflow: "hidden", width: "100%" },
  retryGrad: { alignItems: "center", paddingVertical: 14 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const main = StyleSheet.create({
  root: { flex: 1 },
  nav: { paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  navBack: { width: 40, height: 36, alignItems: "center", justifyContent: "center" },
  navTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
});