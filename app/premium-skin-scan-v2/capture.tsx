/**
 * premium-skin-scan-v2 — CaptureScreen
 *
 * 5 açı OTOMATİK çekim akışı:
 *   front → left → right → up → down → /review
 *
 * KATMANLAR:
 *   1. Gyroscope    → gerçek stabilite (aralıksız)
 *   2. Kalibrasyon  → her açı için sıfırlanır (calibKey)
 *   3. Auto-capture → allClear + 1 sn kararlılık → otomatik çekim
 *   4. Quality gate → snap değerleriyle güvenlik kontrolü
 *   5. captureStore → URI kayıt
 *   6. Manuel buton → yedek, her zaman görünür
 *
 * Store YOK · analiz YOK
 * TÜM hook'lar koşullu return'lardan ÖNCE.
 */

import { Gyroscope } from "expo-sensors";
import { CameraView, useCameraPermissions } from "@/local_demo_data/safe_runtime_shims_v74";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Ellipse } from "react-native-svg";

import { captureStore } from "@/local_demo_data/safe_runtime_shims_v74";
import { analyzePhotoBrightness, analyzePhotoFull, computePerceptualHash } from "@/local_demo_data/safe_runtime_shims_v74";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";

// ─── 5 Açı ────────────────────────────────────────────────────────────────────

const ANGLES = [
  { id: "front" as const, label: "Düz Bak",     hint: "Kameraya doğrudan bakın",          arrow: "·" },
  { id: "left"  as const, label: "Sola Dön",     hint: "Başınızı yavaşça sola çevirin",    arrow: "←" },
  { id: "right" as const, label: "Sağa Dön",     hint: "Başınızı yavaşça sağa çevirin",    arrow: "→" },
  { id: "up"    as const, label: "Yukarı Bak",   hint: "Başınızı hafifçe yukarı kaldırın", arrow: "↑" },
  { id: "down"  as const, label: "Aşağı Bak",    hint: "Başınızı hafifçe aşağı indirin",   arrow: "↓" },
] as const;

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const GYRO_INTERVAL_MS = 200;
const MOTION_THRESHOLD = 0.65;   // rad/s
const STABLE_WINDOW    = 4;      // ardışık N okuma
const AUTO_CAPTURE_MS  = 1000;   // kararlılık süresi → otomatik çekim

// ─── Tipler ───────────────────────────────────────────────────────────────────

type LightState = "checking" | "ok" | "low";
type FaceState  = "checking" | "detected" | "none";

interface Snap {
  light:    LightState;
  face:     FaceState;
  centered: boolean;
  stable:   boolean;
}

function qualityCheck(s: Snap): string | null {
  // Bu kontroller guidance-readiness'e bağlı (light/face/centered legacy
  // durumlarına). Tek gerçek doğrulama çekim sonrası analyzePhotoBrightness ve
  // gyroscope-tabanlı `stable`. Mesajlar iddia içermez, kılavuzluk eder.
  if (!s.stable)             return "Lütfen sabit durun, tekrar deneyin";
  if (s.light !== "ok")      return "Hazırlık tamamlanamadı, tekrar deneyin";
  if (s.face !== "detected") return "Yüzünüzü çerçeveye alın, tekrar deneyin";
  if (!s.centered)           return "Yüzünüzü ovalin içine yerleştirin";
  return null;
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={pt.row}>
      {Array.from({ length: total }).map((_, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <View key={i} style={[pt.dot, done && pt.dotDone, active && pt.dotActive]}>
            {done && <Text style={pt.check}>✓</Text>}
          </View>
        );
      })}
    </View>
  );
}
const pt = StyleSheet.create({
  row:       { flexDirection: "row", gap: 10, alignItems: "center" },
  dot:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" },
  dotDone:   { backgroundColor: SAGE, borderColor: SAGE },
  dotActive: { borderColor: COPPER, borderWidth: 2, backgroundColor: "rgba(200,169,126,0.18)" },
  check:     { color: "#fff", fontSize: 11, fontWeight: "700" },
});

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeKind = "ok" | "warn" | "info";

function Badge({ text, kind }: { text: string; kind: BadgeKind }) {
  const bg =
    kind === "ok"   ? "rgba(122,143,107,0.88)" :
    kind === "warn" ? "rgba(210,70,50,0.82)"   :
                     "rgba(0,0,0,0.52)";
  const dot =
    kind === "ok"   ? "#D1FAD7" :
    kind === "warn" ? "#FFD7D0" :
                     "rgba(255,255,255,0.4)";
  return (
    <View style={[bst.wrap, { backgroundColor: bg }]}>
      <View style={[bst.dot, { backgroundColor: dot }]} />
      <Text style={bst.text}>{text}</Text>
    </View>
  );
}
const bst = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20 },
  dot:  { width: 7, height: 7, borderRadius: 3.5 },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
});

