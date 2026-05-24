/**
 * effectEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hafif "Effect Score + Why Suggested" üretici.
 *
 * KURAL:
 *  • O(1) per ürün — yalnız 1 lower-case + birkaç string `includes` kontrolü.
 *  • DERIN ingredient parse YOK, registry YOK, async iş YOK.
 *  • Tamamen pure & idempotent → useMemo / virtualization ile hatasız.
 *  • Bu modül üretim mantığını ETKİLEMEZ:
 *    - comparisonCandidates/pairKey/similarProducts → DOKUNULMAZ
 *    - rankedX sıralama mantığı                    → DOKUNULMAZ
 *    - DB schema                                    → DOKUNULMAZ
 *  • Sadece UI'a "neden öneriliyor" satırı düşürmek için.
 */

import type { Product } from "@/types/product";

export type EffectScores = {
  acne: number;
  pigmentation: number;
  hydration: number;
  barrier: number;
};

export type EffectKey = keyof EffectScores;

export type EffectResult = {
  scores: EffectScores;
  dominant: EffectKey;
  reason: string;
};

const EMPTY_SCORES: EffectScores = {
  acne: 0,
  pigmentation: 0,
  hydration: 0,
  barrier: 0,
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return String(v);
  } catch {
    return "";
  }
}

/**
 * Dominant key seçimi. Tüm skorlar 0 ise "barrier" — en yumuşak/genel
 * mesaja düşer ("genel bakım ürünü"). Aynı skor varsa Object.entries
 * sıralaması stable + tie-break sort sıralı (acne > pigmentation >
 * hydration > barrier) — predictable, sessiz.
 */
function pickDominant(scores: EffectScores): EffectKey {
  const entries: [EffectKey, number][] = [
    ["acne", scores.acne],
    ["pigmentation", scores.pigmentation],
    ["hydration", scores.hydration],
    ["barrier", scores.barrier],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function buildReason(dominant: EffectKey, hasAnySignal: boolean): string {
  if (!hasAnySignal) return "Genel bakım ürünü";
  switch (dominant) {
    case "acne":         return "Sivilce üzerinde daha güçlü etki";
    case "pigmentation": return "Leke görünümünü hedefler";
    case "hydration":    return "Yoğun nem desteği sağlar";
    case "barrier":      return "Cilt bariyerini destekler";
    default:             return "Genel bakım ürünü";
  }
}

/**
 * Hafif anahtar-kelime tabanlı etki skoru.
 * Hiçbir ürünü FİLTRELEMEZ; sadece "why suggested" satırı için skor üretir.
 *
 * Performans: tek bir lowercase + ~14 includes çağrısı. Per-item, render
 * sırasında. FlatList virtualization sayesinde aynı anda en fazla
 * görünen satır + buffer kadar çağrılır.
 */
export function getEffectResult(
  product: Product | null | undefined,
): EffectResult {
  if (!product) {
    return { scores: { ...EMPTY_SCORES }, dominant: "barrier", reason: "Genel bakım ürünü" };
  }
  const p: any = product;

  // İçerik metni: ingredients ayrı tutulur (özel "salicylic"/"vitamin c"
  // gibi ham bileşen sinyalleri için). Geri kalanı serbest metin havuzu.
  const text = [
    safeStr(p.short_description),
    safeStr(p.full_description),
    safeStr(p.benefits),
    safeStr(p.description),
    safeStr(p.aciklama),
    safeStr(p.name),
    safeStr(p.isim),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const ingredients = [safeStr(p.ingredients), safeStr(p.icindekiler)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const scores: EffectScores = { ...EMPTY_SCORES };

  // ── ACNE ───────────────────────────────────────────────────────────────
  if (ingredients.includes("salicylic") || ingredients.includes("salisilik")) scores.acne += 3;
  if (ingredients.includes("zinc") && !ingredients.includes("zinc oxide"))    scores.acne += 2;
  if (text.includes("akne") || text.includes("sivilce"))                      scores.acne += 2;

  // ── PIGMENTATION ───────────────────────────────────────────────────────
  if (ingredients.includes("vitamin c") || ingredients.includes("ascorbic") || ingredients.includes("askorbik")) scores.pigmentation += 3;
  if (ingredients.includes("niacinamide") || ingredients.includes("niasinamid")) scores.pigmentation += 2;
  if (text.includes("leke") || text.includes("aydınlat") || text.includes("aydinlat")) scores.pigmentation += 2;

  // ── HYDRATION ──────────────────────────────────────────────────────────
  if (ingredients.includes("hyaluronic") || ingredients.includes("hiyaluronik")) scores.hydration += 3;
  if (ingredients.includes("glycerin") || ingredients.includes("gliserin"))     scores.hydration += 1;
  if (text.includes("nem") || text.includes("hydra"))                            scores.hydration += 2;

  // ── BARRIER ────────────────────────────────────────────────────────────
  if (ingredients.includes("ceramide") || ingredients.includes("seramid"))   scores.barrier += 3;
  if (ingredients.includes("panthenol") || ingredients.includes("pantenol")) scores.barrier += 2;
  if (text.includes("bariyer") || text.includes("repair") || text.includes("onar")) scores.barrier += 2;

  const dominant = pickDominant(scores);
  const hasAnySignal =
    scores.acne + scores.pigmentation + scores.hydration + scores.barrier > 0;

  return {
    scores,
    dominant,
    reason: buildReason(dominant, hasAnySignal),
  };
}
