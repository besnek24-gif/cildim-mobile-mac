/**
 * concernRoutineBridgeStore.ts
 * Tamamlanan concern flow → routine profile merkezi deposu.
 * Routine Dashboard, Premium generator ve Smart Warning sistemi tarafından kullanılır.
 *
 * KALICILIK (ECZ4 Multi-Care Profile Step 3):
 *  · Profil kayıtları AsyncStorage'da @tenvir:bridge_profiles_v1 anahtarında saklanır.
 *  · Modül ilk yüklendiğinde otomatik hydrate çağrılır (fire-and-forget).
 *  · Her mutasyon (saveConcernRoutineProfile / clearRoutineProfiles) debounced kayıt tetikler.
 *  · _save() hydrate tamamlanmadan yazma yapmaz; bunun yerine _dirtyDuringHydrate
 *    bayrağıyla bellekteki state'i diske flush ettirir → boş default ile gerçek
 *    veriyi ezme yarış koşulu engellenir.
 *  · Public API senkron kalır; caller'lar hiçbir şey await etmez.
 *  · domain/source metadata (Step 1+2) JSON serializasyonuyla otomatik korunur.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CareDomain, RoutineProfile } from "./concernRoutineBridge";
import {
  akilliSecimToRoutineProfile,
  type AkilliSecimProfileInput,
} from "./akilliSecimMapper";

export interface BridgeRecord {
  flowId: string;
  routineProfile: RoutineProfile;
  completedAt: number;
  isPremium: boolean;
}

// ─── In-memory state ─────────────────────────────────────────────────────────

const _store: Map<string, BridgeRecord> = new Map();
let _latest: BridgeRecord | null = null;

// ─── Kalıcılık (AsyncStorage) ────────────────────────────────────────────────

const BRIDGE_PROFILES_STORAGE_KEY = "@tenvir:bridge_profiles_v1";

interface PersistedBridgeProfiles {
  version: 1;
  records: Array<[string, BridgeRecord]>;
  latestKey: string | null;
}

let _hydrated = false;
let _hydratingPromise: Promise<void> | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
// ECZ4 logout epoch — clearAllOnLogout her çağrıda artırır. In-flight
// _doHydrate() epoch snapshot'ı tutar; commit aşamasında epoch değiştiyse
// disk verisini belleğe yazmaz (cross-user leak guard).
let _logoutEpoch = 0;
// Hydrate başladıktan SONRA, henüz tamamlanmadan kullanıcı bir mutasyon yaparsa
// (ör. rehber-sonuc cold-start'ta hızlıca saveConcernRoutineProfile çağrılırsa)
// bu bayrak true olur. _doHydrate() bunu görürse disk state'i bellekteki
// kullanıcı verisinin üzerine YAZMAZ — onun yerine bellekteki state'i kabul eder
// ve flush eder.
let _dirtyDuringHydrate = false;

function _isValidBridgeRecord(r: unknown): r is BridgeRecord {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return typeof o.flowId === "string"
      && typeof o.completedAt === "number"
      && typeof o.isPremium === "boolean"
      && o.routineProfile != null
      && typeof o.routineProfile === "object";
}

async function _doHydrate(): Promise<void> {
  // ECZ4 logout race guard: epoch'u baştan snapshot et.
  const startEpoch = _logoutEpoch;
  let diskRecords: Array<[string, BridgeRecord]> | null = null;
  let diskLatestKey: string | null = null;
  try {
    const raw = await AsyncStorage.getItem(BRIDGE_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed && typeof parsed === "object"
        && (parsed as PersistedBridgeProfiles).version === 1
        && Array.isArray((parsed as PersistedBridgeProfiles).records)
      ) {
        const p = parsed as PersistedBridgeProfiles;
        diskRecords = p.records.filter(
          (entry): entry is [string, BridgeRecord] =>
            Array.isArray(entry)
            && entry.length === 2
            && typeof entry[0] === "string"
            && _isValidBridgeRecord(entry[1])
            && entry[0] === entry[1].flowId,
        );
        diskLatestKey = typeof p.latestKey === "string" ? p.latestKey : null;
      }
    }
  } catch {
    // Bozuk JSON / okuma hatası → sessizce default'a (boş store) düş.
    if (__DEV__) {
      console.warn("[concernRoutineBridgeStore] hydrate failed; falling back to empty store");
    }
  }

  // ECZ4 logout race guard: hydrate sırasında clearAllOnLogout araya girdiyse
  // diskten okunan eski user verisini belleğe BAĞLAMA. Cleared state korunur.
  if (startEpoch !== _logoutEpoch) {
    _hydrated = true;
    return;
  }

  // Yarış koşulu koruması: hydrate sırasında kullanıcı mutasyon yaptıysa
  // (ör. rehber-sonuc cold-start'ta hızlı save), bellekteki kullanıcı verisini
  // disk üzerine yaz — disk eski veriyle bellekteki yeni veriyi EZME.
  if (_dirtyDuringHydrate) {
    _hydrated = true;
    _save();   // Bellekteki kullanıcı state'ini diske flush et.
    return;
  }

  if (diskRecords) {
    _store.clear();
    for (const [key, record] of diskRecords) {
      _store.set(key, record);
    }
    if (diskLatestKey && _store.has(diskLatestKey)) {
      _latest = _store.get(diskLatestKey) ?? null;
    } else {
      // latestKey yok veya geçersiz → en son completedAt'i seç.
      let candidate: BridgeRecord | null = null;
      for (const rec of _store.values()) {
        if (!candidate || rec.completedAt > candidate.completedAt) candidate = rec;
      }
      _latest = candidate;
    }
  }
  _hydrated = true;
}

/**
 * Public hydrate fonksiyonu — re-entry-safe (singleflight).
 * Modül yüklendiğinde otomatik tetiklenir; ekranlardan tekrar çağırmak güvenli.
 */
