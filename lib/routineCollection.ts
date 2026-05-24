/**
 * routineCollection.ts — Multi-routine v2 koleksiyon deposu (ECZ4 Step 1)
 *
 * SİNGLE SOURCE OF TRUTH (Kaide 4):
 *   · @tenvir:routines_v2 — tüm rutinler için TEK kalıcılık katmanı.
 *   · routineStore.ts artık bu modülün adapter'ı; doğrudan AsyncStorage'a yazmaz.
 *
 * BACKWARD COMPATIBILITY (Kaide 11):
 *   · Hydrate'da @tenvir:routines_v2 yoksa eski @tenvir:manual_routine_v1
 *     anahtarından migration yapılır (en fazla 1 RoutineRecord üretir).
 *   · Eski v1 anahtarı SİLİNMEZ — rollback güvencesi.
 *
 * RACE GUARD (architect-fix):
 *   · Pre-hydrate mutation'lar bir mutator queue'sine yazılır.
 *   · `_collection` optimistic olarak güncellenir (sync read'ler için).
 *   · Hydrate diski okuyunca pending mutator'lar disk state'i ÜZERİNE replay edilir;
 *     böylece diskteki mevcut rutinler ezilmez. Eski deseninin (dirty-flush) data
 *     loss'u kapatıldı.
 *
 * UI DEĞİŞMEZ (Step 1 kapsamı):
 *   · Home / Rutinim / Manuel Editor / Rutin Rehberi save UI dokunulmaz.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ManualStep, RoutineSlot } from "./routineStore";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type RoutineDomain = "skin" | "hair" | "sun" | "body" | "oral" | "mixed";
export type RoutineSource =
  | "manual"
  | "anket"
  | "cilt_analizi"
  | "akilli_secim"
  | "rehber"
  | "danisma";

export interface RoutineRecord {
  id: string;
  title: string;
  domain: RoutineDomain;
  source: RoutineSource;
  morning: ManualStep[];
  evening: ManualStep[];
  weekly:  ManualStep[];
  monthly: ManualStep[];
  createdAt: number;
  updatedAt: number;
}

export interface PersistedRoutineCollection {
  version: 2;
  routines: RoutineRecord[];
  primaryRoutineId: string | null;
  updatedAt: number;
}

export type RoutineRecordInput = {
  title?: string;
  domain?: RoutineDomain;
  source?: RoutineSource;
  morning?: ManualStep[];
  evening?: ManualStep[];
  weekly?:  ManualStep[];
  monthly?: ManualStep[];
};

type Mutator = (col: PersistedRoutineCollection) => PersistedRoutineCollection;

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_V2     = "@tenvir:routines_v2";
const STORAGE_KEY_LEGACY = "@tenvir:manual_routine_v1";
const DEFAULT_MAX_ROUTINES = 4;
const DEFAULT_PRIMARY_TITLE = "Günlük Cilt Rutinim";

// ─── In-memory state ──────────────────────────────────────────────────────────

const EMPTY_COLLECTION: PersistedRoutineCollection = Object.freeze({
  version: 2,
  routines: [],
  primaryRoutineId: null,
  updatedAt: 0,
}) as PersistedRoutineCollection;

let _collection: PersistedRoutineCollection = EMPTY_COLLECTION;
let _hydrated = false;
let _hydratingPromise: Promise<void> | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const _pendingMutators: Mutator[] = [];
// ECZ4 logout epoch — clearAllOnLogout her çağrıda artırır. In-flight
// _doHydrate() başlangıçta epoch'u snapshot eder; commit aşamasında epoch
// değişmişse disk verisini belleğe ASLA yazmaz (cross-user leak guard).
let _logoutEpoch = 0;

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function _uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function _isValidStep(s: unknown): s is ManualStep {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return typeof o.id === "string"
      && typeof o.label === "string"
      && typeof o.category === "string"
      && typeof o.slot === "string"
      && typeof o.order === "number";
}

function _sanitizeStepArray(arr: unknown): ManualStep[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(_isValidStep);
}

function _isValidRecord(r: unknown): r is RoutineRecord {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return typeof o.id === "string"
      && typeof o.title === "string"
      && typeof o.domain === "string"
      && typeof o.source === "string"
      && Array.isArray(o.morning)
      && Array.isArray(o.evening)
      && Array.isArray(o.weekly)
      && Array.isArray(o.monthly)
      && typeof o.createdAt === "number"
      && typeof o.updatedAt === "number";
}

function _normalizeRecord(rec: RoutineRecord): RoutineRecord {
  return {
    ...rec,
    morning: _sanitizeStepArray(rec.morning),
    evening: _sanitizeStepArray(rec.evening),
    weekly:  _sanitizeStepArray(rec.weekly),
    monthly: _sanitizeStepArray(rec.monthly),
  };
}

function _slotOf(rec: RoutineRecord, slot: RoutineSlot): ManualStep[] {
  if (slot === "morning") return rec.morning;
  if (slot === "evening") return rec.evening;
  if (slot === "weekly")  return rec.weekly;
  return rec.monthly;
}

function _writeSlot(rec: RoutineRecord, slot: RoutineSlot, steps: ManualStep[]): RoutineRecord {
  if (slot === "morning") return { ...rec, morning: steps };
  if (slot === "evening") return { ...rec, evening: steps };
  if (slot === "weekly")  return { ...rec, weekly: steps };
  return { ...rec, monthly: steps };
}

// ─── Hydrate + migration ──────────────────────────────────────────────────────

async function _readV2(): Promise<PersistedRoutineCollection | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_V2);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed && typeof parsed === "object"
      && (parsed as PersistedRoutineCollection).version === 2
      && Array.isArray((parsed as PersistedRoutineCollection).routines)
    ) {
      const p = parsed as PersistedRoutineCollection;
      const routines = p.routines.filter(_isValidRecord).map(_normalizeRecord);
      const primaryRoutineId =
        typeof p.primaryRoutineId === "string"
        && routines.some(r => r.id === p.primaryRoutineId)
          ? p.primaryRoutineId
          : (routines[0]?.id ?? null);
      return {
        version: 2,
        routines,
        primaryRoutineId,
        updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
      };
    }
  } catch {
    // Bozuk JSON → null döndür, migration veya boş default'a düş.
  }
  return null;
}

async function _migrateFromLegacy(): Promise<PersistedRoutineCollection | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed || typeof parsed !== "object"
      || !Array.isArray((parsed as { morning?: unknown }).morning)
      || !Array.isArray((parsed as { evening?: unknown }).evening)
    ) return null;

    const p = parsed as {
      morning: unknown[]; evening: unknown[]; weekly?: unknown[]; monthly?: unknown[];
      updatedAt?: number;
    };
    const morning = _sanitizeStepArray(p.morning);
    const evening = _sanitizeStepArray(p.evening);
    const weekly  = _sanitizeStepArray(p.weekly);
    const monthly = _sanitizeStepArray(p.monthly);
    const hasAny = morning.length + evening.length + weekly.length + monthly.length > 0;
    if (!hasAny) return null;

    const now = typeof p.updatedAt === "number" && p.updatedAt > 0 ? p.updatedAt : Date.now();
    const rec: RoutineRecord = {
      id: _uid(),
      title: DEFAULT_PRIMARY_TITLE,
      domain: "skin",
      source: "manual",
      morning, evening, weekly, monthly,
      createdAt: now,
      updatedAt: now,
    };
    return {
      version: 2,
      routines: [rec],
      primaryRoutineId: rec.id,
      updatedAt: now,
    };
    // NOT: STORAGE_KEY_LEGACY SİLİNMEZ (Kaide 11 — rollback güvencesi).
  } catch {
    return null;
  }
}

async function _doHydrate(): Promise<void> {
  // ECZ4 logout race guard: epoch'u baştan snapshot et. Eğer hydrate
  // sırasında clearAllOnLogout çağrılırsa epoch değişir; commit etmeden çık.
  const startEpoch = _logoutEpoch;
  const disk = await _readV2();
  // Logout-during-hydrate: disk okuması bitti ama logout araya girdi →
  // disk verisini belleğe BAĞLAMA. Bellekteki temiz state korunur.
  if (startEpoch !== _logoutEpoch) {
    _hydrated = true;
    _pendingMutators.length = 0;
    return;
  }
  let base: PersistedRoutineCollection | null = disk;
  let migrated = false;
  if (!base) {
    base = await _migrateFromLegacy();
    if (startEpoch !== _logoutEpoch) {
      _hydrated = true;
      _pendingMutators.length = 0;
      return;
    }
    migrated = !!base;
  }

  // Kritik birleşim: pre-hydrate mutation'lar varsa onları diskteki gerçek
  // state'in üzerine replay et. Böylece disk verileri ezilmez (architect fix).
  if (base) {
    let replayed = base;
    for (const m of _pendingMutators) replayed = m(replayed);
    _collection = replayed;
  } else {
    // Disk yok ve migration yok → _collection zaten pending mutator'larla
    // güncellenmiş durumdadır (optimistic). Olduğu gibi bırak.
  }

  const hadPending = _pendingMutators.length > 0;
  _pendingMutators.length = 0;
  _hydrated = true;

  // Persist gerekiyor mu? — yalnızca state diskteki halinden farklıysa.
  //   · migrated  → v2 anahtarını ilk kez yaz.
  //   · hadPending→ pre-hydrate kullanıcı mutasyonu disk'e yansıtılmalı.
  //   · disk varsa ve hiçbir değişim yoksa → write atma (gereksiz IO).
  //   · disk yoksa ve _collection boşsa → write atma.
  if (migrated || hadPending) {
    _scheduleSave();
  }
}

export function hydrateRoutineCollection(): Promise<void> {
  if (_hydrated) return Promise.resolve();
  if (_hydratingPromise) return _hydratingPromise;
  _hydratingPromise = _doHydrate();
  return _hydratingPromise;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function _scheduleSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  // ECZ4 logout race guard: epoch'u schedule anında snapshot et. Timer
  // ateşlendiğinde logout araya girmişse setItem'i ATLA. Ek olarak setItem
  // başlatıldıktan sonra logout araya girerse (post-write race), yazımdan
  // sonra epoch farkını yakalayıp anahtarı tekrar siler — "key resurrection"
  // engellenir.
  const scheduledEpoch = _logoutEpoch;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (scheduledEpoch !== _logoutEpoch) return;
    AsyncStorage.setItem(STORAGE_KEY_V2, JSON.stringify(_collection))
      .then(() => {
        if (scheduledEpoch !== _logoutEpoch) {
          // Logout setItem ile multiRemove arasında sıkıştı → tekrar temizle.
          return AsyncStorage.multiRemove([STORAGE_KEY_V2, STORAGE_KEY_LEGACY]);
        }
        return undefined;
      })
      .catch(() => {
        // Yazma hatası → kullanıcıyı engelleme; bir sonraki mutasyonda tekrar denenir.
      });
  }, 250);
}

/**
 * Tüm mutasyonların geçtiği TEK yol.
 *  · Optimistic: _collection anında güncellenir (sync read'ler için).
 *  · Pre-hydrate ise mutator queue'ye eklenir; hydrate disk'i okuyunca replay eder.
 *  · Post-hydrate ise hemen debounced save tetiklenir.
 */
