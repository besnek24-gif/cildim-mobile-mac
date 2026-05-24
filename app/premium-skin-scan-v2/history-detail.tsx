/**
 * premium-skin-scan-v2 — HistoryDetailScreen
 *
 * Seçilen analizi detaylıca gösterir.
 * idx > 0 ise → en son analizle karşılaştırma bölümü eklenir.
 *
 * URL params: idx (string → int)
 * Hook'lar koşullu return'lardan ÖNCE.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreRing }                         from "@/components/ScoreRing";
import { ScanBottomNav, SCAN_NAV_HEIGHT }    from "@/components/ScanBottomNav";
import { historyStore }                      from "@/local_demo_data/safe_runtime_shims_v74";
import { resultStore }                       from "@/local_demo_data/safe_runtime_shims_v74";
import { routineProgramStore, buildRoutineFromAnalysis } from "@/local_demo_data/safe_runtime_shims_v74";
import type { AnalysisResult, RoutineStep }  from "@/local_demo_data/safe_runtime_shims_v74";
import type { SkinScanContextBundle }        from "@/lib/skinAnalysis/contextBundle";

// ─── ECZ4 SAVED-ROUTINE-FIX-3 ────────────────────────────────────────────────
// History'den 'Ürünleri Gör' / 'Bu Rutini Kullan' tıklandığında routine-program
// resultStore.getContextBundle() okur. Bundle yoksa SAFE_FALLBACK_BUNDLE
// (minimal/low_confidence) okunur → routine-program buildRoutineFromAnalysis
// sonucu daraltır ve kullanıcıya bu detay ekranındakinden FARKLI (daha az)
// adım sayısı gösterir.
//
// Çözüm: history entry için "viewing saved routine" bundle'ını set et.
// Bu bundle full eligibility ve high reliability kullandığı için
// buildRoutineFromAnalysis() restricted filtre uygulamaz → ekran tam plan
// gösterir, "Analiz Detayı" ile birebir aynı adım sayısı.
// cannotDetermineFields: ["viewing_saved_routine"] → routine-program save
// handler'ı (L873) yeniden-kayıt'ı engeller, yeni tarama gerektirir.
function buildViewingBundleFor(entry: AnalysisResult): SkinScanContextBundle {
  // ECZ4 SAVED-ROUTINE-FIX-3 (rev2 — architect feedback): historyStore
  // orijinal SkinScanContextBundle'ı saklamıyor. Sentetik full/high bundle
  // recommendation safety filter'ını (decideMode=off) kapatır → blocked/
  // minimal kökenli geçmiş bir analiz bile aktif-ağır ürün önerebilir.
  // Bu nedenle bundle CONSERVATIVE tutulur (low_confidence + minimal); böylece
  // applyScanRecommendationSafetyFilter aktif kalır ve PremiumStepRow yanlış
  // ürünü göstermez. routine-program ekranı 'viewing_saved_routine' bayrağını
  // görünce projection'u bundle'sız üretir → entry'nin tam adım planını
  // "Analiz Detayı"yla birebir aynı şekilde render eder.
  return {
    ageGroup: "unknown",
    selectedConcerns: entry.concerns ?? [],
    imageQualityScore: 0,
    minImageQualityScore: 0,
    poseComplianceScore: 0,
    visualConfidence: 0,
    detectedVisibleConcerns: [],
    contradictionWarnings: [],
    cannotDetermineFields: ["viewing_saved_routine"],
    riskMode: "low_confidence",
    resultReliabilityLevel: "low",
    routineEligibility: "minimal",
    safetyMessages: [
      "Geçmiş analiz görüntüleniyor; ürün önerileri yalnız temel bakım kategorisinde tutulur. Yeni öneriler için güncel tarama gerekir.",
    ],
    serverPoseComplianceOk: null,
    hasCriticalContradictions: false,
    computedAt: entry.timestamp,
    bundleVersion: 1,
  };
}

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const WHITE  = "#FFFFFF";
const RED    = "#D97070";

// ─── Tarih formatlama ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Oca","Şub","Mar","Nis","May","Haz",
    "Tem","Ağu","Eyl","Eki","Kas","Ara",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} — ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ─── Karşılaştırma kartı ──────────────────────────────────────────────────────

function ComparisonCard({
  older,
  newer,
}: {
  older: AnalysisResult;
  newer: AnalysisResult;
}) {
  const delta      = newer.score - older.score;
  const improved   = delta > 0;
  const worsened   = delta < 0;
  const stable     = delta === 0;

  const arrowColor = improved ? SAGE : worsened ? RED : MUTED;
  const arrowChar  = improved ? "↑" : worsened ? "↓" : "→";
  const deltaLabel =
    improved ? `+${delta} puan iyileşme` :
    worsened ? `${delta} puan düşüş`     :
               "Değişim yok";
  const psyMsg =
    improved ? "Cildin toparlanıyor." :
    worsened ? "Son günler etkili olmamış." :
               "Denge korunmuş.";

  return (
    <View style={cc.card}>
      <Text style={cc.heading}>Son Analizle Karşılaştırma</Text>

      {/* İki skor yan yana */}
      <View style={cc.row}>
        {/* Bu analiz (eski) */}
        <View style={cc.col}>
          <Text style={cc.colLabel}>Bu analiz</Text>
          <Text style={cc.colDate}>{formatDate(older.timestamp).split(" — ")[0]}</Text>
          <Text style={[cc.colScore, { color: MUTED }]}>{older.score}</Text>
        </View>

        {/* Ok + delta */}
        <View style={cc.midCol}>
          <Text style={[cc.arrow, { color: arrowColor }]}>{arrowChar}</Text>
          <Text style={[cc.delta, { color: arrowColor }]}>{deltaLabel}</Text>
        </View>

        {/* Son analiz (daha yeni) */}
        <View style={cc.col}>
          <Text style={cc.colLabel}>Son analiz</Text>
          <Text style={cc.colDate}>{formatDate(newer.timestamp).split(" — ")[0]}</Text>
          <Text style={[cc.colScore, { color: improved ? SAGE : worsened ? RED : INK }]}>
            {newer.score}
          </Text>
        </View>
      </View>

      {/* Psikolojik mesaj */}
      <View style={[cc.msgWrap, {
        backgroundColor: improved ? `${SAGE}12` : worsened ? `${RED}12` : "#F0F0F0",
        borderLeftColor:  arrowColor,
      }]}>
        <Text style={[cc.msg, { color: arrowColor }]}>{psyMsg}</Text>
      </View>
    </View>
  );
}

