/**
 * accessControl.ts — Semantik erişim kontrol yardımcıları
 *
 * Kullanım:
 *   const { user } = useAuth();
 *   if (canUseAllergyFilter(user)) { ... }
 *
 * Tier haritası:
 *   guest   → Misafir    (sadece göz at)
 *   free    → Üye        (alerji filtresi + şahsi profil)
 *   seckin  → Seçkin Üyelik (tüm özellikler)
 */

import { computeEffectiveRole, isRegistered, isSeckin, type RbacUser, type UserRole } from "./rbac";

// ─── Erişim yardımcıları ───────────────────────────────────────────────────────

/** Alerji filtresini kullanabilir mi? (Üye + Seçkin) */
export function canUseAllergyFilter(user: RbacUser | null | undefined): boolean {
  const role = computeEffectiveRole(user);
  return role === "free" || role === "seckin";
}

/** Hamilelik bilgisini girebilir/okuyabilir mi? (Sadece Seçkin) */
export function canUsePregnancyInfo(user: RbacUser | null | undefined): boolean {
  return computeEffectiveRole(user) === "seckin";
}

/** Emzirme bilgisini girebilir/okuyabilir mi? (Sadece Seçkin) */
export function canUseBreastfeedingInfo(user: RbacUser | null | undefined): boolean {
  return computeEffectiveRole(user) === "seckin";
}

/** Premium modüllere erişebilir mi? (Sadece Seçkin) */
export function canUsePremiumModules(user: RbacUser | null | undefined): boolean {
  return computeEffectiveRole(user) === "seckin";
}

/** Favorileri kaydedebilir mi? (Üye + Seçkin) */
export function canSaveFavorites(user: RbacUser | null | undefined): boolean {
  const role = computeEffectiveRole(user);
  return role === "free" || role === "seckin";
}

/** Tarama geçmişini görebilir mi? (Üye + Seçkin) */
export function canViewHistory(user: RbacUser | null | undefined): boolean {
  const role = computeEffectiveRole(user);
  return role === "free" || role === "seckin";
}

// ─── ECZ4 · Multi-Care Profile feature boundary helpers (additive) ────────────
//
// Bu helper'lar Bölüm 5a kapsamında eklendi. Henüz hiçbir consumer çağırmıyor;
// sadece yeni özellik sınırını tek noktadan tarif etmek için API hazırlar.
// İleride UI/screen migration'larında inline `isSeckin ?` ternary'leri yerine
// bu helper'lar kullanılacak — single source of truth korunur.

/**
 * Manuel rutin oluşturma/düzenleme erişimi.
 * Misafir dahil tüm kullanıcılara açık (oturumluk veya kalıcı, mevcut
 * routineStore davranışıyla aynı). Hiçbir koşulda kapatılmaz.
 */
export function canUseManualRoutine(_user: RbacUser | null | undefined): boolean {
  return true;
}

/**
 * Akıllı Seçim (rehberli ürün filtreleme/keşif) erişimi.
 * Misafir dahil tüm kullanıcılara açık. Akıllı Seçim premium öneri sistemi
 * DEĞİLDİR — yalnızca alan/amaç/koşul/seviye filtresine göre ürün listesi
 * sunar; bu nedenle Seçkin gating'i uygulanmaz.
 */
export function canUseAkilliSecim(_user: RbacUser | null | undefined): boolean {
  return true;
}

/**
 * Temel bakım profili (cilt tipi, basit hassasiyet vb.) kalıcı kayıt erişimi.
 * Misafir kalıcı profil tutamaz; kayıtlı kullanıcı (free) ve Seçkin tutar.
 * Mevcut canSaveFavorites / canViewHistory deseniyle paralel.
 */
export function canUseBasicCareProfile(user: RbacUser | null | undefined): boolean {
  return isRegistered(user);
}

/**
 * Otomatik (sistem-üretimli) akıllı rutin erişimi.
 * Cilt analizi / rehber profili sonuçlarından üretilen Premium engine
 * çıktıları (smartRoutineEngine + premiumResult) Seçkin'e özeldir.
 */
