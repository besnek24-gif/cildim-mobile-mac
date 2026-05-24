import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { signInWithProvider, supabase } from "@/lib/supabaseClient";
import { computeEffectiveRole, type UserRole, type SubscriptionStatus } from "@/lib/rbac";
// ECZ4 — Logout state-leak guard: çıkışta tüm user-spesifik routine + bakım
// profili state'ini sıfırla. Tek yön: bu üç store'un kendi clearAllOnLogout()
// helper'ı (additive). Mevcut auth davranışı korunur.
import { clearAllOnLogout as clearRoutineCollectionOnLogout } from "@/lib/routineCollection";
import { clearAllOnLogout as clearRoutineProgramOnLogout } from "@/lib/premium-skin-scan-v2/routineProgramStore";
import { clearAllOnLogout as clearBridgeProfilesOnLogout } from "@/lib/concernRoutineBridgeStore";
// ECZ4 PHASE 2A — historyStore'un AsyncStorage anahtarı (`pskv2_history_v1`)
// önceki temizleme zincirinde yoktu; logout sonrası yeni kullanıcı önceki
// kullanıcının cilt analizi geçmişini görebiliyordu. removeAll() AsyncStorage
// + in-memory cache'i sıfırlar.
import { historyStore } from "@/lib/premium-skin-scan-v2/historyStore";
// ECZ4 PHASE 2C-4 — KVKK/Apple privacy hardening: logout sonrası alerji,
// hamilelik/emzirme, cilt tipi, son analiz sonucu, klasik local geçmiş,
// arama düzeltmeleri ve davranış sinyalleri AsyncStorage'da kalmasın → bir
// sonraki kullanıcı (cihaz paylaşımı) önceki kullanıcının özel nitelikli
// kişisel verilerini ASLA göremez.
import { clearPreferences } from "@/lib/userPreferences";
import { clearLocalHistory } from "@/lib/localHistory";
import { resultStore } from "@/lib/premium-skin-scan-v2/resultStore";
import { clearCorrections } from "@/lib/searchCorrections";
import { clearUserEvents } from "@/lib/userEvents";

export interface User {
  id: string;
  email: string;
  ad?: string;
  soyad?: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: string | null;
  username?: string;
  emailVerified: boolean;
  /** @deprecated tier yerine role kullanın */
  tier: "ucretsiz" | "ekonomik" | "orta" | "seckin";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    ad: string,
    soyad: string,
    email: string,
    password: string
  ) => Promise<{ needsConfirmation: boolean }>;
  loginWithProvider: (provider: "google" | "apple") => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  isSeckin: boolean;
  isRegistered: boolean;
  effectiveRole: UserRole;
  emailVerified: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithPassword: async () => {},
  signUpWithPassword: async () => ({ needsConfirmation: false }),
  loginWithProvider: async () => {},
  logout: async () => {},
  refresh: async () => {},
  getAuthHeaders: async () => ({ "Content-Type": "application/json" }),
  isSeckin: false,
  isRegistered: false,
  effectiveRole: "guest",
  emailVerified: false,
});

function mapUser(su: SupabaseUser): User {
  const m = su.user_metadata ?? {};
  const fullName: string = m.full_name ?? m.name ?? "";
  const parts = fullName.split(" ").filter(Boolean);

  // Supabase user_metadata'dan rol ve abonelik bilgisi
  const role = (m.role as UserRole) ?? "free";
  const subscriptionStatus = (m.subscription_status as SubscriptionStatus) ?? "none";

  // Eski tier sistemi ile uyumluluk
  let tier: User["tier"] = "ucretsiz";
  if (role === "seckin" && subscriptionStatus === "active") {
    tier = "seckin";
  }

  return {
    id: su.id,
    email: su.email ?? "",
    ad: m.ad ?? parts[0] ?? undefined,
    soyad: m.soyad ?? (parts.length > 1 ? parts.slice(1).join(" ") : undefined),
    role,
    subscriptionStatus,
    subscriptionExpiresAt: m.subscription_expires_at ?? null,
    username: m.username ?? undefined,
    emailVerified: !!su.email_confirmed_at,
    tier,
  };
}

