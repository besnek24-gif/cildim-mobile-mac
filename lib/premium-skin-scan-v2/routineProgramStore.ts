/**
 * premium-skin-scan-v2 — routineProgramStore
 *
 * Kullanıcının aktif rutin programını, geçmiş programlarını
 * ve günlük check-in kayıtlarını yönetir.
 *
 * AsyncStorage + in-memory cache.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnalysisResult, RoutineStep, ProductItem } from "./analysisEngine";
import type { SkinScanContextBundle } from "@/lib/skinAnalysis/contextBundle";

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface SavedRoutine {
  id:         string;
  createdAt:  string;
  analysisId: string;
  skinType:   string;
  concerns:   string[];
  morning:    RoutineStep[];
  evening:    RoutineStep[];
  weekly:     RoutineStep[];
  products:   {
    ekonomik:    ProductItem[];
    profesyonel: ProductItem[];
    seckin:      ProductItem[];
  };
  isActive:   boolean;
}

export interface DayRecord {
  date:    string;   // YYYY-MM-DD
  morning: boolean;
  evening: boolean;
  weekly:  boolean;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEY_ACTIVE   = "pskv2_active_routine";
const KEY_HISTORY  = "pskv2_routine_history";
const KEY_CHECKINS = "pskv2_checkins";

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

let _active:   SavedRoutine | null   = null;
let _history:  SavedRoutine[]        = [];
let _checkins: DayRecord[]           = [];
let _checkinLoaded = false;
// ECZ4 logout epoch — clearAllOnLogout her çağrıda artırır. In-flight async
// load (loadActive / loadHistory / getCheckins / loadFavProducts /
// loadStepCheckins) başlangıçta epoch snapshot eder; commit aşamasında
// epoch değiştiyse disk verisini belleğe yazmaz (cross-user leak guard).
let _logoutEpoch = 0;

// ECZ4 post-write remediation: setItem başladıktan sonra logout araya
// girerse (multiRemove ile setItem arasındaki race), yazım tamamlandıktan
// sonra epoch farkını yakalayıp anahtarı tekrar siler — "key resurrection"
// engellenir. Tüm setItem çağrıları bu helper üzerinden geçer.
async function _guardedSetItem(
  key: string,
  value: string,
  startEpoch: number,
): Promise<void> {
  await AsyncStorage.setItem(key, value);
  if (startEpoch !== _logoutEpoch) {
    try { await AsyncStorage.removeItem(key); } catch { /* best-effort */ }
  }
}
async function _guardedRemoveItem(key: string, _startEpoch: number): Promise<void> {
  // removeItem zaten idempotent — post-check gereksiz; clearAllOnLogout
  // multiRemove yapıyorsa zaten silinmiş olur.
  await AsyncStorage.removeItem(key);
}

// ─── SPF Migration ────────────────────────────────────────────────────────────

/** Adım adında geçen eski "SPF 30" ifadelerini "SPF 50+" ile değiştirir. */
function migrateSpfSteps(steps: RoutineStep[]): RoutineStep[] {
  return steps.map((step) => ({
    ...step,
    name: step.name
      .replace(/\bSPF\s*30\b\+?/g, "SPF 50+")
      .replace(/\bMineral\s+SPF\s*30\b\+?/g, "Mineral SPF 50+"),
  }));
}

