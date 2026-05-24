/**
 * scorer/index.ts — ingredientEngineV4
 *
 * V4 unified product scorer.
 * Produces one deterministic result object — no mixed-source fallback logic.
 *
 * Scoring philosophy:
 *   - Start at BASE_SCORE (100)
 *   - Deduct per risk bucket (high_risk > medium_risk > unknown)
 *   - Apply bonus for confirmed safe/low_risk ingredients
 *   - Apply unknown-ratio penalty (smooth, tier-based) — NEW in v4.1
 *   - Score ceiling when unknownRatio > 0.3 / > 0.5    — NEW in v4.1
 *   - Formula-type modifiers applied BEFORE scoring (via policyEngine)
 *
 * Output: V4ProductScore — complete, self-contained, UI-ready
 *
 * ZERO imports from legacy/V3 systems.
 */

import type { V4MatchResult } from "../registry/types";
import type { V4RiskAssessment, V4RiskBucket } from "../policyEngine/types";
import type { FormulaClassification, V4FormulaType } from "../formulaClassifier";

// ── Scoring constants ──────────────────────────────────────────────────────────

const BASE_SCORE            = 100;
const HIGH_RISK_PENALTY     = 18;    // per high_risk ingredient
const MEDIUM_RISK_PENALTY   = 5;     // per medium_risk ingredient
const UNKNOWN_PENALTY_RATIO = 0.20;  // per unknown ingredient (count-based)
const SAFE_BONUS_PER        = 0.4;   // per safe/low_risk ingredient
const MAX_SAFE_BONUS        = 10;

// ── Confidence coverage thresholds ────────────────────────────────────────────

const CONFIDENCE_HIGH_THRESHOLD   = 80;  // coverage > 80% → high
const CONFIDENCE_MEDIUM_THRESHOLD = 60;  // coverage 60-80% → medium
                                         // coverage < 60%  → low

// ── Score ceiling thresholds (unknown-aware) ──────────────────────────────────

const CEILING_STRONG_THRESHOLD = 0.5;   // unknownRatio > 0.5 → cap at 69
const CEILING_MILD_THRESHOLD   = 0.3;   // unknownRatio > 0.3 → cap at 79
const CEILING_STRONG_MAX       = 69;
const CEILING_MILD_MAX         = 79;

// ── Types ──────────────────────────────────────────────────────────────────────

export type V4ScoreConfidence = "high" | "medium" | "low";
export type V4ScoreLabel =
  | "Çok Güvenli"
  | "Güvenli"
  | "Orta"
  | "Dikkatli Ol"
  | "Yüksek Risk";

export interface V4Warning {
  code:    string;
  message: string;
}

export interface V4ScoreBreakdown {
  base_score:            number;
  high_risk_penalty:     number;
  medium_risk_penalty:   number;
  unknown_penalty:       number;
  unknown_ratio_penalty: number;   // smooth tier-based ratio penalty
  safe_bonus:            number;
  raw_score:             number;
  final_score:           number;
}

export interface V4ScoredIngredient {
  raw:             string;
  normalized:      string;
  canonical_name:  string | null;
  category:        string | null;
  flags:           string[];
  matched:         boolean;
  match_tier:      string;
  risk_level:      string;
  bucket:          V4RiskBucket;
  decision_source: string;
  reasons:         string[];
  pregnancy_safe:  boolean | "uncertain" | null;
}

export interface V4ProductScore {
  // Core output
  finalScore:           number;
  scoreLabel:           V4ScoreLabel;
  confidence:           V4ScoreConfidence;
  coveragePct:          number;
  formulaType:          V4FormulaType;
  formulaConfidence:    "high" | "medium" | "low";

  // Ingredient breakdown
  totalIngredients:     number;
  matchedIngredients:   number;
  unresolvedIngredients: number;
  ingredients:          V4ScoredIngredient[];

  // Warnings
  warnings:             V4Warning[];

  // Score breakdown (audit trail)
  breakdown:            V4ScoreBreakdown;

  // Human-readable summary
  explanationSummary:   string;

  // Meta
  computedAt:           string;
  engineVersion:        "v4.0";
}

