/**
 * routineStore.ts — Manuel rutin adapter (ECZ4 Step 1)
 *
 * SİNGLE SOURCE OF TRUTH (Kaide 4):
 *   · Bu modül artık `routineCollection.ts` üzerinde ince bir adapter'dır.
 *   · Tüm rutin CRUD'u koleksiyonun PRIMARY routine'una delege edilir.
 *   · AsyncStorage erişimi tek bir yerden (routineCollection) yapılır.
 *
 * BACKWARD COMPATIBILITY (Kaide 11):
 *   · Public API imzaları DEĞİŞMEMİŞTİR — Home, Rutinim ve Manuel Editor
 *     mevcut import'larını koruyabilir; davranış aynı görünür.
 *   · `getManualRoutine()` primary routine'u eski `ManualRoutine` şeklinde döner.
 *   · `addStep()` primary yoksa otomatik "Günlük Cilt Rutinim" oluşturur
 *     (eski "ilk addStep ile rutin doğar" davranışı korundu).
 *   · `clearAllSteps()` SADECE primary'yi boşaltır — diğer rutinler korunur.
 *
 * IN-MEMORY STATE (adapter'da kalanlar):
 *   · Günlük log Map'i (`_logs`) — eski sürüm gibi in-memory.
 *   · Hatırlatıcı tercihleri (`_reminders`) — eski sürüm gibi in-memory.
 *   · Rutin adımları artık burada tutulmuyor (koleksiyonda).
 */

import {
  hydrateRoutineCollection,
  ensurePrimaryRoutine,
  getPrimaryRoutine,
  getPrimaryRoutineOrEmpty,
  mutatePrimarySlot,
  clearPrimaryAllSlots,
} from "./routineCollection";

// ─── Tipler (DEĞİŞMEDİ — public re-export) ───────────────────────────────────

export type RoutineSlot = "morning" | "evening" | "weekly" | "monthly";
export type StepCategory = "cleanser" | "serum" | "moisturizer" | "sunscreen" | "treatment" | "other";

export interface ManualStep {
  id: string;
  category: StepCategory;
  label: string;
  slot: RoutineSlot;
  order: number;
  productId?: string;
  productName?: string;
  productBrand?: string;
  note?: string;
}

export interface ManualRoutine {
  morning: ManualStep[];
  evening: ManualStep[];
  weekly:  ManualStep[];
  monthly: ManualStep[];
  updatedAt: number;
}

export interface DailyLog {
  date: string;
  completedStepIds: string[];
  skippedStepIds: string[];
  morningDone: boolean;
  eveningDone: boolean;
}

export interface ReminderPrefs {
  morningEnabled: boolean;
  morningTime: string;
  eveningEnabled: boolean;
  eveningTime: string;
}

export const CATEGORY_LABELS: Record<StepCategory, string> = {
  cleanser:    "Temizleyici",
  serum:       "Serum",
  moisturizer: "Nemlendirici",
  sunscreen:   "Güneş Koruyucu",
  treatment:   "Aktif Bakım",
  other:       "Diğer",
};

// ─── In-memory log + reminder state (eski davranış) ──────────────────────────

const DEFAULT_REMINDER: ReminderPrefs = {
  morningEnabled: false, morningTime: "08:00",
  eveningEnabled: false, eveningTime: "21:00",
};

let _logs: Map<string, DailyLog> = new Map();
let _reminders: ReminderPrefs = { ...DEFAULT_REMINDER };

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function _todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function _uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Hydrate (backward-compat alias) ─────────────────────────────────────────
//
// Eski adıyla export'u koruyoruz. Artık koleksiyon hydrate'ini tetikler;
// koleksiyon içinde @tenvir:routines_v2 → @tenvir:manual_routine_v1
// migration'ı yapılır. Eski v1 anahtarı silinmez (rollback güvencesi).

export function hydrateManualRoutine(): Promise<void> {
  return hydrateRoutineCollection();
}

// Modül yüklendiği anda hydrate'i fire-and-forget başlat (eski davranış).
void hydrateManualRoutine();

// ─── Rutin CRUD (adapter — primary routine üzerinde çalışır) ─────────────────

export function getManualRoutine(): ManualRoutine {
  return getPrimaryRoutineOrEmpty();
}

export function addStep(step: Omit<ManualStep, "id" | "order">): ManualStep {
  // Primary yoksa adapter onu garanti eder (eski "ilk addStep ile rutin doğar").
  ensurePrimaryRoutine();
  let created!: ManualStep;
  mutatePrimarySlot(step.slot, (existing) => {
    created = { ...step, id: _uid(), order: existing.length + 1 };
    return [...existing, created];
  });
  return created;
}

export function removeStep(id: string, slot: RoutineSlot): void {
  mutatePrimarySlot(slot, (existing) => existing.filter(s => s.id !== id));
}

export function clearSlot(slot: RoutineSlot): void {
  mutatePrimarySlot(slot, () => []);
}