function migrateRoutine(r: SavedRoutine): SavedRoutine {
  return {
    ...r,
    morning: migrateSpfSteps(r.morning),
    evening: migrateSpfSteps(r.evening),
    weekly:  migrateSpfSteps(r.weekly ?? []),
  };
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ─── Program İşlemleri ────────────────────────────────────────────────────────

export const routineProgramStore = {

  /** Yeni programı aktif yap, eskiyi geçmişe ekle. */
  async saveProgram(program: SavedRoutine): Promise<void> {
    // ECZ4 logout race guard: yazımdan hemen önce epoch tekrar kontrol et.
    // Aksi halde logout araya girip multiRemove yaptıktan sonra burada setItem
    // ile anahtar yeniden canlanabilir (stale-write resurrection).
    const startEpoch = _logoutEpoch;
    // Eski aktifi deaktive et → geçmişe ekle
    const prev = await routineProgramStore.loadActive();
    if (startEpoch !== _logoutEpoch) return;
    if (prev) {
      const hist = await routineProgramStore.loadHistory();
      if (startEpoch !== _logoutEpoch) return;
      const idx  = hist.findIndex((h) => h.id === prev.id);
      const deactivated = { ...prev, isActive: false };
      if (idx >= 0) hist[idx] = deactivated;
      else          hist.unshift(deactivated);
      _history = hist.slice(0, 20);
      if (startEpoch !== _logoutEpoch) return;
      await _guardedSetItem(KEY_HISTORY, JSON.stringify(_history), startEpoch);
      if (startEpoch !== _logoutEpoch) return;
    }

    _active = { ...program, isActive: true };
    if (startEpoch !== _logoutEpoch) return;
    await _guardedSetItem(KEY_ACTIVE, JSON.stringify(_active), startEpoch);
  },

  /** Aktif programı yükle (önbellekli). SPF 30 → 50+ migration otomatik yapılır. */
  async loadActive(): Promise<SavedRoutine | null> {
    if (_active !== null) return _active;
    const startEpoch = _logoutEpoch;
    try {
      const raw  = await AsyncStorage.getItem(KEY_ACTIVE);
      // Logout-during-load: ara çağrı bittiyse eski user verisini yükleme.
      if (startEpoch !== _logoutEpoch) return null;
      const parsed = raw ? (JSON.parse(raw) as SavedRoutine) : null;
      _active   = parsed ? migrateRoutine(parsed) : null;
      // Migrated veriyi geri yaz (bir kez) — guarded: logout araya girerse
      // setItem sonrası anahtarı tekrar siler.
      if (_active && parsed && JSON.stringify(_active) !== JSON.stringify(parsed)) {
        await _guardedSetItem(KEY_ACTIVE, JSON.stringify(_active), startEpoch);
      }
    } catch {
      _active = null;
    }
    return _active;
  },

  /** Aktif programı senkron oku (önbellekten). */
  getActiveSync(): SavedRoutine | null {
    return _active;
  },

  /** Program geçmişini yükle. SPF 30 → 50+ migration otomatik yapılır. */
  async loadHistory(): Promise<SavedRoutine[]> {
    const startEpoch = _logoutEpoch;
    try {
      const raw    = await AsyncStorage.getItem(KEY_HISTORY);
      if (startEpoch !== _logoutEpoch) return [];
      const parsed = raw ? (JSON.parse(raw) as SavedRoutine[]) : [];
      _history     = parsed.map(migrateRoutine);
      // Migrated veriyi geri yaz (bir kez) — guarded.
      if (JSON.stringify(_history) !== JSON.stringify(parsed)) {
        await _guardedSetItem(KEY_HISTORY, JSON.stringify(_history), startEpoch);
      }
    } catch {
      _history = [];
    }
    return _history;
  },

  /** Önbelleği temizle. */
  invalidate(): void {
    _active        = null;
    _history       = [];
    _checkins      = [];
    _checkinLoaded = false;
  },

  /** Aktif rutini kalıcı olarak sil. */
  async deleteActive(): Promise<void> {
    const startEpoch = _logoutEpoch;
    _active = null;
    if (startEpoch !== _logoutEpoch) return;
    await _guardedRemoveItem(KEY_ACTIVE, startEpoch);
  },

  /** Geçmişteki bir rutini ID'ye göre kalıcı olarak sil. */
  async deleteFromHistory(id: string): Promise<void> {
    const startEpoch = _logoutEpoch;
    const hist = await routineProgramStore.loadHistory();
    if (startEpoch !== _logoutEpoch) return;
    _history   = hist.filter((r) => r.id !== id);
    await _guardedSetItem(KEY_HISTORY, JSON.stringify(_history), startEpoch);
  },

  /** Tüm geçmiş rutinleri kalıcı olarak sil. */
  async clearHistory(): Promise<void> {
    const startEpoch = _logoutEpoch;
    _history = [];
    if (startEpoch !== _logoutEpoch) return;
    await _guardedRemoveItem(KEY_HISTORY, startEpoch);
  },

  // ─── Check-In İşlemleri ───────────────────────────────────────────────────

  /** Tüm check-in kayıtlarını yükle. */
  async getCheckins(): Promise<DayRecord[]> {
    if (_checkinLoaded) return _checkins;
    const startEpoch = _logoutEpoch;
    try {
      const raw = await AsyncStorage.getItem(KEY_CHECKINS);
      if (startEpoch !== _logoutEpoch) return [];
      _checkins = raw ? (JSON.parse(raw) as DayRecord[]) : [];
    } catch {
      _checkins = [];
    }
    _checkinLoaded = true;
    return _checkins;
  },

  /** Bugünkü check-in'in bir alanını güncelle. */
  async updateCheckin(
    field: "morning" | "evening" | "weekly",
    value: boolean
  ): Promise<DayRecord[]> {
    const startEpoch = _logoutEpoch;
    const checkins = await routineProgramStore.getCheckins();
    if (startEpoch !== _logoutEpoch) return [];
    const today    = todayStr();
    const idx      = checkins.findIndex((c) => c.date === today);

    if (idx >= 0) {
      checkins[idx] = { ...checkins[idx], [field]: value };
    } else {
      checkins.unshift({
        date: today, morning: false, evening: false, weekly: false,
        [field]: value,
      });
    }

    _checkins = checkins.slice(0, 90); // son 90 gün
    if (startEpoch !== _logoutEpoch) return [];
    await _guardedSetItem(KEY_CHECKINS, JSON.stringify(_checkins), startEpoch);
    return _checkins;
  },

  /** Bugünkü check-in'i döner (yoksa boş). */
  getTodayCheckin(checkins: DayRecord[]): DayRecord {
    const today = todayStr();
    return (
      checkins.find((c) => c.date === today) ??
      { date: today, morning: false, evening: false, weekly: false }
    );
  },

  /** Son 7 günü sıralı döner (bugün = index 0). */
  getLast7Days(checkins: DayRecord[]): DayRecord[] {
    return Array.from({ length: 7 }, (_, i) => {
      const ds = daysAgo(i);
      return (
        checkins.find((c) => c.date === ds) ??
        { date: ds, morning: false, evening: false, weekly: false }
      );
    });
  },

  /** Sabah + akşam tamamlanan gün streak'i (max 60 gün geriye). */
  calcStreak(checkins: DayRecord[]): number {
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const ds = daysAgo(i);
      const c  = checkins.find((x) => x.date === ds);
      if (c && (c.morning || c.evening)) streak++;
      else if (i > 0) break; // sadece ilk günü geç
    }
    return streak;
  },

  /** Son 7 güne göre bağlılık yüzdesi (her gün: sabah+akşam = tam). */
  calcAdherence(checkins: DayRecord[]): number {
    let full = 0;
    for (let i = 0; i < 7; i++) {
      const ds = daysAgo(i);
      const c  = checkins.find((x) => x.date === ds);
      if (c && c.morning && c.evening) full++;
    }
    return Math.round((full / 7) * 100);
  },

  /** Rutin kaç haftadır sürüyor. */
  routineWeeks(createdAt: string): number {
    const ms = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  },

  routineDays(createdAt: string): number {
    const ms = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  },
};