// ── Internal analysis item ─────────────────────────────────────────────────────

export interface V4AnalysisItem {
  match:      V4MatchResult;
  assessment: V4RiskAssessment;
}

// ── Score label ────────────────────────────────────────────────────────────────

export function getV4ScoreLabel(score: number): V4ScoreLabel {
  if (score >= 85) return "Çok Güvenli";
  if (score >= 70) return "Güvenli";
  if (score >= 55) return "Orta";
  if (score >= 40) return "Dikkatli Ol";
  return "Yüksek Risk";
}

// ── Unknown-ratio penalty (smooth, tier-based) ─────────────────────────────────
//
// Penalty tiers — additive on top of the per-ingredient unknown penalty:
//   ratio < 0.10 → 0
//   ratio 0.10–0.25 → 3–5  (linear)
//   ratio 0.25–0.40 → 8–12 (linear)
//   ratio > 0.40 → 15–25   (linear, hard-capped at 25)
//
// Deterministic: same ratio always yields same penalty.

function calcUnknownRatioPenalty(unknownRatio: number): number {
  if (unknownRatio < 0.10) return 0;

  if (unknownRatio <= 0.25) {
    // Linear interpolation: 3 → 5
    const t = (unknownRatio - 0.10) / 0.15;
    return 3 + t * 2;
  }

  if (unknownRatio <= 0.40) {
    // Linear interpolation: 8 → 12
    const t = (unknownRatio - 0.25) / 0.15;
    return 8 + t * 4;
  }

  // > 0.40: Linear interpolation: 15 → 25, hard-capped
  const t = Math.min(1, (unknownRatio - 0.40) / 0.30);
  return 15 + t * 10;
}

// ── Score ceiling (unknown-aware) ──────────────────────────────────────────────

function applyUnknownCeiling(score: number, unknownRatio: number): { score: number; ceilingApplied: boolean } {
  if (unknownRatio > CEILING_STRONG_THRESHOLD) {
    return { score: Math.min(score, CEILING_STRONG_MAX), ceilingApplied: true };
  }
  if (unknownRatio > CEILING_MILD_THRESHOLD) {
    return { score: Math.min(score, CEILING_MILD_MAX), ceilingApplied: true };
  }
  return { score, ceilingApplied: false };
}

// ── Warnings builder ──────────────────────────────────────────────────────────

function buildWarnings(
  items:        V4AnalysisItem[],
  coveragePct:  number,
  unknownRatio: number
): V4Warning[] {
  const warnings: V4Warning[] = [];
  const matches = items.map((i) => i.match);

  if (matches.some((m) => m.flags.includes("fragrance"))) {
    warnings.push({ code: "contains_fragrance", message: "Koku (parfüm) içeriyor — hassas ciltlerde hassasiyet riski" });
  }
  if (matches.some((m) => m.flags.includes("drying_alcohol"))) {
    warnings.push({ code: "contains_drying_alcohol", message: "Kurutucu alkol içeriyor — cilt bariyerini zayıflatabilir" });
  }
  if (matches.some((m) => m.flags.includes("allergen"))) {
    warnings.push({ code: "contains_allergen", message: "Bilinen alerjen içeriyor — EU 26 listesi" });
  }
  if (matches.some((m) => m.flags.includes("endocrine_disruptor"))) {
    warnings.push({ code: "contains_endocrine_disruptor", message: "Hormonal bozucu aktivite şüphesi olan madde içeriyor" });
  }
  if (matches.some((m) => m.flags.includes("formaldehyde_releaser"))) {
    warnings.push({ code: "contains_formaldehyde_releaser", message: "Formaldehit salımlı koruyucu içeriyor" });
  }
  if (matches.some((m) => m.flags.includes("paraben"))) {
    warnings.push({ code: "contains_paraben", message: "Paraben grubu koruyucu içeriyor" });
  }
  // Pregnancy caution: check ALL matched ingredients
  if (matches.some((m) => m.pregnancy_safe === false)) {
    warnings.push({ code: "pregnancy_caution", message: "Gebelikte kaçınılması önerilen bileşen içeriyor" });
  }

  // Coverage-based warnings
  if (coveragePct < 60) {
    warnings.push({ code: "low_coverage", message: `Bileşenlerin %${100 - coveragePct}'i tanınamadı — skor tahmini` });
  }
  if (items.filter((i) => !i.match.matched).length > 5) {
    warnings.push({ code: "many_unknowns", message: "Çok sayıda bilinmeyen bileşen mevcut" });
  }

  // Unknown-ratio threshold warning (NEW in v4.1)
  if (unknownRatio > CEILING_MILD_THRESHOLD) {
    warnings.push({ code: "analysis_limited", message: "İçerik analizi sınırlı — bazı bileşenler değerlendirilemedi" });
  }

  return warnings;
}

