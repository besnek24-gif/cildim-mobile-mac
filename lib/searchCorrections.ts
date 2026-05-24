/**
 * searchCorrections.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Arama düzeltme hafızası — "bunu mu demek istediniz?" öğrenme katmanı.
 *
 * Kullanıcı bir yazım düzeltmesini kabul ettiğinde (bioksin → Bioxcin)
 * bu eşleşme AsyncStorage'a kaydedilir.
 *
 * Bir sonraki aramada:
 *   - Aynı veya benzer yazımdaki sorgular için güven skoru yükselir
 *   - Düzeltme öncelikli olarak önerilir
 *
 * Veri formatı:
 *   { [normalizedWrong]: { corrected: string; count: number; lastUsed: number } }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@ciltbakim:search_corrections";
const MAX_ENTRIES = 200;

// ── Tür ───────────────────────────────────────────────────────────────────────

interface CorrectionEntry {
  corrected: string;
  count:     number;
  lastUsed:  number;
}

type CorrectionsMap = Record<string, CorrectionEntry>;

// ── Normalize ─────────────────────────────────────────────────────────────────

function normalize(term: string): string {
  return term
    .toLowerCase()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .trim();
}

// ── Yük / Kaydet ──────────────────────────────────────────────────────────────

async function load(): Promise<CorrectionsMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function save(map: CorrectionsMap): Promise<void> {
  try {
    // Boyut sınırı: en az kullanılanları at
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      const kept = entries
        .sort(([, a], [, b]) => (b.count * 0.5 + b.lastUsed * 0.5) - (a.count * 0.5 + a.lastUsed * 0.5))
        .slice(0, MAX_ENTRIES);
      map = Object.fromEntries(kept);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Bir düzeltme kaydı ekle veya kullanım sayısını artır.
 * Ateşle-unut (async, hata fırlatmaz).
 */
export function recordCorrection(wrong: string, corrected: string): void {
  const key = normalize(wrong);
  load().then((map) => {
    const existing = map[key];
    map[key] = {
      corrected,
      count:    (existing?.count ?? 0) + 1,
      lastUsed: Date.now(),
    };
    save(map);
  }).catch(() => {});
}

/**
 * Verilen sorgu için bilinen en iyi düzeltmeyi döndür.
 * Eşleşme yoksa → null.
 */
export async function getTopCorrection(
  query: string,
): Promise<{ corrected: string; count: number } | null> {
  const key = normalize(query);
  const map  = await load();
  const entry = map[key];
  if (!entry) return null;
  return { corrected: entry.corrected, count: entry.count };
}

/**
 * Bir sorgu için güven artışı hesapla.
 * Önceki düzeltmeler varsa 0–0.4 arası bonus döner.
 * Fuzzy search confidence değerine eklenir.
 */
export async function getCorrectionConfidenceBonus(query: string): Promise<number> {
  const result = await getTopCorrection(query);
  if (!result) return 0;
  // Kullanım sayısına göre: 1 kullanım → +0.1, 5+ kullanım → +0.4
  return Math.min(result.count * 0.08, 0.40);
}

/**
 * Tüm düzeltme haritasını döndür (ayarlar ekranı vb. için).
 */
export async function getAllCorrections(): Promise<CorrectionsMap> {
  return load();
}

/**
 * Düzeltme hafızasını temizle.
 */
export async function clearCorrections(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}
