/**
 * premium-skin-scan-v2 — RoutineTrackingScreen
 * Günlük check-in, haftalık bağlılık, beklenen ilerleme, karşılaştırma bağlantısı.
 *
 * Hook'lar koşullu return'lardan ÖNCE.
 */

import { router }                           from "expo-router";
import { useEffect, useState }              from "react";
import { ScanBottomNav, SCAN_NAV_HEIGHT }   from "@/components/ScanBottomNav";
import { GateCard, SeckinModal }            from "@/components/SeckinModal";
import { useAuth }                          from "@/local_demo_data/safe_runtime_shims_v74";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets }                from "react-native-safe-area-context";

import {
  routineProgramStore,
  type SavedRoutine,
  type DayRecord,
}                                           from "@/lib/premium-skin-scan-v2/routineProgramStore";
import { historyStore }                     from "@/local_demo_data/safe_runtime_shims_v74";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const WHITE  = "#FFFFFF";
const RED    = "#D97070";

// ─── Tarih yardımcısı ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function dayLabel(iso: string): string {
  return DAY_LABELS[new Date(iso).getDay()];
}

// ─── Beklenen İlerleme verisi ─────────────────────────────────────────────────

const PROGRESS_TIMELINE: Record<string, { period: string; note: string }[]> = {
  Karma: [
    { period: "2–3 hafta",       note: "T bölgesinde yağ dengesi değişimleri başlar" },
    { period: "4–6 hafta",       note: "Nem dengesi belirginleşebilir" },
    { period: "Düzenli kullanım", note: "Daha homojen, dengeli görünüm" },
  ],
  Yağlı: [
    { period: "3–4 hafta",       note: "Yağ salgısında hafif azalma" },
    { period: "6–8 hafta",       note: "Gözenek görünümünde iyileşme olabilir" },
    { period: "Düzenli kullanım", note: "Parlaklık kontrolü güçlenir" },
  ],
  Kuru: [
    { period: "1–2 hafta",       note: "Nem hissi artar" },
    { period: "4–6 hafta",       note: "Sıkışma hissinde azalma görülebilir" },
    { period: "Düzenli kullanım", note: "Daha elastik, beslenmiş görünüm" },
  ],
  Normal: [
    { period: "2–3 hafta",       note: "Cilt tonu eşitlenir" },
    { period: "6–8 hafta",       note: "Genel cilt sağlığı güçlenir" },
    { period: "Düzenli kullanım", note: "Denge korunur" },
  ],
  Hassas: [
    { period: "2–4 hafta",       note: "Hassasiyet eşiğinde stabilite" },
    { period: "6–8 hafta",       note: "Kızarıklık görünümünde azalma olabilir" },
    { period: "Düzenli kullanım", note: "Bariyer güçlenir, reaksiyonlar azalır" },
  ],
};

// ─── Bölüm başlığı ────────────────────────────────────────────────────────────

function STitle({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.8 }}>{label}</Text>;
}

