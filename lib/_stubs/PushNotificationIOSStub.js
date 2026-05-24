/**
 * PushNotificationIOSStub.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ECZ4 / FINAL-RUNTIME-TRUTH-AND-HARD-FIX — PART B
 *
 * Expo Go altında react-native barrel `PushNotificationIOS` getter'ı
 * NativeEventEmitter çağırır (`new NativeEventEmitter(RCTPushNotificationManager)`)
 * ve bu native modül Expo Go'da YOKTUR → Invariant Violation crash.
 *
 * Metro resolver'ı `react-native/Libraries/PushNotificationIOS/PushNotificationIOS`
 * import'larını bu dosyaya yönlendirir. Pure no-op default export ile crash önlenir.
 *
 * Bu dosya HİÇBİR native modüle dokunmaz.
 */
const noop = () => {};
const noopArr = () => [];
const noopThen = (cb) => { try { cb && cb({}); } catch {} };

const PushNotificationIOSStub = {
  presentLocalNotification: noop,
  scheduleLocalNotification: noop,
  cancelAllLocalNotifications: noop,
  removeAllDeliveredNotifications: noop,
  getDeliveredNotifications: (cb) => { try { cb && cb([]); } catch {} },
  removeDeliveredNotifications: noop,
  setApplicationIconBadgeNumber: noop,
  getApplicationIconBadgeNumber: (cb) => { try { cb && cb(0); } catch {} },
  cancelLocalNotifications: noop,
  getScheduledLocalNotifications: (cb) => { try { cb && cb([]); } catch {} },
  addEventListener: () => ({ remove: noop }),
  removeEventListener: noop,
  requestPermissions: () => Promise.resolve({ alert: false, badge: false, sound: false }),
  abandonPermissions: noop,
  checkPermissions: (cb) => { try { cb && cb({ alert: false, badge: false, sound: false }); } catch {} },
  getInitialNotification: () => Promise.resolve(null),
  getAuthorizationStatus: (cb) => { try { cb && cb(0); } catch {} },
  FetchResult: { NewData: "UIBackgroundFetchResultNewData", NoData: "UIBackgroundFetchResultNoData", ResultFailed: "UIBackgroundFetchResultFailed" },
};

module.exports = PushNotificationIOSStub;
module.exports.default = PushNotificationIOSStub;