function _apply(mutator: Mutator): void {
  const next = mutator(_collection);
  _collection = { ...next, updatedAt: Date.now() };
  if (_hydrated) {
    _scheduleSave();
  } else {
    _pendingMutators.push(mutator);
  }
}

// Module load: fire-and-forget hydrate.
void hydrateRoutineCollection();

// ─── Public read APIs (multi-routine) ─────────────────────────────────────────

export function getRoutineCollection(): PersistedRoutineCollection {
  return _collection;
}

export function getAllRoutines(): RoutineRecord[] {
  return _collection.routines;
}

export function getRoutineById(id: string): RoutineRecord | null {
  return _collection.routines.find(r => r.id === id) ?? null;
}

export function getPrimaryRoutine(): RoutineRecord | null {
  const id = _collection.primaryRoutineId;
  if (!id) return null;
  return _collection.routines.find(r => r.id === id) ?? null;
}

export function getRoutineCount(): number {
  return _collection.routines.length;
}

export function canCreateAnotherRoutine(max: number = DEFAULT_MAX_ROUTINES): boolean {
  return _collection.routines.length < max;
}

// ─── Public write APIs (multi-routine) ────────────────────────────────────────

export type SaveRoutineResult =
  | { ok: true; id: string }
  | { ok: false; reason: "limit" };