// ─── Kart ────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[ca.card, style]}>{children}</View>;
}
const ca = StyleSheet.create({
  card: { backgroundColor: WHITE, borderRadius: 18, padding: 18, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
});

// ─── Check-In Toggle ─────────────────────────────────────────────────────────

function CheckItem({
  icon,
  label,
  done,
  onToggle,
}: {
  icon:     string;
  label:    string;
  done:     boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={[ci.wrap, done && ci.wrapDone]} onPress={onToggle} activeOpacity={0.8}>
      <Text style={ci.icon}>{icon}</Text>
      <Text style={[ci.label, done && ci.labelDone]}>{label}</Text>
      <View style={[ci.check, done && ci.checkDone]}>
        {done && <Text style={ci.tick}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}
const ci = StyleSheet.create({
  wrap:      { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: `${MUTED}0A`, borderWidth: 1.5, borderColor: "transparent" },
  wrapDone:  { backgroundColor: `${SAGE}0F`, borderColor: `${SAGE}30` },
  icon:      { fontSize: 18 },
  label:     { flex: 1, fontSize: 14, color: MUTED, fontWeight: "500" },
  labelDone: { color: SAGE, fontWeight: "700" },
  check:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#CCC", alignItems: "center", justifyContent: "center" },
  checkDone: { backgroundColor: SAGE, borderColor: SAGE },
  tick:      { color: WHITE, fontSize: 12, fontWeight: "700" },
});

// ─── 7 Günlük Nokta ──────────────────────────────────────────────────────────

function WeekDot({ record }: { record: DayRecord }) {
  const full    = record.morning && record.evening;
  const partial = !full && (record.morning || record.evening);
  const color   = full ? SAGE : partial ? COPPER : "#D4D0C8";
  const char    = full ? "●" : partial ? "◐" : "○";

  return (
    <View style={wd.col}>
      <Text style={[wd.dot, { color }]}>{char}</Text>
      <Text style={wd.dayLabel}>{dayLabel(record.date)}</Text>
    </View>
  );
}
const wd = StyleSheet.create({
  col:      { alignItems: "center", gap: 4, flex: 1 },
  dot:      { fontSize: 18 },
  dayLabel: { fontSize: 10, color: MUTED },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function RoutineTrackingScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { isSeckin }    = useAuth();

  // Tüm hook'lar koşullu return'lardan ÖNCE
  const [loading,      setLoading]      = useState(true);
  const [program,      setProgram]      = useState<SavedRoutine | null>(null);
  const [checkins,     setCheckins]     = useState<DayRecord[]>([]);
  const [histCount,    setHistCount]    = useState(0);
  const [simplified,   setSimplified]   = useState(false);
  const [seckinModal,  setSeckinModal]  = useState(false);

  useEffect(() => {
    Promise.all([
      routineProgramStore.loadActive(),
      routineProgramStore.getCheckins(),
      historyStore.load(),
    ]).then(([prog, cks, hist]) => {
      setProgram(prog);
      setCheckins(cks);
      setHistCount(hist.length);
      setLoading(false);
    });
  }, []);

  // Check-in toggle
  async function toggle(field: "morning" | "evening" | "weekly") {
    const today = routineProgramStore.getTodayCheckin(checkins);
    const next  = await routineProgramStore.updateCheckin(field, !today[field]);
    setCheckins(next);
  }

  // Rutini sadeleştir
  async function simplifyRoutine() {
    if (!program) return;
    const simplified: SavedRoutine = {
      ...program,
      morning: program.morning.filter((s) => s.role !== "İsteğe bağlı"),
      evening: program.evening.filter((s) => s.role !== "İsteğe bağlı"),
      weekly:  program.weekly.filter((s) => s.role !== "İsteğe bağlı"),
    };
    await routineProgramStore.saveProgram(simplified);
    setProgram(simplified);
    setSimplified(true);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CREAM, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={SAGE} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={[s.root, { paddingTop: top }]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
            <Text style={s.back}>← Geri</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>Rutin Takibi</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <Text style={{ fontSize: 16, color: MUTED, textAlign: "center" }}>
            Henüz kaydedilmiş bir rutin yok.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: SAGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
            onPress={() => router.push("/premium-skin-scan-v2/routine-program" as any)}
          >
            <Text style={{ color: WHITE, fontWeight: "700", fontSize: 15 }}>Rutin Oluştur</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Hesaplamalar
  const todayRec   = routineProgramStore.getTodayCheckin(checkins);
  const last7      = routineProgramStore.getLast7Days(checkins);
  const streak     = routineProgramStore.calcStreak(checkins);
  const adherence  = routineProgramStore.calcAdherence(checkins);
  const weeks      = routineProgramStore.routineWeeks(program.createdAt);
  const days       = routineProgramStore.routineDays(program.createdAt);

  const adherenceStatus =
    adherence >= 70 ? { label: "Güçleniyor", color: SAGE } :
    adherence >= 40 ? { label: "Dengede",    color: COPPER } :
                      { label: "Düşük",      color: RED };

  const psyMsg =
    adherence >= 70 ? "Denge korunuyor." :
    adherence >= 40 ? "Bugün tamam." :
                      "Son günler aksamış.";

  const timeline = PROGRESS_TIMELINE[program.skinType] ?? PROGRESS_TIMELINE["Karma"];

  const durationLabel =
    weeks >= 1
      ? `${weeks} haftadır sürüyor`
      : days === 0
        ? "Bugün başladı"
        : `${days} gündür sürüyor`;

  const comparisonMsg =
    adherence >= 70
      ? "Bağlılık iyi, cilt dengesinin toparlanması beklenir."
      : adherence >= 40
        ? "Düzenli kullanım sonuçları daha belirgin kılar."
        : "Düzen aksamış, görünür fark sınırlı kalabilir.";

  return (
    <View style={[s.root, { paddingTop: top }]}>

      {/* Üst çubuk */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Rutin Takibi</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── BUGÜN ───────────────────────────────────────────────────────── */}
        <Card>
          <STitle label="BUGÜN" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <CheckItem
              icon="☀"
              label="Sabah"
              done={todayRec.morning}
              onToggle={() => toggle("morning")}
            />
            <CheckItem
              icon="◑"
              label="Akşam"
              done={todayRec.evening}
              onToggle={() => toggle("evening")}
            />
            {program.weekly.length > 0 && (
              <CheckItem
                icon="◎"
                label="Haftalık"
                done={todayRec.weekly}
                onToggle={() => toggle("weekly")}
              />
            )}
          </View>
          {/* Psikolojik mesaj */}
          <View style={[s.psyWrap, {
            backgroundColor:
              adherence >= 70 ? `${SAGE}0F` :
              adherence >= 40 ? `${COPPER}0F` : `${RED}0A`,
          }]}>
            <Text style={[s.psyMsg, {
              color: adherence >= 70 ? SAGE : adherence >= 40 ? COPPER : RED,
            }]}>
              {psyMsg}
            </Text>
          </View>
        </Card>

        {/* ── HAFTALIK BAĞLILIK ────────────────────────────────────────────── */}
        <Card>
          <STitle label="HAFTALIK BAĞLILIK" />

          {/* 7 nokta */}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {last7.slice().reverse().map((rec) => (
              <WeekDot key={rec.date} record={rec} />
            ))}
          </View>

          {/* Yüzde + seri */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={[s.adherencePill, { backgroundColor: `${adherenceStatus.color}15` }]}>
              <Text style={[s.adherencePct, { color: adherenceStatus.color }]}>{adherence}%</Text>
              <Text style={[s.adherenceLabel, { color: adherenceStatus.color }]}>{adherenceStatus.label}</Text>
            </View>
            {streak > 0 && (
              <Text style={s.streakTxt}>🔥  {streak} günlük seri</Text>
            )}
          </View>

          {/* Sadeleştir önerisi */}
          {adherence < 50 && !simplified && (
            <View style={s.simplifyWrap}>
              <Text style={s.simplifyPrompt}>Rutin ağır geldi. Sadeleştirelim mi?</Text>
              <TouchableOpacity style={s.simplifyBtn} onPress={simplifyRoutine} activeOpacity={0.8}>
                <Text style={s.simplifyTxt}>Rutini Sadeleştir</Text>
              </TouchableOpacity>
            </View>
          )}
          {simplified && (
            <Text style={[s.simplifyPrompt, { color: SAGE }]}>
              ✓  İsteğe bağlı adımlar kaldırıldı. Rutin sadeleştirildi.
            </Text>
          )}
        </Card>

        {/* ── BEKLENİLEN İLERLEME ─────────────────────────────────────────── */}
        <Card>
          <STitle label="BEKLENİLEN İLERLEME" />
          {timeline.map((item, i) => (
            <View key={i} style={s.timelineRow}>
              <View style={s.periodBadge}>
                <Text style={s.periodTxt}>{item.period}</Text>
              </View>
              <Text style={s.timelineNote}>{item.note}</Text>
            </View>
          ))}
          <View style={s.disclaimerWrap}>
            <Text style={s.disclaimer}>
              Bu iş sabır ister; ilk farklar birkaç hafta içinde başlar.
              Düzenli kullanım sürerse cilt daha dengeli görünmeye başlar.
            </Text>
          </View>
        </Card>

        {/* ── İLERLEME SİSTEMİ KAPISI ─────────────────────────────────────── */}
        {!isSeckin && (
          <GateCard
            title="İlerleme Sistemi"
            description="Bağlılık analizi, karşılaştırma içgörüleri ve tahmini ilerleme yorumu."
            onUpgrade={() => setSeckinModal(true)}
          />
        )}

        {/* ── KARŞILAŞTIRMA BAĞLANTISI ─────────────────────────────────────── */}
        {histCount >= 2 && (
          <Card>
            <STitle label="ANALİZ KARŞILAŞTIRMA" />
            <Text style={s.durationTxt}>Bu rutin {durationLabel}.</Text>
            <Text style={s.comparisonMsg}>{comparisonMsg}</Text>
            <TouchableOpacity
              style={s.compareBtn}
              onPress={() => router.push("/premium-skin-scan-v2/history-detail?idx=1" as any)}
              activeOpacity={0.82}
            >
              <Text style={s.compareTxt}>Son analizle karşılaştır →</Text>
            </TouchableOpacity>
          </Card>
        )}

      </ScrollView>

      {/* Seçkin Üyelik Modalı */}
      <SeckinModal visible={seckinModal} onClose={() => setSeckinModal(false)} />

      <ScanBottomNav />
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: CREAM },
  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  back:          { color: MUTED, fontSize: 15 },
  pageTitle:     { fontSize: 15, fontWeight: "700", color: INK },
  scroll:        { flex: 1 },
  content:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80, gap: 14 },

  psyWrap:       { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  psyMsg:        { fontSize: 14, fontWeight: "600" },

  adherencePill: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  adherencePct:  { fontSize: 22, fontWeight: "800" },
  adherenceLabel:{ fontSize: 13, fontWeight: "600" },
  streakTxt:     { fontSize: 14, color: MUTED, fontWeight: "500" },

  simplifyWrap:  { gap: 8 },
  simplifyPrompt:{ fontSize: 13, color: MUTED, lineHeight: 19 },
  simplifyBtn:   { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: `${COPPER}15`, borderWidth: 1, borderColor: `${COPPER}40` },
  simplifyTxt:   { fontSize: 13, color: COPPER, fontWeight: "700" },

  timelineRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  periodBadge:   { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${SAGE}14`, borderRadius: 8, flexShrink: 0 },
  periodTxt:     { fontSize: 11, fontWeight: "700", color: SAGE },
  timelineNote:  { flex: 1, fontSize: 14, color: INK, lineHeight: 20 },
  disclaimerWrap:{ borderLeftWidth: 2, borderLeftColor: `${MUTED}40`, paddingLeft: 12 },
  disclaimer:    { fontSize: 12, color: MUTED, lineHeight: 18, fontStyle: "italic" },

  durationTxt:   { fontSize: 14, fontWeight: "600", color: INK },
  comparisonMsg: { fontSize: 13, color: MUTED, lineHeight: 19 },
  compareBtn:    { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: `${COPPER}12`, borderWidth: 1, borderColor: `${COPPER}40` },
  compareTxt:    { fontSize: 13, color: COPPER, fontWeight: "700" },
});