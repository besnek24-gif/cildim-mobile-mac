export type ProfileModeV47 = "Misafir" | "Seçkin hazırlık";
export type LocalModuleStatusV47 = {
  title: string;
  status: string;
  note: string;
};

export const PROFILE_MODES_V47: ProfileModeV47[] = ["Misafir", "Seçkin hazırlık"];

export const LOCAL_MODULE_STATUS_V47: LocalModuleStatusV47[] = [
  {
    title: "Ürün motoru",
    status: "Hazır demo",
    note: "Yerel ürün listesi arama, kategori ve endişe filtresiyle çalışır.",
  },
  {
    title: "Rutin",
    status: "Hazır demo",
    note: "Sabah-akşam ürünlü plan seçilen endişeye göre değişir.",
  },
  {
    title: "Analiz",
    status: "Hazır demo",
    note: "Cilt hissi, endişe ve rutin seviyesiyle sonuç dili üretir.",
  },
  {
    title: "Tara",
    status: "Güvenli önizleme",
    note: "Gerçek görsel işleme açılmadan önce ekran akışı test edilir.",
  },
  {
    title: "Karar rehberi",
    status: "Hazır demo",
    note: "Ürünleri skor, kategori ve segment diliyle kıyaslar.",
  },
];

export const MEMBERSHIP_PREVIEW_V47 = [
  "Gelişmiş analiz açıklamaları",
  "Daha ayrıntılı ürün gerekçeleri",
  "Rutin takibi ve bakım planı",
  "Karar rehberi genişletmeleri",
];

export function getProfileSummaryV47(mode: ProfileModeV47) {
  if (mode === "Seçkin hazırlık") {
    return {
      title: "Seçkin üyelik hazırlığı",
      text: "Bu aşama ödeme veya giriş açmaz; sadece üyelik ekran dilini ve değer önerisini güvenli biçimde gösterir.",
      badge: "Hazırlık",
    };
  }

  return {
    title: "Misafir görünümü",
    text: "Kişisel veri almadan ürün, rutin, analiz ve tarama demo akışları gezilebilir.",
    badge: "Güvenli",
  };
}
