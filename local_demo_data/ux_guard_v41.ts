import { type Concern } from "./products_v37";

export type EmptyStateCopy = {
  title: string;
  text: string;
  action: string;
};

export const SAFE_FLOW_NOTICES = {
  products: "Bu bölüm yerel ürün motoruyla çalışır. Sonuç bulunamazsa filtreler sıfırlanabilir.",
  scan: "Bu adım gerçek görsel işleme yapmaz. Önce güvenli akış, sonra gerçek tarama katmanı gelir.",
  analysis: "Analiz sonucu demo veriden üretilir; ürün ve rutin önerisine güvenli şekilde bağlanır.",
};

export function buildEmptyStateV41(params: {
  query: string;
  category: string;
  concern: Concern;
}): EmptyStateCopy {
  const hasQuery = params.query.trim().length > 0;
  const hasCategory = params.category !== "Tümü";

  if (hasQuery && hasCategory) {
    return {
      title: "Bu arama ve kategoriyle sonuç yok",
      text: `${params.concern} odağında daha geniş sonuç için arama metnini veya kategoriyi sıfırla.`,
      action: "Filtreleri sıfırla",
    };
  }

  if (hasQuery) {
    return {
      title: "Bu aramayla ürün bulunamadı",
      text: "Marka, ürün adı veya endişeyi daha kısa yazarak tekrar dene.",
      action: "Aramayı temizle",
    };
  }

  if (hasCategory) {
    return {
      title: "Bu kategoride uygun ürün yok",
      text: `${params.concern} odağında başka kategori seçerek devam edebilirsin.`,
      action: "Kategoriyi sıfırla",
    };
  }

  return {
    title: "Uygun ürün bulunamadı",
    text: "Endişe seçimini değiştirerek yeni öneri listesi oluştur.",
    action: "Filtreleri sıfırla",
  };
}
