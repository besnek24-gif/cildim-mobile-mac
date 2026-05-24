/**
 * expoNotificationsStub.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ECZ4 / FINAL-RUNTIME-TRUTH-AND-HARD-FIX — PART B
 *
 * `expo-notifications` herhangi bir koddan istense bile (transitive paket,
 * eski dynamic import, vs.) Metro resolver burayı çözer. Tüm exports güvenli
 * no-op'tur; native modül erişimi YOKTUR.
 */
const noopAsync = () => Promise.resolve();
const noopAsyncRet = (v) => () => Promise.resolve(v);
const noopSub = () => ({ remove: () => {} });

module.exports = {
  // permission / settings
  requestPermissionsAsync: noopAsyncRet({ status: "denied", granted: false }),
  getPermissionsAsync:     noopAsyncRet({ status: "denied", granted: false }),
  // scheduling
  scheduleNotificationAsync:  noopAsyncRet("noop-id"),
  cancelScheduledNotificationAsync: noopAsync,
  cancelAllScheduledNotificationsAsync: noopAsync,
  getAllScheduledNotificationsAsync: noopAsyncRet([]),
  // presented
  dismissNotificationAsync: noopAsync,
  dismissAllNotificationsAsync: noopAsync,
  // listeners
  addNotificationReceivedListener:           noopSub,
  addNotificationResponseReceivedListener:   noopSub,
  removeNotificationSubscription: () => {},
  // handler
  setNotificationHandler: () => {},
  // categories / channels
  setNotificationCategoryAsync: noopAsync,
  setNotificationChannelAsync:  noopAsync,
  deleteNotificationChannelAsync: noopAsync,
  // device push token
  getExpoPushTokenAsync: noopAsyncRet({ data: "noop" }),
  getDevicePushTokenAsync: noopAsyncRet({ type: "noop", data: "noop" }),
  // triggers / enums (best-effort placeholders)
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 0, SECRET: -1 },
  SchedulableTriggerInputTypes: { CALENDAR: "calendar", DAILY: "daily", DATE: "date", TIME_INTERVAL: "timeInterval", WEEKLY: "weekly", YEARLY: "yearly" },
};

module.exports.default = module.exports;
