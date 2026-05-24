/**
 * ECZ-CTX-GATE-1 — computeContextBundle
 *
 * Saf, deterministik, ağ/Supabase/ürün araması yok.
 * Bir kez hesaplanır → resultStore'a yazılır → tüm tüketiciler okur.
 *
 * Girdiler:
 *   - captures: ECZ-CAP-1 quality metadata (qualityScore, qualityLabel,
 *     poseAngleOk) içeren açı çekimleri.
 *   - analysisResult: adapter sonrası `AnalysisResult` (skinType, score,
 *     concerns, ...). Tıbbi-olmayan bakım terimleri.
 *   - rawAnalysis (opsiyonel): server `analiz` ham objesi. confidence
 *     ve concerns_structured okumak için. Yoksa "missing" olarak işaretlenir.
 *   - selectedConcerns: kullanıcının seçtiği endişeler (varsa).
 *   - ageGroup: scanSubjectAgeGroup. Verilmezse "unknown".
 *
 * Çıktı: `SkinScanContextBundle`. Asla null/undefined dönmez.
 */

import type { AngleCapture } from "@/lib/premium-skin-scan-v2/captureStore";
import type { AnalysisResult } from "@/lib/premium-skin-scan-v2/analysisEngine";
import type {
  AgeGroup,
  ReliabilityLevel,
  RiskMode,
  RoutineEligibility,
  SkinScanContextBundle,
} from "./contextBundle";

const REQUIRED_ANGLES: AngleCapture["id"][] = ["front", "left", "right", "up", "down"];

const IRRITATION_TOKENS = [
  "tahriş", "tahris",
  "kızarık", "kizarik",
  "kızarıklık", "kizariklik",
  "irritasyon", "irritation",
  "yanma", "burning",
  "döküntü", "dokuntu", "rash",
  "alerji", "allergy", "allergic",
];
const SENSITIVITY_TOKENS = [
  "hassas", "sensitive",
  "bariyer", "barrier",
  "reaktif", "reactive",
];
const ACNE_TOKENS = [
  "akne", "acne",
  "sivilce", "blemish", "pimple",
  "komedon", "comedone",
];

function lc(s: unknown): string {
  return String(s ?? "").toLowerCase();
}

