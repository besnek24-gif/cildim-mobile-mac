import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ManolyaEmblem from "@/components/ManolyaEmblem";
import { useColors } from "@/hooks/useColors";

const KULLANIM_KOSULLARI = `KULLANIM KOŞULLARI

Son güncellenme: Mayıs 2026

Bu uygulamayı indirerek, yükleyerek veya kullanarak aşağıdaki kullanım koşullarının tamamını okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmektesiniz.

1. UYGULAMANIN AMACI VE KAPSAMI

Cildim uygulaması; kozmetik ürünlerin içerik bilgilerini ve genel cilt bakım rehberliğini kullanıcılara sunmak amacıyla hazırlanmış bir bilgi ve referans aracıdır. Uygulama bilgilendirici bir bakım rehberi sunar. Tıbbi teşhis, tedavi, reçete, klinik değerlendirme veya hekim muayenesi yerine geçmez.

2. SAĞLIK VE BAKIM REHBERLİĞİNE İLİŞKİN BİLGİLENDİRME

2.1. Bu uygulama dermatolojik hastalık teşhisi koymaz, tedavi planı oluşturmaz ve reçete önermez. Uygulamada yer alan hiçbir içerik tıbbi görüş ya da tıbbi tavsiye olarak yorumlanamaz.

2.2. Yara, enfeksiyon, hızla büyüyen ben veya leke, şiddetli akne, alerjik reaksiyon, ani kızarıklık, şişlik, yanma veya benzeri belirtilerin varlığında kullanıcının bir hekime başvurması önerilir.

2.3. Cilt hastalıkları, atopik dermatit, egzama, sedef hastalığı veya benzeri dermatolojik rahatsızlıkların yönetimi için yetkili bir hekim, dermatoloji uzmanı veya eczacıya danışılması esastır.

2.4. Uygulamada sunulan dermatolojik güvenlik puanları ve içerik analizleri; bilimsel literatür verilerine dayalı algoritmik değerlendirmelerdir. Bireysel cilt tipi, alerjik duyarlılık, sistemik hastalık durumu veya ilaç etkileşimleri kişisel olarak değerlendirilmediği için bu puanlar klinik muayene ya da uzman görüşünün yerine geçmez.

3. CİLT BAKIM PROFİLİ VE SONUÇLARIN DEĞİŞKENLİĞİ

Cilt bakım profili sonuçları; fotoğraf kalitesi, ışık koşulları, çekim açısı, cihaz kamerası, kullanıcı beyanı ve ürün verilerine bağlı olarak değişebilir. Sunulan değerlendirmeler kişiselleştirilmiş bakım rehberliği amacıyla üretilir; tıbbi tanı veya tedavi niteliği taşımaz.

4. ÜRÜN İÇERİKLERİNİN GÜNCELLİĞİ

Ürün içerikleri üretici tarafından zaman içinde değiştirilebilir. Kullanıcının, herhangi bir ürünü kullanmadan önce ambalajdaki güncel içerik listesini kontrol etmesi önerilir. Uygulamada yer alan ürün bilgileri üçüncü taraf kaynaklardan derlenmekte olup zaman içinde güncelliğini yitirmiş olabilir.

5. YENİ ÜRÜN KULLANIMI VE YAMA TESTİ (PATCH TEST)

5.1. Herhangi bir kozmetik ürünü ilk kez kullanmadan önce küçük bir cilt bölgesinde yama testi (patch test) yapılması önerilir.

5.2. Yama testi uygulaması: İlgili ürünü dirsek içi, kulak arkası veya ön kol gibi hassas bir cilt bölgesine az miktarda uygulayın ve 24–48 saat boyunca gözlemleyin. Herhangi bir kızarıklık, kaşıntı, yanma, şişme veya tahriş belirtisi görülmesi hâlinde ürünü durdurun ve gerektiğinde tıbbi yardım alın.

5.3. Yama testinin olumsuz sonuçlanmaması ürünün kesin güvenli olduğu anlamına gelmez; bazı reaksiyonlar gecikmeli ortaya çıkabilir. Alerji ve hassasiyet durumlarında patch test yapılması ve gerekli hâllerde hekim veya eczacı danışmanlığı alınması önerilir.

6. HAMİLELİK VE EMZİRME DÖNEMİ

Hamilelik ve emzirme dönemine ilişkin uygunluk bilgileri genel bilgilendirme niteliğindedir. Kullanıcının, bu dönemlerde herhangi bir ürünü kullanmadan önce hekim veya eczacı görüşü alması önerilir.

7. ÜRÜN VE RUTİN ÖNERİLERİNİN NİTELİĞİ

Uygulamadaki ürün ve rutin önerileri kesin uygunluk garantisi taşımaz. Öneriler; sistemsel puanlama, ürün verileri ve kullanıcı beyanlarına göre oluşturulan rehberlik niteliğindedir. Bu önerilerin kullanıcının cildine uygunluğu kişisel olarak değerlendirilmelidir.

8. KULLANIM RİSKİ VE SORUMLULUK SINIRI

8.1. Uygulamadan edinilen bilgiler bilgilendirme amaçlıdır. Bir kozmetik ürünün kullanılması ya da kullanılmaması yönündeki kararlar kullanıcının kendi tercihidir.

8.2. Cildim uygulaması bilgilendirici bir bakım rehberi sunar; tıbbi teşhis, tedavi, reçete, klinik değerlendirme veya hekim muayenesi yerine geçmez. Sunulan içeriklerin doğruluğu için makul özen gösterilmekle birlikte içeriklerin güncelliği ve eksiksizliği konusunda mutlak bir taahhüt verilemez.

8.3. Uygulamada incelenen kozmetik ürünler, üçüncü taraf firmalara ait bağımsız ürünlerdir. Uygulama bu ürünlerin üreticisi, distribütörü veya yetkili temsilcisi değildir.

9. ÇOCUKLAR İÇİN KULLANIM

Bu uygulama 18 yaş altındaki kişilerin kullanımına yönelik tasarlanmamıştır. 18 yaş altındaki kullanıcıların uygulamayı veli veya yasal vasi onayıyla kullanması gerekir.

10. FİKRİ MÜLKİYET

Uygulamada yer alan tüm içerikler, tasarımlar, algoritmalar, yazılı metinler ve grafikler fikri mülkiyet hukuku kapsamında koruma altındadır. İzinsiz çoğaltılması, dağıtılması veya ticari amaçla kullanılması yasaktır.

11. DEĞİŞİKLİK HAKKI

Uygulama sahibi, bu kullanım koşullarını güncelleme hakkını saklı tutar. Güncellenmiş koşullar uygulamada yayımlandığı tarihten itibaren geçerli olur.

12. UYGULANACAK HUKUK

Bu koşullar, Türkiye Cumhuriyeti yasaları çerçevesinde yorumlanır ve uygulanır. Doğacak her türlü uyuşmazlıkta Türkiye mahkemeleri yetkilidir.`;

