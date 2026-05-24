/**
 * CiltBakımım — Proactive Insight Engine v2
 * Davranışsal hassasiyet sistemi ile entegre akıllı öneri motoru.
 *
 * YENİ: Engagement sınıflandırması, uyarlanabilir frekans,
 * tepki takibi, yoğunluk filtrelemesi ve anti-tekrar sistemi.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getConcernProfile } from "@/lib/concernFlowStore";
import { getManualRoutine, getWeekLogs } from "@/lib/routineStore";
import {
  getFlowCompletionCount,
  getRoutineInteractionCount,
  getProductViewCount,
} from "@/lib/retentionEngine";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type ProactiveSuggestionType =
  | "correction"   // Kritik bakım eksikliği
  | "routine"      // Rutin basitleştirme
  | "behavior"     // Davranış paterni
  | "product"      // Ürün kategorisi önerisi
  | "contextual";  // Genel bağlamsal öneri

/** Önerinin etki gücü — düşük engagement kullanıcıya yalnızca HIGH gösterilir */
export type SuggestionIntensity = "low" | "medium" | "high";

/** Kullanıcı etkileşim profili */
export type UserEngagementLevel = "low" | "normal" | "high";

export interface ProactiveSuggestion {
  id: string;
  type: ProactiveSuggestionType;
  intensity: SuggestionIntensity;    // Yeni: dozaj filtresi için
  icon: string;
  accentColor: string;
  title: string;
  messageFree: string;
  messagePremium: string;
  priority: number;                  // 1 en yüksek öncelik
}

// ─── Kontrol depolama — v3 (engagement + response takibi) ────────────────────

const CTRL_KEY = "@ciltbakim:proactive_ctrl_v3";

interface ProactiveControl {
  lastShownAt: number;
  sessionDate: string;
  sessionCount: number;
  shownIds: Record<string, number>;
  engagementLevel: UserEngagementLevel;
  engagementUpdatedAt: number;       // Son engagement hesaplama zamanı
  recentIgnoreCount: number;         // Son 7 gündeki "Şimdi değil" sayısı
  recentAcceptCount: number;         // Son 7 gündeki "Kabul et" sayısı
  responseUpdatedAt: number;         // Son response güncelleme zamanı
}

const DEFAULT_CTRL: ProactiveControl = {
  lastShownAt: 0,
  sessionDate: "",
  sessionCount: 0,
  shownIds: {},
  engagementLevel: "normal",
  engagementUpdatedAt: 0,
  recentIgnoreCount: 0,
  recentAcceptCount: 0,
  responseUpdatedAt: 0,
};

async function readCtrl(): Promise<ProactiveControl> {
  try {
    const raw = await AsyncStorage.getItem(CTRL_KEY);
    return raw ? { ...DEFAULT_CTRL, ...JSON.parse(raw) } : { ...DEFAULT_CTRL };
  } catch {
    return { ...DEFAULT_CTRL };
  }
}

