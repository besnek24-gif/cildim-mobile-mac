/**
 * premiumFeatures.ts
 *
 * Uygulamadaki tüm premium (Seçkin) özelliklerin merkezi kaydı.
 * Yeni bir premium özellik eklemek için sadece bu dosyaya bir satır ekle.
 * UI, mantık ve backend bu tek kaynaktan beslenir.
 */

import type { UserRole } from "./rbac";

const ROLE_ORDER: Record<UserRole, number> = { guest: 0, free: 1, seckin: 2 };

// ── Tip Tanımları ────────────────────────────────────────────────────────────

export type FeatureId =
  | "dermaAssistant"
  | "skinAnalysis"
  | "routineBuilder"
  | "smartWarnings"
  // ECZ4 · Step 5d — gerçek Seçkin özellikleri için temiz feature ID'leri.
  // routineBuilder artık "free" olduğundan, otomatik üretim ve diğer premium
  // davranışlar için ayrı ID'ler tanımlanır. Henüz hiçbir consumer kullanmıyor.
  | "autoRoutine"
  | "smartRecommendations"
  | "advancedSafety"
  | "multiProfileAutomation";

export interface PremiumFeature {
  id: FeatureId;
  name: string;
  shortDescription: string;
  isPremium: true;
  icon: string;
  iconBg: { light: string; dark: string };
  iconColor: { light: string; dark: string };
  textColor: { light: string; dark: string };
  requiredRole: UserRole;
}

// ── Feature Kataloğu ─────────────────────────────────────────────────────────

