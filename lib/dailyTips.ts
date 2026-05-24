/**
 * Günün Notu — V2: 30 küratörlü içerik, GÜNDE 1 rotasyon
 *
 * Rotasyon: Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % GUNUN_IPUCLARI.length
 * → Her 24 saatte otomatik değişir, 30 içerik döngüsel devam eder
 * → N=30 + günde-1 rotasyon → matematiksel olarak ardışık 30 gün
 *   içinde aynı tip TEKRARLANMAZ.
 * → Deterministic (random değil), aynı gün içinde sabit kalır
 *
 * Kategori dağılımı (round-robin): SPF, Nemlendirme, Aktif Bileşen,
 * Temizlik, Gece Rutini, Cilt Tipi, Bileşen Okuma, Yaygın Hata,
 * Motivasyon — ardışık günlerde aynı kategori arka arkaya gelmez.
 *
 * Katmanlar: title · text (bilgi) · microAction (mikro eylem)
 * productMode: "match" (default) | "none" (kavramsal — ürün gösterilmez)
 */

export type DailyTip = {
  icon: string;
  title: string;
  text: string;
  microAction: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  border: string;
  category: "rutin" | "bilgi" | "uyarı" | "motivasyon";
  keywords?: string[];
  // SAFE TIP FIX — opsiyonel ürün eşleme modu.
  // "match" (varsayılan) → mevcut keyword tabanlı eşleme çalışır.
  // "none"               → kavramsal/motivasyonel tip; detay sayfasında
  //                        "ilgili ürünler" bölümü HİÇ render edilmez.
  // Geriye uyumluluk: alan opsiyoneldir, undefined = "match" davranışı.
  productMode?: "match" | "none";
};

// ── Renk temaları (yeniden kullanılabilir) ──────────────────────────────────
const AMBER  = { bg: "#FFFBEB", iconBg: "#F59E0B", iconColor: "#fff", titleColor: "#92400E", border: "#FCD34D" };
const BLUE   = { bg: "#EFF6FF", iconBg: "#2563EB", iconColor: "#fff", titleColor: "#1E40AF", border: "#93C5FD" };
const PURPLE = { bg: "#F5F3FF", iconBg: "#7C3AED", iconColor: "#fff", titleColor: "#5B21B6", border: "#C4B5FD" };
const GREEN  = { bg: "#ECFDF5", iconBg: "#059669", iconColor: "#fff", titleColor: "#065F46", border: "#6EE7B7" };
const ORANGE = { bg: "#FFF7ED", iconBg: "#D97706", iconColor: "#fff", titleColor: "#78350F", border: "#FBD38D" };
const RED    = { bg: "#FFF1F2", iconBg: "#E11D48", iconColor: "#fff", titleColor: "#9F1239", border: "#FECDD3" };
const TEAL   = { bg: "#F0FDFA", iconBg: "#0D9488", iconColor: "#fff", titleColor: "#0F766E", border: "#99F6E4" };
const INDIGO = { bg: "#EEF2FF", iconBg: "#4F46E5", iconColor: "#fff", titleColor: "#3730A3", border: "#C7D2FE" };
const PINK   = { bg: "#FCE7F3", iconBg: "#DB2777", iconColor: "#fff", titleColor: "#9D174D", border: "#F9A8D4" };
const SLATE  = { bg: "#F8FAFC", iconBg: "#475569", iconColor: "#fff", titleColor: "#1E293B", border: "#CBD5E1" };

