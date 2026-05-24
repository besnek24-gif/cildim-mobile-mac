/**
 * userSafetyProfile.ts
 * Kullanıcı güvenlik profili — hamilelik, emzirme, alerji, kaçınılan içerikler
 * Mimari hazır: gelecekteki klinik genişleme için temiz yapı
 */

export interface UserSafetyProfile {
  isPregnant?:         boolean;
  isBreastfeeding?:    boolean;
  allergyFlags?:       string[];
  avoidedIngredients?: string[];
  isBeginner?:         boolean;
  highSensitivity?:    boolean;
}

// Önceden tanımlı hassasiyet etiketleri
export const ALLERGY_FLAG_OPTIONS = [
  "Parfüm / Koku",
  "Lanolin",
  "Nikel",
  "Propilen Glikol",
  "Formaldehit",
  "Paraben",
  "Salisilik Asit",
  "Retinol",
] as const;

// Hamilelikte dikkat edilmesi önerilen içerikler (mimari placeholder)
export const PREGNANCY_CAUTION_INGREDIENTS = [
  "retinol",
  "retinoid",
  "tretinoin",
  "adapalene",
  "salicylic acid",
  "benzoyl peroxide",
  "hydroquinone",
  "mercury",
  "formaldehyde",
] as const;

// ─── In-memory store ───────────────────────────────────────────────────────────

let _profile: UserSafetyProfile = {};

export function getUserSafetyProfile(): UserSafetyProfile {
  return _profile;
}

export function updateUserSafetyProfile(updates: Partial<UserSafetyProfile>): void {
  _profile = { ..._profile, ...updates };
}

export function resetUserSafetyProfile(): void {
  _profile = {};
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

export function hasAvoidedIngredient(ingredientsText: string, profile: UserSafetyProfile): string[] {
  if (!profile.avoidedIngredients?.length) return [];
  const lower = ingredientsText.toLowerCase();
  return profile.avoidedIngredients.filter(ing => lower.includes(ing.toLowerCase()));
}

export function hasPregnancyCautionIngredient(ingredientsText: string): string[] {
  const lower = ingredientsText.toLowerCase();
  return PREGNANCY_CAUTION_INGREDIENTS.filter(ing => lower.includes(ing));
}

export function isBeginnerProfile(profile: UserSafetyProfile): boolean {
  return !!profile.isBeginner;
}
