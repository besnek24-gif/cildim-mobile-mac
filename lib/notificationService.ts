/**
 * notificationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ECZ4 / FINAL-HARD-LOCK — TASK 1: HARD DISABLE NOTIFICATIONS FOR THIS RELEASE
 *
 * Bu modül artık SAFE PURE NO-OP'tir.
 *
 *   • expo-notifications STATİK import YOK.
 *   • expo-notifications DİNAMİK import YOK.
 *   • PushNotificationIOS / NativeEventEmitter / expo-constants kullanımı YOK.
 *   • AsyncStorage erişimi YOK (eski recovery ID şeması artık gerekmez).
 *   • Tüm dışa açık fonksiyonlar güvenli `false`/`undefined` döndürür.
 *   • Hiçbir native modüle dokunulmaz; Expo Go'da kesinlikle çökmez.
 *
 * Not: Eski tüketicilerin (rehber.tsx vb.) import yüzeyi korunur; gelecek
 * release'te bildirimler aktifleşirse bu dosya genişletilebilir. Şimdilik
 * hiçbir runtime yan etkisi YOKTUR.
 */

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleRoutineReminder(
  _slot: "morning" | "evening",
  _time: string,
): Promise<void> {
  // no-op
}

export async function cancelRoutineReminder(
  _slot: "morning" | "evening",
): Promise<void> {
  // no-op
}

export async function scheduleFlowRecoveryNotification(
  _flowId: string,
  _flowTitle: string,
  _delayHours: number = 4,
): Promise<void> {
  // no-op
}

export async function cancelFlowRecoveryNotification(
  _flowId: string,
): Promise<void> {
  // no-op
}