export function canUseAutoRoutine(user: RbacUser | null | undefined): boolean {
  return isSeckin(user);
}

/**
 * Akıllı ürün eşleşmesi (profil bazlı otomatik öneri) erişimi.
 * profileRecommendationEngine'in segment scoring boost'u + multi-factor
 * sıralaması Seçkin'e özeldir.
 */
export function canUseSmartRecommendations(user: RbacUser | null | undefined): boolean {
  return isSeckin(user);
}

/**
 * Gelişmiş güvenlik uyarıları erişimi.
 * Hamilelik/emzirme/alerji/içerik çakışması kombinasyonu, hekim katmanı
 * overlay'leri ve ingredientAlerts'in seckinOnly uyarıları Seçkin'e özeldir.
 * (Temel alerji filtresi için canUseAllergyFilter ayrı tutulur.)
 */
export function canUseAdvancedSafety(user: RbacUser | null | undefined): boolean {
  return isSeckin(user);
}

/**
 * DermoAsistan derin sohbet/analiz erişimi.
 * Mesaj gönderme, derin soru sorma, kişiselleştirilmiş yanıt üretimi
 * Seçkin'e özeldir. (Tanıtım/intro ekranları herkese açık kalır.)
 */
export function canUseDeepDermaAssistant(user: RbacUser | null | undefined): boolean {
  return isSeckin(user);
}

/**
 * Çoklu bakım profili otomasyonu erişimi.
 * Cilt + Saç + Güneş + Vücut + Ağız domain'lerini ayrı ayrı yöneten,
 * domain bazlı otomatik rutin senkronu sunan üst-seviye dashboard Seçkin'e
 * özeldir. (Tek-domain manuel kullanım canUseManualRoutine ile açık kalır.)
 */
export function canUseMultiProfileAutomation(user: RbacUser | null | undefined): boolean {
  return isSeckin(user);
}

// ─── Türkçe etiket ve renk sistemi ───────────────────────────────────────────

export interface MembershipInfo {
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
}

export function getMembershipInfo(role: UserRole): MembershipInfo {
  switch (role) {
    case "guest":
      return {
        label: "Misafir",
        sublabel: "Giriş yaparak tüm özelliklere erişin",
        color: "#64748B",
        bgColor: "#F1F5F9",
      };
    case "free":
      return {
        label: "Üye",
        sublabel: "Alerji filtresi ve şahsi profil aktif",
        color: "#3D6E56",
        bgColor: "#ECFDF5",
      };
    case "seckin":
      return {
        label: "Seçkin Üyelik",
        sublabel: "Tüm premium özellikler aktif",
        color: "#B87333",
        bgColor: "#FDF2E5",
      };
  }
}

// ─── Multi-routine yetki kapısı (ECZ4 Step 1) ────────────────────────────────
//
// Kaide 10:
//   guest         → 0 rutin (kayıt yapamaz)
//   free (üye)    → 1 rutin
//   seckin        → 4 rutin

/** Yeni rutin oluşturabilir mi? (kayıtlı kullanıcı VEYA Seçkin) */
export function canCreateNewRoutine(user: RbacUser | null | undefined): boolean {
  return isRegistered(user) || isSeckin(user);
}

/** Bu kullanıcı için maksimum rutin sayısı. */
export function getMaxRoutineCount(user: RbacUser | null | undefined): number {
  if (isSeckin(user))     return 4;
  if (isRegistered(user)) return 1;
  return 0;
}

// ─── Gelecekteki ödeme altyapısı için yer tutucu ─────────────────────────────
// Bu alanlar ödeme sistemi entegrasyonunda doldurulacak.
// AuthContext.User'a eklenecek alanlar:
//   premium_started_at?: string | null
//   premium_expires_at?: string | null
//   subscription_status?: "none" | "active" | "expired" | "cancelled"
