/**
 * safeBack — Hidden Tabs.Screen sayfaları için güvenli geri navigasyon.
 *
 * NEDEN router.back() KULLANMIYORUZ?
 *
 * Bu helper'ı kullanan 8 ekran (cilt-raporlari, ayarlar, danisma,
 * cilt-analizi intro, favoriler, gecmis, urun-oner, questionnaire) hepsi
 * `app/(tabs)/_layout.tsx` içinde `<Tabs.Screen ... options={{ href: null }}>`
 * olarak kayıtlı GİZLİ tab ekranları. Yani aynı `<Tabs>` navigator'unun
 * çocukları — Stack çocukları DEĞİL.
 *
 * React Navigation'ın `Tab.Navigator` varsayılan `backBehavior` değeri
 * `"firstRoute"`. Yani bir tab'tayken `router.back()` çağrıldığında
 * navigator önceki ziyaret edilen tab'a değil, KAYITLI İLK tab'a atlar.
 * Bu uygulamada ilk tab `(home)` (Ana Sayfa). Sonuç: gizli tab ekranındaki
 * geri tuşu `router.back()` ile her zaman Home'a düşüyor.
 *
 * Üstüne bir de `(home)` tab'ının `tabPress` listener'ı (PERF E4/F2)
 * `e.preventDefault() → resetHomeSearch() → router.navigate("/(tabs)/(home)/")`
 * yaparak tab aktivasyonunu pekiştiriyor — yani back sonrası kullanıcı
 * temiz bir Home root'a düşüyor, "her zaman Home'a gidiyor" hissi tam
 * burada doğuyor.
 *
 * `app/(tabs)/_layout.tsx` dosyasına `backBehavior="history"` eklemek
 * teorik olarak bu davranışı düzeltirdi, ancak o dosya sabit kaide
 * gereği DOKUNULMAZ (navigation architecture + Home tabPress PERF E4/F2).
 *
 * BU YÜZDEN: gizli tab ekranlarında `router.back()` GÜVENİLİR DEĞİL.
 * Çağıran her ekran zaten anlamlı parent ekranını (Profil) `fallback`
 * olarak veriyor. Doğrudan `router.replace(fallback)` ile o parent'a
 * dönüyoruz — kayıp yok, yan etki yok, mimari değişikliği yok.
 *
 * Notlar:
 *   - `fallback` ZORUNLU. Sessiz default yok ("/" yok, route guess yok).
 *   - Helper saf, side-effect free. Haptic / log / analytics çağıran
 *     ekrana ait, burada yok.
 *   - `safeBack` adı korunuyor — 8 call site dokunulmuyor.
 *   - Kapsam: yalnızca gizli tab ekranları. Stack içindeki ekranlar
 *     (Home stack, skin-intelligence, premium-skin-scan-v2 vs.) bu
 *     helper'ı kullanmıyor; oralardaki kendi `canGoBack/back` desenleri
 *     dokunulmadan çalışmaya devam ediyor.
 */

type SafeRouter = {
  replace: (href: any) => void;
};

export function safeBack(router: SafeRouter, fallback: any): void {
  router.replace(fallback);
}