export function clearAllSteps(): void {
  // SADECE primary routine etkilenir — diğer rutinler korunur (multi-routine).
  clearPrimaryAllSlots();
}

export function applySkeletonToSlot(
  slot: RoutineSlot,
  steps: Array<{ category: StepCategory; label: string }>
): void {
  // Eski davranış: slot doluysa hiçbir şey yapma. Primary üzerinde çalışır.
  const primary = getPrimaryRoutine();
  if (primary) {
    const current =
      slot === "morning" ? primary.morning :
      slot === "evening" ? primary.evening :
      slot === "weekly"  ? primary.weekly  : primary.monthly;
    if (current.length > 0) return;
  }
  mutatePrimarySlot(slot, () =>
    steps.map((s, i) => ({
      id: _uid(), category: s.category, label: s.label, slot, order: i + 1,
    })),
  );
}

// ─── Günlük takip (in-memory — eski davranış) ────────────────────────────────

export function getTodayLog(): DailyLog {
  const key = _todayKey();
  if (!_logs.has(key)) {
    _logs.set(key, {
      date: key, completedStepIds: [], skippedStepIds: [], morningDone: false, eveningDone: false,
    });
  }
  return _logs.get(key)!;
}

export function markStepDone(stepId: string): void {
  const log = getTodayLog();
  if (!log.completedStepIds.includes(stepId)) {
    log.completedStepIds.push(stepId);
    log.skippedStepIds = log.skippedStepIds.filter(id => id !== stepId);
  }
  _syncSlotCompletion(log);
}

export function markStepSkipped(stepId: string): void {
  const log = getTodayLog();
  if (!log.skippedStepIds.includes(stepId)) {
    log.skippedStepIds.push(stepId);
    log.completedStepIds = log.completedStepIds.filter(id => id !== stepId);
  }
}

export function unmarkStep(stepId: string): void {
  const log = getTodayLog();
  log.completedStepIds = log.completedStepIds.filter(id => id !== stepId);
  log.skippedStepIds   = log.skippedStepIds.filter(id => id !== stepId);
  _syncSlotCompletion(log);
}

export function markSlotDone(slot: RoutineSlot): void {
  const log     = getTodayLog();
  const routine = getManualRoutine();
  const steps   =
    slot === "morning" ? routine.morning :
    slot === "evening" ? routine.evening :
    slot === "weekly"  ? routine.weekly  : routine.monthly;
  steps.forEach(s => {
    if (!log.completedStepIds.includes(s.id)) log.completedStepIds.push(s.id);
  });
  if (slot === "morning")      log.morningDone = true;
  else if (slot === "evening") log.eveningDone = true;
}

function _syncSlotCompletion(log: DailyLog): void {
  const routine = getManualRoutine();
  log.morningDone = routine.morning.length > 0 &&
    routine.morning.every(s => log.completedStepIds.includes(s.id));
  log.eveningDone = routine.evening.length > 0 &&
    routine.evening.every(s => log.completedStepIds.includes(s.id));
}

export function getWeekLogs(): DailyLog[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return _logs.get(key) ?? {
      date: key, completedStepIds: [], skippedStepIds: [], morningDone: false, eveningDone: false,
    };
  });
}

// ─── Streak & ilerleme hesaplama ─────────────────────────────────────────────

export function getStreak(): { current: number; longest: number } {
  const today    = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const todayLog = _logs.get(todayKey);
  const todayDone = todayLog ? (todayLog.morningDone || todayLog.eveningDone) : false;

  let current   = 0;
  let checkDate = new Date(today);
  if (!todayDone) checkDate.setDate(checkDate.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const key = checkDate.toISOString().slice(0, 10);
    const log = _logs.get(key);
    if (log && (log.morningDone || log.eveningDone)) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }
  if (todayDone) current++;

  let longest = 0;
  let running = 0;
  let prevKey = "";
  for (const key of Array.from(_logs.keys()).sort()) {
    const log = _logs.get(key)!;
    if (log.morningDone || log.eveningDone) {
      if (prevKey) {
        const diff = (new Date(key).getTime() - new Date(prevKey).getTime()) / 86400000;
        running = diff === 1 ? running + 1 : 1;
      } else running = 1;
      prevKey = key;
      if (running > longest) longest = running;
    } else { running = 0; prevKey = ""; }
  }

  return { current: Math.max(current, 0), longest: Math.max(longest, current) };
}

export function getTodayProgress(): number {
  const log     = getTodayLog();
  const routine = getManualRoutine();
  const total   = routine.morning.length + routine.evening.length;
  if (total === 0) return 0;
  return Math.round((log.completedStepIds.length / total) * 100);
}

// ─── Hatırlatıcı tercihleri ───────────────────────────────────────────────────

export function getReminders(): ReminderPrefs {
  return _reminders;
}

export function setReminders(prefs: Partial<ReminderPrefs>): void {
  _reminders = { ..._reminders, ...prefs };
}
