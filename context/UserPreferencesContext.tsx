import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type AllergyKey,
  type SpecialConditionKey,
  type SkinType,
  type SkinConcernKey,
  type TexturePreferenceKey,
  type FinishPreferenceKey,
  type UserPreferences,
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  clearPreferences,
} from "@/lib/userPreferences";

// ─── Context tipi ─────────────────────────────────────────────────────────────

interface UserPreferencesContextType {
  ready: boolean;
  preferences: UserPreferences;
  update: (partial: Partial<Omit<UserPreferences, "updatedAt">>) => Promise<void>;
  setAllergies: (keys: AllergyKey[]) => Promise<void>;
  setSpecialConditions: (keys: SpecialConditionKey[]) => Promise<void>;
  setSkinType: (type: SkinType | null) => Promise<void>;
  setSkinConcerns: (keys: SkinConcernKey[]) => Promise<void>;
  setTexturePreferences: (keys: TexturePreferenceKey[]) => Promise<void>;
  setFinishPreference: (key: FinishPreferenceKey | null) => Promise<void>;
  /** Şahsî alerji içerik listesini günceller */
  setAllergyIngredients: (items: string[]) => Promise<void>;
  /** Şahsî kaçınma içerik listesini günceller */
  setAvoidedIngredients: (items: string[]) => Promise<void>;
  clear: () => Promise<void>;
}

// ─── Varsayılan context değeri ────────────────────────────────────────────────