export const PREMIUM_FEATURES: Record<FeatureId, PremiumFeature> = {

  dermaAssistant: {
    id: "dermaAssistant",
    name: "DermoAsistan",
    shortDescription: "Yapay zeka destekli içerik rehberi",
    isPremium: true,
    icon: "cpu",
    iconBg:    { light: "#EBF0FA", dark: "#243050" },
    iconColor: { light: "#3D6EAA", dark: "#7A9AC8" },
    textColor: { light: "#1E2B3C", dark: "#A0B8D8" },
    requiredRole: "seckin",
  },

  skinAnalysis: {
    id: "skinAnalysis",
    name: "Cilt Bakım Profili",
    shortDescription: "Selfie tabanlı cilt tipi tespiti",
    isPremium: true,
    icon: "camera",
    iconBg:    { light: "#EEE9F8", dark: "#3A2A50" },
    iconColor: { light: "#7355B8", dark: "#A888D0" },
    textColor: { light: "#1E2B3C", dark: "#C0A8D8" },
    requiredRole: "seckin",
  },

  routineBuilder: {
    id: "routineBuilder",
    name: "Rutinim",
    shortDescription: "Şahsi bakım rutini oluştur",
    // ECZ4 · Step 5b — registry ↔ implementation hizalama.
    // routineStore + canUseManualRoutine herkese açık (misafir dahil); bu
    // entry'nin requiredRole'u "seckin" iken canAccessFeature("routineBuilder")
    // free kullanıcılarda yanlışlıkla false dönüyordu. Manuel rutin gerçek
    // erişim seviyesi "free" — yani kayıtlı kullanıcı + Seçkin. Misafir için
    // routineStore oturumluk çalışır; bu registry kayıtlı erişimi ifade eder.
    // (isPremium literal'i interface kontratı; UI metadata olarak korunur.)
    isPremium: true,
    icon: "list",
    iconBg:    { light: "#FAF2E8", dark: "#402A18" },
    iconColor: { light: "#B07230", dark: "#C0906A" },
    textColor: { light: "#1E2B3C", dark: "#D0A888" },
    requiredRole: "free",
  },

  smartWarnings: {
    id: "smartWarnings",
    name: "Akıllı Uyarılar",
    shortDescription: "Cilt tipine özel güvenlik analizi",
    isPremium: true,
    icon: "shield",
    iconBg:    { light: "#FBF4E6", dark: "#3A2A10" },
    iconColor: { light: "#C48A20", dark: "#D4A840" },
    textColor: { light: "#1E2B3C", dark: "#D0A888" },
    requiredRole: "seckin",
  },

  // ── ECZ4 · Step 5d — Yeni Seçkin feature kayıtları ────────────────────────
  // Henüz hiçbir consumer (UI/screen/hook) çağırmıyor. SECKIN_BLOCK_FEATURES
  // listesine de eklenmedi (Home grid layout'una dokunulmaz). Yalnızca
  // canAccessFeature/usePremiumGate.requireAccess gelecekteki çağrılar için
  // temiz API hazırlar. Renk paleti mevcut entry'lerden yeniden kullanıldı.

  autoRoutine: {
    id: "autoRoutine",
    name: "Akıllı Rutin",
    shortDescription: "Profiline göre otomatik bakım programı",
    isPremium: true,
    icon: "zap",
    // Palet: routineBuilder ile aynı amber/turuncu aile — rutin görsel kimliğiyle uyum.
    iconBg:    { light: "#FAF2E8", dark: "#402A18" },
    iconColor: { light: "#B07230", dark: "#C0906A" },
    textColor: { light: "#1E2B3C", dark: "#D0A888" },
    requiredRole: "seckin",
  },

  smartRecommendations: {
    id: "smartRecommendations",
    name: "Akıllı Öneriler",
    shortDescription: "Ürünleri ihtiyacına göre önceliklendir",
    isPremium: true,
    icon: "target",
    // Palet: skinAnalysis ile aynı mor aile — öneri/analiz görsel kimliğiyle uyum.
    iconBg:    { light: "#EEE9F8", dark: "#3A2A50" },
    iconColor: { light: "#7355B8", dark: "#A888D0" },
    textColor: { light: "#1E2B3C", dark: "#C0A8D8" },
    requiredRole: "seckin",
  },

  advancedSafety: {
    id: "advancedSafety",
    name: "Gelişmiş Güvenlik",
    shortDescription: "Alerji, hamilelik ve içerik çakışmalarını takip et",
    isPremium: true,
    icon: "shield-off",
    // Palet: smartWarnings ile aynı altın aile — güvenlik/uyarı görsel kimliğiyle uyum.
    iconBg:    { light: "#FBF4E6", dark: "#3A2A10" },
    iconColor: { light: "#C48A20", dark: "#D4A840" },
    textColor: { light: "#1E2B3C", dark: "#D0A888" },
    requiredRole: "seckin",
  },

  multiProfileAutomation: {
    id: "multiProfileAutomation",
    name: "Çoklu Profil Otomasyonu",
    shortDescription: "Cilt, saç ve güneş bakımını birlikte yönet",
    isPremium: true,
    icon: "layers",
    // Palet: dermaAssistant ile aynı mavi aile — sistem/asistan görsel kimliğiyle uyum.
    iconBg:    { light: "#EBF0FA", dark: "#243050" },
    iconColor: { light: "#3D6EAA", dark: "#7A9AC8" },
    textColor: { light: "#1E2B3C", dark: "#A0B8D8" },
    requiredRole: "seckin",
  },

};

// ── Yardımcı Listeler ────────────────────────────────────────────────────────

/** Ana sayfadaki Seçkin bloğunda gösterilen 4 kart (2×2 grid) */
export const SECKIN_BLOCK_FEATURES: FeatureId[] = [
  "dermaAssistant",
  "skinAnalysis",
  "routineBuilder",
  "smartWarnings",
];

/** Tüm premium feature listesi (ayarlar / üyelik ekranı gibi yerlerde) */
export const PREMIUM_FEATURE_LIST: PremiumFeature[] = Object.values(PREMIUM_FEATURES);

// ── Erişim Kontrol Fonksiyonu ────────────────────────────────────────────────

/**
 * Kullanıcının belirli bir özelliğe erişimi var mı?
 *
 * KULLANIM: Uygulamanın her yerinde bu fonksiyonu kullan.
 *           `effectiveRole === "seckin"` şeklinde hardcode kontrol yapma.
 *
 * @param effectiveRole  useAuth() → effectiveRole
 * @param featureId      PREMIUM_FEATURES içindeki id
 */
export function canAccessFeature(
  effectiveRole: UserRole,
  featureId: FeatureId,
): boolean {
  const feature = PREMIUM_FEATURES[featureId];
  if (!feature) return true; // Bilinmeyen feature → varsayılan olarak serbest bırak
  return ROLE_ORDER[effectiveRole] >= ROLE_ORDER[feature.requiredRole];
}
