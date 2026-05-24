/**
 * productDetailAnalysisAdapter.ts — ingredientIntelligence
 *
 * Single authority for product detail analysis.
 * Replaces all scattered score/parsedIngredients/summary branching in [id].tsx.
 *
 * Source priority (highest to lowest):
 *   V4 (new engine, primary) → V3 (legacy intel) → V2 (API result) → LEGACY (old parse)
 *
 * ROLLBACK: To revert to V3-primary behaviour, comment out PATH V4 block below.
 * The fallback chain (V3 → V2 → LEGACY) remains untouched.
 *
 * Consumers must read ONLY from the returned ProductDetailAnalysisModel.
 * Do NOT mix sources after this layer.
 */

import { analyzeProductV4 }               from "../ingredientEngineV4/analyzeProductV4";
import type { V4ProductScore, V4ScoredIngredient } from "../ingredientEngineV4/scorer";

import { analyzeProductFull }              from "./index";
import { intelItemToParsedIngredient, buildIngredientSummaryFromIntel } from "./pilotAdapter";
import type { ParsedIngredient, IngredientSummary } from "../ingredientAnalysis";

// ── V2 internal types (mirrors [id].tsx local types) ─────────────────────────

interface MatchedItemV2 {
  raw:          string;
  canonical_name: string;
  matched:      boolean;
  category:     string;
  risk_level:   string;
  flags:        string[];
}

interface MatchResultV2 {
  version:      "2";
  total:        number;
  matched:      number;
  unknown:      number;
  coverage_pct: number;
  items:        MatchedItemV2[];
  unknown_items: string[];
}

// ── Category descriptions (shared across V2 and V4 paths) ────────────────────

const CATEGORY_DESC_TR: Record<string, string> = {
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
  chelating:    "Şelatlama ajanı; iz mineralleri bağlar.",
  fragrance:    "Koku bileşeni; bazı kişilerde hassasiyet yapabilir.",
  uv_filter:    "UV filtre; güneş koruyucu etki sağlar.",
  absorbent:    "Emici; fazla yağı ve nemi tutar.",
  ph_adjuster:  "pH düzenleyici.",
  film_former:  "Film oluşturucu.",
  silicone:     "Sikon bazlı bileşen; pürüzsüzleştirici ve yumuşatıcı etki.",
  botanical:    "Bitkisel özlü bileşen.",
  colorant:     "Renklendirici pigment.",
  polymer:      "Polimer yapılı bileşen.",
};

// ── V4 converters ─────────────────────────────────────────────────────────────

function v4ItemToParsedIngredient(item: V4ScoredIngredient): ParsedIngredient {
  const bucketToLevel: Record<string, "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown"> = {
    safe:        "safe",
    low_risk:    "low_risk",
    medium_risk: "medium_risk",
    high_risk:   "high_risk",
    unknown:     "unknown",
  };
  return {
    name:   item.raw,
    nameTr: item.canonical_name ?? item.raw,
    level:  bucketToLevel[item.bucket] ?? "unknown",
    desc:   item.matched
      ? (CATEGORY_DESC_TR[item.category ?? ""] ?? "İçerik hakkında bilgi mevcut.")
      : "Bu içerik için veri bulunamadı.",
  };
}

