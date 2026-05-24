/**
 * premium-skin-scan-v2 — AnalysisScreen
 *
 * ECZ-SRV-1: Gerçek AI bağlantısı (artık local PRNG değil).
 *   - captureStore'dan tüm açıları okur
 *   - ImageManipulator ile 800px / q=0.72 JPEG + base64 + data:image/jpeg;base64
 *   - lib/skinIntelligence/api.ts → runDeepAnalysis(images, angles, authHeaders)
 *   - Gerçek server cevabını AnalysisResult formatına SADE adapter ile çevirir
 *   - Hata/timeout: SESSİZ FALLBACK YOK; safe error UI gösterilir
 *   - Retry → router.back() (review ekranına dön)
 *
 * Animasyon: 4 adımlı progress, AI bitene kadar son adım aktif kalır.
 *
 * Dokunulmadı: Home, Search, Supabase, scoring/ingredient engine, navigation
 * arch, product visuals, server prompt'u/endpoint'i.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImageManipulator from "expo-image-manipulator";

import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { runDeepAnalysis } from "@/lib/skinIntelligence/api";
import type { DeepAnalysisResponse } from "@/lib/skinIntelligence/types";

import { captureStore, type AngleCapture } from "@/local_demo_data/safe_runtime_shims_v74";
import type { AnalysisResult, RoleType, RoutineStep } from "@/local_demo_data/safe_runtime_shims_v74";
import { resultStore, persistResult } from "@/local_demo_data/safe_runtime_shims_v74";
import { ECZ4_RUNTIME_BUILD_ID } from "@/lib/skinAnalysis/runtimeBuildId";
import { historyStore } from "@/local_demo_data/safe_runtime_shims_v74";
import { computeContextBundle } from "@/lib/skinAnalysis/computeContextBundle";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const DANGER = "#B45A4A";

// ─── Adımlar ──────────────────────────────────────────────────────────────────

const STEPS = [
  "Fotoğraf kalitesi kontrol edildi",
  "Bakım profili hazırlanıyor",
  "Cilt bakım öncelikleri değerlendiriliyor",
  "Rutin ve ürün önerileri derleniyor",
];

const STEP_MS         = 1500;        // adımlar arası animasyon süresi
// ECZ-FINAL-QA-FIX-3: Sunucu loglarındaki gerçek responseTime'lar 65-78s
// arasında ölçüldü (3 paralel Anthropic çağrısı: Sonnet+Sonnet+Haiku).
// Önceki 75s sınırı tam P95 üzerinde olduğu için iyi-açılı taramalar
// "DEEP_TIMEOUT" alıp yanıltıcı "daha net fotoğraf" mesajı görüyordu.
// 120s, gerçek P99 marjına ek olarak şebeke gecikmesini de absorbe eder.
const DEEP_TIMEOUT_MS = 120_000;

// Server beklediği Türkçe açı etiketleri (cilt-analizi.tsx ile aynı sözlük)
const ANGLE_LABEL_MAP: Record<string, string> = {
  front: "ön",
  left:  "sol 45°",
  right: "sağ 45°",
  up:    "çene yukarı",
  down:  "çene aşağı",
};

// ─── Adım satırı bileşeni ─────────────────────────────────────────────────────

function StepRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  const dotBg =
    state === "done"   ? SAGE   :
    state === "active" ? COPPER :
                         "#D9D6D0";
  const opacity = state === "pending" ? 0.4 : 1;

  return (
    <View style={[sr.row, { opacity }]}>
      <View style={[sr.dot, { backgroundColor: dotBg }]}>
        {state === "done" && <Text style={sr.check}>✓</Text>}
      </View>
      <Text style={[sr.label, state === "active" && { color: INK, fontWeight: "600" }]}>
        {label}
      </Text>
    </View>
  );
}

const sr = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 14 },
  dot:   { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  check: { color: "#fff", fontSize: 12, fontWeight: "700" },
  label: { fontSize: 15, color: MUTED, fontWeight: "500" },
});

// ─── Adapter: server `analiz` → AnalysisResult ───────────────────────────────

const SKIN_TYPE_MAP: Record<string, AnalysisResult["skinType"]> = {
  yağlı:  "Yağlı",
  yagli:  "Yağlı",
  kuru:   "Kuru",
  karma:  "Karma",
  normal: "Normal",
  hassas: "Hassas",
};

function pickRole(idx: number, total: number): RoleType {
  if (idx < 2) return "Esas";
  if (idx < Math.max(3, total - 1)) return "Destek";
  return "İsteğe bağlı";
}

function tieredToSteps(
  tier: any,
  fallbackList: string[] | undefined,
): RoutineStep[] {
  // Önce katmanlı (profesyonel > ekonomik > seçkin) tercih
  const arr =
    (Array.isArray(tier?.profesyonel) && tier.profesyonel) ||
    (Array.isArray(tier?.ekonomik)    && tier.ekonomik)    ||
    (Array.isArray(tier?.seckin)      && tier.seckin)      ||
    null;

  if (arr && arr.length > 0) {
    return arr.slice(0, 5).map((s: any, i: number, all: any[]) => ({
      name: String(s.title ?? s.productType ?? s.productName ?? `Adım ${i + 1}`),
      role: pickRole(i, all.length),
    }));
  }

  // Tiered yoksa düz liste (gunluk_rutin_onerisi.sabah/aksam)
  if (Array.isArray(fallbackList) && fallbackList.length > 0) {
    return fallbackList.slice(0, 5).map((label, i, all) => ({
      name: String(label),
      role: pickRole(i, all.length),
    }));
  }

  return [];
}

function tieredToProducts(tier: any): { name: string; role: string; reason: string }[] {
  if (!Array.isArray(tier)) return [];
  return tier.slice(0, 3).map((s: any) => ({
    name:   String(s.productName ?? s.productType ?? s.title ?? "Ürün"),
    role:   String(s.productType ?? s.title ?? "Bakım"),
    reason: String(s.why ?? s.targetConcern ?? ""),
  }));
}

function buildProductsFromTiered(routineTiered: any): AnalysisResult["products"] {
  // Sabah ve akşamı birleştir, her tier için
  const morningSabah = routineTiered?.sabah ?? {};
  const eveningAksam = routineTiered?.aksam ?? {};
  return {
    ekonomik: [
      ...tieredToProducts(morningSabah.ekonomik),
      ...tieredToProducts(eveningAksam.ekonomik),
    ].slice(0, 4),
    profesyonel: [
      ...tieredToProducts(morningSabah.profesyonel),
      ...tieredToProducts(eveningAksam.profesyonel),
    ].slice(0, 4),
    seckin: [
      ...tieredToProducts(morningSabah.seckin),
      ...tieredToProducts(eveningAksam.seckin),
    ].slice(0, 4),
  };
}

function adaptDeepResponse(deep: DeepAnalysisResponse): AnalysisResult {
  const a: any = (deep as any).analiz ?? {};

  const rawType = String(a.cilt_tipi ?? "normal").toLowerCase();
  const skinType = SKIN_TYPE_MAP[rawType] ?? "Normal";

  // RELEASE-BLOCKER PART E — score_source: ham puanın kaynağı izlenir.
  //  - server  : geçerli sayı geldi (1..100)
  //  - default : alan yok / null / 0 → 0'a indi
  //  - invalid : NaN ya da non-finite → 0'a sabitlendi (sahte sayıya izin yok)
  // "hidden" pose-failed bağlamında sonradan analysis.tsx içinde set edilir.
  const rawPuan = a.puan;
  const numPuan = Number(rawPuan);
  let scoreSource: AnalysisResult["score_source"];
  let score: number;
  if (rawPuan === undefined || rawPuan === null) {
    scoreSource = "default";
    score = 0;
  } else if (!Number.isFinite(numPuan)) {
    scoreSource = "invalid";
    score = 0;
  } else if (numPuan < 0 || numPuan > 100) {
    // ARCHITECT FOLLOW-UP: anormal aralık (negatif veya >100) "invalid"
    // olarak işaretlenmeli; "default" gibi sessizce maskelenmemeli.
    scoreSource = "invalid";
    score = Math.max(0, Math.min(100, Math.round(numPuan)));
  } else {
    const clamped = Math.max(0, Math.min(100, Math.round(numPuan)));
    scoreSource = clamped > 0 ? "server" : "default";
    score = clamped;
  }

  // Concerns: önce concerns_structured.title, yoksa sorunlar
  const structured: any[] = Array.isArray(a.concerns_structured) ? a.concerns_structured : [];
  let concerns: string[] = structured
    .map((s) => String(s.title ?? "").trim())
    .filter((t) => t.length > 0);
  if (concerns.length === 0 && Array.isArray(a.sorunlar)) {
    concerns = (a.sorunlar as any[]).map((s) => String(s)).filter(Boolean);
  }

  // PART B-2 — Visible findings'i additive olarak concerns'e enjekte et.
  // Sadece server somut bir bulgu (true) döndürdüyse safe-wording terim ekle.
  // Tıbbi tanı dili (akne/eczema/dermatit) ASLA kullanılmaz; "...benzeri görünüm".
  // Server uydurma yapmasın diye: yalnızca a.visible_findings okunur, lokal tahmin yok.
  const vf: any = a.visible_findings ?? null;
  if (vf && typeof vf === "object") {
    const safeTerms: string[] = [];
    if (vf.acne_like_spots === true) safeTerms.push("Sivilce benzeri görünüm");
    if (vf.redness_like_areas === true) safeTerms.push("Kızarıklık benzeri görünüm");
    if (vf.irritation_like_appearance === true) safeTerms.push("Tahriş benzeri görünüm");
    // Diğerleri (dark_circles, visible_pores, dryness_flaking, oiliness_shine)
    // zaten concerns_structured/sorunlar üzerinden sıkça geliyor; tekrar etmemek
    // için yalnızca akne/kızarıklık/tahriş benzeri kritik sinyaller eklenir.
    for (const t of safeTerms) {
      const exists = concerns.some((c) => c.toLowerCase().includes(t.toLowerCase().split(" ")[0]));
      if (!exists) concerns.unshift(t); // önemli — başa ekle
    }
  }

  concerns = concerns.slice(0, 4);

  const comment = String(a.analiz_ozeti ?? "").trim();

  const tiered = a.routine_tiered ?? {};
  const dailySabah = (a.gunluk_rutin_onerisi?.sabah ?? []) as string[];
  const dailyAksam = (a.gunluk_rutin_onerisi?.aksam ?? []) as string[];

  const morning = tieredToSteps(tiered.sabah, dailySabah);
  const evening = tieredToSteps(tiered.aksam, dailyAksam);

  // Haftalık destek
  const weekly: RoutineStep[] = tiered.haftaDestek
    ? [{
        name: String(tiered.haftaDestek.title ?? tiered.haftaDestek.productType ?? "Haftalık destek"),
        role: "Destek",
      }]
    : [];

  return {
    id:           `pskv2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp:    new Date().toISOString(),
    skinType,
    score,
    score_source: scoreSource,
    concerns,
    comment,
    morning,
    evening,
    weekly,
    products: buildProductsFromTiered(tiered),
  };
}

// ─── Görsel sıkıştırma (cilt-analizi.tsx ile aynı pattern) ───────────────────

async function compressImage(uri: string): Promise<string | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!result.base64) return null;
    return `data:image/jpeg;base64,${result.base64}`;
  } catch {
    return null;
  }
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function AnalysisScreen() {
  const { top }                         = useSafeAreaInsets();
  const { photos }                      = useLocalSearchParams<{ photos?: string }>();
  const { getAuthHeaders }              = useAuth();

  // Tüm hook'lar koşullu return'lardan ÖNCE
  const [currentStep, setCurrentStep]   = useState(0);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const pulse                           = useRef(new Animated.Value(1)).current;
  const didRun                          = useRef(false);
  const stepTimers                      = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Pulse animasyonu ──────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // ── Adım progress'i — son adım AI bitene kadar aktif kalır ────────────────
  const startStepProgress = useCallback(() => {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = STEPS.slice(1).map((_, i) =>
      setTimeout(() => setCurrentStep(i + 1), STEP_MS * (i + 1)),
    );
  }, []);

  // ── Gerçek API analizi ────────────────────────────────────────────────────
  const runRealAnalysis = useCallback(async () => {
    if (__DEV__) {
      // RELEASE-BLOCKER PART A — analysis request marker
      console.log("[ECZ4 RELEASE BLOCKER BUILD] analysis.runRealAnalysis() request start @", new Date().toISOString());
    }
    // 1) Capture'ları topla — captureStore tek kaynak
    const allCaptures: AngleCapture[] = captureStore.get();
    const captureUris = allCaptures.map((c) => c.uri);

    // photos param geldiyse sırayı doğrula (review.tsx oradan gönderiyor)
    const paramUris: string[] | null = photos
      ? (() => {
          try { return JSON.parse(photos as string) as string[]; }
          catch { return null; }
        })()
      : null;

    // captures store'da varsa onu kullan (metadata için), yoksa param URI'leri
    let working: { uri: string; angle: AngleCapture["id"] | null; perceptualHash?: string | null }[];
    if (allCaptures.length > 0) {
      working = allCaptures.map((c) => ({ uri: c.uri, angle: c.id, perceptualHash: c.perceptualHash ?? null }));
    } else if (paramUris && paramUris.length > 0) {
      working = paramUris.map((u) => ({ uri: u, angle: null }));
    } else {
      working = [];
    }

    if (working.length === 0) {
      setErrorMsg("Fotoğraf bulunamadı. Lütfen tekrar çekim yapın.");
      return;
    }

    // 2) Hard guard: ECZ-CAP-1 metadata varsa "failed" olan açı varsa durdur.
    //    review.tsx zaten engelliyor; defansif çift-kontrol.
    const hasFailed = allCaptures.some((c) => c.qualityLabel === "failed");
    if (hasFailed) {
      setErrorMsg("Fotoğraflar analiz için yeterince güvenilir değil. Lütfen tekrar çekin.");
      return;
    }

    // 3) Adım animasyonunu başlat
    startStepProgress();

    // 4) Görselleri paralel sıkıştır
    const compressedNullable = await Promise.all(working.map((w) => compressImage(w.uri)));
    const compressed: string[] = [];
    const angles: string[] = [];
    // ECZ4 HYBRID-POSE-GUARD — capture'ta hesaplanmış perceptualHash'leri
    // compressed[] ile aynı sıraya hizala ve sunucuya gönder. Sunucu hardBlock
    // dediğinde bu hash'ler "kullanıcı gerçekten 5 farklı açı çekmiş mi?"
    // sorusuna ikinci kanıt olarak hizmet eder.
    const imageHashes: (string | null | undefined)[] = [];
    for (let i = 0; i < compressedNullable.length; i++) {
      const img = compressedNullable[i];
      if (!img) continue;
      compressed.push(img);
      const angleId = working[i].angle;
      angles.push((angleId && ANGLE_LABEL_MAP[angleId]) || "ön");
      imageHashes.push(working[i].perceptualHash ?? null);
    }

    if (compressed.length === 0) {
      setErrorMsg("Fotoğraflar hazırlanamadı. Lütfen tekrar deneyin.");
      return;
    }

    // 5) Auth header — Bearer token
    let authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    try {
      authHeaders = await getAuthHeaders();
    } catch {
      // Devam — server 401 dönecek
    }

    // ECZ4 PART F — yeni tarama başında resultStore'u resetle: eski score
    // (ör. 62) ya da eski bundle yeni cevaba sızamasın. scan_id üretilir;
    // analysis ve save loglarında bu kimlik görünür.
    const scanIdent = resultStore.resetForNewScan();
    if (__DEV__) {
      console.log("[ECZ4_RUNTIME_BUILD_ID]", ECZ4_RUNTIME_BUILD_ID,
        "analysis.request.start", { scan_id: scanIdent.scan_id, started_at: scanIdent.started_at, angle_count: compressed.length });
    }

    // 6) Gerçek deep analiz çağrısı + 75s timeout (server ~50s'e kadar uzayabilir).
    //    Promise.race ile timeout. SESSİZ FALLBACK YOK.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DEEP_TIMEOUT")), DEEP_TIMEOUT_MS),
    );

    let deep: DeepAnalysisResponse | null = null;
    try {
      deep = await Promise.race([
        runDeepAnalysis(compressed, angles, authHeaders, imageHashes),
        timeoutPromise,
      ]);
    } catch (err: any) {
      // ── ECZ-FINAL-QA-FIX-3 PART C — Hata sınıflandırma ───────────────────
      // Önceki davranış tüm hataları "daha net fotoğraf" mesajına normalize
      // ediyordu. Bu, timeout/auth/server hatasında YANILTICI. Şimdi her
      // sınıf için doğru Türkçe mesaj gösterilir; foto kalitesi mesajı
      // sadece gerçekten format/parse problemi olduğunda kullanılır.
      const msg    = String(err?.message ?? "");
      const code   = String(err?.code ?? "");
      // Status önceliği: Error.status → message'taki "HTTP xxx" pattern (fallback)
      const httpMatch = msg.match(/^HTTP (\d{3})$/);
      const status: number | null =
        typeof err?.status === "number" ? err.status :
        httpMatch ? Number(httpMatch[1]) : null;
      console.warn("[AnalysisScreen] runDeepAnalysis hata:", { msg, code, status });

      if (msg === "DEEP_TIMEOUT") {
        setErrorMsg("Analiz beklenenden uzun sürdü. Lütfen bağlantınızı kontrol edip tekrar deneyin.");
      } else if (code === "PREMIUM_REQUIRED" || msg === "PREMIUM_REQUIRED" || status === 401 || status === 403) {
        setErrorMsg("Bu analiz için oturum veya üyelik doğrulaması gerekiyor.");
      } else if (
        (status !== null && status >= 500 && status <= 599) ||
        /network|fetch|abort|failed/i.test(msg)
      ) {
        setErrorMsg("Analiz servisine ulaşılamadı. Lütfen biraz sonra tekrar deneyin.");
      } else {
        setErrorMsg("Analiz güvenilir şekilde tamamlanamadı. Lütfen daha net fotoğraflarla tekrar deneyin.");
      }
      return;
    }

    // ── ECZ4 PART A — server runtime kanıt zorunluluğu ────────────────────
    // Mobile'a gelen cevap runtime_build_id veya precheck_decision içermiyorsa
    // sunucu eski sürümdedir → result'ı bloklamak için pose-failed yoluna sap.
    const dProbe: any = deep ?? {};
    const hasRuntimeProof =
      typeof dProbe.runtime_build_id === "string" &&
      dProbe.runtime_build_id === ECZ4_RUNTIME_BUILD_ID &&
      typeof dProbe.precheck_decision === "string";
    if (__DEV__) {
      console.log("[ECZ4_RUNTIME_BUILD_ID]", ECZ4_RUNTIME_BUILD_ID,
        "analysis.response.received", {
          scan_id: resultStore.getScanId(),
          server_runtime_build_id: dProbe.runtime_build_id ?? null,
          precheck_decision: dProbe.precheck_decision ?? null,
          score_source: dProbe.score_source ?? null,
          has_pose_compliance: !!dProbe.pose_compliance,
          analysis_blocked: dProbe.analysis_blocked === true,
          hasRuntimeProof,
        });
    }
    if (deep && !hasRuntimeProof) {
      console.warn("[ECZ4][BLOCK] outdated_server_response — runtime kanıtı yok, result bloklanıyor.");
      // Outdated server cevabını analysis_blocked yoluyla aynı SAFE state'e zorla.
      (deep as any).analysis_blocked = true;
      (deep as any).block_reason = "outdated_server_response";
      (deep as any).message = "Sunucu cevabı doğrulanamadı. Lütfen birkaç saniye sonra tekrar tarayın.";
      (deep as any).pose_compliance = (deep as any).pose_compliance ?? { overall_ok: false, score: 0 };
    }

    // ── RELEASE-BLOCKER PART C — server pose precheck blocked path ────────
    // Sunucu ucuz haiku ile pose uyumunu doğruladı ve başarısız buldu →
    // ana analiz çalışmadı. Mobile burada SAFE state bundle'ı kurar:
    // skor/cilt tipi/yorum/rutin/ürün önerileri TAMAMEN gizlenir; result.tsx
    // serverPoseComplianceOk=false algılayıp pose-failed kartını gösterir.
    if (deep && (deep as any).analysis_blocked === true) {
      const dAny: any = deep as any;
      if (__DEV__) {
        console.warn("[ECZ4 RELEASE BLOCKER BUILD] analysis_blocked received:", {
          block_reason: dAny.block_reason,
          pose_compliance: dAny.pose_compliance,
        });
      }
      const blockedAdapted: AnalysisResult = {
        id:           `pskv2-blocked-${Date.now()}`,
        timestamp:    new Date().toISOString(),
        skinType:     "Normal",
        score:        0,
        score_source: "hidden",
        concerns:     [],
        comment:      "",
        morning:      [],
        evening:      [],
        weekly:       [],
        products:     { ekonomik: [], profesyonel: [], seckin: [] },
      };
      resultStore.set(blockedAdapted);
      persistResult(blockedAdapted).catch(() => {});
      // Bundle: pose-failed safe state. computeContextBundle çağırmıyoruz
      // çünkü `analiz` payload'u yok; doğrudan kontrollü bir bundle yazıyoruz.
      // ECZ4 PRECHECK-UNAVAILABLE-MESSAGE-FIX — Sunucu precheck JSON parse/network
      // hatasıyla başarısız olduğunda (block_reason === "precheck_unavailable"),
      // kullanıcıya "Fotoğraf açıları yeniden çekilmeli" demek doğru DEĞİL —
      // çünkü model açıları kontrol bile edemedi. Burada bundle'a block_reason'ı
      // taşıyıp result.tsx'in doğru mesajı seçmesini sağlıyoruz. Gerçek pose-fail
      // durumlarında (same_angle / front_unusable / side_diversity_failed)
      // mevcut "Fotoğraflar istenen açılarla uyumlu görünmüyor" mesajı korunur.
      const blockReasonRaw = String(dAny.block_reason ?? "").trim();
      const isPrecheckUnavailable = blockReasonRaw === "precheck_unavailable";
      const blockedSafetyMessage = isPrecheckUnavailable
        ? "Açı uygunluk kontrolü tamamlanamadı. Lütfen birkaç saniye sonra tekrar deneyin."
        : String(dAny.message ?? "Fotoğraflar istenen açılarla uyumlu görünmüyor. Profil oluşturmak için düz, sağ, sol, yukarı ve aşağı açıları yeniden çekmelisiniz.");
      const blockedBundle = {
        ageGroup: "unknown" as const,
        selectedConcerns: [] as string[],
        imageQualityScore: 0,
        minImageQualityScore: 0,
        poseComplianceScore: typeof dAny.pose_compliance?.score === "number" ? dAny.pose_compliance.score : 0,
        visualConfidence: 0,
        detectedVisibleConcerns: [] as string[],
        contradictionWarnings: [] as string[],
        cannotDetermineFields: [isPrecheckUnavailable ? "precheck_unavailable" : "pose_compliance_failed"],
        riskMode: "low_confidence" as const,
        resultReliabilityLevel: "insufficient" as const,
        routineEligibility: "blocked" as const,
        safetyMessages: [blockedSafetyMessage],
        serverPoseComplianceOk: false,
        hasCriticalContradictions: true,
        computedAt: new Date().toISOString(),
        bundleVersion: 1 as const,
      };
      resultStore.setContextBundle(blockedBundle);
      setCurrentStep(STEPS.length - 1);
      setTimeout(() => setCurrentStep(STEPS.length), 200);
      setTimeout(() => router.replace("/premium-skin-scan-v2/result" as any), 700);
      return;
    }

    if (!deep || !(deep as any).analiz) {
      // Sunucu cevap döndü ama beklenen `analiz` alanı yok → format problemi.
      // Bu gerçekten "geçerli ama eksik cevap" sınıfıdır; foto kalitesi mesajı
      // burada doğru kalır çünkü Anthropic JSON üretemediğinde tipik olarak
      // görsel kalitesi/içerik anlaşılırlığı ile ilişkilidir.
      setErrorMsg("Analiz güvenilir şekilde tamamlanamadı. Lütfen daha net fotoğraflarla tekrar deneyin.");
      return;
    }

    // 7) Sonucu adapt et + persist + history
    let adapted: AnalysisResult;
    try {
      adapted = adaptDeepResponse(deep);
    } catch {
      setErrorMsg("Analiz sonucu okunamadı. Lütfen tekrar deneyin.");
      return;
    }

    // ECZ4 FINAL-FIX-2 — score teşhis logu (sadece dev). Server'dan dönen
    // ham `puan` ile adapter sonrası `score` arasında fark var mı, sürekli
    // ~62 dönüyor mu, contextBundle eligibility nasıl çıkıyor — bunları
    // konsoldan gözlemlemek için. Production build'de tamamen elenir.
    if (__DEV__) {
      const a: any = (deep as any).analiz ?? {};
      console.log("[Analysis] deep response →", {
        rawPuan: a.puan,
        rawCiltTipi: a.cilt_tipi,
        adaptedScore: adapted.score,
        adaptedScoreSource: adapted.score_source,
        adaptedSkinType: adapted.skinType,
        concernsCount: adapted.concerns.length,
        structuredCount: Array.isArray(a.concerns_structured) ? a.concerns_structured.length : 0,
        sorunlarCount: Array.isArray(a.sorunlar) ? a.sorunlar.length : 0,
        // FINAL-HARD-LOCK TASK 6 — pose & visible findings teşhis
        pose_compliance: a.pose_compliance ?? null,
        visible_findings: a.visible_findings ?? null,
      });
    }

    resultStore.set(adapted);
    persistResult(adapted).catch(() => {});
    historyStore.push(adapted).catch(() => {});

    // ── ECZ-CTX-GATE-1 ─────────────────────────────────────────────────────
    // Tek seferlik hesaplama → resultStore'a yaz. result.tsx ve
    // routine-program.tsx bu bundle'ı tüketir; paralel truth yok.
    try {
      const bundle = computeContextBundle({
        captures: allCaptures,
        analysisResult: adapted,
        rawAnalysis: (deep as any).analiz,
        ageGroup: captureStore.getScanSubjectAgeGroup(),
        // selectedConcerns: ileride concern-picker eklendiğinde geçilecek
      });
      // ECZ4 PRECHECK-UNAVAILABLE-ALLOW (mobile soft-note + reliability cap):
      // Sunucu precheck'i tamamlayamadığında deep analiz devam ediyor (yanlış
      // suçlama YOK), ama kullanıcıya sessizce nedenini söylemek için bundle'a
      // tek satırlık nötr not ekliyoruz ve reliability'yi medium'a sınırlıyoruz.
      // Skor/profil/rutin/save POLİTİKASI değişmez — yalnız küçük bilgi notu.
      try {
        const _decision = String((deep as any)?.precheck_decision ?? "");
        // ECZ4 HYBRID-POSE-GUARD — iki "soft allow" durumu için soft-note + cap:
        //   • precheck_unavailable_allow: precheck modeli cevap veremedi
        //   • hybrid_soft_allow: server hard_block istedi ama client hash'leri
        //     açı çeşitliliğini doğruladı → temkinli devam
        // Skor/profil/rutin/save POLİTİKASI değişmez; yalnız bilgi notu + reliability medium cap.
        let _note: string | null = null;
        if (_decision === "precheck_unavailable_allow") {
          _note = "Açı uygunluk kontrolü bu denemede tam doğrulanamadı.";
        } else if (_decision === "hybrid_soft_allow") {
          _note = "Açı uygunluğu tam doğrulanamadı; sonuç temkinli değerlendirilmelidir.";
        }
        if (_note) {
          const existing = Array.isArray((bundle as any).safetyMessages)
            ? ((bundle as any).safetyMessages as string[])
            : [];
          if (!existing.includes(_note)) {
            (bundle as any).safetyMessages = [_note, ...existing];
          }
          // Reliability cap: yalnız "high" ise "medium"a düşür; daha düşükse dokunma.
          if ((bundle as any).resultReliabilityLevel === "high") {
            (bundle as any).resultReliabilityLevel = "medium";
          }
        }
      } catch {
        // soft-note ekleme kritik değil; sessizce geç
      }
      resultStore.setContextBundle(bundle);
      if (__DEV__) {
        // FINAL-HARD-LOCK TASK 6 — score-hide-reason hesaplama
        const isPoseFailed = bundle.serverPoseComplianceOk === false;
        const isBlocked = bundle.routineEligibility === "blocked";
        const scoreHideReason = isPoseFailed
          ? "pose_compliance_failed"
          : isBlocked
            ? "eligibility_blocked"
            : "score_visible";
        console.log("[Analysis] contextBundle →", {
          imageQualityScore: bundle.imageQualityScore,
          minImageQualityScore: bundle.minImageQualityScore,
          poseComplianceScore: bundle.poseComplianceScore,
          serverPoseComplianceOk: bundle.serverPoseComplianceOk,
          visualConfidence: bundle.visualConfidence,
          reliability: bundle.resultReliabilityLevel,
          riskMode: bundle.riskMode,
          eligibility: bundle.routineEligibility,
          contradictionCount: bundle.contradictionWarnings.length,
          safetyMessageCount: bundle.safetyMessages.length,
          cannotDetermine: bundle.cannotDetermineFields,
          scoreHideReason,
          adaptedScoreShown: adapted.score,
        });
      }
    } catch {
      // Bundle hesaplanamazsa SAFE_FALLBACK_BUNDLE devreye girer (consumer tarafı).
      resultStore.setContextBundle(null);
    }

    // 8) Tüm adımları done yap ve sonuca geç
    setCurrentStep(STEPS.length - 1);
    setTimeout(() => {
      setCurrentStep(STEPS.length); // tüm adımlar done görünür
    }, 200);
    setTimeout(() => {
      router.replace("/premium-skin-scan-v2/result" as any);
    }, 700);
  }, [photos, getAuthHeaders, startStepProgress]);

  // ── Tek kez çalıştır ──────────────────────────────────────────────────────
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    runRealAnalysis();

    return () => {
      stepTimers.current.forEach(clearTimeout);
    };
  }, [runRealAnalysis]);

  // ── Retry handler ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    // Review ekranına geri dön (oradan tekrar başlatılır veya yeniden çekilir)
    if (router.canGoBack()) router.back();
    else router.replace("/premium-skin-scan-v2/review" as any);
  }, []);

  // ── ERROR UI ──────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <View style={[s.root, { paddingTop: top + 20 }]}>
        <View style={s.errorCard}>
          <View style={s.errorIcon}>
            <Text style={s.errorIconText}>!</Text>
          </View>
          <Text style={s.errorTitle}>Analiz tamamlanamadı</Text>
          <Text style={s.errorMsg}>{errorMsg}</Text>
          <Pressable style={s.retryBtn} onPress={handleRetry}>
            <Text style={s.retryText}>Geri dön ve tekrar dene</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Yükleniyor UI ─────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: top + 20 }]}>

      {/* Animasyonlu merkez halka */}
      <View style={s.sphereArea}>
        <Animated.View style={[s.halo, { transform: [{ scale: pulse }] }]} />
        <View style={s.ring}>
          <View style={s.ringInner} />
        </View>
      </View>

      {/* Başlık */}
      <View style={s.titleArea}>
        <Text style={s.title}>Cilt bakım profili hazırlanıyor</Text>
        <Text style={s.sub}>Fotoğraflar analiz ediliyor — bu bir miktar sürebilir</Text>
      </View>

      {/* Adımlar */}
      <View style={s.stepsCard}>
        {STEPS.map((label, i) => {
          const state =
            i < currentStep   ? "done"    :
            i === currentStep ? "active"  :
                                "pending";
          return <StepRow key={label} label={label} state={state} />;
        })}
        <View style={s.spinnerRow}>
          <ActivityIndicator size="small" color={SAGE} />
          <Text style={s.spinnerLabel}>AI dermatoloji modeli çalışıyor…</Text>
        </View>
      </View>

      {/* Alt not */}
      <Text style={s.note}>
        Fotoğraflarınız bakım önerisi hazırlamak için kullanılıyor; kesin tanı değildir.
      </Text>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: CREAM, alignItems: "center", paddingHorizontal: 24 },

  sphereArea: { marginTop: 40, marginBottom: 36, alignItems: "center", justifyContent: "center" },
  halo:       {
    position: "absolute",
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: `${SAGE}16`,
  },
  ring:       {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: `${SAGE}60`,
    alignItems: "center", justifyContent: "center",
    backgroundColor: `${SAGE}0A`,
  },
  ringInner:  {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: SAGE,
  },

  titleArea:  { alignItems: "center", gap: 6, marginBottom: 40 },
  title:      { fontSize: 22, fontWeight: "700", color: INK },
  sub:        { fontSize: 14, color: MUTED, textAlign: "center" },

  stepsCard:  {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EFEBE3",
  },
  spinnerLabel: { fontSize: 13, color: MUTED, fontWeight: "500" },

  note:       { marginTop: 24, fontSize: 12, color: `${MUTED}88`, textAlign: "center" },

  // Error UI
  errorCard: {
    marginTop: 80,
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  errorIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: `${DANGER}18`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  errorIconText: { fontSize: 28, fontWeight: "700", color: DANGER },
  errorTitle: { fontSize: 18, fontWeight: "700", color: INK },
  errorMsg:   { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    marginTop: 8,
    backgroundColor: SAGE,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});