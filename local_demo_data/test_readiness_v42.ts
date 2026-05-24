export const TEST_SUMMARY_V42 = {
  title: "TestFlight hazırlık özeti",
  text: "Bu sürüm yerel ürün motoru, rutin, analiz, tarama önizlemesi, karar rehberi ve boş ekran korumalarını birlikte taşır.",
};

export const TEST_CHECKLIST_V42 = [
  "Uygulama açılışı",
  "Ana menü geçişleri",
  "Ürün arama ve filtreleme",
  "Rutin oluşturma",
  "Analiz sonucu yönlendirmesi",
  "Tarama önizleme akışı",
  "Karar rehberi",
  "Profil demo alanı",
  "Boş sonuç koruması",
];

export function getReadinessCountV42() {
  return TEST_CHECKLIST_V42.length;
}


export const TEST_SUMMARY_V43 = {
  title: "V48 TestFlight adayı",
  text: "Bu paket yerel ürün motoru, rutin, analiz, tara önizleme, karar rehberi, profil/üyelik hazırlığı ve güvenli boş ekran korumalarını birlikte taşır.",
};

export const TEST_CHECKLIST_V43 = [
  "Ana ekran ve hızlı giriş kartları",
  "Ürün arama / kategori / endişe filtresi",
  "Ürün detay ve neden önerildi alanı",
  "Rutin ekranı sabah-akşam planı",
  "Analiz ekranı sonuç ve yönlendirme kartları",
  "Tara ekranı büyük seçim kartları",
  "Karar rehberi ürün kıyaslama",
  "Profil ve Seçkin üyelik hazırlığı",
  "Boş arama sonucu koruması",
];

export function getReadinessCountV43() {
  return TEST_CHECKLIST_V43.length;
}