// ─── Ürün Favorileri ──────────────────────────────────────────────────────────

const KEY_FAV_PRODUCTS = "pskv2_fav_products_v1";
let _favProducts: string[] | null = null;

async function loadFavProducts(): Promise<string[]> {
  if (_favProducts !== null) return _favProducts;
  const startEpoch = _logoutEpoch;
  try {
    const raw = await AsyncStorage.getItem(KEY_FAV_PRODUCTS);
    if (startEpoch !== _logoutEpoch) return [];
    _favProducts = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    _favProducts = [];
  }
  return _favProducts!;
}

/** Ürünü favorilere ekle/çıkar. Yeni durumu (true=favori) döner. */
export async function toggleFavorite(productName: string): Promise<boolean> {
  const startEpoch = _logoutEpoch;
  const favs = await loadFavProducts();
  if (startEpoch !== _logoutEpoch) return false;
  const idx  = favs.indexOf(productName);
  const next = idx >= 0
    ? favs.filter((n) => n !== productName)
    : [...favs, productName];
  _favProducts = next;
  if (startEpoch !== _logoutEpoch) return false;
  await _guardedSetItem(KEY_FAV_PRODUCTS, JSON.stringify(next), startEpoch);
  return idx < 0; // true = yeni favori
}

/** Ürün favoride mi? (senkron, loadFavProducts çağrısı sonrası) */
export function isFavorite(productName: string): boolean {
  return (_favProducts ?? []).includes(productName);
}

/** Favorileri yükle (ekran mount'unda çağrılabilir). */
export { loadFavProducts };

// ─── Adım Bazlı Check-In (günlük, adım düzeyinde) ─────────────────────────────

const KEY_STEP_CHECKINS = "pskv2_step_checkins"; // Record<date, string[]>
let _stepCheckins: Record<string, string[]> = {};
let _stepCheckinLoaded = false;

