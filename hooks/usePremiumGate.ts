/**
 * usePremiumGate.ts
 *
 * Premium özellik kapı kontrol hook'u.
 * Tüm ekranlar ve bileşenler bu hook'u kullanır.
 *
 * Kullanım:
 *   const { canAccess, requireAccess } = usePremiumGate();
 *   if (!requireAccess("skinAnalysis")) return; // → paywall'a yönlendirir
 */

import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { canAccessFeature, type FeatureId } from "@/lib/premiumFeatures";

export function usePremiumGate() {
  const { effectiveRole } = useAuth();
  const router = useRouter();

  /**
   * Feature'a erişim var mı?
   * Salt sorgulama — yan etki yok.
   */
  function canAccess(featureId: FeatureId): boolean {
    return canAccessFeature(effectiveRole, featureId);
  }

  /**
   * Erişim varsa true döner.
   * Yoksa paywall'a (/uyelik) yönlendirir ve false döner.
   *
   * Tipik kullanım:
   *   const handlePress = () => {
   *     if (!requireAccess("skinAnalysis")) return;
   *     // ... premium işlem
   *   };
   */
  function requireAccess(featureId: FeatureId): boolean {
    if (canAccess(featureId)) return true;
    router.push("/uyelik" as any);
    return false;
  }

  return {
    canAccess,
    requireAccess,
    effectiveRole,
  };
}