export function saveRoutineAsNew(
  input: RoutineRecordInput,
  max: number = DEFAULT_MAX_ROUTINES,
): SaveRoutineResult {
  // Limit ön kontrolü pre-hydrate aşamasında diskteki gerçek sayıyı bilmez.
  // Replay aşamasında closure içinde tekrar güvenli kontrol yapılır.
  if (_collection.routines.length >= max) {
    return { ok: false, reason: "limit" };
  }
  const now = Date.now();
  const id = _uid();
  const rec: RoutineRecord = {
    id,
    title:   input.title  ?? DEFAULT_PRIMARY_TITLE,
    domain:  input.domain ?? "skin",
    source:  input.source ?? "manual",
    morning: _sanitizeStepArray(input.morning),
    evening: _sanitizeStepArray(input.evening),
    weekly:  _sanitizeStepArray(input.weekly),
    monthly: _sanitizeStepArray(input.monthly),
    createdAt: now,
    updatedAt: now,
  };
  _apply((col) => {
    if (col.routines.length >= max) return col;          // replay-safe limit guard
    if (col.routines.some(r => r.id === id)) return col; // idempotent on replay
    const isFirst = col.routines.length === 0;
    return {
      ...col,
      routines: [...col.routines, rec],
      primaryRoutineId: isFirst ? id : col.primaryRoutineId,
    };
  });
  return { ok: true, id };
}