async function loadStepCheckins(): Promise<Record<string, string[]>> {
  if (_stepCheckinLoaded) return _stepCheckins;
  const startEpoch = _logoutEpoch;
  try {
    const raw = await AsyncStorage.getItem(KEY_STEP_CHECKINS);
    if (startEpoch !== _logoutEpoch) return {};
    _stepCheckins = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    _stepCheckins = {};
  }
  _stepCheckinLoaded = true;
  return _stepCheckins;
}

/** Bugünkü tamamlanan adım key'lerini döner. */
export async function getTodayStepIds(): Promise<string[]> {
  const all = await loadStepCheckins();
  return all[todayStr()] ?? [];
}

/** Adım key'ini toggle eder. Yeni tamamlanan liste döner. */
export async function toggleStepCheckin(key: string): Promise<string[]> {
  const startEpoch = _logoutEpoch;
  const all  = await loadStepCheckins();
  if (startEpoch !== _logoutEpoch) return [];
  const today = todayStr();
  const list = all[today] ?? [];
  const idx  = list.indexOf(key);
  const next = idx >= 0 ? list.filter((k) => k !== key) : [...list, key];
  _stepCheckins = { ...all, [today]: next };
  // Son 30 günü sakla
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  for (const d of Object.keys(_stepCheckins)) {
    if (new Date(d) < cutoff) delete _stepCheckins[d];
  }
  if (startEpoch !== _logoutEpoch) return [];
  await _guardedSetItem(KEY_STEP_CHECKINS, JSON.stringify(_stepCheckins), startEpoch);
  return next;
}

/** Tüm adımları bir slot için tamamlandı işaretle. */
export async function markAllStepsDone(keys: string[]): Promise<void> {
  const startEpoch = _logoutEpoch;
  const all   = await loadStepCheckins();
  if (startEpoch !== _logoutEpoch) return;
  const today = todayStr();
  const list  = all[today] ?? [];
  const next  = Array.from(new Set([...list, ...keys]));
  _stepCheckins = { ...all, [today]: next };
  if (startEpoch !== _logoutEpoch) return;
  await _guardedSetItem(KEY_STEP_CHECKINS, JSON.stringify(_stepCheckins), startEpoch);
}

/** Step check-in önbelleğini temizle. */
export function invalidateStepCheckins(): void {
  _stepCheckins = {};
  _stepCheckinLoaded = false;
}

// ─── ECZ4 — Logout state-leak guard ───────────────────────────────────────────
//
// Çıkışta v2 (premium scan) rutinine ait TÜM kullanıcı-spesifik state'i sıfırlar:
//   · In-memory cache: _active, _history, _checkins, _favProducts, _stepCheckins
//   · AsyncStorage anahtarları: pskv2_active_routine, pskv2_routine_history,
//     pskv2_checkins, pskv2_step_checkins, pskv2_fav_products_v1
//
// Public API imzaları DOKUNULMAZ — bu sadece logout flow tarafından çağrılır.
// Mevcut migration / SPF normalizer / save / loadActive / check-in mantığı
// aynen korunur.
export async function clearAllOnLogout(): Promise<void> {
  // Epoch'u önce artır → in-flight async load fonksiyonları (loadActive,
  // loadHistory, getCheckins, loadFavProducts, loadStepCheckins) commit
  // etmeden çıkar.
  _logoutEpoch++;
  _active = null;
  _history = [];
  _checkins = [];
  _checkinLoaded = false;
  _favProducts = null;
  _stepCheckins = {};
  _stepCheckinLoaded = false;
  try {
    await AsyncStorage.multiRemove([
      KEY_ACTIVE,
      KEY_HISTORY,
      KEY_CHECKINS,
      KEY_STEP_CHECKINS,
      KEY_FAV_PRODUCTS,
    ]);
  } catch {
    // Best-effort: in-memory sıfırlandı; storage hatası kullanıcıyı engellemez.
  }
}

// ─── Sadece Geçmişe Kaydet (aktifleştirmeden) ────────────────────────────────

/** Rutini aktif yapmadan sadece geçmiş listesine ekler. */
export async function saveRoutineToHistory(program: SavedRoutine): Promise<void> {
  const startEpoch = _logoutEpoch;
  const hist = await routineProgramStore.loadHistory();
  if (startEpoch !== _logoutEpoch) return;
  const idx  = hist.findIndex((h) => h.id === program.id);
  const entry = { ...program, isActive: false };
  if (idx >= 0) hist[idx] = entry;
  else hist.unshift(entry);
  _history = hist.slice(0, 20);
  if (startEpoch !== _logoutEpoch) return;
  await _guardedSetItem(KEY_HISTORY, JSON.stringify(_history), startEpoch);
}