function buildIngredientSummaryFromV4(score: V4ProductScore): IngredientSummary {
  let safe = 0, low = 0, medium = 0, high = 0, unknown = 0;

  for (const item of score.ingredients) {
    switch (item.bucket) {
      case "safe":        safe++;    break;
      case "low_risk":    low++;     break;
      case "medium_risk": medium++;  break;
      case "high_risk":   high++;    break;
      default:            unknown++; break;
    }
  }

  const total    = score.totalIngredients;
  const hiPct    = total > 0 ? (high   / total) * 100 : 0;
  const midPct   = total > 0 ? (medium / total) * 100 : 0;
  const safePct  = total > 0 ? (safe   / total) * 100 : 0;
  const warnings = score.warnings.map((w) => w.message);

  let rating: IngredientSummary["rating"];
  if      (hiPct  > 15)               rating = "riskli";
  else if (hiPct  > 5 || midPct > 30) rating = "dikkat";
  else if (midPct > 15)               rating = "orta";
  else if (safePct > 70)              rating = "cok_iyi";
  else                                rating = "iyi";

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

// ── V2 converters ─────────────────────────────────────────────────────────────

function v2ItemToParsedIngredient(item: MatchedItemV2): ParsedIngredient {
  const levelMap: Record<string, "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown"> = {
    low:     "safe",
    medium:  "medium_risk",
    high:    "high_risk",
    unknown: "unknown",
  };
  return {
    name:   item.raw,
    nameTr: item.canonical_name,
    level:  levelMap[item.risk_level] ?? "unknown",
    desc:   item.matched
      ? (CATEGORY_DESC_TR[item.category] ?? "İçerik hakkında bilgi mevcut.")
      : "Bu içerik için veri bulunamadı.",
  };
}

function buildIngredientSummaryFromV2(result: MatchResultV2): IngredientSummary {
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

  const hasFragrance     = result.items.some((i) => i.flags.includes("fragrance"));
  const hasDryingAlcohol = result.items.some((i) => i.flags.includes("drying_alcohol"));
  if (hasFragrance)     warnings.push("Koku (parfüm) içeriyor");
  if (hasDryingAlcohol) warnings.push("Kurutucu alkol içeriyor");

  const total   = result.total;
  const hiPct   = total > 0 ? (high   / total) * 100 : 0;
  const midPct  = total > 0 ? (medium / total) * 100 : 0;
  const safePct = total > 0 ? (safe   / total) * 100 : 0;

  let rating: IngredientSummary["rating"];
  if      (hiPct  > 15)               rating = "riskli";
  else if (hiPct  > 5 || midPct > 30) rating = "dikkat";
  else if (midPct > 15)               rating = "orta";
  else if (safePct > 70)              rating = "cok_iyi";
  else                                rating = "iyi";

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

// ── Public interface ──────────────────────────────────────────────────────────

export interface ProductDetailInput {
  productId:               string;
  rawIngredientsText?:     string | null;
  legacyParsedIngredients?: ParsedIngredient[];
  legacySummary?:          IngredientSummary | null;
  legacyScore?:            number | null;
  ingredientAnalysisV2?:   MatchResultV2 | null;
}

export interface ProductDetailAnalysisModel {
  /** Analysis engine source — V4 is primary post-cutover. */
  source:                "V4" | "V3" | "V2" | "LEGACY";

  // Core score fields (all from V4 when source === "V4")
  finalScore:            number | null;
  scoreLabel:            string | null;
  confidence:            "high" | "medium" | "low";

  // Ingredient lists and summary
  parsedIngredients:     ParsedIngredient[];
  ingredientSummary:     IngredientSummary;

  // Warnings (Turkish human-readable strings)
  warnings:              string[];

  // V4-specific fields (null for V3/V2/LEGACY)
  coveragePct:           number | null;
  formulaType:           string | null;
  formulaConfidence:     "high" | "medium" | "low" | null;
  matchedIngredients:    number | null;
  unresolvedIngredients: number | null;
  totalIngredients:      number | null;
  explanationSummary:    string | null;
}

// ── Fallback summary (empty state) ───────────────────────────────────────────

const EMPTY_SUMMARY: IngredientSummary = {
  total: 0, safe: 0, low: 0, medium: 0, high: 0, unknown: 0,
  rating: "iyi", ratingLabel: "İyi", ratingColor: "#84cc16", warnings: [],
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Builds a single, authoritative product detail analysis model.
 *
 * Priority: V4 (primary) → V3 (legacy, high/medium confidence) → V2 → LEGACY
 *
 * ROLLBACK INSTRUCTIONS:
 *   Comment out the "── PATH V4" block below to revert to V3-primary behaviour.
 *   No other files need to change.
 *
 * This is the ONLY place source branching happens for product detail.
 * [id].tsx must read exclusively from the returned model.
 */
export function buildProductDetailAnalysisModel(
  input: ProductDetailInput
): ProductDetailAnalysisModel {

  // ═══════════════════════════════════════════════════════════════════════════
  // ── PATH V4 (PRIMARY) ─────────────────────────────────────────────────────
  // To rollback: comment out this entire block.
  // ═══════════════════════════════════════════════════════════════════════════
  if (input.rawIngredientsText) {
    try {
      const v4: V4ProductScore = analyzeProductV4({
        rawIngredientsText: input.rawIngredientsText,
        productId:          input.productId,
      });

      return {
        source:                "V4",
        finalScore:            v4.finalScore,
        scoreLabel:            v4.scoreLabel,
        confidence:            v4.confidence,
        parsedIngredients:     v4.ingredients.map(v4ItemToParsedIngredient),
        ingredientSummary:     buildIngredientSummaryFromV4(v4),
        warnings:              v4.warnings.map((w) => w.message),
        coveragePct:           v4.coveragePct,
        formulaType:           v4.formulaType,
        formulaConfidence:     v4.formulaConfidence,
        matchedIngredients:    v4.matchedIngredients,
        unresolvedIngredients: v4.unresolvedIngredients,
        totalIngredients:      v4.totalIngredients,
        explanationSummary:    v4.explanationSummary,
      };
    } catch (e) {
      // V4 threw a runtime error — fall through to V3
      console.warn("[productDetailAnalysisAdapter] V4 failed, falling back to V3:", e);
    }
  }
  // ═══════════════════════════════════════════════════════════════════════════

  // ── PATH V3 (emergency fallback) ──────────────────────────────────────────
  if (input.rawIngredientsText) {
    try {
      const { analysis, score } = analyzeProductFull(
        input.rawIngredientsText,
        input.productId
      );

      if (score.confidence !== "low") {
        return {
          source:                "V3",
          finalScore:            score.score_0_100,
          scoreLabel:            null,
          confidence:            score.confidence,
          parsedIngredients:     analysis.items.map(intelItemToParsedIngredient),
          ingredientSummary:     buildIngredientSummaryFromIntel(analysis),
          warnings:              score.warnings,
          coveragePct:           null,
          formulaType:           null,
          formulaConfidence:     null,
          matchedIngredients:    null,
          unresolvedIngredients: null,
          totalIngredients:      null,
          explanationSummary:    null,
        };
      }
      // V3 ran but confidence is low — fall through to V2/LEGACY below
    } catch {
      // V3 threw — fall through to V2/LEGACY
    }
  }

  // ── PATH V2 ───────────────────────────────────────────────────────────────
  if (input.ingredientAnalysisV2?.items?.length) {
    const v2 = input.ingredientAnalysisV2;
    return {
      source:                "V2",
      finalScore:            input.legacyScore ?? null,
      scoreLabel:            null,
      confidence:            "medium",
      parsedIngredients:     v2.items.map(v2ItemToParsedIngredient),
      ingredientSummary:     buildIngredientSummaryFromV2(v2),
      warnings:              [],
      coveragePct:           null,
      formulaType:           null,
      formulaConfidence:     null,
      matchedIngredients:    null,
      unresolvedIngredients: null,
      totalIngredients:      null,
      explanationSummary:    null,
    };
  }

  // ── PATH LEGACY ───────────────────────────────────────────────────────────
  return {
    source:                "LEGACY",
    finalScore:            input.legacyScore ?? null,
    scoreLabel:            null,
    confidence:            "low",
    parsedIngredients:     input.legacyParsedIngredients ?? [],
    ingredientSummary:     input.legacySummary ?? EMPTY_SUMMARY,
    warnings:              [],
    coveragePct:           null,
    formulaType:           null,
    formulaConfidence:     null,
    matchedIngredients:    null,
    unresolvedIngredients: null,
    totalIngredients:      null,
    explanationSummary:    null,
  };
}
