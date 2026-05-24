/**
 * Skin Intelligence — API Contracts
 * Layer 3-5 için typed API fonksiyonları.
 * Her fonksiyon kendi hata işlemini yapar; çağıran sadece sonucu kullanır.
 */

import type {
  AnalysisResult,
  DeepAnalysisResponse,
  GeneratedRoutine,
  ProductMatchSet,
  QuickAnalysisResponse,
  RoutineStep,
  SkinSignal,
  SkinType,
  StepCategory,
} from "./types";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";
const QUICK_TIMEOUT_MS = 15_000;

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function makeHeaders(authHeaders: Record<string, string>) {
  return { ...authHeaders, "Content-Type": "application/json" };
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try { return (await res.json()) as T; }
  catch { return null; }
}

// ─── Layer 3a: Hızlı Analiz ──────────────────────────────────────────────────

/**
 * Tek ön açı görseli, Haiku modeli, ~4-6 saniye.
 * Sonuç isQuickResult=true olarak işaretlenir.
 */
export async function runQuickAnalysis(
  imageBase64: string,
  authHeaders: Record<string, string>
): Promise<AnalysisResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUICK_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/skin-analysis/quick`, {
      method: "POST",
      headers: makeHeaders(authHeaders),
      credentials: "include",
      body: JSON.stringify({ image: imageBase64 }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await parseJsonSafe<QuickAnalysisResponse>(res);
    if (!data?.analiz) return null;

    return normalizeQuickResult(data.analiz);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Layer 3b: Derin Analiz ───────────────────────────────────────────────────

/**
 * 5 açı görseli, Sonnet×2 + Haiku paralel, ~35-50 saniye.
 * routine_tiered dahil tam sonuç döner.
 */
export async function runDeepAnalysis(
  images: string[],
  angles: string[],
  authHeaders: Record<string, string>,
  // ECZ4 HYBRID-POSE-GUARD — opsiyonel client perceptual hash dizisi.
  // images ile aynı sıra/uzunlukta. Hash hesaplanamamışsa null/undefined olabilir.
  // Sunucu yan tarafta hammingDistance ile near-duplicate / diversity hesaplar
  // ve yalnızca server hard_block + client near-duplicate AYNI ANDA doğruysa
  // ekrana "Açıları yeniden çekin" der; aksi halde uncertain_allow'a düşürür.
  imageHashes?: (string | null | undefined)[]
): Promise<DeepAnalysisResponse | null> {
  try {
    const body: Record<string, unknown> = { images, angles };
    if (Array.isArray(imageHashes) && imageHashes.length === images.length) {
      // Sadece string olanları gönder; null'ları aynı index'te boş string yap
      // ki sunucu sıra hizalamasını koruyabilsin.
      body.imageHashes = imageHashes.map((h) => (typeof h === "string" ? h : ""));
    }
    const res = await fetch(`${API_BASE}/api/skin-analysis`, {
      method: "POST",
      headers: makeHeaders(authHeaders),
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await parseJsonSafe<{ error?: string; code?: string }>(res);
      // ECZ-FINAL-QA-FIX-3: Status kodunu Error nesnesine ilave et — sunucu
      // Türkçe `error` metni döndürdüğü için sadece message üzerinden HTTP
      // kodunu çıkarmak güvenilir değildi. Client tarafında deterministik
      // sınıflandırma için (err as any).status okunur; PREMIUM_REQUIRED
      // kodu da korunur (geriye dönük uyum için).
      if (res.status === 403 || errData?.code === "PREMIUM_REQUIRED") {
        const e: any = new Error("PREMIUM_REQUIRED");
        e.status = 403;
        e.code   = "PREMIUM_REQUIRED";
        throw e;
      }
      const e: any = new Error(errData?.error ?? `HTTP ${res.status}`);
      e.status = res.status;
      if (errData?.code) e.code = errData.code;
      throw e;
    }

    return await parseJsonSafe<DeepAnalysisResponse>(res);
  } catch (err: any) {
    throw err;
  }
}

// ─── Layer 4: Rutin Motoru ────────────────────────────────────────────────────

/**
 * Analiz sonucundan routine üretir.
 * Şu an deep analizin içinden gelen routine_tiered kullanılıyor.
 * İleride ayrı bir endpoint'e taşınabilir.
 */
export function extractRoutineFromDeepResult(
  deepRes: DeepAnalysisResponse,
  analysisId: string
): GeneratedRoutine | null {
  if (!deepRes.routine_tiered) return null;

  const tiered = deepRes.routine_tiered as any;
  const skinType: SkinType = deepRes.analiz?.skinType ?? "normal";

  const morning: RoutineStep[] = (tiered.morning?.profesyonel ?? tiered.morning?.ekonomik ?? []).map(
    (s: any, i: number) => normalizeStep(s, i, "morning")
  );
  const evening: RoutineStep[] = (tiered.evening?.profesyonel ?? tiered.evening?.ekonomik ?? []).map(
    (s: any, i: number) => normalizeStep(s, i, "evening")
  );

  return {
    id: `routine-${analysisId}`,
    analysisId,
    morningSteps: morning.slice(0, 5),
    eveningSteps: evening.slice(0, 5),
    generatedAt: new Date().toISOString(),
    adaptedFor: skinType,
  };
}

// ─── Layer 5: Ürün Eşleme ────────────────────────────────────────────────────

/**
 * Rutin adımlarını veritabanındaki ürünlerle eşleştirir.
 * Şu an stub — API endpoint hazır olduğunda doldurulacak.
 */
export async function matchProductsForRoutine(
  routine: GeneratedRoutine,
  analysisId: string,
  authHeaders: Record<string, string>
): Promise<ProductMatchSet | null> {
  try {
    const res = await fetch(`${API_BASE}/api/skin-intelligence/match-products`, {
      method: "POST",
      headers: makeHeaders(authHeaders),
      credentials: "include",
      body: JSON.stringify({
        routineId: routine.id,
        analysisId,
        morningCategories: routine.morningSteps.map((s) => s.category),
        eveningCategories: routine.eveningSteps.map((s) => s.category),
      }),
    });

    if (!res.ok) return null;
    return await parseJsonSafe<ProductMatchSet>(res);
  } catch {
    return null;
  }
}

// ─── Normalizasyon Yardımcıları ───────────────────────────────────────────────

function normalizeQuickResult(raw: any): AnalysisResult {
  return {
    id: `quick-${Date.now()}`,
    scanId: "",
    createdAt: new Date().toISOString(),
    skinType: raw.cilt_tipi ?? "normal",
    skinTone: raw.cilt_tonu ?? "orta",
    skinScore: raw.puan ?? 50,
    moistureLevel: raw.nem_seviyesi ?? 50,
    uvDamage: raw.uv_hasarı ?? "none",
    ageEstimate: raw.yas_tahmini,
    signals: normalizeSignals(raw.concerns_structured ?? []),
    strengths: (raw.strengths_structured ?? []).slice(0, 3).map((s: any) => ({
      key: s.key ?? String(Math.random()),
      title: s.title ?? "",
      description: s.description ?? "",
    })),
    summary: raw.analiz_ozeti ?? "",
    confidence: "medium",
    isQuickResult: true,
  };
}

function normalizeSignals(raw: any[]): SkinSignal[] {
  return raw.slice(0, 4).map((s) => ({
    key: s.key ?? String(Math.random()),
    title: s.title ?? "",
    severity: mapSeverity(s.severity),
    confidence: s.confidence ?? "medium",
    zone: s.zone,
    description: s.explanation ?? "",
    careDirection: s.careDirection ?? "",
  }));
}

function mapSeverity(raw: string): SkinSignal["severity"] {
  if (raw === "yüksek" || raw === "significant") return "significant";
  if (raw === "orta" || raw === "moderate") return "moderate";
  return "mild";
}

function normalizeStep(raw: any, index: number, period: "morning" | "evening"): RoutineStep {
  return {
    id: `step-${period}-${index}`,
    order: index + 1,
    period,
    category: (raw.category ?? raw.productType ?? "moisturizer") as StepCategory,
    role: (raw.role ?? "core") as RoutineStep["role"],
    label: raw.label ?? raw.productName ?? raw.productType ?? "Adım",
    productType: raw.productType ?? raw.productName ?? "",
    why: raw.why ?? raw.description ?? "",
    targetSignal: raw.targetConcern,
    avoidIfSensitive: false,
  };
}
