/**
 * CiltBakımım — Flow Recovery & Re-engagement Store
 * Yarım kalan concern akışlarını takip eder ve kullanıcıyı nazikçe geri çeker.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const RECOVERY_KEY = "@ciltbakim:flow_recovery_v1";

// ─── Tip tanımları ──────────────────────────────────────────────────────────────

export interface IncompleteFlowRecord {
  flowId: string;
  flowTitle: string;
  flowColor: string;
  lastStepIndex: number;        // Son cevaplanan adım (0-indexed)
  totalSteps: number;
  answersSnapshot: Record<string, string[]>;
  startedAt: number;            // Unix ms
  dismissCount: number;         // 0, 1 → 2'de kalıcı sil
  lastShownAt?: number;         // Recovery kartı en son ne zaman gösterildi
}

// ─── Flow meta (renk + isim) ────────────────────────────────────────────────────

export const FLOW_RECOVERY_META: Record<string, { title: string; color: string }> = {
  akne:       { title: "Akne",           color: "#15803D" },
  hassasiyet: { title: "Hassasiyet",     color: "#BE123C" },
  leke:       { title: "Leke",           color: "#7C3AED" },
  kuruluk:    { title: "Kuruluk",        color: "#1D4ED8" },
  gunes:      { title: "Güneş Koruma",   color: "#B45309" },
  sac:        { title: "Saç Dökülmesi",  color: "#C2410C" },
};

// ─── Timing sabitleri ───────────────────────────────────────────────────────────

const MIN_HOURS_BEFORE_SHOW = 1;     // Akış başlangıcından en az 1 saat sonra göster
const MIN_HOURS_BETWEEN_SHOW = 4;    // Kartın gösterimler arası minimum bekleme
const MAX_DISMISS_COUNT = 2;         // 2 redden sonra kalıcı sil

// ─── Yardımcı: tüm kayıtları oku ───────────────────────────────────────────────

async function readAll(): Promise<Record<string, IncompleteFlowRecord>> {
  try {
    const raw = await AsyncStorage.getItem(RECOVERY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeAll(records: Record<string, IncompleteFlowRecord>): Promise<void> {
  try {
    await AsyncStorage.setItem(RECOVERY_KEY, JSON.stringify(records));
  } catch { /* silent */ }
}

// ─── Flow başlatıldığında çağrılır ─────────────────────────────────────────────

export async function markFlowStarted(
  flowId: string,
  totalSteps: number
): Promise<void> {
  const records = await readAll();
  const meta = FLOW_RECOVERY_META[flowId] ?? { title: flowId, color: "#3D6E56" };

  // Daha önce kayıt varsa güncelleme yapma (mevcut ilerlemeyi koru)
  if (records[flowId]) {
    records[flowId].lastStepIndex = 0; // Yeniden başladı, sıfırla
    records[flowId].answersSnapshot = {};
    records[flowId].startedAt = Date.now();
  } else {
    records[flowId] = {
      flowId,
      flowTitle: meta.title,
      flowColor: meta.color,
      lastStepIndex: 0,
      totalSteps,
      answersSnapshot: {},
      startedAt: Date.now(),
      dismissCount: 0,
    };
  }
  await writeAll(records);
}

// ─── Adım ilerlemesini güncelle (her "Devam Et" tıklamasında) ──────────────────

export async function updateFlowProgress(
  flowId: string,
  stepIndex: number,
  answers: Record<string, string[]>
): Promise<void> {
  const records = await readAll();
  if (!records[flowId]) return; // Kayıt yoksa yoksay
  records[flowId].lastStepIndex = stepIndex;
  records[flowId].answersSnapshot = answers;
  await writeAll(records);
}

// ─── Akış tamamlandığında çağrılır — kaydı sil ─────────────────────────────────

export async function clearFlowRecord(flowId: string): Promise<void> {
  const records = await readAll();
  delete records[flowId];
  await writeAll(records);
}

// ─── Kayıt oku (resume için) ────────────────────────────────────────────────────

export async function getFlowRecord(
  flowId: string
): Promise<IncompleteFlowRecord | null> {
  const records = await readAll();
  return records[flowId] ?? null;
}

// ─── Home kartı için en iyi adayı döndür ───────────────────────────────────────

export async function getTopIncompleteFlow(): Promise<IncompleteFlowRecord | null> {
  const records = await readAll();
  const candidates = Object.values(records)
    .filter(r => r.dismissCount < MAX_DISMISS_COUNT && r.lastStepIndex >= 1);

  if (candidates.length === 0) return null;

  // Önce en çok ilerlemiş, eşitlik varsa en yeni
  candidates.sort((a, b) => {
    const progressDiff = b.lastStepIndex / b.totalSteps - a.lastStepIndex / a.totalSteps;
    if (Math.abs(progressDiff) > 0.01) return progressDiff;
    return b.startedAt - a.startedAt;
  });

  return candidates[0];
}

// ─── Timing: kartı gösterme zamanı geldi mi? ────────────────────────────────────

export function shouldShowRecoveryCard(record: IncompleteFlowRecord): boolean {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  // En az 1 saat geçmiş mi?
  if (now - record.startedAt < MIN_HOURS_BEFORE_SHOW * hourMs) return false;

  // Daha önce gösterildiyse, en az 4 saat geçmiş mi?
  if (record.lastShownAt && now - record.lastShownAt < MIN_HOURS_BETWEEN_SHOW * hourMs) return false;

  return true;
}

// ─── Kart gösterildi — lastShownAt güncelle ────────────────────────────────────

export async function markRecoveryCardShown(flowId: string): Promise<void> {
  const records = await readAll();
  if (!records[flowId]) return;
  records[flowId].lastShownAt = Date.now();
  await writeAll(records);
}

// ─── Kullanıcı "Şimdi değil" tıkladı ──────────────────────────────────────────

export async function dismissFlowRecord(flowId: string): Promise<void> {
  const records = await readAll();
  if (!records[flowId]) return;
  records[flowId].dismissCount += 1;
  if (records[flowId].dismissCount >= MAX_DISMISS_COUNT) {
    delete records[flowId]; // 2. redde kalıcı sil
  }
  await writeAll(records);
}

// ─── İlerleme yüzdesini hesapla ────────────────────────────────────────────────

export function calcProgress(record: IncompleteFlowRecord): number {
  if (record.totalSteps <= 0) return 0;
  return Math.round((record.lastStepIndex / record.totalSteps) * 100);
}
