/**
 * premium-skin-scan-v2 — ReviewScreen
 *
 * 5 çekilmiş açıyı orbit/sarkaç düzeninde gösterir.
 * - Merkez: ön (front)
 * - Çevre: left · right · up · down
 * Her çevre görüntüsü kendi phase'iyle float animasyonu yapar.
 *
 * "Analizi Başlat" → /analysis (tüm URI'ler params ile)
 * "↺ Tekrar çek" → ilgili açı için /capture?retakeFrom=i
 *
 * Store YOK · analiz YOK · hook'lar koşullu return'lardan ÖNCE.
 */

import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { captureStore, type AngleCapture } from "@/local_demo_data/safe_runtime_shims_v74";
import { analyzePhotosBrightness, hammingDistanceHex } from "@/local_demo_data/safe_runtime_shims_v74";
import { useUserPreferences } from "@/context/UserPreferencesContext";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";

// ─── Orbit pozisyonları (300x300 canvas) ─────────────────────────────────────
// Her çevre görüntüsü: boyut 80x80
//   left  → cx=48,  cy=150  →  left:8,   top:110
//   right → cx=252, cy=150  →  left:212, top:110
//   up    → cx=150, cy=38   →  left:110, top:-2
//   down  → cx=150, cy=262  →  left:110, top:222

const ORBIT_POSITIONS = [
  { key: "left",  left:   8, top: 110, label: "Sol"    },
  { key: "right", left: 212, top: 110, label: "Sağ"    },
  { key: "up",    left: 110, top:  -2, label: "Yukarı" },
  { key: "down",  left: 110, top: 222, label: "Aşağı"  },
] as const;

// ─── Tek orbit resim bileşeni ─────────────────────────────────────────────────

function OrbitImage({
  uri,
  label,
  floatAnim,
  size,
  style,
  onRetake,
}: {
  uri:       string;
  label:     string;
  floatAnim: Animated.Value;
  size:      number;
  style?:    object;
  onRetake?: () => void;
}) {
  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  return (
    <Animated.View style={[{ transform: [{ translateY }] }, style]}>
      {/* Resim + badge */}
      <View style={[oi.imgWrap, { width: size, height: size, borderRadius: size * 0.22 }]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size * 0.22 }}
          resizeMode="cover"
        />
        {/* Yeşil onay rozeti */}
        <View style={oi.check}><Text style={oi.checkTxt}>✓</Text></View>
        {/* Retake butonu */}
        {onRetake && (
          <TouchableOpacity style={oi.retake} onPress={onRetake} hitSlop={6} activeOpacity={0.8}>
            <Text style={oi.retakeTxt}>↺</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Açı etiketi */}
      <Text style={[oi.label, { width: size, textAlign: "center" }]}>{label}</Text>
    </Animated.View>
  );
}

