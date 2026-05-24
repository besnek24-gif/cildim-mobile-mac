/**
 * stepTypeMapping.ts — Rutin adımı tipi çıkarımı ve ürün eşleştirme.
 *
 * Dual-mode sistemi:
 *   • "product" mode → adım için eşleşen ürün mevcut
 *   • "category" mode → henüz eşleşen ürün yok; kategori adı gösterilir
 *
 * Yeni ürünler eklendikçe mevcut rutinler otomatik "product" moda geçer.
 */

import type { ProductItem, AnalysisResult } from "./analysisEngine";

// ─── Adım tipi çıkarımı ───────────────────────────────────────────────────────

export type StepType =
  | "cleanser"
  | "sunscreen"
  | "moisturizer"
  | "exfoliant"
  | "eye_care"
  | "retinol"
  | "vitamin_c_serum"
  | "niacinamide_serum"
  | "hyaluronic_serum"
  | "peptide_serum"
  | "soothing_serum"
  | "barrier"
  | "mask"
  | "face_oil"
  | "toner"
  | "general";

/** Adım adından step type çıkar (Türkçe keyword matching). */
export function inferStepType(name: string): StepType {
  const n = name.toLowerCase();

  // Önce özel serumlar
  if (n.includes("niacinamide") || n.includes("niasin"))                  return "niacinamide_serum";
  if (n.includes("vitamin c")   || n.includes("c vitamin"))               return "vitamin_c_serum";
  if (n.includes("hyaluronik")  || n.includes("hyaluronic"))              return "hyaluronic_serum";
  if (n.includes("peptit")      || n.includes("peptide"))                 return "peptide_serum";
  if (n.includes("soothing")    || n.includes("yatıştır"))                return "soothing_serum";
  if (n.includes("retinol")     || n.includes("retinoid"))                return "retinol";

  // Temizleyiciler
  if (
    n.includes("temizle") || n.includes("temizleyici") ||
    n.includes("köpük") || n.includes("jel") || n.includes("kremsi") ||
    n.includes("çift temizle")
  ) return "cleanser";

  // Güneş
  if (n.includes("spf") || n.includes("güneş")) return "sunscreen";

  // Göz
  if (n.includes("göz altı") || n.includes("göz kremi")) return "eye_care";

  // Exfoliant
  if (
    n.includes("aha") || n.includes("bha") ||
    n.includes("exfoliant") || n.includes("eksfoliasyon") || n.includes("peeling")
  ) return "exfoliant";

  // Toner (AHA/BHA toneri zaten yukarıda yakalandı)
  if (n.includes("tonik") || n.includes("toner")) return "toner";

  // Bariyer / ceramide / onarıcı
  if (
    n.includes("ceramide") || n.includes("seramid") ||
    n.includes("bariyer") || n.includes("onarıcı")
  ) return "barrier";

  // Yüz yağı / masaj yağı
  if (n.includes("yüz yağı") || n.includes("masaj yağı")) return "face_oil";

  // Maske
  if (n.includes("maske") || n.includes("mask")) return "mask";

  // Genel serum
  if (n.includes("serum")) return "niacinamide_serum"; // Serum → niacinamide bucket

  // Nemlendirici / krem (en sona; yukarıdaki özel tipler önce yakalanır)
  if (
    n.includes("nemlendirici") || n.includes("krem") ||
    n.includes("gece") || n.includes("zengin") || n.includes("losyon")
  ) return "moisturizer";

  return "general";
}

// ─── Ürün rolü → adım tipi eşleştirme ───────────────────────────────────────

const ROLE_STEP_TYPES: Record<StepType, string[]> = {
  cleanser:         ["temizleyici"],
  sunscreen:        ["güneş", "spf", "sunscreen", "sun"],
  moisturizer:      ["nemlendirici", "krem", "cream", "losyon"],
  exfoliant:        ["exfoliant", "toner", "tonik", "aha", "bha"],
  eye_care:         ["göz", "eye"],
  retinol:          ["retinol", "retinoid", "serum"],
  vitamin_c_serum:  ["serum", "vitamin"],
  niacinamide_serum:["serum", "niacinamide", "niasinamid"],
  hyaluronic_serum: ["serum", "hyalur"],
  peptide_serum:    ["serum", "peptit", "peptide"],
  soothing_serum:   ["serum", "yatıştır"],
  barrier:          ["onarıcı", "seramid", "ceramid", "bariyer", "barrier"],
  mask:             ["maske", "mask"],
  face_oil:         ["yağ", "oil"],
  toner:            ["toner", "tonik", "essence", "esans"],
  general:          [],
};