// ── 30 küratörlü içerik (round-robin kategori dağılımı) ─────────────────────
// Sıra: ardışık günlerde aynı kategori arka arkaya gelmesin diye
// SPF → Nemlendirme → Aktif → Temizlik → Gece → Cilt Tipi → Bileşen Okuma →
// Yaygın Hata → Motivasyon döngüsü kullanılır. 30 gün boyunca aynı tip
// bir kez gözükür, 31. günde döngü baştan başlar.
//
// Kelime ve metinler audit'teki onaylı 30 listesinden BİREBİR korunmuştur.
// "none" işaretli 11 tip (kavramsal/öğretici/motivasyon) detay sayfasında
// "ilgili ürünler" bölümünü göstermez.
export const GUNUN_IPUCLARI: DailyTip[] = [

  // ── Cycle 1 (gün 1–9) ───────────────────────────────────────────────────
  {
    // 1 · SPF
    ...AMBER, icon: "sun", category: "rutin",
    title: "Güneş Koruması",
    text: "SPF 50+ faktörlü güneş kremi, bulutlu havalarda bile vazgeçilmeziniz olsun.",
    microAction: "Bugün makyajdan önce SPF'ini sür — bunu alışkanlık haline getir.",
    keywords: ["spf", "sunscreen", "güneş kremi", "uv", "zinc oxide", "titanium dioxide"],
  },
  {
    // 2 · Nemlendirme
    ...BLUE, icon: "droplet", category: "rutin",
    title: "Derin Nemlendirme",
    text: "Hyaluronik asit serumunu hafif nemli cilde sür — kuru ortamda cildin kendi nemini çekebilir.",
    microAction: "Bu akşam serumu banyodan çıkar çıkmaz, henüz nemli cilde uygula.",
    keywords: ["hyaluronic", "hyaluron", "sodium hyaluronate"],
  },
  {
    // 3 · Aktif
    ...PURPLE, icon: "moon", category: "rutin",
    title: "Gece Aktif Bileşenler",
    text: "Retinol ve AHA asitler akşam uygulaması için idealdir — gece onarım döngüsüyle sinerji kurar.",
    microAction: "Bu akşam retinolünü ya da AHA asitini kullan, sabahı değil.",
    keywords: ["retinol", "aha", "glycolic acid", "salicylic acid"],
  },
  {
    // 4 · Temizlik
    ...GREEN, icon: "wind", category: "rutin",
    title: "Çift Temizleme",
    text: "Önce yağ bazlı temizleyici (makyajı çözer), ardından su bazlı (cildi gerçekten temizler).",
    microAction: "Bu akşam çift temizleme yöntemini dene: önce yağ, sonra su.",
    keywords: ["cleansing oil", "temizleme yağı", "micellar"],
  },
  {
    // 5 · Gece
    ...PURPLE, icon: "moon", category: "bilgi",
    title: "Gece Onarım Zirvesi",
    text: "Gece 22:00–02:00 arası cilt onarımı doruk noktasında. En aktif ürünlerini bu süreç için kullan.",
    microAction: "Bu gece en aktif ürününü 22:00'dan önce uygula.",
    productMode: "none",
  },
  {
    // 6 · Cilt Tipi
    ...PINK, icon: "info", category: "bilgi",
    title: "Kuru ≠ Hassas",
    text: "Kuru cilt (az sebum) ile hassas cilt (bariyer zayıflığı) farklı sorunlardır, farklı çözüm gerektirir.",
    microAction: "Cildinizin şikayetini tanımla: nem eksikliği mi, reaktivite mi?",
    productMode: "none",
  },
  {
    // 7 · Bileşen Okuma
    ...INDIGO, icon: "book", category: "bilgi",
    title: "İlk 5 Bileşen Kuralı",
    text: "Bileşen listesindeki ilk 5 madde ürünün yaklaşık %80'ini oluşturur. Gerçek formülasyonu buradan oku.",
    microAction: "Elinizdeki bir ürünün ilk 5 bileşenini bugün oku.",
    productMode: "none",
  },
  {
    // 8 · Yaygın Hata
    ...INDIGO, icon: "info", category: "bilgi",
    title: "İyi Alkol, Kötü Alkol",
    text: "Fatty alcohols (cetearyl, stearyl) nemlendiricidir; ethanol ve denat kurutucudur — ikisini karıştırma.",
    microAction: "Ürünündeki 'alcohol' türünü kontrol et: fatty mi, ethanol mi?",
    keywords: ["alcohol", "ethanol", "cetearyl", "cetyl"],
  },
  {
    // 9 · Motivasyon
    ...GREEN, icon: "clock", category: "motivasyon",
    title: "12 Hafta Sabret",
    text: "Herhangi bir cilt ürününe adil şans tanımak için minimum 12 haftalık düzenli kullanım gereklidir.",
    microAction: "Yeni bir ürün başlattıysan başlangıç tarihini not et ve 12 hafta bekle.",
    productMode: "none",
  },

  // ── Cycle 2 (gün 10–18) ─────────────────────────────────────────────────
  {
    // 10 · SPF
    ...AMBER, icon: "sun", category: "bilgi",
    title: "UVA Kışın da Aktif",
    text: "Bulutlar UV ışınımını durdurmaz. UVA yılın 365 günü cilt bariyerini etkiler.",
    microAction: "Sabah rutinine kış günü de SPF ekle — mevsim fark etmez.",
    productMode: "none",
  },
  {
    // 11 · Nemlendirme
    ...BLUE, icon: "droplet", category: "rutin",
    title: "Doğru Uygulama Anı",
    text: "Nemlendiricinin en verimli anı: duştan hemen sonra, henüz nemli cilt üzerine uygulamak.",
    microAction: "Bugün duş sonrası 30 saniye içinde nemlendiricini sür.",
  },
  {
    // 12 · Aktif
    ...PURPLE, icon: "zap", category: "bilgi",
    title: "Retinol + Niasinamid",
    text: "Retinol ile niasinamidi aynı gece kullanabilirsin. Bu kombinasyon hem güvenli hem güçlüdür.",
    microAction: "Bu gece retinolden önce niasinamid serum uygula.",
    keywords: ["retinol", "niacinamide", "niasinamid"],
  },
  {
    // 13 · Temizlik
    ...GREEN, icon: "clock", category: "rutin",
    title: "60 Saniye Kuralı",
    text: "Temizleyiciyi yüzde en az 60 saniye tut — bu süre temizleme etkinliğini anlamlı ölçüde artırır.",
    microAction: "Bu gece temizleyiciyi tam 60 saniye tut ve farkı hisset.",
  },
  {
    // 14 · Gece
    ...BLUE, icon: "shield", category: "bilgi",
    title: "Slugging Tekniği",
    text: "Çok kuru ciltler için gece son katman petrolatum (slugging) uygulaması güçlü bir bariyer onarım yöntemidir.",
    microAction: "Çok kuru hissediyorsan bu gece son katman olarak bir damla bitki yağı dene.",
    keywords: ["vaseline", "petrolatum", "slugging"],
  },
  {
    // 15 · Cilt Tipi
    ...RED, icon: "alert-triangle", category: "uyarı",
    title: "Akne = Yağlı Cilt Değil",
    text: "Kuru ve hassas ciltler de akneli olabilir. Akneyi yalnızca yağlı cilt sorunu olarak sınıflandırmak hatalı bakıma yol açar.",
    microAction: "Aknen varsa nemlendiriciden vazgeçme — aksine hafif formül seç.",
    productMode: "none",
  },
  {
    // 16 · Bileşen Okuma
    ...RED, icon: "alert-triangle", category: "uyarı",
    title: "Fragrance Siyah Kutu",
    text: "'Fragrance/Parfum' etiketi binlerce potansiyel allerjen barındırabilir. Hassas ciltler için parfümsüz tercih et.",
    microAction: "Bileşen listesinde 'fragrance' varsa hassas cildin için risklidir.",
  },
  {
    // 17 · Yaygın Hata
    ...RED, icon: "alert-triangle", category: "uyarı",
    title: "Kozmetik İlaç Değildir",
    text: "Bir kozmetik ürün, hastalıkları kesin çözdüğünü söylüyorsa temkinli yaklaş.",
    microAction: "Kesin sonuç vaat eden üründe önce INCI listesini oku.",
    productMode: "none",
  },
  {
    // 18 · Motivasyon
    ...TEAL, icon: "check-circle", category: "motivasyon",
    title: "3 Ürün Yeterli Başlangıç",
    text: "Sabah ve akşam rutini 3 temel ürünle kurulabilir: temizleyici, nemlendirici ve SPF. Geri kalanı sonra gelir.",
    microAction: "Rutinini 3 temel ürüne indirgemeyi dene — ne kadar basitleşiyor bak.",
    productMode: "none",
  },

  // ── Cycle 3 (gün 19–27) ─────────────────────────────────────────────────
  {
    // 19 · SPF
    ...AMBER, icon: "shield", category: "bilgi",
    title: "Mineral SPF Avantajı",
    text: "Çinko oksit bazlı mineral güneş kremleri hassas ve akne eğilimli ciltler için ilk tercihtir.",
    microAction: "Sıradaki SPF alışverişinde 'zinc oxide' içeriği ara.",
    keywords: ["zinc oxide", "çinko oksit", "mineral spf"],
  },
  {
    // 20 · Nemlendirme
    ...BLUE, icon: "layers", category: "bilgi",
    title: "Bariyer Formülü",
    text: "Seramid + kolesterol + yağ asidi üçlüsü cilt bariyerinin biyolojik yapısına en yakın kombinasyondur.",
    microAction: "Nemlendiricinin bileşen listesinde 'ceramide' kelimesini ara.",
    keywords: ["ceramide", "seramid"],
  },
  {
    // 21 · Aktif
    ...ORANGE, icon: "star", category: "rutin",
    title: "C Vitamini Sabah",
    text: "C vitamini serumu sabah uygulamasında en değerlidir — antioksidan koruması UV hasarını nötralize eder.",
    microAction: "Yarın sabah serumunu C vitaminiyle başlat, güne antioksidan zırhıyla gir.",
    keywords: ["vitamin c", "ascorbic acid", "askorbik asit"],
  },
  {
    // 22 · Temizlik
    ...GREEN, icon: "alert-circle", category: "uyarı",
    title: "SLS Bariyer Hasarı",
    text: "SLS içeren temizleyiciler cilt pH dengesini bozar ve uzun vadede bariyer hasarına zemin hazırlayabilir.",
    microAction: "Temizleyicinin bileşenlerinde 'sodium lauryl sulfate' var mı? Kontrol et.",
    keywords: ["sls", "sodium lauryl sulfate"],
  },
  {
    // 23 · Gece
    ...RED, icon: "alert-circle", category: "uyarı",
    title: "Makyajla Asla Uyuma",
    text: "Makyaj üzerine uyumak bir gecelik oxidatif stres ve gözenek tıkanıklığı zinciridir — istisnasız temizle.",
    microAction: "Bu gece uyumadan önce mutlaka yüzünü temizle — istisna yok.",
    productMode: "none",
  },
  {
    // 24 · Cilt Tipi
    ...BLUE, icon: "info", category: "bilgi",
    title: "Dehidre Cilt ≠ Kuru Cilt",
    text: "Dehidrasyon (nem eksikliği) geçici bir durumdur ve her cilt tipinde görülebilir.",
    microAction: "Bugün 1.5 litre su içmeyi hedefle — cilt içeriden de nem alır.",
    productMode: "none",
  },
  {
    // 25 · Bileşen Okuma
    ...INDIGO, icon: "clock", category: "bilgi",
    title: "pH Bekleme Süresi",
    text: "C vitamini veya AHA/BHA uyguladıktan sonra 20-30 dakika beklemek aktif bileşenin etkinliğini artırır.",
    microAction: "C vitamini veya asit serum sonrası 20-30 dakika bekle, sonra devam et.",
    keywords: ["vitamin c", "aha", "bha", "glycolic", "salicylic"],
  },
  {
    // 26 · Aktif (yedek slot — Yaygın Hata sonrası 9. tipe kalmadığı için
    //              dağılımı bozmadan 5. aktif tip buraya yerleştirildi)
    ...GREEN, icon: "activity", category: "bilgi",
    title: "Niasinamid Çok Amaçlı",
    text: "Niasinamid akne, leke ve bariyer bozukluğu için aynı anda etki eden nadir bileşenlerden biridir.",
    microAction: "Rutininde %5+ niasinamid içeren bir ürün var mı? Yoksa araştır.",
    keywords: ["niacinamide", "niasinamid", "vitamin b3"],
  },
  {
    // 27 · Motivasyon
    ...TEAL, icon: "award", category: "motivasyon",
    title: "Sürdürülebilir Rutin Kazanır",
    text: "En pahalı ürün tutarsız kullanımı telafi edemez. En iyi rutin, sürdürebileceğin rutindir.",
    microAction: "Karmaşık rutinini sadeleştir — bugün atlanabilecek adımı çıkar.",
    productMode: "none",
  },

  // ── Cycle 4 (gün 28–30) — kategori artıklarıyla kapanış ────────────────
  {
    // 28 · SPF
    ...AMBER, icon: "refresh-cw", category: "rutin",
    title: "SPF Yenileme",
    text: "Her 2 saatte bir SPF yenilenmeli. Makyaj üzerine için spray veya toz formatlı kullanabilirsin.",
    microAction: "Bugün öğlen saatinde SPF tazelemek için hatırlatıcı kur.",
    productMode: "match",
    // Ecz4 — Daily Tip Relevance Fix: format/genel kelimeler ("spray", "toz",
    // "stick") çıkarıldı; substring match'te hair spray / lipstick / powder
    // gibi SPF olmayan ürünleri yanlışlıkla yakalıyorlardı. Yalnızca intent
    // keyword'leri korundu.
    keywords: [
      "spf",
      "güneş",
      "gunes",
      "güneş koruyucu",
      "gunes koruyucu",
      "sunscreen",
      "uv",
      "sun protection",
    ],
  },
  {
    // 29 · Nemlendirme
    ...BLUE, icon: "zap", category: "bilgi",
    title: "Gliserin Gücü",
    text: "Gliserin hem çek hem tut mekanizmasıyla çalışan, etkinliği klinik olarak kanıtlanmış uygun fiyatlı bir hümektandır.",
    microAction: "İlk 3 bileşende 'glycerin' varsa ürün iyi bir hümektandır.",
    keywords: ["glycerin", "gliserin"],
  },
  {
    // 30 · Aktif
    ...PURPLE, icon: "activity", category: "rutin",
    title: "Retinol Basamak Protokolü",
    text: "Retinol konsantrasyonunu yavaş artır: %0.025 → %0.05 → %0.1 → %0.3, her aşamada 4-6 hafta bekle.",
    microAction: "Retinol konsantrasyonunu not et — bir sonraki basamağa hazır mısın?",
    keywords: ["retinol", "retinal", "tretinoin"],
  },
];

/**
 * Bugün gösterilecek ipucunu döndürür.
 * V2: 24 saatlik (günde 1) deterministik rotasyon. N=30 + 24h ile
 * ardışık 30 gün içinde aynı tip tekrarlanmaz.
 */
export function getCurrentTip(): DailyTip {
  const idx = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % GUNUN_IPUCLARI.length;
  return GUNUN_IPUCLARI[idx];
}

/**
 * Kategorinin Türkçe etiketini döndürür.
 */
export function getCategoryLabel(cat: DailyTip["category"]): string {
  const map: Record<DailyTip["category"], string> = {
    rutin:      "Rutin",
    bilgi:      "İçerik Bilgisi",
    uyarı:      "Uyarı",
    motivasyon: "Motivasyon",
  };
  return map[cat];
}
