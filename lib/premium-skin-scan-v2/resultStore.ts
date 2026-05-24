/**
 * premium-skin-scan-v2 — resultStore
 * Analiz sonucunu session boyunca tutar + AsyncStorage'a kaydeder.
 *
 * ECZ4 / FINAL-RUNTIME-TRUTH-AND-HARD-FIX — PART F:
 *   • scan_id + scan_started_at her tarama başında set edilir.
 *   • resetForNewScan() yeni tarama başlamadan ÖNCE çağrılır; eski sonucun
 *     (ör. score=62) yeni taramada görünmesi imkansız hale gelir.
 *   • clear() hem ürün sonucunu hem bağlam bundle'ını hem scan_id'yi siler.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalysisResult } from "./analysisEngine";
import type { SkinScanContextBundle } from "@/lib/skinAnalysis/contextBundle";
import type { V2DBProduct } from "./v2ProductDB";

const STORAGE_KEY = "pskv2_last_result";

let _current: AnalysisResult | null = null;

// ECZ-CTX-GATE-1 — additive: scan reliability/eligibility bundle. Eski
// tüketiciler bu alanı görmek zorunda değil; undefined ise SAFE_FALLBACK_BUNDLE
// uygulanır (bkz. contextBundle.ts).
let _bundle: SkinScanContextBundle | null = null;

// ECZ4 PART F — scan kimliği. Yeni tarama başında set edilir; result ve save
// path bu kimliği loglar. Eski sonucun "geri kalmış" görünmesi imkansız olur.
let _scanId: string | null = null;
let _scanStartedAt: string | null = null;

// ECZ4 STEP-PRODUCT-CACHE — result.tsx ve routine-program.tsx aynı stepName için
// fetchAlternativesForStep + safety filter sonucu birinci ürünü kendi state'inde
// hesaplıyordu. Bu yarış (race) ve önbellek farkı, kullanıcının "Ürünleri İncele"
// ekranında result'tan farklı birinci ürün görmesine yol açıyordu.
// Tek truth: result.tsx hesaplandığında bu cache'e yazar; routine-program okur ve
// fetch atlar (varsa). resetForNewScan ve clear bu cache'i de temizler.
//
// ECZ4 SAME-ANGLE-TIGHTEN follow-up — null-sentinel: result.tsx bir adım için
// "uygun ürün yok" (null) hesapladıysa bunu cache'te saklarız; routine-program
// re-fetch yapıp farklı sonuç göstermez. Cache MAP'inde key VAR ama value null
// olabilir; `hasStepProduct` true döner, `getStepProduct` null döner.
let _stepProductsCache: Record<string, V2DBProduct | null> = {};

function genScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const resultStore = {
  set:   (r: AnalysisResult) => { _current = r; },
  get:   (): AnalysisResult | null => _current,
  clear: () => {
    _current = null;
    _bundle = null;
    _scanId = null;
    _scanStartedAt = null;
    _stepProductsCache = {};
  },

  // ── ECZ-CTX-GATE-1 ─────────────────────────────────────────────────────────
  setContextBundle: (b: SkinScanContextBundle | null) => { _bundle = b; },
  getContextBundle: (): SkinScanContextBundle | null => _bundle,

  // ── ECZ4 PART F — scan identity ───────────────────────────────────────────
  /** Yeni tarama başında çağır. Eski result+bundle silinir, yeni scan_id üretilir. */
  resetForNewScan: (): { scan_id: string; started_at: string } => {
    _current = null;
    _bundle = null;
    _stepProductsCache = {};
    _scanId = genScanId();
    _scanStartedAt = new Date().toISOString();
    return { scan_id: _scanId, started_at: _scanStartedAt };
  },
  getScanId:        (): string | null => _scanId,
  getScanStartedAt: (): string | null => _scanStartedAt,

  // ── ECZ4 STEP-PRODUCT-CACHE ───────────────────────────────────────────────
  /** result.tsx hesabını kaydeder; routine-program aynı seçimi gösterir.
   *  null-sentinel: "hesaplandı ama ürün yok" durumunda da key tutulur. */
  setStepProduct: (stepName: string, product: V2DBProduct | null) => {
    if (!stepName) return;
    _stepProductsCache[stepName] = product;
  },
  getStepProduct: (stepName: string): V2DBProduct | null =>
    _stepProductsCache[stepName] ?? null,
  hasStepProduct: (stepName: string): boolean =>
    Object.prototype.hasOwnProperty.call(_stepProductsCache, stepName),
};

/** Analiz tamamlandığında çağrılır. Hatalar sessizce yutulur. */
export async function persistResult(r: AnalysisResult): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}

/** Uygulama açılışında önceki sonucu geri yüklemek için. */
export async function loadLastResult(): Promise<AnalysisResult | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisResult;
    _current = parsed;
    return parsed;
  } catch {
    return null;
  }
}
