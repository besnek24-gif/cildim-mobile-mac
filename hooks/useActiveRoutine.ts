/**
 * useActiveRoutine — Tek kaynak rutin hook'u
 *
 * Home ve Rutinim sayfası bu hook'u paylaşır.
 * Öncelik: v2 aktif rutin → manuel rutin → boş durum
 *
 * v2 aktif rutin varken:
 *  - steps: RoutineStep[] → ManualStep[] dönüşüm (name = id = label)
 *  - check-in: routineProgramStore per-step AsyncStorage
 *
 * v2 yokken:
 *  - steps: routineStore getManualRoutine()
 *  - check-in: routineStore markStepDone / unmarkStep
 */

import { useCallback, useEffect, useState } from "react";
import {
  routineProgramStore,
  getTodayStepIds,
  toggleStepCheckin,
  markAllStepsDone,
  type SavedRoutine,
} from "@/lib/premium-skin-scan-v2/routineProgramStore";
import {
  getManualRoutine,
  getTodayLog,
  getStreak,
  markStepDone,
  unmarkStep,
  markSlotDone,
  type ManualStep,
} from "@/lib/routineStore";

// ─── Yardımcı: RoutineStep → ManualStep dönüşümü ─────────────────────────────

function routineStepToManual(
  step: { name: string },
  slot: "morning" | "evening",
  idx: number
): ManualStep {
  const id = `${slot}-${idx}-${step.name.replace(/\s+/g, "_")}`;
  return { id, label: step.name, slot, order: idx, category: "other" };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface ActiveRoutineState {
  v2Routine:    SavedRoutine | null;
  morning:      ManualStep[];
  evening:      ManualStep[];
  weekly:       ManualStep[];
  monthly:      ManualStep[];
  completedIds: string[];
  hasRoutine:   boolean;
  loading:      boolean;
  streak:       number;
  toggleStep:   (id: string, wasDone: boolean) => Promise<void>;
  markAllSlot:  (slot: "morning" | "evening") => Promise<void>;
  reload:       () => Promise<void>;
}

export function useActiveRoutine(): ActiveRoutineState {
  const [v2Routine,      setV2Routine]      = useState<SavedRoutine | null>(null);
  const [completedIds,   setCompletedIds]   = useState<string[]>([]);
  const [manualMorning,  setManualMorning]  = useState<ManualStep[]>([]);
  const [manualEvening,  setManualEvening]  = useState<ManualStep[]>([]);
  const [manualWeekly,   setManualWeekly]   = useState<ManualStep[]>([]);
  const [manualMonthly,  setManualMonthly]  = useState<ManualStep[]>([]);
  const [manualCompleted, setManualCompleted] = useState<string[]>([]);
  const [streak,         setStreak]         = useState(0);
  const [loading,        setLoading]        = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const v2 = await routineProgramStore.loadActive();
      setV2Routine(v2);

      if (v2) {
        const stepIds  = await getTodayStepIds();
        setCompletedIds(stepIds);
        const checkins = await routineProgramStore.getCheckins();
        setStreak(routineProgramStore.calcStreak(checkins));
      } else {
        const manual = getManualRoutine();
        const log    = getTodayLog();
        const st     = getStreak();
        setManualMorning(manual.morning);
        setManualEvening(manual.evening);
        setManualWeekly(manual.weekly   ?? []);
        setManualMonthly(manual.monthly ?? []);
        setManualCompleted([...log.completedStepIds]);
        setStreak(st.current);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Adımları hesapla ────────────────────────────────────────────────────────

  const morning: ManualStep[] = v2Routine
    ? (v2Routine.morning ?? []).map((s, i) => routineStepToManual(s, "morning", i))
    : manualMorning;

  const evening: ManualStep[] = v2Routine
    ? (v2Routine.evening ?? []).map((s, i) => routineStepToManual(s, "evening", i))
    : manualEvening;

  const weekly:  ManualStep[] = manualWeekly;
  const monthly: ManualStep[] = manualMonthly;

  const activeCompletedIds = v2Routine ? completedIds : manualCompleted;

  const hasRoutine = morning.length > 0 || evening.length > 0;

  // ── Toggle ──────────────────────────────────────────────────────────────────

  const toggleStep = useCallback(async (id: string, wasDone: boolean) => {
    if (v2Routine) {
      const next = await toggleStepCheckin(id);
      setCompletedIds(next);
      const allMorningKeys = (v2Routine.morning ?? []).map((s, i) => routineStepToManual(s, "morning", i).id);
      const allEveningKeys = (v2Routine.evening ?? []).map((s, i) => routineStepToManual(s, "evening", i).id);
      if (allMorningKeys.every((k) => next.includes(k))) {
        routineProgramStore.updateCheckin("morning", true);
      }
      if (allEveningKeys.every((k) => next.includes(k))) {
        routineProgramStore.updateCheckin("evening", true);
      }
    } else {
      if (wasDone) {
        unmarkStep(id);
        setManualCompleted((prev) => prev.filter((x) => x !== id));
      } else {
        markStepDone(id);
        setManualCompleted((prev) => [...prev, id]);
      }
    }
  }, [v2Routine]);

  const markAllSlot = useCallback(async (slot: "morning" | "evening") => {
    if (v2Routine) {
      const steps = slot === "morning" ? morning : evening;
      const keys  = steps.map((s) => s.id);
      await markAllStepsDone(keys);
      setCompletedIds((prev) => Array.from(new Set([...prev, ...keys])));
      routineProgramStore.updateCheckin(slot, true);
    } else {
      markSlotDone(slot);
      const steps = slot === "morning" ? manualMorning : manualEvening;
      setManualCompleted((prev) => {
        const ids = new Set(prev);
        steps.forEach((s) => ids.add(s.id));
        return Array.from(ids);
      });
    }
  }, [v2Routine, morning, evening, manualMorning, manualEvening]);

  return {
    v2Routine,
    morning,
    evening,
    weekly,
    monthly,
    completedIds: activeCompletedIds,
    hasRoutine,
    loading,
    streak,
    toggleStep,
    markAllSlot,
    reload,
  };
}
