/**
 * ECZ-CTX-GATE-1 — SkinScanContextBundle (additive type definitions)
 *
 * Tek doğruluk katmanı: scan güvenilirliği + rutin uygunluğu kararları
 * burada hesaplanır ve resultStore'a yazılır. Tüketiciler (result.tsx,
 * routine-program.tsx, ileride recommendation gate) yalnızca bu bundle'a
 * bakar — paralel truth sistemi yok.
 *
 * NOT: Pure type/constant module. Hesaplama `computeContextBundle.ts`'te.
 */

export type AgeGroup = "baby" | "child" | "teen" | "adult" | "unknown";

export type RiskMode =
  | "normal"
  | "sensitive"
  | "pediatric"
  | "irritated"
  | "low_confidence";

export type ReliabilityLevel = "high" | "medium" | "low" | "insufficient";

export type RoutineEligibility = "full" | "minimal" | "blocked";

export interface SkinScanContextBundle {
  ageGroup: AgeGroup;
  selectedConcerns: string[];
  imageQualityScore: number;        // 0-100, ortalama
  minImageQualityScore: number;     // 0-100, minimum
  poseComplianceScore: number;      // 0-100
  visualConfidence: number;         // 0-100
  detectedVisibleConcerns: string[];
  contradictionWarnings: string[];
  cannotDetermineFields: string[];
  riskMode: RiskMode;
  resultReliabilityLevel: ReliabilityLevel;
  routineEligibility: RoutineEligibility;
  safetyMessages: string[];
  /**
   * FINAL-HARD-LOCK — server tarafı pose compliance kararı.
   *  - true  : server overall_ok=true ve score yeterli
   *  - false : server overall_ok=false veya score < 60 (UI: skor/rutin gizle)
   *  - null  : server bu alanı dönmedi → kanıt yok (cap reliability)
   */
  serverPoseComplianceOk: boolean | null;
  /**
   * RELEASE-BLOCKER PART D — yalnızca güvenlik-kritik çelişki varsa true.
   * (>=2 contradictionWarnings veya pediatric/blocked/insufficient bağlamında.)
   * "Güvenli Kullanım Notu" kartının tetiklenme koşulu olarak kullanılır.
   */
  hasCriticalContradictions: boolean;
  computedAt: string;
  bundleVersion: 1;
}

/**
 * Bundle mevcut değilse tüketiciler bunu varsayar:
 * sessiz iyimserlik yok — düşük güven + minimal rutin.
 */
export const SAFE_FALLBACK_BUNDLE: SkinScanContextBundle = {
  ageGroup: "unknown",
  selectedConcerns: [],
  imageQualityScore: 0,
  minImageQualityScore: 0,
  poseComplianceScore: 0,
  visualConfidence: 0,
  detectedVisibleConcerns: [],
  contradictionWarnings: [],
  cannotDetermineFields: ["bundle_missing"],
  riskMode: "low_confidence",
  resultReliabilityLevel: "low",
  routineEligibility: "minimal",
  safetyMessages: [
    "Bu sonuç rutin oluşturmak için yeterince güvenilir değil.",
  ],
  serverPoseComplianceOk: null,
  hasCriticalContradictions: false,
  computedAt: new Date(0).toISOString(),
  bundleVersion: 1,
};