const UserPreferencesContext = createContext<UserPreferencesContextType>({
  ready: false,
  preferences: { ...DEFAULT_PREFERENCES },
  update: async () => {},
  setAllergies: async () => {},
  setSpecialConditions: async () => {},
  setSkinType: async () => {},
  setSkinConcerns: async () => {},
  setTexturePreferences: async () => {},
  setFinishPreference: async () => {},
  setAllergyIngredients: async () => {},
  setAvoidedIngredients: async () => {},
  clear: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
//
// PERF — Phase A fix pack:
//   1. `update` artık `[preferences]` dep'ine bağlı DEĞİL — ref üzerinden
//      en güncel snapshot'ı okur. Sonuç: `update` ve onun türevi olan
//      `setAllergies / setAllergyIngredients / ...` callback'leri PROVIDER
//      ÖMRÜ BOYUNCA stabil referans (mount'ta bir kez yaratılır).
//   2. Provider value `useMemo([ready, preferences])` ile sarıldı —
//      callback'ler stabil olduğu için sadece state değişiminde yeni
//      nesne üretilir.
//   3. `update` flow OPTIMISTIC: önce `setPreferences(merged)` (UI anında
//      yansır), sonra `savePreferences()` background'da. Hata durumunda
//      önceki snapshot'a geri rollback + DEV warn. Storage round-trip
//      artık tap algısını bloke etmez.
//
// Sonuç: Alerji tag basışında UI ANINDA güncellenir; `useUserPreferences`
// kullanan ProductCard'lar yalnızca preferences gerçekten değiştiğinde
// re-render olur (callback referans değişimi yok).

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES });

  // En güncel preferences referansı — `update` closure'ı stale capture'a
  // düşmesin diye. setPreferences her başarılı/rollback'ten sonra burayı
  // da günceller (aşağıdaki helper).
  const prefsRef = useRef<UserPreferences>(preferences);

  // Yazma sıra numarası — eşzamanlı update'lerde STALE rollback'i önler.
  // Her update/clear çağrısı kendi `mySeq`'ini alır; hata anında YALNIZCA
  // bu seq hâlâ en güncelse rollback uygular. Aksi halde daha yeni bir
  // başarılı yazma snapshot'tan ileri taşınmış olur — onu clobber etmemek
  // için rollback atlanır (DEV warn'da bildirilir).
  const writeSeqRef = useRef(0);

  // Tek noktadan state + ref senkronizasyonu — closure'lar her zaman
  // güncel snapshot'a güvenir.
  const applyPreferences = useCallback((next: UserPreferences) => {
    prefsRef.current = next;
    setPreferences(next);
  }, []);

  useEffect(() => {
    loadPreferences().then((prefs) => {
      applyPreferences(prefs);
      setReady(true);
    });
  }, [applyPreferences]);

  // Optimistic update — `[preferences]` dep YOK; ref üzerinden son snapshot.
  // Flow:
  //   1. snapshot = mevcut preferences (rollback hedefi)
  //   2. mySeq = ++writeSeqRef.current (race-guard token)
  //   3. merged = { ...snapshot, ...partial, updatedAt: now }
  //   4. applyPreferences(merged) → UI ANINDA güncellenir
  //   5. savePreferences(merged) background'da
  //   6a. hata + biz hâlâ en güncel seq'iz → snapshot'a rollback + rethrow
  //   6b. hata + bizden sonra başka yazma oldu → rollback YOK (clobber riski),
  //       sadece DEV warn + rethrow (caller bizim save'imizin başarısız
  //       olduğunu yine bilmeli — error contract korundu)
  const update = useCallback(
    async (partial: Partial<Omit<UserPreferences, "updatedAt">>) => {
      const snapshot = prefsRef.current;
      const mySeq = ++writeSeqRef.current;
      const merged: UserPreferences = {
        ...snapshot,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      // Optimistic: UI anında yansısın
      applyPreferences(merged);
      try {
        await savePreferences(merged);
      } catch (err) {
        if (writeSeqRef.current === mySeq) {
          // Sonrasında başka yazma yok — snapshot'a güvenle dön
          applyPreferences(snapshot);
          if (__DEV__) {
            console.warn(
              "[UserPreferences] save failed → rolled back:",
              (err as Error)?.message ?? "unknown",
            );
          }
        } else if (__DEV__) {
          console.warn(
            "[UserPreferences] save failed but newer write supersedes — rollback skipped:",
            (err as Error)?.message ?? "unknown",
          );
        }
        // Error contract korundu — caller `await update(...)` ile yakalayabilir
        throw err;
      }
    },
    [applyPreferences],
  );

  const setAllergies = useCallback(
    (allergies: AllergyKey[]) => update({ allergies }),
    [update],
  );

  const setSpecialConditions = useCallback(
    (specialConditions: SpecialConditionKey[]) => update({ specialConditions }),
    [update],
  );

  const setSkinType = useCallback(
    (skinType: SkinType | null) => update({ skinType }),
    [update],
  );

  const setSkinConcerns = useCallback(
    (skinConcerns: SkinConcernKey[]) => update({ skinConcerns }),
    [update],
  );

  const setTexturePreferences = useCallback(
    (texturePreferences: TexturePreferenceKey[]) => update({ texturePreferences }),
    [update],
  );

  const setFinishPreference = useCallback(
    (finishPreference: FinishPreferenceKey | null) => update({ finishPreference }),
    [update],
  );

  const setAllergyIngredients = useCallback(
    (allergyIngredients: string[]) => update({ allergyIngredients }),
    [update],
  );

  const setAvoidedIngredients = useCallback(
    (avoidedIngredients: string[]) => update({ avoidedIngredients }),
    [update],
  );

  const clear = useCallback(async () => {
    const snapshot = prefsRef.current;
    const mySeq = ++writeSeqRef.current;
    // Optimistic clear — UI anında varsayılana dönsün
    applyPreferences({ ...DEFAULT_PREFERENCES });
    try {
      await clearPreferences();
    } catch (err) {
      if (writeSeqRef.current === mySeq) {
        applyPreferences(snapshot);
        if (__DEV__) {
          console.warn(
            "[UserPreferences] clear failed → rolled back:",
            (err as Error)?.message ?? "unknown",
          );
        }
      } else if (__DEV__) {
        console.warn(
          "[UserPreferences] clear failed but newer write supersedes — rollback skipped:",
          (err as Error)?.message ?? "unknown",
        );
      }
      throw err;
    }
  }, [applyPreferences]);

  // Provider value — yalnızca state değişiminde yeni nesne. Callback'ler
  // stabil olduğu için consumer rerender'ları sadece preferences/ready
  // değişikliklerinden tetiklenir.
  const contextValue = useMemo<UserPreferencesContextType>(
    () => ({
      ready,
      preferences,
      update,
      setAllergies,
      setSpecialConditions,
      setSkinType,
      setSkinConcerns,
      setTexturePreferences,
      setFinishPreference,
      setAllergyIngredients,
      setAvoidedIngredients,
      clear,
    }),
    [
      ready,
      preferences,
      update,
      setAllergies,
      setSpecialConditions,
      setSkinType,
      setSkinConcerns,
      setTexturePreferences,
      setFinishPreference,
      setAllergyIngredients,
      setAvoidedIngredients,
      clear,
    ],
  );

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserPreferences() {
  return useContext(UserPreferencesContext);
}