export function replaceRoutine(routineId: string, input: RoutineRecordInput): boolean {
  let didReplace = false;
  _apply((col) => {
    const idx = col.routines.findIndex(r => r.id === routineId);
    if (idx < 0) return col;
    const prev = col.routines[idx];
    const next: RoutineRecord = {
      ...prev,
      title:   input.title  ?? prev.title,
      domain:  input.domain ?? prev.domain,
      source:  input.source ?? prev.source,
      morning: input.morning ? _sanitizeStepArray(input.morning) : prev.morning,
      evening: input.evening ? _sanitizeStepArray(input.evening) : prev.evening,
      weekly:  input.weekly  ? _sanitizeStepArray(input.weekly)  : prev.weekly,
      monthly: input.monthly ? _sanitizeStepArray(input.monthly) : prev.monthly,
      updatedAt: Date.now(),
    };
    const routines = [...col.routines];
    routines[idx] = next;
    didReplace = true;
    return { ...col, routines };
  });
  return didReplace;
}

/**
 * ECZ4 Step 5 — Çoklu rutin isimlendirme desteği.
 * Sadece title alanını günceller; steps / domain / source / primaryRoutineId
 * dokunulmaz. Boş string veya 40 karakterden uzun başlık reddedilir (false).
 * Trim sonrası boşalan da reddedilir. Persist + updatedAt güncellenir.
 */
export const ROUTINE_TITLE_MAX_LEN = 40;
export function renameRoutine(routineId: string, title: string): boolean {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return false;
  if (trimmed.length > ROUTINE_TITLE_MAX_LEN) return false;
  // Idempotency fast-path: aynı başlıkla çağrılırsa _apply'ı tetiklemeyelim
  // (collection updatedAt + _scheduleSave write-churn'ünü engeller). Sadece
  // mevcut routine'i kontrol edip true döndürürüz; yine de "exists" kapısı
  // bozulmasın diye routineId yoksa false döneriz.
  const existingIdx = _collection.routines.findIndex(r => r.id === routineId);
  if (existingIdx >= 0 && _collection.routines[existingIdx].title === trimmed) {
    return true;
  }
  let didRename = false;
  _apply((col) => {
    const idx = col.routines.findIndex(r => r.id === routineId);
    if (idx < 0) return col;
    const prev = col.routines[idx];
    if (prev.title === trimmed) {
      // Replay aşamasında diskten gelen state aynıysa burada da no-op döneriz.
      didRename = true;
      return col;
    }
    const next: RoutineRecord = { ...prev, title: trimmed, updatedAt: Date.now() };
    const routines = [...col.routines];
    routines[idx] = next;
    didRename = true;
    return { ...col, routines };
  });
  return didRename;
}

export function setPrimaryRoutine(routineId: string): boolean {
  let ok = false;
  _apply((col) => {
    if (!col.routines.some(r => r.id === routineId)) return col;
    ok = true;
    return { ...col, primaryRoutineId: routineId };
  });
  return ok;
}

export function deleteRoutine(routineId: string): boolean {
  let ok = false;
  _apply((col) => {
    const exists = col.routines.some(r => r.id === routineId);
    if (!exists) return col;
    ok = true;
    const routines = col.routines.filter(r => r.id !== routineId);
    let primaryRoutineId = col.primaryRoutineId;
    if (primaryRoutineId === routineId) {
      primaryRoutineId = routines[0]?.id ?? null;
    }
    return { ...col, routines, primaryRoutineId };
  });
  return ok;
}

// ─── Adapter helpers (routineStore tarafından kullanılır) ────────────────────

export function getPrimaryRoutineOrEmpty(): {
  morning: ManualStep[]; evening: ManualStep[]; weekly: ManualStep[]; monthly: ManualStep[];
  updatedAt: number;
} {
  const p = getPrimaryRoutine();
  if (!p) return { morning: [], evening: [], weekly: [], monthly: [], updatedAt: 0 };
  return {
    morning: p.morning, evening: p.evening, weekly: p.weekly, monthly: p.monthly,
    updatedAt: p.updatedAt,
  };
}

/**
 * Primary rutini garanti eder. Replay-safe:
 *   · primary geçerliyse no-op.
 *   · primary yok ama rutin varsa → ilk rutini primary olarak adopt eder
 *     (corrupted state recovery; limit aşımı oluşmaz).
 *   · hiç rutin yoksa → eager record'u ekler ve primary yapar.
 */
