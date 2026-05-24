/**
 * premium-skin-scan-v2 — historyStore
 *
 * Tüm analiz geçmişini AsyncStorage'da tutar.
 * - push()  → listeye ekle, max 20 entry
 * - load()  → AsyncStorage'dan yükle (önbellek ile)
 * - getSync() → senkron okuma (önbellekten)
 * - invalidate() → önbelleği sıfırla
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalysisResult } from "./analysisEngine";

const STORAGE_KEY = "pskv2_history_v1";
const MAX_ENTRIES = 20;

let _cache: AnalysisResult[] | null = null;

export const historyStore = {

  /** Yeni analizi listenin başına ekle. Aynı id varsa atla. */
  async push(result: AnalysisResult): Promise<void> {
    const list = await historyStore.load();
    if (list.some((e) => e.id === result.id)) return;
    const next = [result, ...list].slice(0, MAX_ENTRIES);
    _cache = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore write errors
    }
  },

  /** AsyncStorage'dan yükle (önbellekli). */
  async load(): Promise<AnalysisResult[]> {
    if (_cache !== null) return _cache;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      _cache = raw ? (JSON.parse(raw) as AnalysisResult[]) : [];
    } catch {
      _cache = [];
    }
    return _cache!;
  },

  /** Önbellekten senkron okuma. load() öncesinde boş dizi döner. */
  getSync(): AnalysisResult[] {
    return _cache ?? [];
  },

  /** Belirli bir analizi id'ye göre sil. Güncel listeyi döner. */
  async remove(id: string): Promise<AnalysisResult[]> {
    const list = await historyStore.load();
    const next = list.filter((e) => e.id !== id);
    _cache = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore write errors
    }
    return next;
  },

  /** Tüm geçmişi sil. */
  async removeAll(): Promise<void> {
    _cache = [];
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  },

  /** Önbelleği temizle → bir sonraki load() AsyncStorage'dan okur. */
  invalidate(): void {
    _cache = null;
  },
};