async function writeCtrl(ctrl: ProactiveControl): Promise<void> {
  try { await AsyncStorage.setItem(CTRL_KEY, JSON.stringify(ctrl)); } catch { /* noop */ }
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const HOUR_MS  = 60 * 60 * 1000;
const DAY_MS   = 24 * HOUR_MS;
const WEEK_MS  = 7 * DAY_MS;

// ─── Kullanıcı etkileşim düzeyi sınıflandırması ───────────────────────────────

async function classifyEngagement(ctx: UserContext): Promise<UserEngagementLevel> {
  // Async kaynaklar
  const [flowCount, routineInteractions, productViews] = await Promise.all([
    getFlowCompletionCount(),
    getRoutineInteractionCount(),
    getProductViewCount(),
  ]);

  // Puanlama
  let score = 0;
  score += Math.min(ctx.completedFlows.length, 5) * 2;         // Max 10 puan
  score += Math.min(ctx.morningDoneThisWeek, 7) * 0.4;         // Max 2.8
  score += Math.min(ctx.eveningDoneThisWeek, 7) * 0.4;         // Max 2.8
  score += ctx.hasRoutine ? 1 : 0;
  score += Math.min(routineInteractions, 5) * 0.6;             // Max 3
  score += Math.min(flowCount, 6) * 0.5;                       // Max 3
  score += Math.min(productViews, 10) * 0.2;                   // Max 2

  if (score < 3)  return "low";
  if (score < 10) return "normal";
  return "high";
}

// ─── Adaptive frekans parametreleri ──────────────────────────────────────────

interface FrequencyConfig {
  cooldownHours: number;
  maxPerDay: number;
  minIntensity: SuggestionIntensity;
  repeatCooldownDays: number;
}

function getFrequencyConfig(
  level: UserEngagementLevel,
  ignoreRatio: number,          // 0-1: son 7 günde görmezden gelme oranı
  isPremium: boolean
): FrequencyConfig {
  const base: Record<UserEngagementLevel, FrequencyConfig> = {
    low:    { cooldownHours: 24, maxPerDay: 1, minIntensity: "high",   repeatCooldownDays: 14 },
    normal: { cooldownHours: 4,  maxPerDay: 2, minIntensity: "medium", repeatCooldownDays: 7  },
    high:   { cooldownHours: 2,  maxPerDay: 3, minIntensity: "low",    repeatCooldownDays: 5  },
  };

  const cfg = { ...base[level] };

  // Çok fazla görmezden geliniyorsa → daha az sıkıştır
  if (ignoreRatio > 0.70) {
    cfg.cooldownHours  = Math.round(cfg.cooldownHours * 1.8);
    cfg.maxPerDay      = Math.max(1, cfg.maxPerDay - 1);
    cfg.minIntensity   = cfg.minIntensity === "low" ? "medium" : "high";
  } else if (ignoreRatio > 0.45) {
    cfg.cooldownHours  = Math.round(cfg.cooldownHours * 1.3);
  }

  // Kullanıcı sık kabul ediyorsa → biraz daha aktif
  // (premiumda bu avantaj açılır)
  if (isPremium && ignoreRatio < 0.2) {
    cfg.maxPerDay = Math.min(cfg.maxPerDay + 1, 4);
  }

  return cfg;
}

// ─── Response takibi yükle ────────────────────────────────────────────────────

async function loadResponseCounts(): Promise<{ accepted: number; ignored: number }> {
  try {
    const [rawAcc, rawIgn] = await Promise.all([
      AsyncStorage.getItem("@ciltbakim:proactive_accepted_v1"),
      AsyncStorage.getItem("@ciltbakim:proactive_ignored_v1"),
    ]);

    const accepted: Record<string, number> = rawAcc ? JSON.parse(rawAcc) : {};
    const ignored:  Record<string, number> = rawIgn ? JSON.parse(rawIgn) : {};
    const now = Date.now();

    // Yalnızca son 7 günü say
    const acc = Object.values(accepted).filter(ts => now - ts < WEEK_MS).length;
    const ign = Object.values(ignored).filter(ts => now - ts < WEEK_MS).length;
    return { accepted: acc, ignored: ign };
  } catch {
    return { accepted: 0, ignored: 0 };
  }
}

// ─── Kullanıcı bağlamı (sync veri) ───────────────────────────────────────────

interface UserContext {
  completedFlows: string[];
  morningStepCount: number;
  eveningStepCount: number;
  eveningDoneThisWeek: number;
  morningDoneThisWeek: number;
  hasRoutine: boolean;
  hasSunscreen: boolean;
  hasSerum: boolean;
}

function getUserContext(): UserContext {
  const FLOW_IDS = ["akne", "hassasiyet", "leke", "kuruluk", "gunes", "sac"];
  const completedFlows = FLOW_IDS.filter(f => getConcernProfile(f) !== null);

  const routine = getManualRoutine();
  const allSteps = [...routine.morning, ...routine.evening];
  const weekLogs = getWeekLogs();

  return {
    completedFlows,
    morningStepCount:    routine.morning.length,
    eveningStepCount:    routine.evening.length,
    eveningDoneThisWeek: weekLogs.filter(l => l.eveningDone).length,
    morningDoneThisWeek: weekLogs.filter(l => l.morningDone).length,
    hasRoutine:          allSteps.length > 0,
    hasSunscreen:        allSteps.some(s => s.category === "sunscreen"),
    hasSerum:            allSteps.some(s => s.category === "serum"),
  };
}

// ─── Öneri kataloğu — trigger analizi + yoğunluk etiketleri ─────────────────

function buildCandidates(ctx: UserContext): ProactiveSuggestion[] {
  const list: ProactiveSuggestion[] = [];

  // ── HIGH INTENSITY — Kritik düzeltmeler (priority 1) ───────────────────────

  if (ctx.completedFlows.includes("leke") && !ctx.completedFlows.includes("gunes") && !ctx.hasSunscreen) {
    list.push({
      id: "correction_leke_gunes", type: "correction", intensity: "high",
      icon: "sun", accentColor: "#B45309", priority: 1,
      title: "Leke bakımında önemli bir adım",
      messageFree: "Leke bakımında güneş koruması olmadan ilerlemek zorlaşabilir.",
      messagePremium: "Leke bakımında SPF olmadan aktif bileşenler etkisini yitirebilir. Güneş değerlendirmesini başlatmak ister misin?",
    });
  }

  if (ctx.completedFlows.includes("hassasiyet") && ctx.hasSerum && !ctx.completedFlows.includes("kuruluk")) {
    list.push({
      id: "correction_hassasiyet_barier", type: "correction", intensity: "high",
      icon: "shield", accentColor: "#BE123C", priority: 1,
      title: "Hassas cilt için bariyer desteği",
      messageFree: "Hassas ciltlerde aktif bileşenler bariyer dengesini zorlayabilir.",
      messagePremium: "Hassas cildin için serumdan önce destekleyici bir nemlendirici eklemeyi düşünebilirsin.",
    });
  }

  // ── MEDIUM INTENSITY — Rutin + davranış sorunları (priority 2) ─────────────

  if (ctx.hasRoutine && ctx.eveningStepCount >= 2 && ctx.eveningDoneThisWeek < 3) {
    list.push({
      id: "behavior_evening_skip", type: "behavior", intensity: "medium",
      icon: "moon", accentColor: "#1D4ED8", priority: 2,
      title: "Akşam rutinin sık aksıyor",
      messageFree: "Akşam rutini biraz aksıyor. Daha hafif bir yapı sürdürmeyi kolaylaştırabilir.",
      messagePremium: "Akşam rutini bu hafta birkaç kez geçildi. İki adımlı daha kısa bir seçenek daha kolay sürdürülebilir olabilir.",
    });
  }

  if (ctx.morningStepCount + ctx.eveningStepCount >= 6) {
    list.push({
      id: "routine_overload", type: "routine", intensity: "medium",
      icon: "layers", accentColor: "#7C3AED", priority: 2,
      title: "Rutin sadeliği",
      messageFree: "Cildin şu an daha sade bir yapıdan iyi bir şekilde beslenebilir.",
      messagePremium: "Çok adımlı rutinler cilt bariyerini yorabilir. Birlikte sadeleştirmek istersen bakabiliriz.",
    });
  }

  if (ctx.hasRoutine && ctx.morningDoneThisWeek < 2 && ctx.morningStepCount >= 2) {
    list.push({
      id: "behavior_morning_skip", type: "behavior", intensity: "medium",
      icon: "sunrise", accentColor: "#B45309", priority: 2,
      title: "Sabah rutini atlanıyor",
      messageFree: "Sabah rutini bu hafta biraz geride kaldı. Akşama taşımak daha kolay olabilir.",
      messagePremium: "Sabah rutini için daha uygun bir zaman dilimi birlikte belirlenebilir.",
    });
  }

  // ── MEDIUM — Ürün önerileri (priority 3) ───────────────────────────────────

  if (ctx.completedFlows.includes("akne") && !ctx.hasSerum) {
    list.push({
      id: "product_akne_serum", type: "product", intensity: "medium",
      icon: "droplet", accentColor: "#15803D", priority: 3,
      title: "Akne eğilimli cilt için öneri",
      messageFree: "Son baktığın ürünlere göre daha nazik alternatifler olabilir.",
      messagePremium: "Akne eğilimli cildin için BHA içeren hafif bir serum araştırabilirsin.",
    });
  }

  if (ctx.completedFlows.includes("leke") && !ctx.hasSerum) {
    list.push({
      id: "product_leke_serum", type: "product", intensity: "medium",
      icon: "zap", accentColor: "#7C3AED", priority: 3,
      title: "Leke bakımı için içerik önerisi",
      messageFree: "Leke bakımında etkili içeriklere sahip ürünler olabilir.",
      messagePremium: "Leke odaklı cildin için Niasinamid veya Azelaic Acid içeren bir serum önerebiliriz.",
    });
  }

  // ── LOW INTENSITY — Bağlamsal ve genel (priority 4-5) ──────────────────────

  if (ctx.completedFlows.includes("kuruluk") && !ctx.hasSunscreen) {
    list.push({
      id: "contextual_kuruluk_nem", type: "contextual", intensity: "low",
      icon: "cloud", accentColor: "#1D4ED8", priority: 4,
      title: "Kuruluk ve nem dengesi",
      messageFree: "Kuru ciltlerde güneş koruması nem dengesini de daha iyi tutar.",
      messagePremium: "Kuru ciltte UV maruziyeti nemi daha çabuk tüketebilir. Güneş değerlendirmesini başlatmak ister misin?",
    });
  }

  if (ctx.completedFlows.includes("sac")) {
    list.push({
      id: "contextual_sac", type: "contextual", intensity: "low",
      icon: "wind", accentColor: "#C2410C", priority: 4,
      title: "Saç bakımında tutarlılık",
      messageFree: "Saç dökülmesinde en çok fark yaratan şey tutarlı bir bakım ritmi.",
      messagePremium: "Saç dökülmesi profiline göre haftalık bir bakım düzeni birlikte oluşturulabilir.",
    });
  }

  if (ctx.completedFlows.includes("hassasiyet")) {
    list.push({
      id: "contextual_hassas_temizlik", type: "contextual", intensity: "low",
      icon: "heart", accentColor: "#BE123C", priority: 4,
      title: "Hassas cilt günlük ipucu",
      messageFree: "Hassas ciltte temizleyici seçimi bariyer sağlığını yakından etkiler.",
      messagePremium: "Hassas ciltlerde pH dengeli temizleyiciler genellikle daha iyi tolere edilir.",
    });
  }

  // ── Genel — Başlangıç kullanıcısı (priority 5) ─────────────────────────────

  if (ctx.completedFlows.length === 0 && !ctx.hasRoutine) {
    list.push({
      id: "general_start", type: "contextual", intensity: "low",
      icon: "star", accentColor: "#3D6E56", priority: 5,
      title: "Şahsi cilt değerlendirmesi",
      messageFree: "Cilt endişeni seçerek sana daha yakın öneriler oluşturabiliriz.",
      messagePremium: "Cilt profilini tamamlamak için birkaç dakika yeterli. İstersen birlikte başlayabiliriz.",
    });
  }

  if (ctx.completedFlows.length === 0 && ctx.hasRoutine) {
    list.push({
      id: "general_no_flow", type: "product", intensity: "low",
      icon: "zap", accentColor: "#7C3AED", priority: 5,
      title: "Rutini şahsileştir",
      messageFree: "Cilt endişene göre rutinini daha şahsi bir şekle getirebiliriz.",
      messagePremium: "Mevcut rutinini birlikte değerlendirip daha uygun bir düzen oluşturabiliriz.",
    });
  }

  return list;
}

// ─── Yoğunluk filtresi ────────────────────────────────────────────────────────

const INTENSITY_RANK: Record<SuggestionIntensity, number> = { low: 0, medium: 1, high: 2 };

function meetsMinIntensity(s: ProactiveSuggestion, min: SuggestionIntensity): boolean {
  return INTENSITY_RANK[s.intensity] >= INTENSITY_RANK[min];
}

// ─── Ana üretim fonksiyonu ────────────────────────────────────────────────────

export async function generateProactiveInsight(isPremium: boolean): Promise<ProactiveSuggestion | null> {
  const ctrl = await readCtrl();
  const today = todayStr();

  // ── Engagement seviyesini belirle (saatlik cache) ─────────────────────────
  const ctx = getUserContext();
  let engagement = ctrl.engagementLevel;
  if (Date.now() - ctrl.engagementUpdatedAt > HOUR_MS) {
    engagement = await classifyEngagement(ctx);
  }

  // ── Response takibini güncelle (günlük) ───────────────────────────────────
  let ignoreCount = ctrl.recentIgnoreCount;
  let acceptCount = ctrl.recentAcceptCount;
  if (Date.now() - ctrl.responseUpdatedAt > HOUR_MS * 6) {
    const counts = await loadResponseCounts();
    ignoreCount = counts.ignored;
    acceptCount = counts.accepted;
  }

  const totalResponses = ignoreCount + acceptCount;
  const ignoreRatio = totalResponses > 0 ? ignoreCount / totalResponses : 0;

  // ── Adaptive frekans parametreleri ────────────────────────────────────────
  const freq = getFrequencyConfig(engagement, ignoreRatio, isPremium);

  // ── Frekans kontrolleri ───────────────────────────────────────────────────
  const todayCount = ctrl.sessionDate === today ? ctrl.sessionCount : 0;
  if (todayCount >= freq.maxPerDay) return null;
  if (Date.now() - ctrl.lastShownAt < freq.cooldownHours * HOUR_MS) return null;

  // ── Aday öneriler — yoğunluk + anti-tekrar filtresi ─────────────────────
  const candidates = buildCandidates(ctx);
  const eligible = candidates
    .filter(c => meetsMinIntensity(c, freq.minIntensity))
    .filter(c => {
      const ts = ctrl.shownIds[c.id];
      if (!ts) return true;
      return Date.now() - ts > freq.repeatCooldownDays * DAY_MS;
    })
    .sort((a, b) => a.priority - b.priority);

  if (eligible.length === 0) return null;

  const best = eligible[0];

  // ── Kontrol kaydını güncelle ──────────────────────────────────────────────
  await writeCtrl({
    lastShownAt: Date.now(),
    sessionDate: today,
    sessionCount: todayCount + 1,
    shownIds: { ...ctrl.shownIds, [best.id]: Date.now() },
    engagementLevel: engagement,
    engagementUpdatedAt: Date.now(),
    recentIgnoreCount: ignoreCount,
    recentAcceptCount: acceptCount,
    responseUpdatedAt: Date.now(),
  });

  return best;
}

// ─── Kullanıcı tepkisi takibi ─────────────────────────────────────────────────

export async function markSuggestionAccepted(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem("@ciltbakim:proactive_accepted_v1");
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[id] = Date.now();
    await AsyncStorage.setItem("@ciltbakim:proactive_accepted_v1", JSON.stringify(map));
  } catch { /* noop */ }
}