const GIZLILIK_POLITIKASI = `GİZLİLİK POLİTİKASI

Son güncellenme: Mayıs 2026

1. ŞAHSÎ VERİ İŞLEME TAAHHÜDÜ

Cildim, kullanıcı gizliliğini en üst öncelik olarak kabul etmekte ve şahsî verilerin korunmasına ilişkin mevzuata uygun hareket etmeyi taahhüt etmektedir.

2. İŞLENEN VERİ TÜRLERİ

Uygulama, sunduğu hizmet kapsamında aşağıdaki veri türlerini işleyebilir:
- Ad-soyad / e-posta
- Cilt tipi
- Cilt endişeleri
- Bakım tercihleri
- Alerji beyanı
- Hamilelik / emzirme durumu
- Sağlık / hassasiyet beyanları
- Ürün favorileri
- Rutin tercihleri
- Uygulama kullanım bilgileri (kullanılan özellikler, arama terimleri, hata raporları)
- Cilt fotoğrafları

Üyelik oluşturulması hâlinde ad ve e-posta adresi toplanır. Taranan barkodlar ve ürün sorgularına ait veriler sisteme kaydedilebilir; bu veriler pazarlama amacıyla üçüncü taraflarla paylaşılmaz.

3. CİLT FOTOĞRAFLARI

Cilt fotoğrafları yalnızca kişiselleştirilmiş bakım önerisi, cilt profili oluşturma ve rutin önerisi amacıyla işlenir. Bu işlem tıbbi teşhis, tedavi, reçete veya hekim muayenesi yerine geçmez.

4. ÖZEL NİTELİKLİ VERİ İÇEREBİLECEK BEYANLAR

Alerji, hamilelik/emzirme ve sağlık/hassasiyet beyanları özel nitelikli kişisel veri içerebilir. Bu bilgiler yalnızca kullanıcının açık rızası, kişiselleştirme ve güvenli bakım önerileri sunma amacıyla işlenir.

5. VERİLERİN KULLANIMI

Toplanan veriler yalnızca şu amaçlarla kullanılır: (a) uygulama işlevlerinin sağlanması, (b) kullanıcı hesabının yönetimi, (c) kişiselleştirilmiş bakım ve rutin önerilerinin oluşturulması, (d) teknik hataların tespiti ve giderilmesi, (e) uygulama tecrübesinin iyileştirilmesi.

6. ÜÇÜNCÜ TARAF TEKNİK SAĞLAYICILAR

Şahsî verileriniz pazarlama amacıyla üçüncü taraflarla paylaşılmaz veya satılmaz. Hizmetin sunulabilmesi için aşağıdaki teknik hizmet sağlayıcılar kullanılmaktadır. Bu sağlayıcılarla yalnızca hizmetin sunulması için gerekli ölçüde, gizlilik ve güvenlik yükümlülükleri kapsamında veri paylaşımı yapılır:

- Supabase (ABD/AB veri merkezleri): Kullanıcı kimlik doğrulama, hesap yönetimi, veritabanı barındırma ve şifrelenmiş veri saklama hizmetleri.
- Resend: Hesap işlemleri, e-posta doğrulama ve bildirim e-postalarının kullanıcıya iletilmesi.
- Expo / EAS (uygulama dağıtımı): Uygulama güncellemeleri, hata raporu ve teknik tanılama süreçleri.
- Yapay zekâ analiz sağlayıcısı (Anthropic / OpenAI proxy): Cilt fotoğrafları ve bakım profili sorularına dayalı kişiselleştirilmiş bakım önerilerinin oluşturulmasında sınırlı işleme.

Yukarıdaki sağlayıcılar, kendilerine iletilen veriyi yalnızca hizmetin sunulabilmesi için ve sözleşme/yasal yükümlülükleri çerçevesinde işler. Pazarlama amaçlı veri satışı yapılmaz.

7. VERİ SAKLAMA, SİLME VE KULLANICI HAKLARI

7.1. Veri Saklama Süresi: Kullanıcı verileri, hesap aktif olduğu sürece ve hizmetin sağlanabilmesi için gerekli olan süre boyunca saklanır. Yasal saklama yükümlülüklerinin sona ermesinin ardından veriler silinir veya anonimleştirilir.

7.2. Hesap ve Veri Silme Talebi: Kullanıcı, hesabının ve kendisine ait verilerin silinmesini her zaman talep edebilir. Uygulama içinde "Ayarlar → Hesabı Sil" yolundan hesabını silebilir; ayrıca "Ayarlar → Cilt verilerimi ve rızamı sıfırla" seçeneğiyle hesabı korunarak yalnızca cilt profili, alerji, geçmiş ve rutin gibi bakım verilerini bu cihazdan temizleyebilir. Ek talepler için besnekfahri@gmail.com adresine yazılabilir; talep alındıktan sonra makul bir süre içinde veriler silinir veya anonim hâle getirilir.

7.3. Açık Rızanın Geri Çekilmesi: Açık rıza ile işlenen veriler için kullanıcı, rızasını her zaman geri çekme hakkına sahiptir. Rızanın geri çekilmesi, daha önce yapılmış işlemlerin hukuka uygunluğunu etkilemez.

7.4. Kullanıcı Hakları: Türkiye Cumhuriyeti 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında; verilerinize erişme, düzeltme, silme, işlemenin sınırlandırılmasını isteme, taşınabilirlik talep etme ve veri işlemeye itiraz etme haklarına sahipsiniz.

7.5. İletişim: Gizlilik ve veri hakları taleplerinizi şu iletişim adresine iletebilirsiniz: besnekfahri@gmail.com

8. 18 YAŞ ALTI KULLANIM

18 yaş altındaki kullanıcıların uygulamayı veli veya yasal vasi onayıyla kullanması gerekir. Uygulama, 18 yaş altı kullanıcılardan bilerek kişisel veri toplamayı amaçlamaz.

9. VERİ GÜVENLİĞİ

Kullanıcı verilerinin korunması için makul teknik ve idari güvenlik önlemleri uygulanır. Ancak internet ve dijital sistemler üzerinden yapılan hiçbir veri aktarımının mutlak güvenliği garanti edilemez.

10. ÇEREZLER VE TAKİP

Uygulama, mobil platformlarda üçüncü taraf reklam çerezi kullanmamaktadır.

11. İLETİŞİM

Gizlilik politikasına ilişkin sorularınız için iletişim adresimiz: besnekfahri@gmail.com`;

