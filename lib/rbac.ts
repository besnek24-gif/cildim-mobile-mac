/**
 * rbac.ts — Mobil uygulama için Rol Bazlı Erişim Kontrol yardımcıları
 *
 * Sunucu tarafı ile aynı mantık; bileşenlerde ve hook'larda kullanılır.
 */

export type UserRole = "guest" | "free" | "seckin";
export type SubscriptionStatus = "none" | "active" | "expired";

export interface RbacUser {
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: string | null;
}

const ROLE_ORDER: Record<UserRole, number> = { guest: 0, free: 1, seckin: 2 };

/**
 * Etkili rolü hesaplar.
 * Kural: role == "seckin" && subscriptionStatus != "active"  →  free gibi davran
 */
export function computeEffectiveRole(user: RbacUser | null | undefined): UserRole {
  if (!user) return "guest";
  if (
    user.role === "seckin" &&
    user.subscriptionStatus !== "active"
  ) {
    return "free";
  }
  return user.role;
}

/** Kullanıcının belirli bir role erişimi var mı? */
export function hasRole(user: RbacUser | null | undefined, required: UserRole): boolean {
  const effective = computeEffectiveRole(user);
  return ROLE_ORDER[effective] >= ROLE_ORDER[required];
}

/** Seçkin üye mi? */
export function isSeckin(user: RbacUser | null | undefined): boolean {
  return computeEffectiveRole(user) === "seckin";
}

/** Kayıtlı kullanıcı mı (free veya seckin)? */
export function isRegistered(user: RbacUser | null | undefined): boolean {
  return hasRole(user, "free");
}

/** Abonelik süresi yakında doluyor mu? (7 gün içinde) */
export function isSubscriptionExpiringSoon(user: RbacUser | null | undefined): boolean {
  if (!user?.subscriptionExpiresAt) return false;
  const diff = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

/** Kalan abonelik günü */
export function daysUntilExpiry(user: RbacUser | null | undefined): number | null {
  if (!user?.subscriptionExpiresAt) return null;
  const diff = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
