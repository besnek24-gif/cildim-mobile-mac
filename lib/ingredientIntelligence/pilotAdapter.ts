/**
 * pilotAdapter.ts — ingredientIntelligence
 *
 * Maps IngredientIntelligenceResult → UI structures that [id].tsx already expects.
 * Used ONLY for the pilot product. Does NOT modify any other product flow.
 *
 * PILOT_PRODUCT_ID is the single product under test.
 * Add more IDs here only after the pilot is validated.
 *
 * Maps to:
 *   ParsedIngredient  (from lib/ingredientAnalysis)
 *   IngredientSummary (from lib/ingredientAnalysis)
 */

import type { IngredientIntelligenceResult } from "./analyzeProduct";
import type { ParsedIngredient, IngredientSummary } from "../ingredientAnalysis";

// ─── PILOT MARKER ────────────────────────────────────────────────────────────
// This constant is the ONLY product touched by the ingredient intelligence pilot.
// Do NOT add more product IDs here without a full validation pass.
export const INGREDIENT_INTEL_PILOT_ID =
  "2e71fc76-4135-48b0-a723-3dae9f621c3c"; // Ducray Keracnyl UV Fluid SPF50+

// ─── Category → Turkish description (mirrors V2_CATEGORY_DESC in [id].tsx) ──

const INTEL_CATEGORY_DESC: Record<string, string> = {
  solvent:      "Formül çözücüsü.",
  humectant:    "Nemlendirici; su çekme özelliğiyle cildi besler.",
  emollient:    "Yumuşatıcı; cilt dokusunu düzeltir ve pürüzsüzleştirir.",
  occlusive:    "Oklüzif; nem bariyerini korur.",
  barrier:      "Cilt bariyerini destekler.",
  soothing:     "Yatıştırıcı; hassas ve tahrişli ciltlere yardımcıdır.",
  active:       "Aktif bileşen; belirli cilt sorunlarını hedefler.",
  antioxidant:  "Antioksidan; serbest radikallere karşı koruma sağlar.",
  surfactant:   "Yüzey aktif madde; temizleme ve köpük oluşturma özelliği vardır.",
  preservative: "Formülü koruyucu bileşen.",
  emulsifier:   "Emülgatör; yağ ve suyu bir arada tutar.",
  thickener:    "Kıvam arttırıcı.",
  film_former:  "Film oluşturucu.",
  chelating:    "Şelatlama ajanı; iz mineralleri bağlar.",
  fragrance:    "Koku bileşeni; bazı kişilerde hassasiyet yapabilir.",
  sunfilter:    "UV filtre; güneş koruyucu etki sağlar.",
  uv_filter:    "UV filtre; güneş koruyucu etki sağlar.",
  absorbent:    "Emici; fazla yağı ve nemi tutar.",
  ph_adjuster:  "pH düzenleyici.",
  colorant:     "Pigment / renklendirici.",
  silicone:     "Silikon; form ve dokuyu düzeltir.",
};

// ─── risk_level → ParsedIngredient.level ─────────────────────────────────────

const RISK_TO_LEVEL: Record<
  string,
  "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown"
> = {
  low:     "safe",
  medium:  "medium_risk",
  high:    "high_risk",
  unknown: "unknown",
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Maps a single AnalyzedItem to the ParsedIngredient the UI renders.
 */
export function intelItemToParsedIngredient(
  item: IngredientIntelligenceResult["items"][number]
): ParsedIngredient {
  return {
    name:   item.raw,
    nameTr: item.canonical_name ?? item.raw,
    level:  RISK_TO_LEVEL[item.risk_level] ?? "unknown",
    desc:   item.matched
      ? (INTEL_CATEGORY_DESC[item.category ?? ""] ?? "İçerik hakkında bilgi mevcut.")
      : "Bu içerik için veri bulunamadı.",
  };
}

/**
 * Builds an IngredientSummary from IngredientIntelligenceResult.
 * Mirrors buildIngredientSummaryFromV2() in [id].tsx.
 */
export function buildIngredientSummaryFromIntel(
  result: IngredientIntelligenceResult
): IngredientSummary {
  let safe = 0, low = 0, medium = 0, high = 0, unknown = 0;
  const warnings: string[] = [];

  for (const item of result.items) {
    switch (item.risk_level) {
      case "low":     safe++;    break;
      case "medium":  medium++;  break;
      case "high":    high++;    break;
      default:        unknown++; break;
    }
  }

  const hasFragrance    = result.items.some((i) => i.flags.includes("fragrance"));
  const hasDryingAlcohol= result.items.some((i) => i.flags.includes("drying_alcohol"));
  const hasAllergen     = result.items.some((i) => i.flags.includes("allergen"));
  if (hasFragrance)     warnings.push("Koku (parfüm) içeriyor");
  if (hasDryingAlcohol) warnings.push("Kurutucu alkol içeriyor");
  if (hasAllergen)      warnings.push("Bilinen alerjen içeriyor");

  const total  = result.summary.total;
  const hiPct  = total > 0 ? (high   / total) * 100 : 0;
  const midPct = total > 0 ? (medium / total) * 100 : 0;
  const safePct= total > 0 ? (safe   / total) * 100 : 0;

  let rating: "cok_iyi" | "iyi" | "orta" | "dikkat" | "riskli";
  if      (hiPct  > 15)                rating = "riskli";
  else if (hiPct  > 5 || midPct > 30) rating = "dikkat";
  else if (midPct > 15)                rating = "orta";
  else if (safePct > 70)               rating = "cok_iyi";
  else                                 rating = "iyi";

  const ratingMeta = {
    cok_iyi: { label: "Çok İyi", color: "#22c55e" },
    iyi:     { label: "İyi",     color: "#84cc16" },
    orta:    { label: "Orta",    color: "#eab308" },
    dikkat:  { label: "Dikkat",  color: "#f97316" },
    riskli:  { label: "Riskli",  color: "#ef4444" },
  };

  return {
    total, safe, low, medium, high, unknown,
    rating,
    ratingLabel: ratingMeta[rating].label,
    ratingColor: ratingMeta[rating].color,
    warnings,
  };
}

// ─── Comparison report (dev/logging only) ────────────────────────────────────

export interface PilotComparisonReport {
  pilot_product_id:   string;
  pilot_product_name: string;
  old_summary: { total: number; safe: number; medium: number; high: number; unknown: number };
  new_summary: { total: number; safe: number; medium: number; high: number; unknown: number; coverage_pct: number };
  fallback_used: boolean;
}

export function buildPilotReport(
  productName: string,
  oldSummary:  IngredientSummary,
  intelResult: IngredientIntelligenceResult | null,
  fallbackUsed: boolean
): PilotComparisonReport {
  return {
    pilot_product_id:   INGREDIENT_INTEL_PILOT_ID,
    pilot_product_name: productName,
    old_summary: {
      total:   oldSummary.total,
      safe:    oldSummary.safe,
      medium:  oldSummary.medium,
      high:    oldSummary.high,
      unknown: oldSummary.unknown,
    },
    new_summary: intelResult
      ? {
          total:        intelResult.summary.total,
          safe:         intelResult.summary.safe + intelResult.summary.low_risk,
          medium:       intelResult.summary.medium_risk,
          high:         intelResult.summary.high_risk,
          unknown:      intelResult.summary.unknown,
          coverage_pct: intelResult.summary.coverage_pct,
        }
      : { total: 0, safe: 0, medium: 0, high: 0, unknown: 0, coverage_pct: 0 },
    fallback_used: fallbackUsed,
  };
}
