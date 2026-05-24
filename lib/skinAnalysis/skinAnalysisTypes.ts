export type CaptureAngle = "front" | "left" | "right" | "up" | "down" | "bonus";
export type QualityLabel = "ideal" | "kabul_edilebilir" | "yetersiz";

export interface CaptureItem {
  angle: CaptureAngle;
  uri: string;
  base64: string;
  qualityScore: number;
  qualityLabel: QualityLabel;
}

export interface SkinConcern {
  key: string;
  title: string;
  severity: "düşük" | "orta" | "yüksek";
  zone: string;
  explanation: string;
  careDirection: string;
  confidence?: number;
}

export interface SkinStrength {
  key: string;
  title: string;
  description: string;
}

// PART B-2 — VISIBLE CONCERN DETECTION
// Server'dan additive olarak gelir; eski cevaplar için optional.
// Tıbbi tanı dili YOK; yalnızca "...benzeri görünüm" formülasyonu.
export interface VisibleFindings {
  acne_like_spots?: boolean;
  redness_like_areas?: boolean;
  irritation_like_appearance?: boolean;
  dark_circles?: boolean;
  visible_pores?: boolean;
  dryness_flaking?: boolean;
  oiliness_shine?: boolean;
  notes?: string[];
  confidence?: number; // 0-1
}

export interface DetailedInsight {
  region: string;
  title: string;
  description: string;
}

export interface PharmacistIntelligence {
  shortSummary: string;
  keyFindings: string[];
  detailedInsights: DetailedInsight[];
  strengths: string[];
  careDirection: string;
  avoidSuggestions: string;
  routineLogicExplanation: string;
  pharmacistNote: string;
}

// ── Tiered Routine Types ──────────────────────────────────────────────────────

export interface RoutineStepAlternative {
  name: string;
}

export interface RoutineStep {
  stepNum: number;
  title: string;
  productType: string;
  productName?: string;
  why: string;
  targetConcern: string;
  alternatives: RoutineStepAlternative[];
}

export interface TieredRoutineSlot {
  ekonomik: RoutineStep[];
  profesyonel: RoutineStep[];
  seckin: RoutineStep[];
}

export interface TieredRoutine {
  sabah: TieredRoutineSlot;
  aksam: TieredRoutineSlot;
  haftaDestek?: RoutineStep;
}

// ── Main Analysis Result ──────────────────────────────────────────────────────

export interface MultiAngleSkinResult {
  cilt_tipi: string;
  cilt_tonu: string;
  nem_seviyesi: number;
  puan: number;
  sorunlar: string[];
  guclü_yonler: string[];
  analiz_ozeti: string;
  oncelikli_bakim: string[];
  onerilen_aktifler: string[];
  kaçınılacak_maddeler: string[];
  gunluk_rutin_onerisi: { sabah: string[]; aksam: string[] };
  uv_hasarı: string;
  yas_tahmini: string;
  dominant_zones?: string[];
  concerns_structured?: SkinConcern[];
  strengths_structured?: SkinStrength[];
  routine_tiered?: TieredRoutine;
  visible_findings?: VisibleFindings;
  // FINAL-HARD-LOCK — server-side pose compliance.
  // Missing → mobil tarafça kanıt yok kabul edilir; cap reliability.
  pose_compliance?: PoseCompliance;
}

// FINAL-HARD-LOCK — POSE COMPLIANCE (additive, optional).
// Server ham çıktısı; mobil contextBundle bu alanı okur ve eligibility'yi
// blocked'a düşürür (overall_ok=false || score < 60).
export interface PoseCompliance {
  overall_ok?: boolean;
  score?: number; // 0-100
  failed_angles?: string[];
  warnings?: string[];
}