// ─── RELEASE-BLOCKER PART F — Active filter for non-full eligibility ──────
// Aktif-ağır içerik tokenları (recommendationSafetyFilter ACTIVE_HEAVY_TOKENS
// listesiyle eşgüdümlü, küçük harfli alt-string araması). Minimal/blocked/
// pediatric/low_confidence bağlamında rutin adımı adında bunlardan biri
// geçiyorsa adım çıkarılır — yalnız temizleyici/nemlendirici/güneş kalır.

const _RP_ACTIVE_HEAVY_TOKENS: readonly string[] = [
  "retinol", "retinal", "retinoid", "retinoik", "retinoic",
  "tretinoin", "adapalen", "adapalene",
  "aha", "bha", "pha",
  "glycolic", "glikolik",
  "lactic acid", "laktik asit",
  "salicylic", "salisilik",
  "mandelic", "mandelik",
  "azelaic", "azelaik",
  "hydroquinone", "hidrokinon",
  "arbutin",
  "kojic", "kojik",
  "peeling", "eksfoliasyon", "exfoliant", "exfoliating", "soyucu",
  // ARCHITECT FOLLOW-UP — recommendationSafetyFilter ile birebir hizalama:
  "niacinamide", "niasinamid",
  "anti-acne", "anti acne", "acne treatment", "akne tedavi",
  "anti-sivilce", "anti sivilce", "sivilce karşıtı", "sivilce karsiti",
  "spot treatment", "leke tedavisi", "leke karşıtı", "leke karsiti",
  "vitamin c serum", "c vitamini serum", "ascorbic acid", "askorbik asit",
  "benzoyl", "benzoil",
  "ampul", "ampoule",
];

const _RP_BASIC_TOKENS: readonly string[] = [
  "temizle", "cleanser", "cleansing", "köpük", "kopuk", "yıkama", "yikama", "micel",
  "nemlendir", "moistur", "krem", "cream", "losyon", "lotion", "bariyer", "barrier",
  "güneş", "gunes", "spf", "sunscreen", "uv koruyucu",
  "yatıştırıcı", "yatistirici", "soothing", "calming", "panthenol", "pantenol", "centella",
];

function _rpHasAny(text: string, tokens: readonly string[]): boolean {
  for (const t of tokens) if (text.includes(t)) return true;
  return false;
}

function _rpFilterStepsForRestrictedMode(steps: RoutineStep[]): RoutineStep[] {
  return steps.filter((s) => {
    const lower = String(s.name ?? "").toLowerCase();
    if (_rpHasAny(lower, _RP_ACTIVE_HEAVY_TOKENS)) return false; // aktif-ağır → çıkar
    return _rpHasAny(lower, _RP_BASIC_TOKENS); // yalnız temel kategoriler kalır
  });
}

/**
 * Analiz sonucundan SavedRoutine üretir.
 *
 * RELEASE-BLOCKER PART F — opsiyonel `bundle` parametresi:
 *  - geçilirse ve eligibility !== "full" ya da risk pediatric/low_confidence/
 *    irritated ya da reliability low/insufficient ise rutin adımları
 *    aktif-ağır içeriklerden temizlenir, yalnızca temel kategoriler kalır.
 *  - geçilmezse mevcut davranış (geriye dönük uyum).
 */
export function buildRoutineFromAnalysis(
  analysis: AnalysisResult,
  bundle?: SkinScanContextBundle | null,
): SavedRoutine {
  let morning = analysis.morning;
  let evening = analysis.evening;
  let weekly  = analysis.weekly ?? [];

  if (bundle) {
    const restricted =
      bundle.routineEligibility !== "full" ||
      bundle.resultReliabilityLevel === "low" ||
      bundle.resultReliabilityLevel === "insufficient" ||
      bundle.riskMode === "pediatric" ||
      bundle.riskMode === "low_confidence" ||
      bundle.riskMode === "irritated";
    if (restricted) {
      morning = _rpFilterStepsForRestrictedMode(morning);
      evening = _rpFilterStepsForRestrictedMode(evening);
      weekly  = []; // haftalık destek (genelde aktif) restricted modlarda gizlenir
    }
  }

  return {
    id:         `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt:  new Date().toISOString(),
    analysisId: analysis.id,
    skinType:   analysis.skinType,
    concerns:   analysis.concerns,
    morning,
    evening,
    weekly,
    products:   analysis.products,
    isActive:   false, // saveProgram set eder
  };
}