// ── Explanation summary ────────────────────────────────────────────────────────

function buildExplanation(
  score:          number,
  label:          V4ScoreLabel,
  formulaType:    V4FormulaType,
  coveragePct:    number,
  highCount:      number,
  mediumCount:    number,
  unknownCount:   number,
  unknownRatio:   number,
  ceilingApplied: boolean
): string {
  const formulaTr: Record<V4FormulaType, string> = {
    sunscreen:   "güneş koruyucu",
    cleanser:    "temizleyici",
    serum:       "serum",
    moisturizer: "nemlendirici",
    treatment:   "aktif bakım ürünü",
    shampoo:     "şampuan",
    other:       "ürün",
  };

  const parts: string[] = [];
  parts.push(`Bu ${formulaTr[formulaType]} formülü ${score}/100 güvenlik puanı aldı (${label}).`);

  if (ceilingApplied) {
    const unknownPct = Math.round(unknownRatio * 100);
    parts.push(`İçeriğin %${unknownPct}'i analiz edilemediği için güven puanı sınırlandırıldı.`);
  } else if (coveragePct < 80) {
    parts.push(`Bileşenlerin %${coveragePct}'i tanındı.`);
  }

  if (highCount > 0) {
    parts.push(`${highCount} yüksek risk bileşeni saptandı.`);
  }
  if (mediumCount > 0) {
    parts.push(`${mediumCount} orta risk bileşeni tespit edildi.`);
  }
  if (unknownCount > 0) {
    parts.push(`${unknownCount} bileşen kütüphanede bulunamadı.`);
  }

  return parts.join(" ");
}

// ── Main scorer ────────────────────────────────────────────────────────────────

/**
 * Calculates the unified V4ProductScore from analyzed items.
 *
 * @param items           Array of {match, assessment} pairs from analyzeV4Product()
 * @param classification  Formula classification from classifyV4Formula()
 * @param rawText         Original raw ingredient string (for metadata)
 */