const cc = StyleSheet.create({
  card:      { backgroundColor: WHITE, borderRadius: 18, padding: 18, gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  heading:   { fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.8 },
  row:       { flexDirection: "row", alignItems: "center", gap: 8 },
  col:       { flex: 1, alignItems: "center", gap: 4 },
  colLabel:  { fontSize: 11, color: MUTED, fontWeight: "600" },
  colDate:   { fontSize: 11, color: `${MUTED}80` },
  colScore:  { fontSize: 36, fontWeight: "800" },
  midCol:    { alignItems: "center", gap: 4, paddingHorizontal: 4 },
  arrow:     { fontSize: 28, fontWeight: "700" },
  delta:     { fontSize: 11, fontWeight: "600", textAlign: "center" },
  msgWrap:   { borderLeftWidth: 3, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  msg:       { fontSize: 14, fontWeight: "600" },
});

// ─── Bölüm başlığı ────────────────────────────────────────────────────────────

function STitle({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.8 }}>{label}</Text>;
}

// ─── Kart ────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[ca.card, style]}>{children}</View>;
}
const ca = StyleSheet.create({
  card: { backgroundColor: WHITE, borderRadius: 18, padding: 18, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
});

// ─── Rutin adımı ──────────────────────────────────────────────────────────────

function StepRow({ step, index }: { step: RoutineStep; index: number }) {
  const roleColor =
    step.role === "Esas"   ? SAGE   :
    step.role === "Destek" ? COPPER : MUTED;
  const roleBg =
    step.role === "Esas"   ? `${SAGE}18`   :
    step.role === "Destek" ? `${COPPER}18` : "#EEE";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${SAGE}18`, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: SAGE }}>{index + 1}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: INK, fontWeight: "500" }}>{step.name}</Text>
      <View style={{ backgroundColor: roleBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: roleColor }}>{step.role}</Text>
      </View>
    </View>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function HistoryDetailScreen() {
  const { top, bottom }                   = useSafeAreaInsets();
  const { idx: idxParam }                 = useLocalSearchParams<{ idx?: string }>();
  const [history, setHistory]             = useState<AnalysisResult[]>([]);
  const [loading, setLoading]             = useState(true);
  const [routineSaved, setRoutineSaved]   = useState(false);

  // Tüm hook'lar koşullu return'lardan ÖNCE
  useEffect(() => {
    historyStore.load().then((list) => {
      setHistory(list);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={SAGE} />
      </View>
    );
  }

  const idx   = parseInt(idxParam ?? "0", 10);
  const entry = history[idx];

  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ fontSize: 16, color: MUTED, textAlign: "center" }}>Analiz bulunamadı.</Text>
        <TouchableOpacity
          style={{ marginTop: 20, backgroundColor: SAGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOlderEntry = idx > 0 && history.length >= 2;
  const newerEntry   = isOlderEntry ? history[0] : null;

  const skinTypeLabel =
    entry.skinType === "Karma"  ? "Karma Cilt"  :
    entry.skinType === "Yağlı"  ? "Yağlı Cilt"  :
    entry.skinType === "Kuru"   ? "Kuru Cilt"    :
    entry.skinType === "Normal" ? "Normal Cilt"  :
    entry.skinType === "Hassas" ? "Hassas Cilt"  :
                                   entry.skinType;

  return (
    <View style={[s.root, { paddingTop: top }]}>

      {/* Üst çubuk */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Analiz Detayı</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: bottom + SCAN_NAV_HEIGHT + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tarih satırı */}
        <Text style={s.dateLine}>{formatDate(entry.timestamp)}</Text>

        {/* Karşılaştırma (idx > 0 ise) */}
        {newerEntry && (
          <ComparisonCard older={entry} newer={newerEntry} />
        )}

        {/* Hero: Skor + cilt tipi */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 20 }}>
            <ScoreRing score={entry.score} size={110} />
            <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: INK }}>{skinTypeLabel}</Text>
              <Text style={{ fontSize: 13, color: MUTED, lineHeight: 19 }}>{entry.comment}</Text>
            </View>
          </View>
        </Card>

        {/* Bulgular */}
        <Card>
          <STitle label="BULGULAR" />
          {entry.concerns.map((c, i) => {
            const dotColors = [COPPER, `${SAGE}CC`, "#A0AEC0"];
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColors[i] ?? dotColors[0], marginTop: 6 }} />
                <Text style={{ flex: 1, fontSize: 14, color: INK, lineHeight: 21 }}>{c}</Text>
              </View>
            );
          })}
        </Card>

        {/* Sabah rutini */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <STitle label="SABAH RUTİNİ" />
            <Text style={{ fontSize: 16 }}>☀</Text>
          </View>
          {entry.morning.map((step, i) => <StepRow key={step.name} step={step} index={i} />)}
        </Card>

        {/* Akşam rutini */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <STitle label="AKŞAM RUTİNİ" />
            <Text style={{ fontSize: 16 }}>◑</Text>
          </View>
          {entry.evening.map((step, i) => <StepRow key={step.name} step={step} index={i} />)}
        </Card>

        {/* ── Aksiyon Butonları ──────────────────────────────────────────── */}
        <Card style={{ gap: 10 }}>
          <TouchableOpacity
            style={ad.primaryBtn}
            onPress={async () => {
              if (!routineSaved) {
                const prog = buildRoutineFromAnalysis(entry);
                await routineProgramStore.saveProgram(prog);
                setRoutineSaved(true);
              }
              // ECZ4 score-consistency fix: routine-program ekranı resultStore'u
              // okur. History'den açılan analiz buraya yazılmazsa Uzman Rutinim
              // ekranı buildFallback() (Karma, 70) gösterir → Analiz Detayı ile
              // skor uyuşmaz. Tek truth: resultStore.set(entry).
              resultStore.set(entry);
              // ECZ4 SAVED-ROUTINE-FIX-3 — bundle ile birlikte set, aksi halde
              // routine-program SAFE_FALLBACK (minimal) okur ve adım sayısı
              // bu detay ekranındakinden farklı olur.
              resultStore.setContextBundle(buildViewingBundleFor(entry));
              router.push("/premium-skin-scan-v2/routine-program" as any);
            }}
            activeOpacity={0.82}
          >
            <Text style={ad.primaryTxt}>
              {routineSaved ? "Rutinim Açıldı →" : "Bu Rutini Kullan"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={ad.secondaryBtn}
            onPress={() => {
              // ECZ4 score-consistency fix: aynı sebep, primary CTA ile birlikte.
              resultStore.set(entry);
              // ECZ4 SAVED-ROUTINE-FIX-3 — primary CTA ile aynı bundle stratejisi.
              resultStore.setContextBundle(buildViewingBundleFor(entry));
              router.push("/premium-skin-scan-v2/routine-program" as any);
            }}
            activeOpacity={0.82}
          >
            <Text style={ad.secondaryTxt}>Ürünleri Gör</Text>
          </TouchableOpacity>
        </Card>

      </ScrollView>
      <ScanBottomNav />
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: CREAM },
  topBar:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  back:      { color: MUTED, fontSize: 15 },
  pageTitle: { fontSize: 15, fontWeight: "700", color: INK },
  scroll:    { flex: 1 },
  content:   { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  dateLine:  { fontSize: 12, color: `${MUTED}80`, textAlign: "center", marginBottom: 4 },
});

const ad = StyleSheet.create({
  primaryBtn:  { backgroundColor: COPPER, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryTxt:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn:{ backgroundColor: `${SAGE}10`, paddingVertical: 12, borderRadius: 13, alignItems: "center", borderWidth: 1, borderColor: `${SAGE}30` },
  secondaryTxt:{ color: SAGE, fontSize: 14, fontWeight: "700" },
});