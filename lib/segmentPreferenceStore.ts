/**
 * segmentPreferenceStore — Kullanıcının ürün segment tercihini öğrenir ve saklar.
 *
 * Mantık:
 *  1. Kullanıcı bir ürün kartına tıkladığında segmenti kaydedilir.
 *  2. 3+ tıklamada çoğunluk oyu kazanır → preferred segment belirlenir.
 *  3. 3 tıklamadan önce: premium üye → Seçkin, diğerleri → Profesyonel (varsayılan).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type SegmentKey = "ekonomik" | "profesyonel" | "seckin";

const CLICKS_KEY = "@ciltbakim:seg_clicks_v1";

interface SegmentClicks {
  ekonomik:    number;
  profesyonel: number;
  seckin:      number;
}

const EMPTY: SegmentClicks = { ekonomik: 0, profesyonel: 0, seckin: 0 };

async function loadClicks(): Promise<SegmentClicks> {
  try {
    const raw = await AsyncStorage.getItem(CLICKS_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<SegmentClicks>;
    return {
      ekonomik:    p.ekonomik    ?? 0,
      profesyonel: p.profesyonel ?? 0,
      seckin:      p.seckin      ?? 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

function toKey(segment: string): SegmentKey | null {
  const s = (segment ?? "").toLowerCase();
  if (s.includes("seç") || s.includes("sec")) return "seckin";
  if (s.includes("prof"))                      return "profesyonel";
  if (s.includes("eko"))                       return "ekonomik";
  return null;
}

/** Kullanıcının tıkladığı segment kaydedilir (öğrenme döngüsü). */
export async function recordSegmentClick(segment: string): Promise<void> {
  const key = toKey(segment);
  if (!key) return;
  const c = await loadClicks();
  c[key] += 1;
  await AsyncStorage.setItem(CLICKS_KEY, JSON.stringify(c));
}

/**
 * Kullanıcının tercih ettiği segmenti döner.
 * - 3+ tıklamada: çoğunluk oyu
 * - Yeterli geçmiş yoksa: premium üye → "seckin", diğerleri → "profesyonel"
 */
export async function getPreferredSegment(isSeckin: boolean): Promise<SegmentKey> {
  const c = await loadClicks();
  const total = c.ekonomik + c.profesyonel + c.seckin;

  if (total >= 3) {
    if (c.seckin > c.profesyonel && c.seckin > c.ekonomik) return "seckin";
    if (c.ekonomik > c.profesyonel && c.ekonomik > c.seckin) return "ekonomik";
    return "profesyonel";
  }

  return isSeckin ? "seckin" : "profesyonel";
}

/** Tıklama geçmişini sıfırlar (çıkış veya hesap silme). */
export async function clearSegmentClicks(): Promise<void> {
  await AsyncStorage.removeItem(CLICKS_KEY);
}