export function scoreV4Product(
  items:          V4AnalysisItem[],
  classification: FormulaClassification,
  rawText:        string = ""
): V4ProductScore {
  const total = items.length;

  if (total === 0) {
    return _emptyScore(classification, rawText);
  }

  // ── Count buckets ────────────────────────────────────────────────────────────
  let safe = 0, lowRisk = 0, mediumRisk = 0, highRisk = 0, unknown = 0;

  for (const { assessment } of items) {
    switch (assessment.bucket) {
      case "safe":        safe++;       break;
      case "low_risk":    lowRisk++;    break;
      case "medium_risk": mediumRisk++; break;
      case "high_risk":   highRisk++;   break;
      default:            unknown++;    break;
    }
  }

  const matched      = items.filter((i) => i.match.matched).length;
  const unresolved   = total - matched;
  const coveragePct  = total > 0 ? Math.round((matched / total) * 100) : 0;
  const unknownRatio = total > 0 ? unresolved / total : 0;

  // ── Score calculation ────────────────────────────────────────────────────────
  // Step 1: per-ingredient penalties & bonus (existing)
  const highRiskPenalty    = highRisk * HIGH_RISK_PENALTY;
  const mediumRiskPenalty  = mediumRisk * MEDIUM_RISK_PENALTY;
  const unknownPenalty     = Math.round(unknown * UNKNOWN_PENALTY_RATIO);
  const safeBonus          = Math.min((safe + lowRisk) * SAFE_BONUS_PER, MAX_SAFE_BONUS);

  const rawScore = BASE_SCORE - highRiskPenalty - mediumRiskPenalty - unknownPenalty + safeBonus;

  // Step 2: unknown-ratio penalty (smooth, tier-based) — NEW in v4.1
  const unknownRatioPenalty = calcUnknownRatioPenalty(unknownRatio);
  const afterRatioPenalty   = rawScore - unknownRatioPenalty;

  // Step 3: clamp to 0-100, then apply unknown-aware ceiling — NEW in v4.1
  const clampedScore = Math.max(0, Math.min(100, Math.round(afterRatioPenalty)));
  const { score: finalScore, ceilingApplied } = applyUnknownCeiling(clampedScore, unknownRatio);

  // ── Confidence ────────────────────────────────────────────────────────────────
  // NEW thresholds (v4.1): > 80% → high, 60-80% → medium, < 60% → low
  let confidence: V4ScoreConfidence;
  if (coveragePct > CONFIDENCE_HIGH_THRESHOLD)   confidence = "high";
  else if (coveragePct >= CONFIDENCE_MEDIUM_THRESHOLD) confidence = "medium";
  else                                            confidence = "low";

  // ── Assemble scored ingredients ───────────────────────────────────────────────
  const ingredients: V4ScoredIngredient[] = items.map(({ match, assessment }) => ({
    raw:             match.raw,
    normalized:      match.normalized,
    canonical_name:  match.canonical_name,
    category:        match.category,
    flags:           match.flags,
    matched:         match.matched,
    match_tier:      match.match_tier,
    risk_level:      assessment.risk_level,
    bucket:          assessment.bucket,
    decision_source: assessment.decision_source,
    reasons:         assessment.reasons,
    pregnancy_safe:  match.pregnancy_safe,
  }));

  const scoreLabel = getV4ScoreLabel(finalScore);
  const warnings   = buildWarnings(items, coveragePct, unknownRatio);

  const breakdown: V4ScoreBreakdown = {
    base_score:            BASE_SCORE,
    high_risk_penalty:     highRiskPenalty,
    medium_risk_penalty:   mediumRiskPenalty,
    unknown_penalty:       unknownPenalty,
    unknown_ratio_penalty: Math.round(unknownRatioPenalty * 10) / 10,
    safe_bonus:            Math.round(safeBonus * 10) / 10,
    raw_score:             Math.round(rawScore),
    final_score:           finalScore,
  };

  return {
    finalScore,
    scoreLabel,
    confidence,
    coveragePct,
    formulaType:          classification.formulaType,
    formulaConfidence:    classification.confidence,
    totalIngredients:     total,
    matchedIngredients:   matched,
    unresolvedIngredients: unresolved,
    ingredients,
    warnings,
    breakdown,
    explanationSummary: buildExplanation(
      finalScore, scoreLabel, classification.formulaType,
      coveragePct, highRisk, mediumRisk, unknown,
      unknownRatio, ceilingApplied
    ),
    computedAt:    new Date().toISOString(),
    engineVersion: "v4.0",
  };
}

// ── Empty score (no ingredients) ──────────────────────────────────────────────

function _emptyScore(
  classification: FormulaClassification,
  rawText:        string
): V4ProductScore {
  return {
    finalScore:            0,
    scoreLabel:            "Yüksek Risk",
    confidence:            "low",
    coveragePct:           0,
    formulaType:           classification.formulaType,
    formulaConfidence:     classification.confidence,
    totalIngredients:      0,
    matchedIngredients:    0,
    unresolvedIngredients: 0,
    ingredients:           [],
    warnings:              [{ code: "no_ingredients", message: "Bileşen listesi bulunamadı" }],
    breakdown: {
      base_score: 0, high_risk_penalty: 0, medium_risk_penalty: 0,
      unknown_penalty: 0, unknown_ratio_penalty: 0,
      safe_bonus: 0, raw_score: 0, final_score: 0,
    },
    explanationSummary:    "Bileşen verisi bulunamadı — analiz yapılamadı.",
    computedAt:            new Date().toISOString(),
    engineVersion:         "v4.0",
  };
}