export async function markSuggestionIgnored(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem("@ciltbakim:proactive_ignored_v1");
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[id] = Date.now();
    await AsyncStorage.setItem("@ciltbakim:proactive_ignored_v1", JSON.stringify(map));
  } catch { /* noop */ }
}

// ─── Teşhis / debug yardımcı ─────────────────────────────────────────────────

export async function getProactiveDiagnostics(): Promise<{
  engagement: UserEngagementLevel;
  ignoreRatio: number;
  todayCount: number;
  nextCooldownHours: number;
}> {
  const ctrl = await readCtrl();
  const ctx = getUserContext();
  const engagement = await classifyEngagement(ctx);
  const counts = await loadResponseCounts();
  const total = counts.accepted + counts.ignored;
  const ignoreRatio = total > 0 ? counts.ignored / total : 0;
  const freq = getFrequencyConfig(engagement, ignoreRatio, false);
  const todayCount = ctrl.sessionDate === todayStr() ? ctrl.sessionCount : 0;
  const elapsed = (Date.now() - ctrl.lastShownAt) / HOUR_MS;
  return {
    engagement,
    ignoreRatio: Math.round(ignoreRatio * 100) / 100,
    todayCount,
    nextCooldownHours: Math.max(0, freq.cooldownHours - elapsed),
  };
}
