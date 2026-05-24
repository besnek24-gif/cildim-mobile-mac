export const FINAL_READINESS_V48 = {
  title: "V48 TestFlight adayı",
  summary:
    "Bu paket yerel ürün motoru, rutin, analiz, tara önizleme, karar rehberi, profil/üyelik hazırlığı ve güvenli boş ekran korumalarını birlikte taşır.",
  warning:
    "Gerçek kamera, giriş sistemi, uzak veri bağlantısı ve canlı veri bu sürümde bilinçli olarak kapalıdır.",
};

export const FINAL_TEST_AREAS_V48 = [
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

export function getFinalReadinessCountV48() {
  return FINAL_TEST_AREAS_V48.length;
}