export function ensurePrimaryRoutine(source: RoutineSource = "manual"): RoutineRecord {
  const eagerId = _uid();
  const now = Date.now();
  const eager: RoutineRecord = {
    id: eagerId,
    title: DEFAULT_PRIMARY_TITLE,
    domain: "skin",
    source,
    morning: [], evening: [], weekly: [], monthly: [],
    createdAt: now,
    updatedAt: now,
  };
  _apply((col) => {
    const hasValidPrimary = col.primaryRoutineId
      && col.routines.some(r => r.id === col.primaryRoutineId);
    if (hasValidPrimary) return col;
    if (col.routines.length > 0) {
      // Recover: adopt first routine as primary instead of creating duplicate.
      return { ...col, primaryRoutineId: col.routines[0].id };
    }
    return {
      ...col,
      routines: [...col.routines, eager],
      primaryRoutineId: eagerId,
    };
  });
  return getPrimaryRoutine() ?? eager;
}

/**
 * Primary rutinin belirtilen slot'unu transformer ile günceller.
 * Replay-safe: primary closure içinde lazy çözülür; pre-hydrate "ghost" primary
 * yerine disk'teki gerçek primary kullanılır.
 */
export function mutatePrimarySlot(
  slot: RoutineSlot,
  transform: (steps: ManualStep[]) => ManualStep[],
): void {
  _apply((col) => {
    let next = col;
    let primary = next.primaryRoutineId
      ? next.routines.find(r => r.id === next.primaryRoutineId) ?? null
      : null;
    if (!primary) {
      // Primary yoksa otomatik oluştur (replay'de de güvenli — id yeniden uretilir).
      const now = Date.now();
      primary = {
        id: _uid(),
        title: DEFAULT_PRIMARY_TITLE,
        domain: "skin",
        source: "manual",
        morning: [], evening: [], weekly: [], monthly: [],
        createdAt: now,
        updatedAt: now,
      };
      next = {
        ...next,
        routines: [...next.routines, primary],
        primaryRoutineId: primary.id,
      };
    }
    const transformed = transform(_slotOf(primary, slot));
    const idx = next.routines.findIndex(r => r.id === primary!.id);
    const updated: RoutineRecord = {
      ..._writeSlot(primary, slot, transformed),
      updatedAt: Date.now(),
    };
    const routines = [...next.routines];
    routines[idx] = updated;
    return { ...next, routines };
  });
}

/**
 * ECZ4 — Logout state-leak guard.
 *
 * Çıkışta TÜM kullanıcı-spesifik routine state'ini sıfırlar:
 *   · In-memory `_collection` boş default'a dönülür.
 *   · Bekleyen save timer iptal edilir, mutator queue boşaltılır.
 *   · `_hydrated` false'a alınır → bir sonraki user için temiz hydrate.
 *   · AsyncStorage anahtarları (`@tenvir:routines_v2` + legacy `@tenvir:manual_routine_v1`)
 *     `multiRemove` ile silinir.
 *
 * Public read/write API imzaları DOKUNULMAZ — sadece logout flow tarafından
 * çağrılır. Kalan tüm routine logic (hydrate, mutator queue, primary
 * resolution, slot transform) aynen korunur.
 */
export async function clearAllOnLogout(): Promise<void> {
  // Epoch'u önce artır → in-flight _doHydrate() commit etmeden çıkar.
  _logoutEpoch++;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _pendingMutators.length = 0;
  _collection = EMPTY_COLLECTION;
  _hydrated = false;
  _hydratingPromise = null;
  try {
    await AsyncStorage.multiRemove([STORAGE_KEY_V2, STORAGE_KEY_LEGACY]);
  } catch {
    // Best-effort: in-memory sıfırlandı; storage hatası kullanıcıyı engellemez.
  }
}

/**
 * Primary rutinin tüm slot'larını boşaltır. Primary yoksa no-op.
 * Multi-routine semantiği: SADECE primary etkilenir, diğer rutinler korunur.
 */
export function clearPrimaryAllSlots(): void {
  _apply((col) => {
    const id = col.primaryRoutineId;
    if (!id) return col;
    const idx = col.routines.findIndex(r => r.id === id);
    if (idx < 0) return col;
    const cleared: RoutineRecord = {
      ...col.routines[idx],
      morning: [], evening: [], weekly: [], monthly: [],
      updatedAt: Date.now(),
    };
    const routines = [...col.routines];
    routines[idx] = cleared;
    return { ...col, routines };
  });
}