// ─── Status Row ───────────────────────────────────────────────────────────────

function StatusRow({ light, face, centered, stable, allClear }: Snap & { allClear: boolean }) {
  // NOT: light/face/centered "guidance readiness" durumlarıdır — gerçek
  // dedektör değil. Tek gerçek doğrulama: çekim sonrası analyzePhotoBrightness
  // ve gyroscope-tabanlı `stable`. UI metinleri bu yüzden iddia içermez,
  // sadece kullanıcıya yön gösterir.
  if (allClear) return <View style={{ flexDirection: "row" }}><Badge text="Hazır" kind="ok" /></View>;
  const items: { label: string; kind: BadgeKind }[] = [];
  // Kalibrasyon devam ederken: yumuşak rehberlik
  if (face === "checking" || light === "checking") {
    items.push({ label: "Yüzünüzü çerçeveye alın", kind: "info" });
  } else if (!centered) {
    items.push({ label: "Yüzü ovale yerleştirin",  kind: "info" });
  }
  // GERÇEK sinyal: gyroscope stable
  if (!stable) items.push({ label: "Sabit durun", kind: "warn" });
  return <View style={{ gap: 6 }}>{items.map((i) => <Badge key={i.label} text={i.label} kind={i.kind} />)}</View>;
}

// ─── Countdown Progress Bar ───────────────────────────────────────────────────

function CountdownBar({ progress }: { progress: Animated.Value }) {
  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={cd.wrap}>
      <View style={cd.labelRow}>
        <Text style={cd.label}>Çekiliyor</Text>
        <View style={cd.dot} />
      </View>
      <View style={cd.track}>
        <Animated.View style={[cd.fill, { width: fillW }]} />
      </View>
    </View>
  );
}
const cd = StyleSheet.create({
  wrap:     { alignItems: "center", gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label:    { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: COPPER },
  track:    { width: 200, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  fill:     { height: 4, borderRadius: 2, backgroundColor: SAGE },
});

// ─── Success Flash ────────────────────────────────────────────────────────────

function SuccessFlash({ angleLabel }: { angleLabel: string }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, sf.overlay]}>
      <Text style={sf.mark}>✓</Text>
      <Text style={sf.label}>Alındı</Text>
      <Text style={sf.sub}>{angleLabel}</Text>
    </View>
  );
}
const sf = StyleSheet.create({
  overlay: { backgroundColor: "rgba(122,143,107,0.42)", zIndex: 40, alignItems: "center", justifyContent: "center", gap: 8 },
  mark:    { fontSize: 72, color: "rgba(255,255,255,0.92)", fontWeight: "300" },
  label:   { fontSize: 22, color: "#fff", fontWeight: "700" },
  sub:     { fontSize: 14, color: "rgba(255,255,255,0.7)" },
});

// ─── Quality Error Overlay ────────────────────────────────────────────────────

function QualityError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={qe.overlay}>
      <View style={qe.card}>
        <View style={qe.iconWrap}><Text style={qe.icon}>⚠</Text></View>
        <Text style={qe.msg}>{message}</Text>
        <TouchableOpacity style={qe.btn} onPress={onRetry} activeOpacity={0.82}>
          <Text style={qe.btnTxt}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const qe = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", zIndex: 50 },
  card:    { backgroundColor: "#1C1A18", borderRadius: 20, paddingHorizontal: 32, paddingVertical: 28, alignItems: "center", gap: 14, marginHorizontal: 36, borderWidth: 1, borderColor: "rgba(200,169,126,0.25)" },
  iconWrap:{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(210,70,50,0.18)", alignItems: "center", justifyContent: "center" },
  icon:    { fontSize: 24 },
  msg:     { color: "#F0EAE0", fontSize: 17, fontWeight: "600", textAlign: "center" },
  btn:     { backgroundColor: SAGE, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  btnTxt:  { color: "#fff", fontSize: 15, fontWeight: "700" },
});

// ─── Permission Denied ────────────────────────────────────────────────────────

