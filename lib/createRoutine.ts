/**
 * createRoutine
 *
 * Supabase'deki `products` tablosundan cilt tipine, endişelere ve segmente
 * göre filtreler; her kategoriden 1 ürün seçer; sabah/akşam rutinine ayırır.
 */

import { supabase } from "./supabaseClient";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type RoutineSegment = "ekonomik" | "profesyonel" | "seçkin";
export type UsageTime = "morning" | "evening" | "both";

export interface RoutineProduct {
  id: string;
  name: string;
  brand: string;
  short_benefit: string | null;
  usage_time: UsageTime;
  category: string;
}

export interface Routine {
  morning: RoutineProduct[];
  evening: RoutineProduct[];
}

export interface CreateRoutineInput {
  skin_type: string;
  concerns: string[];
  segment: RoutineSegment;
}

export type CreateRoutineResult =
  | { success: true; routine: Routine }
  | { success: false; error: string };

// ─── Hedef kategoriler ────────────────────────────────────────────────────────

const TARGET_CATEGORIES = ["cleanser", "serum", "moisturizer", "sunscreen"] as const;
type TargetCategory = (typeof TARGET_CATEGORIES)[number];

// Kategori eşdeğerleri — DB'de Türkçe kategori adı girilmiş olabilir
const CATEGORY_ALIASES: Record<TargetCategory, string[]> = {
  cleanser:    ["cleanser", "temizleyici", "yuz-temizleyici", "yüz-temizleyici"],
  serum:       ["serum"],
  moisturizer: ["moisturizer", "nemlendirici"],
  sunscreen:   ["sunscreen", "güneş-kremi", "gunes-kremi", "güneş_koruyucu"],
};

// ─── Yardımcı: kategori eşleşmesi ────────────────────────────────────────────

function matchCategory(productCategory: string): TargetCategory | null {
  const normalized = productCategory.toLowerCase().trim();
  for (const [target, aliases] of Object.entries(CATEGORY_ALIASES) as [TargetCategory, string[]][]) {
    if (aliases.some((a) => normalized.includes(a) || a.includes(normalized))) {
      return target;
    }
  }
  return null;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

/**
 * Verilen cilt profili için sabah + akşam rutini oluşturur.
 *
 * @example
 * const result = await createRoutine({
 *   skin_type: "combination",
 *   concerns: ["acne", "leke"],
 *   segment: "profesyonel",
 * });
 * if (result.success) console.log(result.routine);
 */
export async function createRoutine(
  input: CreateRoutineInput
): Promise<CreateRoutineResult> {
  const { skin_type, concerns, segment } = input;

  // ── 1. Supabase sorgusu ───────────────────────────────────────────────────
  // skin_type: ürünün skin_type'ı kullanıcının cilt tipiyle eşleşmeli veya "all" olmalı
  // concerns: ürünün concerns dizisi kullanıcının endişeleriyle kesişmeli
  // segment: tam eşleşme

  let query = supabase
    .from("products")
    .select("id, name, brand, short_benefit, category, usage_time, concerns, skin_type, segment")
    .eq("segment", segment)
    .or(`skin_type.eq.${skin_type},skin_type.eq.all`);

  // Endişe filtresi — en az 1 endişe eşleşmeli (PostgreSQL @> yerine overlaps)
  if (concerns.length > 0) {
    query = query.overlaps("concerns", concerns);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: `Supabase sorgu hatası: ${error.message}` };
  }

  if (!data || data.length === 0) {
    // Segment/concerns filtresi çok kısıtlayıcıysa segment hariç yeniden dene
    return createRoutineFallback(input);
  }

  // ── 2. Her kategoriden 1 ürün seç ────────────────────────────────────────
  const picked = pickOnePerCategory(data as RawProduct[]);

  if (picked.length === 0) {
    return createRoutineFallback(input);
  }

  // ── 3. Sabah / akşam rutinine ayır ───────────────────────────────────────
  const routine = splitByUsageTime(picked);
  return { success: true, routine };
}

// ─── Fallback: segment olmadan tekrar dene ────────────────────────────────────

async function createRoutineFallback(
  input: CreateRoutineInput
): Promise<CreateRoutineResult> {
  const { skin_type, concerns } = input;

  let query = supabase
    .from("products")
    .select("id, name, brand, short_benefit, category, usage_time, concerns, skin_type, segment")
    .or(`skin_type.eq.${skin_type},skin_type.eq.all`);

  if (concerns.length > 0) {
    query = query.overlaps("concerns", concerns);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: `Supabase fallback hatası: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      error: "Kriterlere uygun ürün bulunamadı. Lütfen farklı filtreler deneyin.",
    };
  }

  const picked = pickOnePerCategory(data as RawProduct[]);
  if (picked.length === 0) {
    return { success: false, error: "Hiçbir kategoride uygun ürün bulunamadı." };
  }

  return { success: true, routine: splitByUsageTime(picked) };
}

// ─── İç tipler ────────────────────────────────────────────────────────────────

interface RawProduct {
  id: string;
  name: string | null;
  brand: string | null;
  short_benefit: string | null;
  category: string | null;
  usage_time: string | null;
  concerns: string[] | null;
  skin_type: string | null;
  segment: string | null;
}

// ─── Her kategoriden 1 ürün seç ───────────────────────────────────────────────

function pickOnePerCategory(products: RawProduct[]): RoutineProduct[] {
  const bucket = new Map<TargetCategory, RawProduct>();

  for (const product of products) {
    if (!product.category) continue;

    const cat = matchCategory(product.category);
    if (!cat) continue;

    // İlk eşleşmeyi kullan (Supabase varsayılan sıralama: created_at DESC)
    if (!bucket.has(cat)) {
      bucket.set(cat, product);
    }
  }

  return Array.from(bucket.entries()).map(([cat, p]) => ({
    id: p.id,
    name: p.name ?? "İsimsiz Ürün",
    brand: p.brand ?? "Bilinmiyor",
    short_benefit: p.short_benefit ?? null,
    usage_time: normalizeUsageTime(p.usage_time),
    category: cat,
  }));
}

// ─── usage_time normalize ──────────────────────────────────────────────────────

function normalizeUsageTime(raw: string | null): UsageTime {
  if (!raw) return "both";
  const v = raw.toLowerCase().trim();
  if (v === "morning" || v === "sabah") return "morning";
  if (v === "evening" || v === "aksam" || v === "akşam") return "evening";
  return "both";
}

// ─── Sabah / akşam rutinine ayır ──────────────────────────────────────────────

function splitByUsageTime(products: RoutineProduct[]): Routine {
  const morning: RoutineProduct[] = [];
  const evening: RoutineProduct[] = [];

  for (const p of products) {
    if (p.usage_time === "morning" || p.usage_time === "both") {
      morning.push(p);
    }
    if (p.usage_time === "evening" || p.usage_time === "both") {
      evening.push(p);
    }
  }

  // Güneş kremi her zaman yalnızca sabaha ait — akşam listesinden çıkar
  const eveningFiltered = evening.filter((p) => p.category !== "sunscreen");

  return { morning, evening: eveningFiltered };
}
