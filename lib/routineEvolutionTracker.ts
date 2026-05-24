/**
 * routineEvolutionTracker.ts
 * Rutin değişikliklerini zaman çizelgesinde tutar
 * "Rutin Evrimi" özelliği için veri katmanı
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_EVOLUTION = "routineEvolution:snapshots_v2";

export interface RoutineSnapshot {
  date: string;            // YYYY-MM-DD
  morningSteps: string[];  // adım etiketleri
  eveningSteps: string[];
  reason: string;          // "Flow tamamlandı" | "Manüel düzenleme" | ...
  milestone: string | null; // "Başlangıç" | "Gelişmiş yapı" | null
}

export async function saveRoutineSnapshot(
  morningSteps: string[],
  eveningSteps: string[],
  reason: string,
  milestone?: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_EVOLUTION);
    const snapshots: RoutineSnapshot[] = raw ? JSON.parse(raw) : [];

    // Değişiklik yoksa kaydetme
    const last = snapshots[snapshots.length - 1];
    if (last) {
      const mSame = JSON.stringify(last.morningSteps) === JSON.stringify(morningSteps);
      const eSame = JSON.stringify(last.eveningSteps) === JSON.stringify(eveningSteps);
      if (mSame && eSame) return;
    }

    // İlk kayıt ise "Başlangıç" milestone'u
    const effectiveMilestone = milestone
      ?? (snapshots.length === 0 ? "Başlangıç" : null);

    snapshots.push({
      date: new Date().toISOString().split("T")[0],
      morningSteps,
      eveningSteps,
      reason,
      milestone: effectiveMilestone,
    });

    await AsyncStorage.setItem(KEY_EVOLUTION, JSON.stringify(snapshots.slice(-12)));
  } catch {}
}

export async function getRoutineSnapshots(): Promise<RoutineSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_EVOLUTION);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Rutin evrimini tek cümleyle anlat */
export function describeEvolution(snapshots: RoutineSnapshot[]): string {
  if (snapshots.length === 0) return "Henüz rutin geçmişi yok.";
  if (snapshots.length === 1) return "Rutin kuruldu, evrimi takip ediliyor.";

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const firstTotal = first.morningSteps.length + first.eveningSteps.length;
  const lastTotal = last.morningSteps.length + last.eveningSteps.length;

  if (lastTotal > firstTotal + 1) {
    return `Başlangıçtan bu yana rutin ${firstTotal} adımdan ${lastTotal} adıma genişledi — daha kapsamlı bir bakım protokolüne geçildi.`;
  } else if (lastTotal < firstTotal - 1) {
    return `Rutin sadeleştirildi: ${firstTotal} adımdan ${lastTotal} adıma indirgendi — daha sürdürülebilir yapı oluşturuldu.`;
  } else {
    return `${snapshots.length} değişiklik kaydedildi — rutin dengeli bir yapı koruyor.`;
  }
}

/** Milestone olan snapshot'ları öne çıkar */
export function getMilestones(snapshots: RoutineSnapshot[]): RoutineSnapshot[] {
  return snapshots.filter(s => s.milestone !== null);
}

/** Son X güne ait snapshot sayısı */
export function recentChangeCount(snapshots: RoutineSnapshot[], days = 30): number {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];
  return snapshots.filter(s => s.date >= sinceStr).length;
}