export function hydrateBridgeProfiles(): Promise<void> {
  if (_hydrated) return Promise.resolve();
  if (_hydratingPromise) return _hydratingPromise;
  _hydratingPromise = _doHydrate();
  return _hydratingPromise;
}

function _save(): void {
  // Hydrate tamamlanmadan yazma → boş default ile saved data'yı silme riski.
  // Ama mutasyonu kaydet ki _doHydrate() bittiğinde disk verisi
  // bellekteki yeni kullanıcı verisini ezmesin (yarış koşulu koruması).
  if (!_hydrated) {
    _dirtyDuringHydrate = true;
    return;
  }
  if (_saveTimer) clearTimeout(_saveTimer);
  // ECZ4 logout race guard: epoch'u schedule anında snapshot et. Timer
  // ateşlendiğinde logout araya girmişse setItem'i ATLA. Ek olarak setItem
  // başlatıldıktan sonra logout araya girerse (post-write race), yazımdan
  // sonra epoch farkını yakalayıp anahtarı tekrar siler.
  const scheduledEpoch = _logoutEpoch;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (scheduledEpoch !== _logoutEpoch) return;
    const payload: PersistedBridgeProfiles = {
      version: 1,
      records: Array.from(_store.entries()),
      latestKey: _latest?.flowId ?? null,
    };
    AsyncStorage.setItem(BRIDGE_PROFILES_STORAGE_KEY, JSON.stringify(payload))
      .then(() => {
        if (scheduledEpoch !== _logoutEpoch) {
          return AsyncStorage.removeItem(BRIDGE_PROFILES_STORAGE_KEY);
        }
        return undefined;
      })
      .catch(() => {
        // Yazma hatası → kullanıcıyı engelleme; bir sonraki mutasyonda tekrar denenir.
      });
  }, 250);
}

// Modül yüklendiği anda hydrate'i fire-and-forget başlat.
// rehber-sonuc / rutin-olustur dahil tüm consumer'lar import ettiğinde bu çalışır.
void hydrateBridgeProfiles();

// ─── Public API (mevcut imzalar korunur) ─────────────────────────────────────

export function saveConcernRoutineProfile(
  flowId: string,
  routineProfile: RoutineProfile,
  isPremium = false
): void {
  const record: BridgeRecord = { flowId, routineProfile, completedAt: Date.now(), isPremium };
  _store.set(flowId, record);
  _latest = record;
  _save();
}

export function getLatestRoutineProfile(): BridgeRecord | null {
  return _latest;
}

export function getSavedRoutineProfile(flowId: string): BridgeRecord | null {
  return _store.get(flowId) ?? null;
}

export function getAllSavedProfiles(): BridgeRecord[] {
  return Array.from(_store.values()).sort((a, b) => b.completedAt - a.completedAt);
}

export function clearRoutineProfiles(): void {
  _store.clear();
  _latest = null;
  _save();
}

/**
 * ECZ4 — Logout state-leak guard.
 *
 * Çıkışta concern bridge profillerine ait TÜM state'i sıfırlar:
 *   · In-memory: _store boşaltılır, _latest=null, _dirtyDuringHydrate=false
 *   · Bekleyen save timer iptal edilir.
 *   · _hydrated false'a alınır → bir sonraki user için temiz hydrate.
 *   · AsyncStorage anahtarı (`@tenvir:bridge_profiles_v1`) silinir.
 *
 * `clearRoutineProfiles()`'ten farkı: o, hydrate sonrası in-memory clear +
 * persist eder; bu helper, çıkışta storage'ı doğrudan removeItem ile siler ve
 * hydrate state'ini de sıfırlar (yeni user için pristine başlangıç).
 *
 * Public read API imzaları DOKUNULMAZ.
 */
export async function clearAllOnLogout(): Promise<void> {
  // Epoch'u önce artır → in-flight _doHydrate() commit etmeden çıkar.
  _logoutEpoch++;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _store.clear();
  _latest = null;
  _dirtyDuringHydrate = false;
  _hydrated = false;
  _hydratingPromise = null;
  try {
    await AsyncStorage.removeItem(BRIDGE_PROFILES_STORAGE_KEY);
  } catch {
    // Best-effort: in-memory sıfırlandı; storage hatası kullanıcıyı engellemez.
  }
}