function anyTokenIn(haystack: string, tokens: string[]): boolean {
  const h = lc(haystack);
  return tokens.some((t) => h.includes(t));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round(sum / nums.length);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface ComputeContextBundleArgs {
  captures: AngleCapture[];
  analysisResult: AnalysisResult;
  rawAnalysis?: any;
  selectedConcerns?: string[];
  ageGroup?: AgeGroup;
  /** Determinizm için: aynı input ile aynı çıktı.
   *  Verilmezse çağrı anındaki saat kullanılır (üretim varsayılanı). */
  now?: Date;
}

export function computeContextBundle(
  args: ComputeContextBundleArgs,
): SkinScanContextBundle {
  const {
    captures,
    analysisResult,
    rawAnalysis,
    selectedConcerns = [],
    ageGroup = "unknown",
    now,
  } = args;

  const cannotDetermineFields: string[] = [];
  const contradictionWarnings: string[] = [];
  const safetyMessages: string[] = [];

  // ── 1) IMAGE QUALITY ──────────────────────────────────────────────────────
  // Her gerekli açı için metadata var mı? Yoksa "missing" sayılır ve düşük puan
  // gibi davranır (sessiz iyimserlik yok).
  const qualityScores: number[] = [];
  for (const required of REQUIRED_ANGLES) {
    const cap = captures.find((c) => c.id === required);
    if (!cap) {
      cannotDetermineFields.push(`capture_missing_${required}`);
      qualityScores.push(0);
      continue;
    }
    if (typeof cap.qualityScore !== "number") {
      cannotDetermineFields.push(`quality_missing_${required}`);
      qualityScores.push(0);
      continue;
    }
    qualityScores.push(clampPct(cap.qualityScore));
  }

  const imageQualityScore = avg(qualityScores);
  const minImageQualityScore = qualityScores.length === 0
    ? 0
    : Math.min(...qualityScores);

  // ── 2) POSE COMPLIANCE ────────────────────────────────────────────────────
  // ECZ-FINAL-QA-FIX-1 — poseAngleOk SADECE çekim anındaki gyroscope kararlılığını
  // gösterir; yüzün gerçekten "sol/sağ/yukarı/aşağı" konumuna döndüğünü ölçmez.
  // Bu nedenle `poseComplianceScore` artık "gyroscope-derived stability" olarak
  // okunmalı ve gerçek yüz-pozu kanıtı olmadığı için cannotDetermineFields'a
  // `face_pose_unverified` eklenir. Aşağıda (low angle diversity heuristic)
  // tüm 5 fotoğrafın aynı açıdan çekilmiş olma ihtimaline karşı ek güvenlik
  // sinyali üretilir; "rawAnalysis.angle_pose_compliance" ileride server'dan
  // dönebilirse bu değer override edilir (additive uyumluluk).
  const posePresent = REQUIRED_ANGLES
    .map((id) => captures.find((c) => c.id === id))
    .filter((c) => c && typeof c.poseAngleOk === "boolean") as AngleCapture[];
  let poseComplianceScore = posePresent.length === 0
    ? 0
    : Math.round(
      (posePresent.filter((c) => c.poseAngleOk === true).length / posePresent.length) * 100,
    );
  if (posePresent.length === 0) {
    cannotDetermineFields.push("pose_metadata_missing");
  }
  // Server (varsa) per-angle pose compliance dönerse onu kullan; yoksa kanıt
  // yok diye işaretle. Bu alan henüz response şemasında zorunlu değil; opsiyonel.
  const serverPoseCompliance = Number(rawAnalysis?.angle_pose_compliance);
  let poseEvidenceMissing = false;
  if (Number.isFinite(serverPoseCompliance)) {
    poseComplianceScore = clampPct(serverPoseCompliance <= 1 ? serverPoseCompliance * 100 : serverPoseCompliance);
  } else {
    cannotDetermineFields.push("face_pose_unverified");
    poseEvidenceMissing = true;
  }

  // ── 2c) FINAL-HARD-LOCK — SERVER POSE COMPLIANCE (visual) ─────────────────
  // Server'ın yeni `pose_compliance` alanı (görsel açı doğrulama):
  //   - missing  → kanıt yok, additive (mevcut downgrades zaten devrede)
  //   - false || score<60 → HARD BLOCK: eligibility=blocked, riskMode=low_confidence,
  //                         reliability=insufficient, skor/rutin UI tarafından gizlenir.
  //   - true     → poseComplianceScore'u override et (gerçek görsel kanıt).
  // ECZ4 FINAL-POSE-PRECHECK-TUNING — üç bantlı yorumlama:
  //   • score<45 VEYA same_angle_detected VEYA front_unusable VEYA
  //     failed_angles>=3 VEYA (overall_ok=false ve side_diversity_ok=false)
  //     → serverPoseFailed = true (hard block).
  //   • score 45..59 → serverPoseUncertain = true (hard block YOK; reliability
  //     tavanı medium'a çekilir).
  //   • score>=60 ve overall_ok → serverPoseComplianceOk = true.
  // Sunucu zaten hard_block durumunda analysis_blocked döndürüyor; bu kod
  // ana analiz cevabıyla geri gelen pose_compliance içindir (uncertain band'i
  // doğru kapsamak için ek savunma katmanı).
  const pc: any = rawAnalysis?.pose_compliance ?? null;
  const pcPresent = pc && typeof pc === "object";
  let serverPoseComplianceOk: boolean | null = null;
  let serverPoseFailed = false;
  let serverPoseUncertain = false;
  if (pcPresent) {
    const pcScoreRaw = Number(pc.score);
    const pcScore = Number.isFinite(pcScoreRaw)
      ? (pcScoreRaw <= 1 ? pcScoreRaw * 100 : pcScoreRaw)
      : NaN;
    const overallOk = pc.overall_ok === true;
    const sameAngle = pc.same_angle_detected === true;
    const frontUnusable = pc.front_unusable === true;
    const sideDiversityOk = pc.side_diversity_ok === true;
    const failedArr = Array.isArray(pc.failed_angles) ? pc.failed_angles : [];

    if (Number.isFinite(pcScore)) {
      poseComplianceScore = clampPct(pcScore);
    }

    // ── ECZ4 HYBRID-POSE-GUARD — server SOFT-ALLOW override ──────────────
    // Sunucu hibrit kanıt katmanı (server pose precheck + client perceptual
    // hash) "izin ver ama temkinli" dediğinde mobile bundle KESİNLİKLE eski
    // hardFail türetimini çalıştırmamalı. Aksi halde server precheck'ten
    // gelen ham `same_angle_detected/score<45/failed_angles` alanları yine
    // serverPoseFailed=true üretir ve "açıları yeniden çekin" güvenli-state'i
    // tetiklenir — yani server "soft allow" demesine rağmen UI yine bloklar.
    //
    // Karar: hybrid_soft_allow VEYA warnings.includes("precheck_unavailable")
    // ise hardFail değerlendirmesini ATLA, doğrudan uncertain banda yerleştir.
    // (Hibrit override'ı yalnız precheck katmanı içindir; reliability cap +
    // soft note işini analysis.tsx ayrıca yapıyor.)
    const _warnings: string[] = Array.isArray(pc.warnings) ? pc.warnings : [];
    const hybridSoftAllowFlag =
      pc.hybrid_soft_allow === true || _warnings.includes("hybrid_soft_allow");
    const precheckUnavailableFlag =
      _warnings.includes("precheck_unavailable");
    // ECZ4 SAME-ANGLE-TIGHTEN — server "ok_allow" güçlü kararı:
    // serverWantsHardBlock olmasına rağmen client perceptual hash'leri açı
    // çeşitliliğini DOĞRULADIYSA server `hybrid_strong_override=true` yollar.
    // Bu durumda ham hard-fail sinyallerini (same_angle/score<45) yok say ve
    // pose_compliance'ı tam OK kabul et — reliability/eligibility düşmesin,
    // save aktif kalsın. Bu hibrit kararın "valid case" yarısının garantisidir.
    const hybridStrongOverrideFlag =
      pc.hybrid_strong_override === true || _warnings.includes("hybrid_strong_override");
    const serverSoftAllowOverride = hybridSoftAllowFlag || precheckUnavailableFlag;

    const hardFail =
      !serverSoftAllowOverride &&
      !hybridStrongOverrideFlag && (
        sameAngle ||
        frontUnusable ||
        failedArr.length >= 3 ||
        (Number.isFinite(pcScore) && pcScore < 45) ||
        (!overallOk && pc.side_diversity_ok === false)
      );

    if (hybridStrongOverrideFlag) {
      // ECZ4 SAME-ANGLE-TIGHTEN — strong override: pose_compliance tam OK.
      // Ham (sameAngle/score<60/overall_ok=false) sinyaller yok sayılır;
      // client perceptual hash kanıtı açı çeşitliliğini doğruladığı için
      // mobile reliability/eligibility düşmesin, save aktif kalsın.
      serverPoseComplianceOk = true;
      serverPoseFailed = false;
      serverPoseUncertain = false;
      poseEvidenceMissing = false;
      if (pc.left_right_maybe_swapped === true) {
        contradictionWarnings.push(
          "Sol ve sağ açı etiketleri görsel olarak takas edilmiş olabilir; analiz devam ediyor.",
        );
      }
    } else if (hardFail) {
      serverPoseComplianceOk = false;
      serverPoseFailed = true;
      cannotDetermineFields.push("pose_compliance_failed");
      for (const a of failedArr) {
        if (typeof a === "string" && a) {
          cannotDetermineFields.push(`pose_failed_${a}`);
        }
      }
      const warns = Array.isArray(pc.warnings) ? pc.warnings : [];
      for (const w of warns) {
        if (typeof w === "string" && w.trim()) contradictionWarnings.push(w.trim());
      }
      poseEvidenceMissing = false;
    } else if (serverSoftAllowOverride) {
      // ECZ4 HYBRID-POSE-GUARD — override aktifken score/overall_ok'a BAKMA;
      // tutarsız payload (örn. hybrid_soft_allow=true + score=65 + overall_ok=true)
      // gelse bile UI tam confidence göstermesin: explicit uncertain banda zorla.
      serverPoseComplianceOk = null;
      serverPoseUncertain = true;
      cannotDetermineFields.push(
        hybridSoftAllowFlag ? "pose_compliance_hybrid_soft" : "pose_compliance_uncertain"
      );
      if (pc.left_right_maybe_swapped === true) {
        contradictionWarnings.push(
          "Sol ve sağ açı etiketleri görsel olarak takas edilmiş olabilir; analiz devam ediyor.",
        );
      }
      poseEvidenceMissing = false;
    } else if ((Number.isFinite(pcScore) && pcScore < 60) || !overallOk) {
      // 45..59 veya overall_ok=false ama hard değil → uncertain
      serverPoseComplianceOk = null; // belirsiz; UI tam confidence göstermesin
      serverPoseUncertain = true;
      cannotDetermineFields.push("pose_compliance_uncertain");
      // Sol/sağ takasını sessiz uyarı olarak ekle ama bunu kritik yapmıyoruz.
      if (pc.left_right_maybe_swapped === true) {
        contradictionWarnings.push(
          "Sol ve sağ açı etiketleri görsel olarak takas edilmiş olabilir; analiz devam ediyor.",
        );
      }
      poseEvidenceMissing = false;
    } else {
      serverPoseComplianceOk = true;
      poseEvidenceMissing = false;
      // Yön karışıklığı bilgi amaçlı uyarı (kritik değil).
      if (pc.left_right_maybe_swapped === true) {
        contradictionWarnings.push(
          "Sol ve sağ açı etiketleri görsel olarak takas edilmiş olabilir; analiz tamamlandı.",
        );
      }
    }
  }
  // serverPoseComplianceOk null kalırsa: server alanı dönmedi → mevcut
  // poseEvidenceMissing/diversity heuristic'leri eski şekilde davranır.

  // ── 2b) ANGLE DIVERSITY HEURISTIC (ECZ-FINAL-QA-FIX-5) ────────────────────
  // ESKİ (kaldırıldı): brightness + sharpness varyans/range eşikleri.
  // Aynı oda/ışıkta çekilen FARKLI yüz açılarında bu metrikler dar bir
  // banda toplandığı için sürekli false-positive üretiyordu (kullanıcı
  // gerçek 5 açı çekse bile lowAngleDiversity=true → riskMode=low_confidence).
  //
  // YENİ: perceptual dHash benzerliği (qualityGate.computePerceptualHash).
  // Front'a karşı diğer 4 açı için Hamming mesafesi ≤ NEAR_DUP_HAMMING ise
  // o açı "near-duplicate" sayılır. SADECE 4 non-front açının HEPSİ
  // near-duplicate ise lowAngleDiversity = true. Hash'lerden herhangi biri
  // eksikse "kanıt yok" → lowAngleDiversity = false (sessiz iyimserlik
  // değil; AI/contextBundle zaten poseEvidenceMissing ile reliability
  // tavanını "medium"a çekiyor).
  const requiredCaptures = REQUIRED_ANGLES
    .map((id) => captures.find((c) => c.id === id))
    .filter(Boolean) as AngleCapture[];
  const NEAR_DUP_HAMMING = 8;
  const frontCap = captures.find((c) => c.id === "front");
  const frontHash = frontCap?.perceptualHash;
  const otherIds = REQUIRED_ANGLES.filter((id) => id !== "front");
  const otherHashes = otherIds.map(
    (id) => captures.find((c) => c.id === id)?.perceptualHash,
  );
  const allHashesPresent = !!frontHash && otherHashes.every((h) => !!h);
  let lowAngleDiversity = false;
  if (allHashesPresent) {
    const allOthersNearDup = otherHashes.every((h) => {
      if (!h || !frontHash) return false;
      // hammingDistanceHex burada import edilemez (cycle riski) — inline:
      if (h.length !== frontHash.length) return false;
      let dist = 0;
      for (let i = 0; i < h.length; i++) {
        let xor = parseInt(h[i], 16) ^ parseInt(frontHash[i], 16);
        while (xor > 0) { dist += xor & 1; xor >>= 1; }
      }
      return dist <= NEAR_DUP_HAMMING;
    });
    lowAngleDiversity = allOthersNearDup;
  } else {
    // Hash yok (eski capture veya decode hatası) → kanıt yok, hard sinyal yok.
    cannotDetermineFields.push("angle_hash_missing");
  }
  if (lowAngleDiversity) {
    contradictionWarnings.push(
      "Tüm açılarda fotoğraflar birbirine çok benzer; gerçekten farklı açıların yakalandığı doğrulanamadı.",
    );
    cannotDetermineFields.push("angle_diversity_low");
    // Pose compliance puanı bu durumda gyro'ya rağmen düşürülür.
    poseComplianceScore = Math.min(poseComplianceScore, 30);
  }
  // requiredCaptures referansı sentinel olarak korundu (ileride başka
  // heuristic'ler kullanmak isteyebilir; davranışı etkilemez).
  void requiredCaptures;

  // ── 3) VISUAL CONFIDENCE (server) ─────────────────────────────────────────
  // concerns_structured[].confidence varsa onların ortalaması * 100.
  // Yoksa 50'ye düşürmek YASAK — düşük (30) varsay.
  let visualConfidence = 30;
  const structured: any[] = Array.isArray(rawAnalysis?.concerns_structured)
    ? rawAnalysis.concerns_structured
    : [];
  const confidences = structured
    .map((s) => Number(s?.confidence))
    .filter((n) => Number.isFinite(n));
  if (confidences.length > 0) {
    // Server confidence 0-1 aralığında geliyor; 1'den büyükse zaten yüzde varsayılır.
    const norm = confidences.map((c) => (c <= 1 ? c * 100 : c));
    visualConfidence = clampPct(avg(norm));
  } else {
    cannotDetermineFields.push("visual_confidence_missing");
  }

  // Server "yetersiz bilgi" / boş concerns sinyali → düşük confidence
  const sorunlarLen = Array.isArray(rawAnalysis?.sorunlar) ? rawAnalysis.sorunlar.length : 0;
  if (structured.length === 0 && sorunlarLen === 0 && analysisResult.concerns.length === 0) {
    visualConfidence = Math.min(visualConfidence, 25);
    cannotDetermineFields.push("no_visible_concerns_returned");
  }

  // ── 4) DETECTED VISIBLE CONCERNS (server tarafı) ──────────────────────────
  const detectedVisibleConcerns: string[] = [];
  for (const s of structured) {
    const t = String(s?.title ?? "").trim();
    if (t) detectedVisibleConcerns.push(t);
  }
  if (detectedVisibleConcerns.length === 0) {
    for (const t of analysisResult.concerns) {
      if (t) detectedVisibleConcerns.push(t);
    }
  }

  // ── 4b) PART B-2 — VISIBLE FINDINGS (server explicit inspection) ──────────
  // Server `visible_findings` döndürdüyse safe-wording terimleri additive olarak
  // detectedVisibleConcerns'e ekle. Tıbbi tanı dili kullanılmaz; yalnızca
  // "...benzeri görünüm" formülasyonu. Lokal tahmin/uydurma yok — sadece
  // server'ın TRUE döndürdüğü alanlar yansıtılır.
  const vf: any = rawAnalysis?.visible_findings ?? null;
  const vfPresent = vf && typeof vf === "object";
  // Confidence 0-1 normalize et; yoksa 0 say (eski cevaplar için).
  const vfConfidenceRaw = vfPresent ? Number(vf.confidence) : NaN;
  const vfConfidence = Number.isFinite(vfConfidenceRaw)
    ? (vfConfidenceRaw <= 1 ? vfConfidenceRaw * 100 : vfConfidenceRaw)
    : 0;
  // Medium/high eşiği = 50.
  const vfHasMediumPlusConfidence = vfPresent && vfConfidence >= 50;

  // visible_findings yoksa "yüksek confidence" sahte iddia edilemez (architect kuralı).
  if (!vfPresent) {
    cannotDetermineFields.push("visible_findings_missing");
    visualConfidence = Math.min(visualConfidence, 60);
  }

  const vfAcne = vfPresent && vf.acne_like_spots === true;
  const vfRedness = vfPresent && vf.redness_like_areas === true;
  const vfIrritation = vfPresent && vf.irritation_like_appearance === true;

  if (vfHasMediumPlusConfidence) {
    const safeAdds: string[] = [];
    if (vfAcne) safeAdds.push("Sivilce benzeri görünüm");
    if (vfRedness) safeAdds.push("Kızarıklık benzeri görünüm");
    if (vfIrritation) safeAdds.push("Tahriş benzeri görünüm");
    for (const term of safeAdds) {
      const exists = detectedVisibleConcerns.some((c) =>
        lc(c).includes(lc(term).split(" ")[0]),
      );
      if (!exists) detectedVisibleConcerns.unshift(term);
    }
  }

  // ── 5) RELIABILITY ────────────────────────────────────────────────────────
  let resultReliabilityLevel: ReliabilityLevel;
  if (
    imageQualityScore >= 70 &&
    minImageQualityScore >= 50 &&
    visualConfidence >= 65
  ) {
    resultReliabilityLevel = "high";
  } else if (
    imageQualityScore >= 55 &&
    minImageQualityScore >= 40 &&
    visualConfidence >= 50
  ) {
    resultReliabilityLevel = "medium";
  } else if (imageQualityScore >= 40 || visualConfidence >= 35) {
    resultReliabilityLevel = "low";
  } else {
    resultReliabilityLevel = "insufficient";
  }

  // ── 5b) ECZ-FINAL-QA-FIX-1 — POSE EVIDENCE GATE ───────────────────────────
  // Architect feedback: face_pose_unverified yalnız cannotDetermineFields'a
  // eklenmesi yetersiz; reliability/eligibility kararını aktif etkilemiyor.
  // Server'dan per-angle pose compliance kanıtı GELMİYORSA (mevcut durum),
  // "high" reliability yanıltıcı olur — gerçek açı çeşitliliği doğrulanamadı.
  // Bu yüzden pose kanıtı yokken reliability tavanı "medium"a indirilir.
  // Ek olarak lowAngleDiversity de tetiklendiyse (aynı-açı şüphesi) "low"a
  // çekilir; save-gate (full + medium/high) bu durumda otomatik kapanır.
  if (poseEvidenceMissing) {
    if (lowAngleDiversity) {
      // İki sinyal birden: kesinlikle güvenilmez.
      if (resultReliabilityLevel === "high" || resultReliabilityLevel === "medium") {
        resultReliabilityLevel = "low";
      }
    } else if (resultReliabilityLevel === "high") {
      // Gyro stable + iyi metadata olsa bile gerçek açı kanıtı yok →
      // tavan medium (full save hâlâ mümkün ama yanıltıcı "high" yok).
      resultReliabilityLevel = "medium";
    }
  }

  // ── 5c) ECZ4 FINAL-FIX-1 — HASH-MISSING SAFETY DEMOTION ───────────────────
  // Architect feedback: angle_hash_missing yalnız cannotDetermineFields'a
  // eklenince downstream eligibility'yi etkilemiyor; "5 aynı açı" escape
  // hash hesaplanamadığı için (eski capture, decode hatası) hard-block atlıyor.
  // Hash kanıtı YOK → açı çeşitliliği DOĞRULANAMADI sayılır. Bu durumda:
  //   • visualConfidence tavanı düşürülür (45 — medium eşiğinin altı),
  //   • reliability "high"sa "medium"a, "medium"sa "low"a indirilir.
  // Save gate (full) zaten "medium/high" gerektiriyor; "low"da otomatik
  // kapanır. Bu bir hard-block değil; soft demotion — yeni capture pipeline
  // hash'i her zaman üreteceği için pratikte yalnız legacy artifact'leri etkiler.
  const hashEvidenceMissing = !allHashesPresent;
  if (hashEvidenceMissing) {
    visualConfidence = Math.min(visualConfidence, 45);
    if (resultReliabilityLevel === "high") {
      resultReliabilityLevel = "medium";
    } else if (resultReliabilityLevel === "medium") {
      resultReliabilityLevel = "low";
    }
  }

  // ── 6) RISK MODE (öncelik sırasıyla) ──────────────────────────────────────
  const isPediatric = ageGroup === "baby" || ageGroup === "child";

  const detectedHaystack = [
    ...detectedVisibleConcerns,
    String(rawAnalysis?.analiz_ozeti ?? ""),
    String(analysisResult.comment ?? ""),
  ].join(" | ");
  const selectedHaystack = selectedConcerns.join(" | ");

  const detectedIrritation = anyTokenIn(detectedHaystack, IRRITATION_TOKENS);
  const selectedIrritation = anyTokenIn(selectedHaystack, IRRITATION_TOKENS);
  // PART B-2 — visible_findings sinyali de irritation kararına katılır.
  const vfTriggersIrritation =
    vfHasMediumPlusConfidence && (vfRedness || vfIrritation);
  const isIrritated = detectedIrritation || selectedIrritation || vfTriggersIrritation;

  const isLowConfidence =
    resultReliabilityLevel === "low" ||
    resultReliabilityLevel === "insufficient" ||
    imageQualityScore < 40 ||
    visualConfidence < 35 ||
    // ECZ-FINAL-QA-FIX-1: aynı-açı şüphesi de düşük güven sayılır.
    lowAngleDiversity;

  const skinTypeLc = lc(analysisResult.skinType);
  const isSensitiveType = skinTypeLc === "hassas";
  const isSensitive =
    isSensitiveType ||
    anyTokenIn(detectedHaystack, SENSITIVITY_TOKENS);

  let riskMode: RiskMode;
  if (isPediatric) riskMode = "pediatric";
  else if (isIrritated) riskMode = "irritated";
  else if (isLowConfidence) riskMode = "low_confidence";
  else if (isSensitive) riskMode = "sensitive";
  else riskMode = "normal";

  // ── 7) CONTRADICTIONS ─────────────────────────────────────────────────────
  // (Tıbbi tanı dili kullanmadan, "benzeri görünüm" formülasyonu)
  const detectedAcne = anyTokenIn(detectedHaystack, ACNE_TOKENS);
  const selectedAcne = anyTokenIn(selectedHaystack, ACNE_TOKENS);
  if (selectedAcne && !detectedAcne) {
    contradictionWarnings.push(
      "Seçilen endişe akne benzeri olsa da görsellerde belirgin akne benzeri görünüm tespit edilmedi.",
    );
  }

  // PART B-2 — Visible findings TRUE ama analiz_ozeti / concerns bulguyu yok sayıyorsa
  // contradiction üret. "sivilcesiz/akne yok" iddiası ile görsel bulgu çelişiyorsa
  // kullanıcı güvenini korumak için açıkça belirt.
  if (vfHasMediumPlusConfidence) {
    const summaryLc = lc(rawAnalysis?.analiz_ozeti) + " | " + lc(analysisResult.comment);
    const summaryDeniesAcne =
      summaryLc.includes("sivilcesiz") ||
      summaryLc.includes("akne yok") ||
      summaryLc.includes("akne bulunmuyor") ||
      summaryLc.includes("tamamen pürüzsüz") ||
      summaryLc.includes("tamamen puruzsuz");
    const summaryDeniesRedness =
      summaryLc.includes("kızarıklık yok") ||
      summaryLc.includes("kizariklik yok") ||
      summaryLc.includes("tahriş yok") ||
      summaryLc.includes("tahris yok");

    if (vfAcne && (summaryDeniesAcne || (!detectedAcne && !anyTokenIn(detectedHaystack, ["sivilce benzeri"])))) {
      contradictionWarnings.push(
        "Görsellerde sivilce benzeri görünüm sinyali var ama özet bunu yansıtmıyor; özet yeniden değerlendirilmeli.",
      );
    }
    if ((vfRedness || vfIrritation) && (summaryDeniesRedness || (!detectedIrritation && !anyTokenIn(detectedHaystack, ["kızarıklık benzeri", "tahriş benzeri"])))) {
      contradictionWarnings.push(
        "Görsellerde kızarıklık/tahriş benzeri görünüm sinyali var ama özet bunu yansıtmıyor.",
      );
    }
  }

  if (selectedIrritation) {
    const resultSaysNormal =
      lc(analysisResult.comment).includes("dengeli") ||
      lc(analysisResult.comment).includes("normal") ||
      lc(rawAnalysis?.analiz_ozeti).includes("normal");
    if (!detectedIrritation && resultSaysNormal) {
      contradictionWarnings.push(
        "Seçilen endişe kızarıklık/tahriş benzeri olsa da sonuç dengeli/normal yönde görünüyor.",
      );
    }
  }

  if (isPediatric) {
    // Pediatrik özneye yetişkin kozmetik dili (yağlı/akne odaklı tip etiketi)
    if (skinTypeLc === "yağlı" || skinTypeLc === "yagli" || detectedAcne) {
      contradictionWarnings.push(
        "Bebek/çocuk öznesinde yetişkin kozmetik tipi/akne odaklı yorum güvenilir değildir.",
      );
    }
  }

  if (
    (resultReliabilityLevel === "low" || resultReliabilityLevel === "insufficient") &&
    analysisResult.score >= 70
  ) {
    contradictionWarnings.push(
      "Düşük görsel güvenilirlikle yüksek skor sunmak yanıltıcı olabilir.",
    );
  }

  const severeContradiction = contradictionWarnings.length >= 2;

  // ── 8) ROUTINE ELIGIBILITY ────────────────────────────────────────────────
  let routineEligibility: RoutineEligibility;

  if (resultReliabilityLevel === "insufficient") {
    routineEligibility = "blocked";
  } else if (isPediatric) {
    // Pediatrik hiçbir zaman full değil
    if (
      resultReliabilityLevel === "low" ||
      isIrritated ||
      severeContradiction ||
      imageQualityScore < 50
    ) {
      routineEligibility = "blocked";
    } else {
      routineEligibility = "minimal";
    }
  } else if (severeContradiction) {
    routineEligibility = "blocked";
  } else if (imageQualityScore < 35 || visualConfidence < 25) {
    routineEligibility = "blocked";
  } else if (
    resultReliabilityLevel === "high" &&
    (riskMode === "normal" || riskMode === "sensitive") &&
    contradictionWarnings.length === 0
  ) {
    routineEligibility = "full";
  } else if (
    resultReliabilityLevel === "medium" &&
    (riskMode === "normal" || riskMode === "sensitive") &&
    contradictionWarnings.length === 0
  ) {
    routineEligibility = "full";
  } else {
    // medium/low + (low_confidence/irritated/sensitive) → minimal
    routineEligibility = "minimal";
  }

  // ── 8b) ECZ4 FINAL-FIX-1 (rev2) — HASH-MISSING ELIGIBILITY FLOOR ──────────
  // Architect feedback: hash-missing'in save'i kapatması poseEvidenceMissing'e
  // bağlıydı (sadece o varken high→medium→low zinciri çalışıyordu). Hash
  // kanıtı yok ise açı çeşitliliği DOĞRULANAMADI; bu durum tek başına bile
  // "full" eligibility'yi yasaklamalı. Floor uygula: full → minimal'a indir.
  // Pediatric/blocked kararı yukarıda zaten son sözü söyledi; onlara dokunma.
  if (
    hashEvidenceMissing &&
    routineEligibility === "full"
  ) {
    routineEligibility = "minimal";
  }

  // ── 8c) FINAL-HARD-LOCK — POSE COMPLIANCE FAILED HARD-BLOCK ───────────────
  // Server `pose_compliance` overall_ok=false veya score<60 ise:
  //   • reliability = insufficient
  //   • routineEligibility = blocked
  //   • riskMode = low_confidence (pediatric ise korunur — daha yüksek öncelik)
  // Bu, UI'nin skor/cilt tipi/rutin/ürün önerilerini gizlemesini ve
  // "Yeniden Tara" CTA'sını göstermesini garanti eder.
  if (serverPoseFailed) {
    resultReliabilityLevel = "insufficient";
    routineEligibility = "blocked";
    if (riskMode !== "pediatric") riskMode = "low_confidence";
  } else if (serverPoseUncertain) {
    // ECZ4 FINAL-POSE-PRECHECK-TUNING — uncertain bandı: BLOK YOK.
    // Reliability tavanı medium'a çekilir (high → medium); diğer
    // sebeplerle low/insufficient'a düşmüşse o seviyeyi koru.
    if (resultReliabilityLevel === "high") {
      resultReliabilityLevel = "medium";
    }
    // routineEligibility'yi tek başına bloğa çevirme; yalnız "full"u
    // "minimal"a indir — kullanıcı temel rutine yine erişebilsin.
    if (routineEligibility === "full") {
      routineEligibility = "minimal";
    }
  }

  // ── 9) SAFETY MESSAGES (Türkçe, güvenli ifadeler) ─────────────────────────
  if (serverPoseFailed) {
    safetyMessages.push(
      "Fotoğraflar istenen açılarla uyumlu görünmüyor. Profil oluşturmak için düz, sağ, sol, yukarı ve aşağı açıları yeniden çekmelisiniz.",
    );
  }
  if (routineEligibility === "blocked") {
    safetyMessages.push(
      "Bu fotoğraflar ve mevcut güvenilirlik düzeyiyle rutin oluşturmak doğru olmaz. Daha net fotoğraflarla tekrar deneyebilir veya eczacınıza/hekiminize danışabilirsiniz.",
    );
  }
  if (riskMode === "pediatric") {
    safetyMessages.push(
      "Bebek/çocuk cildi için otomatik kozmetik rutin oluşturmak güvenli değildir. Belirgin kızarıklık, tahriş veya alerji şüphesinde eczacı veya hekim görüşü alınmalıdır.",
    );
  }
  if (riskMode === "irritated" && routineEligibility !== "blocked") {
    safetyMessages.push(
      "Belirgin kızarıklık/tahriş benzeri görünüm varsa otomatik rutin yerine eczacı veya hekim görüşü daha güvenlidir.",
    );
  }
  if (
    routineEligibility === "minimal" &&
    riskMode !== "pediatric" &&
    safetyMessages.length === 0
  ) {
    // ECZ4 FINAL-FIX-3 — daha somut, koşula bağlı mesaj.
    // Önceki tek-cümlelik genel mesaj, valid/medium-quality scan'lerde de
    // tetiklenip "yanlış pozitif uyarı" hissi veriyordu. Artık mesaj somut
    // sebeplere göre şekillenir; hiçbir somut sebep yoksa sessiz kalırız.
    const reasons: string[] = [];
    if (resultReliabilityLevel === "low") {
      reasons.push("görsel güvenilirlik düşük");
    }
    if (imageQualityScore < 50) {
      reasons.push("fotoğraf kalitesi sınırlı");
    }
    if (visualConfidence < 50) {
      reasons.push("içerik güveni düşük");
    }
    if (lowAngleDiversity) {
      reasons.push("açı çeşitliliği yetersiz");
    }
    if (contradictionWarnings.length > 0) {
      reasons.push("sinyaller arasında çelişki var");
    }
    if (reasons.length > 0) {
      const reasonText = reasons.length === 1
        ? reasons[0]
        : reasons.slice(0, -1).join(", ") + " ve " + reasons[reasons.length - 1];
      safetyMessages.push(
        `Bu rutin yalnızca temel bakıma yöneliktir (sebep: ${reasonText}). Daha net fotoğraflarla tekrar deneyebilirsiniz.`,
      );
    }
    // Hiçbir somut sebep yoksa mesaj eklenmez — kullanıcıya sahte uyarı verilmez.
  }
  if (
    resultReliabilityLevel === "low" &&
    safetyMessages.length === 0
  ) {
    safetyMessages.push(
      "Bu sonuç rutin oluşturmak için yeterince güvenilir değil.",
    );
  }

  return {
    ageGroup,
    selectedConcerns: [...selectedConcerns],
    imageQualityScore,
    minImageQualityScore,
    poseComplianceScore,
    visualConfidence,
    detectedVisibleConcerns,
    contradictionWarnings,
    cannotDetermineFields,
    riskMode,
    resultReliabilityLevel,
    routineEligibility,
    safetyMessages,
    serverPoseComplianceOk,
    // RELEASE-BLOCKER PART D — UI'nin "Güvenli Kullanım Notu"nu yalnızca
    // gerçekten güvenlik-kritik durumlarda göstermesi için kanıt alanı.
    // Pediatric / blocked / insufficient bağlamı ya da >=2 çelişki kritik sayılır.
    hasCriticalContradictions:
      severeContradiction ||
      routineEligibility === "blocked" ||
      resultReliabilityLevel === "insufficient" ||
      riskMode === "pediatric",
    computedAt: (now ?? new Date()).toISOString(),
    bundleVersion: 1,
  };
}
