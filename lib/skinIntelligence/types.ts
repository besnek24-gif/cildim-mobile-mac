/**
 * Skin Intelligence — Master Type System
 * 6 katmanlı yeni modülün tüm veri sözleşmelerini tanımlar.
 * Eski cilt-analizi modülüyle hiçbir bağımlılık yok.
 */

// ─── Temel Enums ────────────────────────────────────────────────────────────

export type AngleId = "front" | "left" | "right" | "up" | "down";
export type SkinType = "yağlı" | "kuru" | "karma" | "normal" | "hassas";
export type SkinTone = "açık" | "orta" | "koyu" | "çok_koyu";
export type Severity = "mild" | "moderate" | "significant";
export type Confidence = "high" | "medium" | "low";
export type RoutinePeriod = "morning" | "evening";
export type RoutineRole = "core" | "active" | "support";
export type ProductSegment = "ekonomik" | "profesyonel" | "seckin";
export type FlowStep =
  | "capture"
  | "validating"
  | "analysis_quick"
  | "analysis_deep"
  | "result"
  | "routine"
  | "products"
  | "saving"
  | "history";

// ─── Layer 1: Capture Guard ──────────────────────────────────────────────────

export interface CaptureQuality {
  score: number;                          // 0–100
  lighting: "ok" | "dark" | "bright";
  blur: "ok" | "blurry";
  faceDetected: boolean;
  faceSize: "ok" | "too_small" | "too_large";
  confidence: Confidence;
  blockAnalysis: boolean;                 // true → analiz başlatılamaz
  blockReason?: string;                   // kullanıcıya gösterilecek mesaj
}

export interface CaptureFrame {
  angle: AngleId;
  uri: string;
  base64: string;
  compressedBase64?: string;             // 800px/72% sıkıştırılmış
  quality: CaptureQuality;
  capturedAt: string;                    // ISO timestamp
}

export const ANGLE_ORDER: AngleId[] = ["front", "left", "right", "up", "down"];

export const ANGLE_LABEL: Record<AngleId, string> = {
  front: "Düz Bakış",
  left: "Sol 45°",
  right: "Sağ 45°",
  up: "Çene Yukarı",
  down: "Çene Aşağı",
};

// ─── Layer 2: Scan Orchestrator ──────────────────────────────────────────────

export interface ScanPackage {
  id: string;                            // uuid
  frames: CaptureFrame[];
  overallQuality: number;                // ortalama kalite skoru
  isReadyForAnalysis: boolean;
  createdAt: string;
}

// ─── Layer 3: Analysis Engine ────────────────────────────────────────────────

export interface SkinSignal {
  key: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  zone?: string;                         // bölge bilgisi — yalnızca yüksek güven varsa
  description: string;                   // "görünüyor", "işaret ediyor" diliyle
  careDirection: string;
}

export interface SkinStrength {
  key: string;
  title: string;
  description: string;
}

export interface AnalysisResult {
  id: string;
  scanId: string;
  createdAt: string;
  skinType: SkinType;
  skinTone: SkinTone;
  skinScore: number;                     // 0–100
  moistureLevel: number;                 // 0–100
  uvDamage: "none" | "mild" | "moderate" | "visible";
  ageEstimate?: string;                  // "25-30" gibi
  signals: SkinSignal[];                 // maks 4, yalnızca güvenilir bulgular
  strengths: SkinStrength[];             // maks 3
  summary: string;                       // 2-3 cümle ihtiyatlı özet
  confidence: Confidence;                // genel analiz güveni
  qualityWarning?: string;               // düşük güven varsa kullanıcıya uyarı
  isQuickResult: boolean;               // hızlı Haiku sonucu mu?
}

// ─── Layer 4: Routine Engine ─────────────────────────────────────────────────

export type StepCategory =
  | "cleanser"
  | "toner"
  | "serum"
  | "moisturizer"
  | "sunscreen"
  | "eye_cream"
  | "mask"
  | "treatment"
  | "oil";