/**
 * Tek bir kayıtlı bakım profilini siler (Rutinim → "Bakım Profillerim"
 * kartlarındaki X aksiyonu için). Sadece verilen flowId'li kayıt silinir;
 * diğer profiller, rutinler, rutin progress, ürün verisi DOKUNULMAZ.
 *
 * · Silinen kayıt _latest singleton'ı ise _latest, kalan kayıtların en
 *   yeni completedAt'ine göre yeniden hesaplanır (null da olabilir).
 * · saveConcernRoutineProfile / clearRoutineProfiles ile aynı _save()
 *   debounced persist yolunu kullanır — yeni storage key, yeni serializer
 *   YOK. AsyncStorage erişimi merkezi tutulur.
 * · Kayıt yoksa false döner, mutasyon yapmaz.
 */
export function removeSavedRoutineProfile(flowId: string): boolean {
  const existed = _store.delete(flowId);
  if (!existed) return false;
  if (_latest && _latest.flowId === flowId) {
    let candidate: BridgeRecord | null = null;
    for (const rec of _store.values()) {
      if (!candidate || rec.completedAt > candidate.completedAt) candidate = rec;
    }
    _latest = candidate;
  }
  _save();
  return true;
}

// ─── ECZ4 Step 4 · Domain-aware read helpers (read-only, additive) ───────────

/**
 * Belirtilen CareDomain'e ait kayıtları döner, en yeni → en eski sıralı.
 *
 * · Salt-okunur: _store / _latest mutasyonu YOK, _save() tetiklemez.
 * · `routineProfile.domain` undefined olan eski kayıtlar (Step 1+2 öncesi
 *   persist edilmiş olabilir) sessizce filtrelenir — tip güvenliği bozulmaz.
 * · Hydration zaten module-load fire-and-forget; bu fonksiyon manuel hydrate
 *   tetiklemez. Hydrate tamamlanmadan çağrılırsa o ana kadar bellekte olan
 *   kayıtları döner (mevcut sync API davranışıyla tutarlı).
 */
export function getSavedProfilesByDomain(domain: CareDomain): BridgeRecord[] {
  const out: BridgeRecord[] = [];
  for (const rec of _store.values()) {
    if (rec.routineProfile.domain === domain) out.push(rec);
  }
  return out.sort((a, b) => b.completedAt - a.completedAt);
}

/**
 * Belirtilen CareDomain için en son tamamlanan profili döner ya da null.
 *
 * · `getLatestRoutineProfile()` davranışını DEĞİŞTİRMEZ — _latest singleton'ı
 *   global "son tamamlanan" anlamını korur. Bu fonksiyon ona dokunmaz.
 * · İç olarak `getSavedProfilesByDomain(domain)[0]` kullanır.
 */
export function getLatestRoutineProfileByDomain(domain: CareDomain): BridgeRecord | null {
  return getSavedProfilesByDomain(domain)[0] ?? null;
}

/**
 * Mevcut kayıtlardaki benzersiz CareDomain'leri tercih edilen sırayla döner.
 *
 * · Sıra: skin → hair → sun → body → oral (UI tab/segment için stabil).
 * · `domain` undefined olan kayıtlar dahil edilmez.
 * · Salt-okunur, mutasyon yok.
 */
const _DOMAIN_ORDER: readonly CareDomain[] = ["skin", "hair", "sun", "body", "oral"];

export function getAvailableProfileDomains(): CareDomain[] {
  const present = new Set<CareDomain>();
  for (const rec of _store.values()) {
    const d = rec.routineProfile.domain;
    if (d) present.add(d);
  }
  return _DOMAIN_ORDER.filter((d) => present.has(d));
}

// ─── ECZ4 Step 7b · Akıllı Seçim save helper (additive) ──────────────────────
//
// Mevcut akışları DEĞİŞTİRMEZ. Step 7a'daki saf mapper'ı mevcut persist
// katmanına bağlar. Henüz hiçbir tüketici çağırmaz; bir sonraki adımda
// (UI CTA) bağlanacak.
//
// Anahtar stratejisi: domain başına TEK aktif Akıllı Seçim profili.
// Rehber anahtarları (akne / hassasiyet / leke / kuruluk / gunes / sac) ile
// çakışma OLMAZ; namespace tamamen ayrıdır:
//   skin → akilli_skin
//   hair → akilli_hair
//   sun  → akilli_sun
//   body → akilli_body
//   oral → akilli_oral
//
// AsyncStorage erişimi merkezi tutulur — bu helper saveConcernRoutineProfile
// üzerinden geçer; yeni storage key, yeni serializer veya yeni AsyncStorage
// çağrısı yoktur.

export type SaveAkilliSecimProfileResult =
  | { ok: true;  flowId: string }
  | { ok: false; reason: "invalid_input" };

export function saveAkilliSecimProfile(
  input: AkilliSecimProfileInput,
  isPremium = false,
): SaveAkilliSecimProfileResult {
  const profile = akilliSecimToRoutineProfile(input);
  if (!profile || !profile.domain) {
    return { ok: false, reason: "invalid_input" };
  }
  const flowId = `akilli_${profile.domain}`;
  saveConcernRoutineProfile(flowId, profile, isPremium);
  return { ok: true, flowId };
}
