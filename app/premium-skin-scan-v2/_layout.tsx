import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";

/**
 * ECZ4 STEP 5 — Premium Skin Scan v2 erişim kontrolü.
 *
 * Tek kaynak: `useAuth()` (context/AuthContext.tsx).
 *   • isRegistered → kullanıcı giriş yapmış mı?
 *   • isSeckin     → Seçkin Üyelik aktif mi?
 *
 * Layout-level guard: index/capture/review/analysis/result/routine-program/
 * routine-tracking/history/history-detail dahil TÜM alt route'lar bu guard'a
 * tabidir — direct deeplink (router.push) ile erişilemez.
 *
 * Yönlendirme uygulamanın mevcut paternine uyar:
 *   guest         → /giris   (login screen)
 *   logged-in & non-seckin → /uyelik  (Seçkin Üyelik upsell)
 *   seckin        → normal flow
 *
 * loading anında null döner (auth henüz çözülmedi); flicker önlenir.
 */
export default function PremiumSkinScanLayout() {
  const { loading, isRegistered, isSeckin } = useAuth();

  if (loading) return null;
  if (!isRegistered) return <Redirect href={"/giris" as any} />;
  if (!isSeckin)     return <Redirect href={"/uyelik" as any} />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="capture" />
      <Stack.Screen name="review" />
      <Stack.Screen name="analysis" />
      <Stack.Screen name="result" />
      <Stack.Screen name="history" />
      <Stack.Screen name="history-detail" />
      <Stack.Screen name="routine-program" />
      <Stack.Screen name="routine-tracking" />
    </Stack>
  );
}