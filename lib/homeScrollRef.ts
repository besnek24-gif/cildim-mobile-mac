/**
 * Shared home-scroll ref holder.
 * Home screen sets it on FlatList mount; tab layout reads it on repeated tab press.
 * Module-level (not React state) → no re-renders, no context needed.
 */

type ScrollTarget = {
  scrollToOffset: (args: { offset: number; animated: boolean }) => void;
} | null;

let _ref: ScrollTarget = null;

/** Called by the Home FlatList's ref callback. */
export function registerHomeScrollRef(ref: ScrollTarget): void {
  _ref = ref;
}

/** Called by the tab press listener when Home is already focused.
 *
 * PERF — Phase A fix pack: animated:true → animated:false.
 * Önceki davranış: 80ms gecikme + animated scroll yüzünden kullanıcı sayfayı
 * önce ortada görüp sonra otomatik yukarı kaydığını izlerdi. Şimdi tab press
 * → ANINDA y=0; jitter yok, intent net.
 * Geri alma: animated parametresini true yap.
 */
export function scrollHomeToTop(): void {
  try {
    _ref?.scrollToOffset({ offset: 0, animated: false });
  } catch {
    // Fail silently — ref may have unmounted
  }
}
