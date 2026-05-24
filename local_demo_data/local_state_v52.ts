import { LOCAL_PRODUCTS, type Concern, type LocalProduct } from "./products_v37";

export type LocalStateSummaryV52 = {
  title: string;
  favoriteLine: string;
  recentLine: string;
  routineLine: string;
  status: string;
};

export function buildLocalStateSummaryV52(params: {
  favoriteCount: number;
  recentCount: number;
  savedRoutineConcern: Concern | null;
}): LocalStateSummaryV52 {
  return {
    title: "Yerel kullanım özeti",
    favoriteLine: `${params.favoriteCount} favori ürün`,
    recentLine: `${params.recentCount} son bakılan ürün`,
    routineLine: params.savedRoutineConcern
      ? `${params.savedRoutineConcern} rutini kaydedildi`
      : "Henüz rutin kaydı yok",
    status: params.favoriteCount || params.recentCount || params.savedRoutineConcern
      ? "Aktif kullanım simülasyonu"
      : "Yeni kullanıcı görünümü",
  };
}

export function buildRecentProductsV52(ids: string[]): LocalProduct[] {
  return ids
    .map((id) => LOCAL_PRODUCTS.find((item) => item.id === id))
    .filter(Boolean) as LocalProduct[];
}

export function buildFavoriteProductsV52(ids: string[]): LocalProduct[] {
  return ids
    .map((id) => LOCAL_PRODUCTS.find((item) => item.id === id))
    .filter(Boolean) as LocalProduct[];
}