/**
 * Çapraz-kategori kirliliği engelleme — deny listesi.
 * Bir ürünün rolü bu kelimeleri içeriyorsa, verilen adım tipi için REDDEDİLİR.
 * Örn: "güneş" içeren ürün asla moisturizer adımına atanmaz.
 */
const ROLE_DENY_FOR_STEP: Partial<Record<StepType, string[]>> = {
  cleanser:         ["serum", "nemlendirici", "moisturizer", "krem", "cream", "güneş", "spf"],
  moisturizer:      ["temizleyici", "cleanser", "güneş", "spf", "sunscreen"],
  sunscreen:        ["temizleyici", "cleanser", "serum", "nemlendirici", "krem"],
  retinol:          ["temizleyici", "cleanser", "güneş", "spf", "nemlendirici", "krem"],
  vitamin_c_serum:  ["temizleyici", "cleanser", "güneş", "spf", "nemlendirici", "krem"],
  niacinamide_serum:["temizleyici", "cleanser", "güneş", "spf", "nemlendirici", "krem"],
  hyaluronic_serum: ["temizleyici", "cleanser", "güneş", "spf"],
  peptide_serum:    ["temizleyici", "cleanser", "güneş", "spf"],
  soothing_serum:   ["temizleyici", "cleanser", "güneş", "spf"],
  barrier:          ["temizleyici", "cleanser", "güneş", "spf"],
  exfoliant:        ["temizleyici", "güneş", "spf", "nemlendirici", "krem"],
};

/**
 * Bir ürünün rolü, verilen adım tipiyle eşleşiyor mu?
 *
 * Sıra:
 *   1. Deny listesi: yasaklı kelime varsa → RED
 *   2. Allow listesi: izin verilen kelime varsa → ONAY
 *   3. Eşleşme yoksa → FALSE
 */
export function productMatchesStepType(productRole: string, stepType: StepType): boolean {
  const roleLower = productRole.toLowerCase();

  // Önce deny — çapraz-kategori kirliliği engelleme
  const denyWords = ROLE_DENY_FOR_STEP[stepType] ?? [];
  if (denyWords.some((dw) => roleLower.includes(dw))) return false;

  // Sonra allow
  const keywords = ROLE_STEP_TYPES[stepType] ?? [];
  return keywords.some((kw) => roleLower.includes(kw));
}

// ─── Dual-mode çözümleme ─────────────────────────────────────────────────────

export type StepDisplayMode = "product" | "category";

export interface StepResolution {
  displayMode:    StepDisplayMode;
  stepType:       StepType;
  matchedProduct: ProductItem | null;
}

/**
 * Bir rutin adımı için en uygun ürünü bulur.
 * Ürün varsa "product" moduna, yoksa "category" moduna geçer.
 * Ekonomik > Profesyonel > Seçkin öncelik sırası.
 */
export function resolveStep(
  stepName: string,
  products: AnalysisResult["products"]
): StepResolution {
  const stepType = inferStepType(stepName);

  const allPools: ProductItem[][] = [
    products.ekonomik,
    products.profesyonel,
    products.seckin,
  ];

  for (const pool of allPools) {
    const match = pool.find((p) => productMatchesStepType(p.role, stepType));
    if (match) {
      return { displayMode: "product", stepType, matchedProduct: match };
    }
  }

  return { displayMode: "category", stepType, matchedProduct: null };
}

/** Tüm sabah + akşam + haftalık adımlarını çözer. */
export function resolveAllSteps(
  morning:  { name: string }[],
  evening:  { name: string }[],
  weekly:   { name: string }[],
  products: AnalysisResult["products"]
): {
  morning: StepResolution[];
  evening: StepResolution[];
  weekly:  StepResolution[];
} {
  return {
    morning: morning.map((s) => resolveStep(s.name, products)),
    evening: evening.map((s) => resolveStep(s.name, products)),
    weekly:  weekly.map((s)  => resolveStep(s.name, products)),
  };
}
