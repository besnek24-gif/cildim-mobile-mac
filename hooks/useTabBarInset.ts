/**
 * useTabBarInset.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tab bar layout-aware bottom inset hesabı.
 *
 * Neden gerekli:
 *   Tab bar `position: absolute` olduğundan scroll içeriğinin üzerine oturur.
 *   Ekranlar yalnızca `insets.bottom` (safe area) kullanırsa tab bar'ın ikon
 *   bölgesini (49pt iOS, 56pt Android, 50pt web) göz ardı eder ve son içerik
 *   tab bar arkasında kalır.
 *
 * Kullanım:
 *   const { scrollPaddingBottom, ctaBarBottom } = useTabBarInset();
 *   // scrollView:
 *   contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
 *   // absolute CTA bar:
 *   style={{ bottom: ctaBarBottom }}
 */

import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Tab bar ikon+etiket bölgesi yüksekliği (safe area hariç) */
const TAB_ICON_ZONE = Platform.select({ ios: 49, android: 56, web: 50, default: 50 }) as number;

export interface TabBarInset {
  /** Tab bar toplam yüksekliği (ikon zonu + safe area) */
  tabBarHeight: number;
  /**
   * ScrollView contentContainerStyle.paddingBottom için hazır değer.
   * Son içerik bloğunun tab bar'ın üzerinde görünmesini sağlar.
   * @param extra  Ek boşluk (varsayılan 16)
   */
  scrollPaddingBottom: (extra?: number) => number;
  /**
   * Absolute konumlu CTA/bottom bar için `bottom` değeri.
   * Barı tam tab bar'ın üzerine konumlandırır.
   */
  ctaBarBottom: number;
}

export function useTabBarInset(): TabBarInset {
  const { bottom } = useSafeAreaInsets();

  // iOS: safe area (home indicator) tab bar yüksekliğine dahil edilir
  // Android/Web: safe area 0 kabul edilir
  const safeBottom = Platform.OS === "ios" ? bottom : 0;
  const tabBarHeight = TAB_ICON_ZONE + safeBottom;

  return {
    tabBarHeight,
    scrollPaddingBottom: (extra = 16) => tabBarHeight + extra,
    ctaBarBottom: tabBarHeight,
  };
}