// PERF — Phase A fix pack:
//   1. Tüm metodlar (`loginWithPassword`, `signUpWithPassword`,
//      `loginWithProvider`, `logout`, `refresh`, `getAuthHeaders`)
//      `useCallback` ile sabitlendi → provider ömrü boyunca stabil referans.
//   2. Provider value `useMemo([user, loading, ...callbacks])` ile sarıldı.
//      user değişmediği sürece tüm `useAuth()` consumer'ları (en yoğun:
//      ProductCard) yeniden render OLMAZ.
//   3. Davranış değişmedi — sadece referans stabilitesi eklendi.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const handleSession = useCallback((session: Session | null) => {
    setUser(session?.user ? mapUser(session.user) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => { listener.subscription.unsubscribe(); };
  }, [handleSession]);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    handleSession(session);
  }, [handleSession]);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUpWithPassword = useCallback(async (
    ad: string,
    soyad: string,
    email: string,
    password: string
  ): Promise<{ needsConfirmation: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ad,
          soyad,
          role: "free",
          subscription_status: "none",
          tier: "ucretsiz",
        },
      },
    });
    if (error) throw new Error(error.message);

    // If Supabase email confirmation is disabled (recommended), data.session exists here
    // and the user is immediately signed in. If confirmation is still enabled in the
    // Supabase Dashboard, we attempt a silent sign-in so returning users aren't blocked.
    if (!data.session) {
      try {
        await supabase.auth.signInWithPassword({ email, password });
      } catch {
        // Silent — user will continue to app as free tier; session will resume after confirmation
      }
    }

    const needsConfirmation = !data.session;
    return { needsConfirmation };
  }, []);

  const loginWithProvider = useCallback(async (provider: "google" | "apple") => {
    await signInWithProvider(provider);
  }, []);

  const logout = useCallback(async () => {
    // ECZ4 — Logout state-leak guard: önce kullanıcı-spesifik store'ları
    // temizle, sonra Supabase oturumunu kapat. Sıralama kritik:
    //   · clear → signOut: bir sonraki user (ya da guest) ekrana eriştiğinde
    //     önceki user'ın in-memory + AsyncStorage verisini ASLA göremez.
    //   · Promise.all: 3 helper birbirinden bağımsız; paralel çalıştırılır.
    //   · catch: bir helper başarısız olsa bile diğerleri ve signOut çalışır
    //     (best-effort temizlik; user signOut'tan mahrum bırakılmaz).
    try {
      await Promise.all([
        clearRoutineCollectionOnLogout(),
        clearRoutineProgramOnLogout(),
        clearBridgeProfilesOnLogout(),
        historyStore.removeAll(),
        // ECZ4 PHASE 2C-4 — eklenen temizlikler:
        clearPreferences().catch(() => {}),       // @ciltbakim:user_prefs (alerji, skinType, hamilelik/emzirme, conditions, concerns, allergyIngredients, avoidedIngredients)
        clearLocalHistory().catch(() => {}),       // @ciltbakim:local_history_v1 (klasik inceleme geçmişi)
        clearCorrections().catch(() => {}),        // @ciltbakim:search_corrections (arama davranış izi)
        clearUserEvents().catch(() => {}),         // @ciltbakim:user_events (engagement / öğrenme profili)
      ]);
      // resultStore in-memory + AsyncStorage; senkron sayılır, ayrı try
      try { resultStore.clear(); } catch { /* best-effort */ }
    } catch {
      // Best-effort — temizleme hatası signOut'u engellemez.
    }
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  const effectiveRole = computeEffectiveRole(user ?? undefined);
  const isSeckinVal = effectiveRole === "seckin";
  const isRegisteredVal = effectiveRole !== "guest";
  const emailVerifiedVal = user?.emailVerified ?? false;

  // Provider value memo — user/loading/effectiveRole değişmediği sürece
  // aynı referans. ProductCard gibi `useAuth()` tüketicilerinin bypass
  // re-render'ı durur.
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      loginWithPassword,
      signUpWithPassword,
      loginWithProvider,
      logout,
      refresh,
      getAuthHeaders,
      isSeckin: isSeckinVal,
      isRegistered: isRegisteredVal,
      effectiveRole,
      emailVerified: emailVerifiedVal,
    }),
    [
      user,
      loading,
      loginWithPassword,
      signUpWithPassword,
      loginWithProvider,
      logout,
      refresh,
      getAuthHeaders,
      isSeckinVal,
      isRegisteredVal,
      effectiveRole,
      emailVerifiedVal,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