const oi = StyleSheet.create({
  imgWrap:  {
    overflow: "hidden",
    shadowColor: COPPER,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  check:    { position: "absolute", bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: SAGE, alignItems: "center", justifyContent: "center" },
  checkTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  retake:   { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center" },
  retakeTxt:{ color: "#fff", fontSize: 12 },
  label:    { color: "#6B6B6B", fontSize: 11, fontWeight: "600", marginTop: 5 },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { preferences } = useUserPreferences();

  // ── Floating animasyonlar — 4 çevre görüntüsü için ───────────────────────
  // Tüm hook'lar koşullu return'lardan ÖNCE
  const floatAnims = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0))
  ).current;

  // Parlaklık safety-net validasyon state'i (koşullu return'dan ÖNCE)
  const [validating, setValidating] = useState(false);

  // ── ECZ-CAP-1: tara öznesi yaş grubu safety flag'ini store'a yansıt ──────
  // profil-kur "Ürünü bir çocuk için mi arıyorsun?" → for_child special condition.
  // Burada sadece flag taşınır; pediatric routine bu adımda KURULMAZ.
  useEffect(() => {
    const isChild =
      preferences?.specialConditions?.includes("for_child") === true;
    captureStore.setScanSubjectAgeGroup(isChild ? "child" : "unknown");
  }, [preferences?.specialConditions]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loops: Animated.CompositeAnimation[] = [];

    floatAnims.forEach((anim, i) => {
      const duration = 1900 + i * 180;          // her biri farklı hızda
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      );
      loops.push(loop);
      // Stagger: 450ms arayla başla
      const t = setTimeout(() => loop.start(), i * 450);
      timers.push(t);
    });

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
  }, []);

  // ── Veri ──────────────────────────────────────────────────────────────────
  const angles   = captureStore.get();  // anlık kopya
  const frontImg = angles.find((a) => a.id === "front");

  // Eksik veri kontrolü (koşullu return — hook'lardan SONRA)
  if (angles.length < 5 || !frontImg) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: INK, fontSize: 16 }}>Fotoğraflar bulunamadı.</Text>
        <TouchableOpacity onPress={() => router.replace("/premium-skin-scan-v2/capture" as any)} style={{ marginTop: 16 }}>
          <Text style={{ color: SAGE, fontSize: 15, fontWeight: "600" }}>Yeniden Çek</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Retake: belirtilen açıdan yeniden başla ───────────────────────────────
  function retakeFrom(angleIdx: number) {
    captureStore.truncateTo(angleIdx);
    router.push({ pathname: "/premium-skin-scan-v2/capture" as any, params: { retakeFrom: String(angleIdx) } });
  }

  // ANGLES sırası: front=0, left=1, right=2, up=3, down=4
  const angleIdxMap: Record<string, number> = {
    front: 0, left: 1, right: 2, up: 3, down: 4,
  };

  // ── Analizi başlat (parlaklık + composite quality safety-net) ────────────
  // ECZ-CAP-1: composite quality metadata'sı varsa tek-kaynak truth burası.
  // No silent optimism: metadata eksikse "fair" ve üstü davranış varsayılmaz.
  async function startAnalysis() {
    if (validating) return;
    setValidating(true);
    try {
      const uris    = angles.map((a) => a.uri);

      // Legacy brightness gate (geriye dönük; cache'li, ucuz)
      const reports     = await analyzePhotosBrightness(uris);
      const frontIdx    = angles.findIndex((a) => a.id === "front");
      const frontReport = frontIdx >= 0 ? reports[frontIdx] : null;
      const frontFailed = !frontReport || !frontReport.ok;
      const brightFailedCount = reports.filter((r) => !r.ok).length;

      // ECZ-CAP-1 composite gate — required-angle semantik + no-silent-optimism
      const REQUIRED_ANGLES: ReadonlyArray<AngleCapture["id"]> = [
        "front", "left", "right", "up", "down",
      ];
      const CRITICAL_ANGLES: ReadonlyArray<string> = ["front", "left", "right"];

      const missingFront      = !angles.some((a) => a.id === "front");
      const tooFew            = angles.length < REQUIRED_ANGLES.length;

      // Required açıları map'le; eksik olanlar undefined döner.
      const requiredCaptures  = REQUIRED_ANGLES.map(
        (id) => angles.find((a) => a.id === id),
      );

      // Required açılardan herhangi biri "failed" → blok.
      const requiredFailed    = requiredCaptures.some(
        (c) => c?.qualityLabel === "failed",
      );

      // No-silent-optimism: required açılardan herhangi birinin kalite
      // metadata'sı yoksa BLOK. Tek bir frame'in metadata'sı olmadan ortalama
      // hesaplamak ve onu "fair" sayıp geçirmek tehlikeli.
      const requiredMissingMeta = requiredCaptures.some(
        (c) => !c || typeof c.qualityScore !== "number",
      );

      // No-silent-optimism: skor metadata yoksa konservatif 50 (fair tavanı).
      const effectiveScores   = angles.map((a) =>
        typeof a.qualityScore === "number" ? a.qualityScore : 50,
      );
      const avgQuality        = effectiveScores.length > 0
        ? effectiveScores.reduce((s, v) => s + v, 0) / effectiveScores.length
        : 0;
      const minQuality        = effectiveScores.length > 0
        ? Math.min(...effectiveScores)
        : 0;

      const poorOrFailedCount = angles.filter(
        (a) => a.qualityLabel === "poor" || a.qualityLabel === "failed",
      ).length;

      const multipleFaceAngle = angles.find(
        (a) => typeof a.faceCount === "number" && a.faceCount > 1,
      );

      const criticalPoseFail  = angles.find(
        (a) => CRITICAL_ANGLES.includes(a.id) && a.poseAngleOk === false,
      );

      // ── ECZ-FINAL-QA-FIX-5 — Erken aynı-açı reddi (perceptual hash) ──────
      // ESKİ DAVRANIŞ (kaldırıldı): brightness + sharpness varyans/range
      // eşikleri. Aynı oda/ışıkta çekilen GERÇEKTEN farklı 5 açıyı yanlış
      // pozitif ile reddediyordu (ışık ve odak açıyla az değişir).
      //
      // YENİ DAVRANIŞ: perceptual dHash (qualityGate.computePerceptualHash)
      // ile front fotoğrafını diğer 4 açı ile karşılaştır. Hash benzerliği
      // gerçek piksel desenine dayanır → yüz pozu değişikliğine duyarlı.
      // Konservatif kural: SADECE 4 non-front açının HEPSİ front'a çok
      // yakınsa (Hamming ≤ 8 / 64) hard-block. Eksik hash veya farklı
      // imzalar → hard-block YOK; computeContextBundle ileride yumuşak
      // downgrade uygulayabilir.
      const frontHash = frontImg?.perceptualHash;
      const otherIds: ReadonlyArray<AngleCapture["id"]> = ["left", "right", "up", "down"];
      const otherHashes = otherIds.map(
        (id) => angles.find((a) => a.id === id)?.perceptualHash,
      );
      const HAMMING_NEAR_DUP = 8; // 64-bit hash'ten ≤8 bit fark = neredeyse aynı
      const allHashesPresent = !!frontHash && otherHashes.every((h) => !!h);
      const allOthersNearDup = allHashesPresent &&
        otherHashes.every((h) => {
          const d = hammingDistanceHex(frontHash, h);
          return d >= 0 && d <= HAMMING_NEAR_DUP;
        });

      if (allOthersNearDup) {
        Alert.alert(
          "Açı çeşitliliği yetersiz",
          "Fotoğraflar birbirine çok benzer çıktı. Lütfen düz, sağ, sol, yukarı ve aşağı açılarını yüzünüzü gerçekten çevirerek tekrar çekin.",
          [{ text: "Tamam" }],
        );
        return;
      }

      const blocked =
        missingFront ||
        tooFew ||
        requiredFailed ||
        requiredMissingMeta ||
        avgQuality < 50 ||
        minQuality < 35 ||
        poorOrFailedCount > 1 ||
        !!multipleFaceAngle ||
        !!criticalPoseFail ||
        // Legacy brightness güvenlik ağı (her durumda geçerli)
        frontFailed ||
        brightFailedCount > 1;

      if (blocked) {
        Alert.alert(
          "Fotoğraflar yetersiz",
          "Fotoğraflar analiz için yeterince güvenilir görünmüyor. Daha net, aydınlık ve yüzün kadrajda olduğu fotoğraflarla tekrar deneyin.",
          [{ text: "Tamam" }],
        );
        return;
      }

      router.push({
        pathname: "/premium-skin-scan-v2/analysis" as any,
        params:   { photos: JSON.stringify(uris) },
      });
    } finally {
      setValidating(false);
    }
  }

  return (
    <View style={s.root}>
      {/* Üst kısım — başlık */}
      <View style={[s.header, { paddingTop: top + 16 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} activeOpacity={0.75}>
          <Text style={s.backIcon}>✕</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.title}>5 Açı Tamamlandı</Text>
          <Text style={s.subtitle}>Tüm fotoğraflar alındı</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Orbit canvas ─────────────────────────────────────────────────── */}
        <View style={s.orbitContainer}>

          {/* Çevre görüntüleri (4 adet) */}
          {ORBIT_POSITIONS.map((pos, i) => {
            const found = angles.find((a) => a.id === pos.key);
            if (!found) return null;
            const storeIdx = angleIdxMap[pos.key] ?? i + 1;
            return (
              <View
                key={pos.key}
                style={[s.orbitAbsolute, { left: pos.left, top: pos.top }]}
              >
                <OrbitImage
                  uri={found.uri}
                  label={pos.label}
                  floatAnim={floatAnims[i]}
                  size={80}
                  onRetake={() => retakeFrom(storeIdx)}
                />
              </View>
            );
          })}

          {/* Merkez — front (büyük, sabit) */}
          <View style={s.frontCenter}>
            <View style={s.frontGlow}>
              <Image
                source={{ uri: frontImg.uri }}
                style={s.frontImg}
                resizeMode="cover"
              />
              <View style={s.frontCheck}><Text style={s.frontCheckTxt}>✓</Text></View>
              <TouchableOpacity style={s.frontRetake} onPress={() => retakeFrom(0)} hitSlop={6} activeOpacity={0.8}>
                <Text style={s.frontRetakeTxt}>↺</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.frontLabel}>Ön</Text>
          </View>

        </View>

        {/* ── Durum satırı ────────────────────────────────────────────────── */}
        <View style={s.statusRow}>
          <View style={s.statusPill}>
            <View style={s.statusDot} />
            <Text style={s.statusTxt}>5 / 5 açı hazır</Text>
          </View>
        </View>

        {/* ── Açı listesi (küçük özet) ─────────────────────────────────────── */}
        <View style={s.listCard}>
          {angles.map((a, i) => (
            <View key={a.id} style={[s.listRow, i < angles.length - 1 && s.listDivider]}>
              <View style={s.listCheck}><Text style={s.listCheckTxt}>✓</Text></View>
              <Text style={s.listLabel}>{a.label}</Text>
              <TouchableOpacity onPress={() => retakeFrom(angleIdxMap[a.id] ?? i)} hitSlop={8}>
                <Text style={s.listRetake}>Tekrar çek</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Alt CTA ─────────────────────────────────────────────────────────── */}
      <View style={[s.ctaBar, { paddingBottom: bottom + 16 }]}>
        <TouchableOpacity style={s.analyzeBtn} onPress={startAnalysis} activeOpacity={0.85}>
          <Text style={s.analyzeBtnTxt}>Profili Oluştur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: CREAM,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  backIcon:     { color: INK, fontSize: 16, fontWeight: "600" },
  headerCenter: { flex: 1, alignItems: "center" },
  title:        { fontSize: 18, fontWeight: "700", color: INK },
  subtitle:     { fontSize: 13, color: "#6B6B6B", marginTop: 2 },

  scroll: { alignItems: "center", paddingTop: 20 },

  // ── Orbit ──────────────────────────────────────────────────────────────────
  orbitContainer: {
    width: 300, height: 310,
    position: "relative",
    marginBottom: 24,
  },
  orbitAbsolute:  { position: "absolute" },
  frontCenter:    {
    position: "absolute",
    left: 100, top: 100,          // cx=150, cy=155 (kompanzasyon)
    alignItems: "center",
  },
  frontGlow: {
    width: 100, height: 100,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: SAGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  frontImg:        { width: 100, height: 100, borderRadius: 22 },
  frontCheck:      { position: "absolute", bottom: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: SAGE, alignItems: "center", justifyContent: "center" },
  frontCheckTxt:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  frontRetake:     { position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  frontRetakeTxt:  { color: "#fff", fontSize: 13 },
  frontLabel:      { color: "#6B6B6B", fontSize: 11, fontWeight: "600", marginTop: 6 },

  // ── Status row ─────────────────────────────────────────────────────────────
  statusRow: { marginBottom: 20 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(122,143,107,0.12)",
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: `${SAGE}44`,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SAGE },
  statusTxt: { color: SAGE, fontSize: 14, fontWeight: "600" },

  // ── Liste kartı ────────────────────────────────────────────────────────────
  listCard: {
    width: "88%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  listRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  listDivider:{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE" },
  listCheck:  { width: 22, height: 22, borderRadius: 11, backgroundColor: SAGE, alignItems: "center", justifyContent: "center" },
  listCheckTxt:{ color: "#fff", fontSize: 11, fontWeight: "700" },
  listLabel:  { flex: 1, fontSize: 14, fontWeight: "500", color: INK },
  listRetake: { fontSize: 13, color: COPPER, fontWeight: "600" },

  // ── CTA ────────────────────────────────────────────────────────────────────
  ctaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: CREAM,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E0D9D0",
    alignItems: "center",
  },
  analyzeBtn: {
    backgroundColor: SAGE,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    shadowColor: SAGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  analyzeBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "700" },
});