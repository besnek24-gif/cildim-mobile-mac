export const FINAL_READY_CARDS_V54 = [
  {
    title: "Ürün keşfi",
    text: "Katalog, ürün detayı, favori ve son bakılan ürün akışı birlikte çalışır.",
    target: "products",
  },
  {
    title: "Analiz + Tara",
    text: "Premium analiz paneli ve tarama timeline alanı test edilebilir durumdadır.",
    target: "analysis",
  },
  {
    title: "Rutin + Karar",
    text: "Sabah-akşam rutin, ürün kıyaslama ve karar cümlesi görsel kartlarla ilerler.",
    target: "routine",
  },
];

export const FINAL_TEST_AREAS_V54 = [
  "Ana ekran",
  "Ürün katalog",
  "Ürün detay",
  "Favori / son bakılan",
  "Rutin kaydı",
  "Premium analiz",
  "Tara timeline",
  "Karar rehberi",
  "Profil özeti",
];

export const FINAL_POLISH_NOTE_V54 = {
  title: "V54 TestFlight adayı",
  text: "Bu sürüm gerçek uygulama hissi için görsel kartlar, yerel durum, katalog, analiz, tarama, rutin ve profil akışlarını tek pakette toplar.",
  warning: "Uzak veri, hesap açma, ödeme ve gerçek görsel işleme bu adayda bilinçli olarak kapalıdır.",
};

export function getFinalAreaCountV54() {
  return FINAL_TEST_AREAS_V54.length;
}
