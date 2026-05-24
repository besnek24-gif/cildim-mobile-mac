/**
 * retentionEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Kullanıcı etkileşim takibi + soft-hook zamanlama mantığı
 *
 * Free:  kaç ürün sayfası görüldü → 2+ sonrası hook'lar görünür
 * Premium: cilt durumu logları + haftalık skor
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PRODUCT_VIEWS    = "retention:product_views_v2";
const KEY_FLOW_COMPLETES   = "retention:flow_completions";
const KEY_ROUTINE_INTERACT = "retention:routine_interactions";
const KEY_SKIN_STATE_LOG   = "retention:skin_state_log_v2";
const KEY_SESSION_HOOKS    = "retention:session_hooks_seen";

// ─── Cilt Durumu ──────────────────────────────────────────────────────────────

export interface SkinStateEntry {
  date: string;         // YYYY-MM-DD
  hydration: number;    // 0-10 (10=çok nemlendirici)
  oiliness: number;     // 0-10 (10=çok yağlı)
  sensitivity: number;  // 0-10 (10=çok hassas)
  acne: number;         // 0-10 (10=çok belirgin)
  overall: number;      // 1-5 genel memnuniyet
}

export type SkinMoodQuick = "very_good" | "good" | "ok" | "bad" | "very_bad";

// ─── Ürün Sayfası Takibi ─────────────────────────────────────────────────────

export async function trackProductView(productId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PRODUCT_VIEWS);
    const views: string[] = raw ? JSON.parse(raw) : [];
    if (!views.includes(productId)) {
      views.push(productId);
      await AsyncStorage.setItem(KEY_PRODUCT_VIEWS, JSON.stringify(views));
    }
  } catch {}
}

export async function getProductViewCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PRODUCT_VIEWS);
    const views: string[] = raw ? JSON.parse(raw) : [];
    return views.length;
  } catch {
    return 0;
  }
}

/** Free hook'lar 2+ ürün sayfasından sonra gösterilir */
export async function shouldShowFreeHook(): Promise<boolean> {
  return (await getProductViewCount()) >= 2;
}

// ─── Flow Tamamlama Takibi ───────────────────────────────────────────────────

export async function trackFlowCompletion(flowId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_FLOW_COMPLETES);
    const completions: string[] = raw ? JSON.parse(raw) : [];
    completions.push(`${flowId}:${Date.now()}`);
    await AsyncStorage.setItem(KEY_FLOW_COMPLETES, JSON.stringify(completions.slice(-20)));
  } catch {}
}

export async function getFlowCompletionCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_FLOW_COMPLETES);
    const c: string[] = raw ? JSON.parse(raw) : [];
    return c.length;
  } catch {
    return 0;
  }
}

// ─── Rutin Etkileşim Takibi ──────────────────────────────────────────────────

export async function trackRoutineInteraction(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_ROUTINE_INTERACT);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    await AsyncStorage.setItem(KEY_ROUTINE_INTERACT, String(count));
  } catch {}
}

export async function getRoutineInteractionCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_ROUTINE_INTERACT);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

// ─── Cilt Durumu Log'ları ─────────────────────────────────────────────────────

export async function saveSkinState(entry: Omit<SkinStateEntry, "date">): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SKIN_STATE_LOG);
    const log: SkinStateEntry[] = raw ? JSON.parse(raw) : [];
    const today = new Date().toISOString().split("T")[0];
    const filtered = log.filter(e => e.date !== today);
    filtered.push({ ...entry, date: today });
    await AsyncStorage.setItem(KEY_SKIN_STATE_LOG, JSON.stringify(filtered.slice(-60)));
  } catch {}
}

export async function getSkinStateLog(days = 7): Promise<SkinStateEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SKIN_STATE_LOG);
    const log: SkinStateEntry[] = raw ? JSON.parse(raw) : [];
    return log.slice(-days);
  } catch {
    return [];
  }
}

export async function getLatestSkinState(): Promise<SkinStateEntry | null> {
  try {
    const log = await getSkinStateLog(1);
    return log.length > 0 ? log[log.length - 1] : null;
  } catch {
    return null;
  }
}

/** Bugün için cilt durumu girilmiş mi? */
export async function hasTodaySkinEntry(): Promise<boolean> {
  try {
    const latest = await getLatestSkinState();
    if (!latest) return false;
    const today = new Date().toISOString().split("T")[0];
    return latest.date === today;
  } catch {
    return false;
  }
}

// ─── Hızlı Cilt Modası (quick-tap) ───────────────────────────────────────────

export function moodToEntry(mood: SkinMoodQuick): Omit<SkinStateEntry, "date"> {
  const map: Record<SkinMoodQuick, Omit<SkinStateEntry, "date">> = {
    very_good: { hydration: 8, oiliness: 3, sensitivity: 2, acne: 1, overall: 5 },
    good:      { hydration: 7, oiliness: 4, sensitivity: 3, acne: 2, overall: 4 },
    ok:        { hydration: 5, oiliness: 5, sensitivity: 5, acne: 4, overall: 3 },
    bad:       { hydration: 3, oiliness: 6, sensitivity: 7, acne: 6, overall: 2 },
    very_bad:  { hydration: 2, oiliness: 7, sensitivity: 9, acne: 8, overall: 1 },
  };
  return map[mood];
}

// ─── Session Hook Kontrolü ────────────────────────────────────────────────────
// Gizli İçgörü her 3 uygulama açılışında bir kez gösterilir

export async function shouldShowGizliInsight(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SESSION_HOOKS);
    const data: { count: number; lastShownDate: string } = raw
      ? JSON.parse(raw)
      : { count: 0, lastShownDate: "" };

    data.count = (data.count ?? 0) + 1;
    await AsyncStorage.setItem(KEY_SESSION_HOOKS, JSON.stringify(data));

    // Her 3 açılışta bir göster
    return data.count % 3 === 1;
  } catch {
    return false;
  }
}