export default function SozlesmeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const botPad = Platform.OS === "web" ? 20 : insets.bottom;

  const [tab, setTab] = useState<"kullanim" | "gizlilik">("kullanim");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.surfaceCard }]}
            onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <ManolyaEmblem size={32} />
            <View>
              <Text style={[styles.appName, { color: colors.text }]}>Cildim</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>Yasal Belgeler</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.infoBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
          <Feather name="info" size={14} color="#92400E" />
          <Text style={[styles.infoText, { color: "#92400E" }]}>
            Bu belgeler uygulamanın kullanım koşullarını ve gizlilik politikasını içermektedir.
          </Text>
        </View>

        <View style={[styles.tabRow, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setTab("kullanim")}
            style={[styles.tabBtn, tab === "kullanim" && { backgroundColor: "#DC2626" }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, { color: tab === "kullanim" ? "#fff" : colors.textMuted }]}>Kullanım Koşulları</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("gizlilik")}
            style={[styles.tabBtn, tab === "gizlilik" && { backgroundColor: "#1D4ED8" }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, { color: tab === "gizlilik" ? "#fff" : colors.textMuted }]}>Gizlilik Politikası</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={true}
      >
        <Text style={[styles.docText, { color: colors.text }]}>
          {tab === "kullanim" ? KULLANIM_KOSULLARI : GIZLILIK_POLITIKASI}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 12, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          activeOpacity={0.8}
        >
          <Feather name="x" size={18} color={colors.textSecondary} />
          <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: 1 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  titleBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoEmoji: { fontSize: 26 },
  appName: { fontSize: 17, fontWeight: "800" as const },
  headerSub: { fontSize: 11, fontWeight: "600" as const, marginTop: 1 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1.5, borderRadius: 10, padding: 10 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  tabRow: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 3, gap: 3 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  tabBtnText: { fontSize: 12, fontWeight: "700" as const },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },
  docText: { fontSize: 13, lineHeight: 21, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  closeBtnText: { fontSize: 15, fontWeight: "600" as const },
});