export interface RoutineStep {
  id: string;
  order: number;
  period: RoutinePeriod;
  category: StepCategory;
  role: RoutineRole;
  label: string;                         // "Hafif Nemlendirici"
  productType: string;                   // "Hyaluronik Asit Serumu"
  why: string;                           // bu adımın sebebi
  targetSignal?: string;                 // hangi SkinSignal.key'i hedefliyor
  avoidIfSensitive?: boolean;
}

export interface GeneratedRoutine {
  id: string;
  analysisId: string;
  morningSteps: RoutineStep[];           // maks 5
  eveningSteps: RoutineStep[];           // maks 5
  generatedAt: string;
  adaptedFor: SkinType;
}

// ─── Layer 5: Product Matching Engine ───────────────────────────────────────

export interface ProductMatch {
  routineStepId: string;
  stepCategory: StepCategory;
  segment: ProductSegment;
  productId?: string;                    // DB'den eşleşen ürün ID
  productName: string;
  brand?: string;
  matchScore: number;                    // 0–100 uyum skoru
  reason: string;                        // neden önerildiği
  isAlternative: boolean;
}

export interface SegmentMatchGroup {
  segment: ProductSegment;
  matches: ProductMatch[];
}

export interface ProductMatchSet {
  id: string;
  analysisId: string;
  routineId: string;
  groups: SegmentMatchGroup[];           // ekonomik / profesyonel / seckin
  generatedAt: string;
}

// ─── Layer 6: Result Memory Engine ──────────────────────────────────────────

export interface SavedScan {
  id: string;
  userId: string;
  createdAt: string;
  scanQuality: number;
  skinScore: number;
  skinType: SkinType;
  topSignals: string[];                  // maks 3 başlık
  analysis: AnalysisResult;
  routine: GeneratedRoutine;
  products: ProductMatchSet;
  thumbnailUri?: string;                 // ön açı görseli
}

export interface ScoreDelta {
  previousScore: number;
  currentScore: number;
  delta: number;
  trend: "up" | "down" | "stable";
}

// ─── API Kontratları ─────────────────────────────────────────────────────────

export interface QuickAnalysisRequest {
  image: string;                         // base64 data URL (sıkıştırılmış)
}

export interface QuickAnalysisResponse {
  analiz: Partial<AnalysisResult> & Pick<AnalysisResult, "skinType" | "skinScore" | "summary" | "signals">;
  quick: true;
  success: boolean;
}

export interface DeepAnalysisRequest {
  images: string[];                      // [ön, sol, sağ, yukarı, aşağı] base64
  angles: string[];
}

export interface DeepAnalysisResponse {
  /**
   * ARCHITECT FOLLOW-UP: blocked cevaplarda `analiz` yok. Tip kontratı buna
   * uygun olmalı — opsiyonel + tüm tüketicilerde guard zorunlu.
   */
  analiz?: AnalysisResult;
  intelligence: DeepIntelligenceLayer | null;
  routine_tiered: TieredRoutineResponse | null;
  success: boolean;
  angle_count: number;
  /**
   * RELEASE-BLOCKER PART C — pose precheck blok cevabı.
   * Sunucu ucuz haiku ile fotoğrafların açı uyumunu önce doğrular; başarısızsa
   * `analysis_blocked: true` + `block_reason` döner ve `analiz` alanı boştur.
   * Mobile: bu durumda sonucu safe-state pose-failed bundle'ı ile gösterir.
   */
  analysis_blocked?: boolean;
  block_reason?: string;
  pose_compliance?: {
    overall_ok?: boolean;
    score?: number;
    failed_angles?: string[];
    warnings?: string[];
  };
  message?: string;
}

export interface DeepIntelligenceLayer {
  shortSummary: string;
  keyFindings: string[];
  detailedInsights: { zone: string; finding: string; recommendation: string }[];
  actionPriority: string[];
  safetyNotes: string[];
}

export interface TieredRoutineResponse {
  morning: Record<ProductSegment, RoutineStep[]>;
  evening: Record<ProductSegment, RoutineStep[]>;
}

// ─── Flow Navigasyon Parametreleri ───────────────────────────────────────────

export type SkinIntelligenceParamList = {
  capture: undefined;
  analysis: { scanId: string };
  result: { analysisId: string };
  routine: { routineId: string };
  products: { productSetId: string };
  history: undefined;
};