function PermissionDenied({ onRequest }: { onRequest: () => void }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[per.wrapper, { paddingTop: top }]}>
      <View style={per.box}>
        <Text style={per.emoji}>📷</Text>
        <Text style={per.title}>Kamera izni gerekli</Text>
        <Text style={per.body}>Bakım profili için kameraya erişim izni vermeniz gerekiyor.</Text>
        <TouchableOpacity style={per.btn} onPress={onRequest} activeOpacity={0.82}>
          <Text style={per.btnTxt}>İzin Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Text style={per.back}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const per = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: CREAM, alignItems: "center", justifyContent: "center" },
  box:     { paddingHorizontal: 36, alignItems: "center", gap: 16 },
  emoji:   { fontSize: 44 },
  title:   { fontSize: 20, fontWeight: "700", color: "#1C1C1E", textAlign: "center" },
  body:    { fontSize: 14, color: "#6B6B6B", textAlign: "center", lineHeight: 21 },
  btn:     { backgroundColor: SAGE, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  btnTxt:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  back:    { fontSize: 14, color: "#6B6B6B", textDecorationLine: "underline" },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function CaptureScreen() {
  const { top, bottom }           = useSafeAreaInsets();
  const [permission, requestPerm] = useCameraPermissions();

  const params   = useLocalSearchParams<{ retakeFrom?: string }>();
  const startIdx = params.retakeFrom != null ? parseInt(params.retakeFrom, 10) : 0;

  // ── State — TÜM hook'lar koşullu return'lardan ÖNCE ──────────────────────
  const [angleIdx,     setAngleIdx]     = useState(startIdx);
  const [calibKey,     setCalibKey]     = useState(0);
  const [light,        setLight]        = useState<LightState>("checking");
  const [face,         setFace]         = useState<FaceState>("checking");
  const [centered,     setCentered]     = useState(false);
  const [stable,       setStable]       = useState(true);
  const [capturing,    setCapturing]    = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);
  const [autoReady,    setAutoReady]    = useState(false);   // countdown aktif mi?

  // ── Ref'ler ───────────────────────────────────────────────────────────────
  const cameraRef       = useRef<CameraView>(null);
  const stableRef       = useRef(true);
  const calDoneRef      = useRef(false);
  const rollingMags     = useRef<number[]>([]);
  const lightRef        = useRef<LightState>("checking");
  const faceRef         = useRef<FaceState>("checking");
  const centeredRef     = useRef(false);
  const allClearRef     = useRef(false);       // son allClear değeri
  const capturingRef    = useRef(false);       // setState'den önce kontrol
  const successRef      = useRef(false);       // setState'den önce kontrol
  const qualityErrorRef = useRef<string | null>(null); // anim callback'i bail için
  const successTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const angleIdxRef     = useRef(startIdx);    // closure-safe açı indeksi

  // Animated.Value — countdown progress (0→1), useNativeDriver: false (width animasyonu)
  const readyProgress   = useRef(new Animated.Value(0)).current;
  const runningAnim     = useRef<Animated.CompositeAnimation | null>(null);

  // Snapshot ref'leri — async callback'te stale closure önlemi
  useEffect(() => { lightRef.current        = light;        }, [light]);
  useEffect(() => { faceRef.current         = face;         }, [face]);
  useEffect(() => { centeredRef.current     = centered;     }, [centered]);
  useEffect(() => { angleIdxRef.current     = angleIdx;     }, [angleIdx]);
  useEffect(() => { qualityErrorRef.current = qualityError; }, [qualityError]);

  // ── Gyroscope — aralıksız stabilite ──────────────────────────────────────
  useEffect(() => {
    if (!permission?.granted) return;
    Gyroscope.setUpdateInterval(GYRO_INTERVAL_MS);
    const sub = Gyroscope.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      rollingMags.current = [...rollingMags.current.slice(-(STABLE_WINDOW - 1)), mag];
      const nowStable = rollingMags.current.length === STABLE_WINDOW &&
                        rollingMags.current.every((m) => m < MOTION_THRESHOLD);
      if (nowStable !== stableRef.current) {
        stableRef.current = nowStable;
        setStable(nowStable);
        if (!nowStable && calDoneRef.current) { setCentered(false); centeredRef.current = false; }
        if (nowStable && faceRef.current === "detected") { setCentered(true); centeredRef.current = true; }
      }
    });
    return () => sub.remove();
  }, [permission?.granted]);

  // ── Guidance-readiness sequence — her açı için sıfırlanır ────────────────
  // ÖNEMLİ: Bu zamanlayıcılar GERÇEK ışık/yüz dedeksiyonu DEĞİLDİR. Sadece
  // kullanıcıya kameraya hazırlanması için ~3.6 sn'lik yumuşak bir UX penceresi
  // verir. Gerçek doğrulamalar:
  //   • light  → çekim sonrası analyzePhotoBrightness (qualityGate.ts)
  //   • face   → bu adımda yok (sonraki adımda eklenecek)
  //   • stable → gyroscope (yukarıdaki gerçek sensör mantığı)
  // İç state isimleri (light="ok", face="detected") legacy olarak korunmuştur;
  // UI metinleri ise iddia içermez, yalnızca kılavuzluk eder.
  useEffect(() => {
    if (!permission?.granted) return;
    calDoneRef.current  = false;
    setLight("checking"); lightRef.current = "checking";
    setFace("checking");  faceRef.current  = "checking";
    setCentered(false);   centeredRef.current = false;

    const t1 = setTimeout(() => { setLight("ok");      lightRef.current = "ok";       }, 1200);
    const t2 = setTimeout(() => { setFace("detected"); faceRef.current  = "detected"; }, 2400);
    const t3 = setTimeout(() => {
      if (stableRef.current) {
        setCentered(true); centeredRef.current = true; calDoneRef.current = true;
      }
    }, 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [permission?.granted, calibKey]);

  // ── Genel cleanup ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      runningAnim.current?.stop();
    };
  }, []);

  // ── allClear hesapla ──────────────────────────────────────────────────────
  const allClear = light === "ok" && face === "detected" && centered && stable;

  // ── Auto-capture countdown ────────────────────────────────────────────────
  useEffect(() => {
    allClearRef.current = allClear;

    if (allClear && !capturing && !success && !qualityError) {
      // Hazır → countdown başlat
      setAutoReady(true);
      readyProgress.setValue(0);

      const anim = Animated.timing(readyProgress, {
        toValue:        1,
        duration:       AUTO_CAPTURE_MS,
        useNativeDriver: false,  // width için gerekli
      });
      runningAnim.current = anim;

      anim.start(({ finished }) => {
        // finished=false → dışarıdan stop() çağrıldı (allClear düştü)
        if (!finished) return;
        // Koşulları ref'lerden tekrar kontrol et (stale closure önlemi)
        if (!allClearRef.current || capturingRef.current || successRef.current) return;
        runCaptureFromAnim();
      });

      return () => {
        anim.stop();
        runningAnim.current = null;
        readyProgress.setValue(0);
        setAutoReady(false);
      };
    } else {
      // Koşul bozuldu → sıfırla
      runningAnim.current?.stop();
      runningAnim.current = null;
      readyProgress.setValue(0);
      setAutoReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClear, capturing, success, qualityError]);

  // ── Otomatik çekim tetikleyici (ref aracılığıyla stale closure kaçınır) ──
  // Bu fonksiyon anim callback'inden çağrılır, her renderda güncellenir
  const runCaptureRef = useRef<(() => Promise<void>) | undefined>(undefined);

  async function runCapture() {
    if (!cameraRef.current || capturingRef.current || successRef.current) return;
    // QualityError aktifken yeniden çekim YOK — kullanıcı "Tekrar Dene"'ye basmalı
    if (qualityErrorRef.current) return;

    const snap: Snap = {
      light:    lightRef.current,
      face:     faceRef.current,
      centered: centeredRef.current,
      stable:   stableRef.current,
    };

    capturingRef.current = true;
    setCapturing(true);
    setQualityError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });

      const err = qualityCheck(snap);
      if (err) { setQualityError(err); return; }

      // ── Gerçek parlaklık (luminance) gate — additive ────────────────────
      // Fake light/face/centered timer'lar henüz yerinde; bu kapı pikselden
      // bağımsız doğrulama yapar. Karanlık/aşırı parlak fotoğraflar burada
      // reddedilir, store'a YAZILMAZ ve açı ilerletilmez.
      const bright = await analyzePhotoBrightness(photo.uri);
      if (!bright.ok) {
        // Active countdown / progress'i hemen durdur — auto-capture loop önlemi
        runningAnim.current?.stop();
        runningAnim.current = null;
        readyProgress.setValue(0);
        setAutoReady(false);
        qualityErrorRef.current = bright.reason ?? "Fotoğraf kalitesi yetersiz.";
        setQualityError(bright.reason ?? "Fotoğraf kalitesi yetersiz.");
        return;
      }

      // ── ECZ-CAP-1: tam kalite metadata (brightness + sharpness + pose) ──
      // Brightness gate yukarıda zaten geçti; burada composite skor ve
      // sharpness/blur sinyalini de yakalayıp store'a yazıyoruz. Hata olursa
      // metadata'sız devam et (eski davranışla aynı).
      const fullQuality = await analyzePhotoFull(photo.uri, ANGLES[angleIdxRef.current].id, {
        gyroStable: stableRef.current,
      }).catch(() => null);

      // ECZ-FINAL-QA-FIX-5: piksel-bazlı imza (dHash) — same-angle tespiti için.
      // Hata olursa undefined kalır; ileri aşamalar bunu "kanıt yok" sayıp
      // hard-block'tan kaçınır.
      const perceptualHash = await computePerceptualHash(photo.uri).catch(() => null);

      // Kaydet
      const currentAngle = ANGLES[angleIdxRef.current];
      captureStore.add({
        id:    currentAngle.id,
        label: currentAngle.label,
        uri:   photo.uri,
        ...(fullQuality
          ? {
              qualityScore:    fullQuality.qualityScore,
              qualityLabel:    fullQuality.qualityLabel,
              brightnessScore: fullQuality.brightnessScore,
              sharpnessScore:  fullQuality.sharpnessScore,
              poseAngleOk:     fullQuality.poseAngleOk,
              faceDetected:    fullQuality.faceDetected,
              faceCount:       fullQuality.faceCount,
              captureWarnings: fullQuality.warnings,
            }
          : {}),
        ...(perceptualHash ? { perceptualHash } : {}),
      });

      if (angleIdxRef.current >= ANGLES.length - 1) {
        // Tüm açılar tamamlandı → review
        successRef.current = true;
        setSuccess(true);
        successTimer.current = setTimeout(() => {
          router.replace("/premium-skin-scan-v2/review" as any);
        }, 800);
      } else {
        // Başarı flash → sonraki açı
        successRef.current = true;
        setSuccess(true);
        successTimer.current = setTimeout(() => {
          successRef.current = false;
          setSuccess(false);
          const next = angleIdxRef.current + 1;
          angleIdxRef.current = next;
          setAngleIdx(next);
          setCalibKey((prev) => prev + 1);
        }, 800);
      }
    } catch {
      setQualityError("Fotoğraf çekilemedi. Tekrar deneyin.");
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  // Her render'da runCaptureRef'i güncelle
  runCaptureRef.current = runCapture;

  function runCaptureFromAnim() {
    runCaptureRef.current?.();
  }

  // ── Manuel yedek çekim ────────────────────────────────────────────────────
  function manualCapture() {
    if (!allClear || capturing || success) return;
    // Countdown'u iptal et, hemen çek
    runningAnim.current?.stop();
    runCapture();
  }

  // ── Koşullu return'lar — TÜM HOOK'LARDAN SONRA ───────────────────────────
  if (!permission) return <View style={{ flex: 1, backgroundColor: "#1A1A1A" }} />;
  if (!permission.granted) return <PermissionDenied onRequest={requestPerm} />;

  // ── Açı & hint metni ──────────────────────────────────────────────────────
  const angle    = ANGLES[angleIdx];
  // Kullanıcıya yön gösteren kılavuz metin — iddia içermez.
  // Işık doğrulaması çekimden sonra yapılır (qualityGate).
  const hintText =
    !stable             ? "Hareketsiz durun"            :
    face === "checking" ? "Yüzünüzü çerçeveye alın"     :
    !centered           ? "Yüzü ovale yerleştirin"      :
    allClear            ? "Sabit durun, çekim başlıyor" :
                          "Hazırlanıyor";

  return (
    <View style={s.root}>
      {/* Kamera */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      {/* Overlays */}
      {success      && <SuccessFlash angleLabel={angle.label} />}
      {qualityError && <QualityError message={qualityError} onRetry={() => {
        // Aynı açıdan tekrar dene — countdown sıfırla, kalibrasyonu yeniden tetikle
        qualityErrorRef.current = null;
        setQualityError(null);
        runningAnim.current?.stop();
        runningAnim.current = null;
        readyProgress.setValue(0);
        setAutoReady(false);
        setCalibKey((k) => k + 1);
      }} />}

      {/* ── Üst çubuk ─────────────────────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} activeOpacity={0.75} disabled={capturing || success}>
          <Text style={s.backIcon}>✕</Text>
        </TouchableOpacity>
        <ProgressDots total={ANGLES.length} current={angleIdx} />
        <View style={{ width: 44 }} />
      </View>

      {/* ── Açı etiketi ───────────────────────────────────────────────────── */}
      <View style={[s.angleLabelArea, { top: top + 68 }]}>
        <View style={s.anglePill}>
          <Text style={s.angleArrow}>{angle.arrow}</Text>
          <Text style={s.angleLabel}>{angle.label}</Text>
        </View>
        <Text style={s.angleHint}>{angle.hint}</Text>
      </View>

      {/* ── Validation badges ─────────────────────────────────────────────── */}
      <View style={[s.badgeArea, { top: top + 122 }]}>
        <StatusRow light={light} face={face} centered={centered} stable={stable} allClear={allClear} />
      </View>

      {/* ── Yüz kılavuzu (SVG oval) ─────────────────────────────────────── */}
      <View style={s.guideWrap} pointerEvents="none">
        <Svg width={240} height={300}>
          <Ellipse cx={120} cy={150} rx={108} ry={138}
            stroke={allClear ? SAGE : "rgba(255,255,255,0.55)"}
            strokeWidth={allClear ? 3 : 2}
            fill="none" strokeDasharray="10 6" />
          <Ellipse cx={120} cy={150} rx={108} ry={138}
            stroke={COPPER} strokeWidth={1} fill="none" opacity={0.28} />
        </Svg>
        <View style={[s.corner, { top: 8,    left:  57 }]} />
        <View style={[s.corner, { top: 8,    right: 57 }]} />
        <View style={[s.corner, { bottom: 8, left:  57 }]} />
        <View style={[s.corner, { bottom: 8, right: 57 }]} />
        <View style={s.hintBox}><Text style={s.hintText}>{hintText}</Text></View>
      </View>

      {/* ── Alt çubuk ─────────────────────────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: bottom + 20 }]}>

        {capturing ? (
          // Çekim alınıyor
          <View style={s.capturingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={s.capturingTxt}>Çekiliyor...</Text>
          </View>

        ) : autoReady ? (
          // Otomatik çekim countdown
          <>
            <CountdownBar progress={readyProgress} />
            <TouchableOpacity style={s.manualBtn} onPress={manualCapture} activeOpacity={0.75}>
              <Text style={s.manualBtnTxt}>Şimdi Çek</Text>
            </TouchableOpacity>
          </>

        ) : (
          // Bekleme durumu
          <>
            <View style={[s.mainBtn, s.mainBtnOff]}>
              <Text style={[s.mainBtnTxt, { opacity: 0.55 }]}>
                {angleIdx + 1} / {ANGLES.length} · Kontrol ediliyor...
              </Text>
            </View>
            <Text style={s.subNote}>
              {!stable             ? "Hareketsiz bekleyin"           :
               face === "checking" ? "Yüzünüzü çerçeveye alın"       :
               !centered           ? "Yüzünüzü ovalin içine yerleştirin" :
                                     "Hazır olduğunuzda çekim başlayacak"}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#000" },

  topBar:     { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, zIndex: 30 },
  backBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center" },
  backIcon:   { color: "#fff", fontSize: 17, fontWeight: "600" },

  angleLabelArea: { position: "absolute", left: 18, right: 18, alignItems: "center", zIndex: 25 },
  anglePill:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: `${COPPER}50` },
  angleArrow:     { color: COPPER, fontSize: 20, fontWeight: "600" },
  angleLabel:     { color: "#fff", fontSize: 18, fontWeight: "700" },
  angleHint:      { color: "rgba(255,255,255,0.52)", fontSize: 12, marginTop: 5 },

  badgeArea:  { position: "absolute", left: 18, zIndex: 24 },

  guideWrap:  { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  corner:     { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: COPPER, opacity: 0.9 },
  hintBox:    { position: "absolute", bottom: -44, backgroundColor: "rgba(0,0,0,0.52)", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  hintText:   { color: "#fff", fontSize: 13, fontWeight: "500" },

  bottomBar:  { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", gap: 12, zIndex: 20 },

  capturingRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  capturingTxt:  { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600" },

  mainBtn:    { paddingHorizontal: 48, paddingVertical: 15, borderRadius: 16, backgroundColor: SAGE, minWidth: 220, alignItems: "center" },
  mainBtnOff: { backgroundColor: "rgba(122,143,107,0.35)" },
  mainBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  subNote:    { color: "rgba(255,255,255,0.38)", fontSize: 12 },

  manualBtn:  { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  manualBtnTxt: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "600" },
});