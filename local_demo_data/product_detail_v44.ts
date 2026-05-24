import { type LocalProduct } from "./products_v37";

export type ProductDetailV44 = {
  headline: string;
  why: string[];
  usage: string;
  routineRole: string;
  caution: string;
};

export function buildProductDetailV44(product: LocalProduct): ProductDetailV44 {
  return {
    headline: `${product.brand} • ${product.category} • ${product.segment}`,
    why: [
      `${product.score} skor ile yerel demo listede güçlü seçenek olarak görünür.`,
      `${product.routineStep} adımında danışma dilini sadeleştirir.`,
      product.shortBenefit,
    ],
    usage: product.usage,
    routineRole: `${product.routineStep} adımı için ${product.category} kategorisinde konumlanır.`,
    caution: "Bu kart demo amaçlıdır; gerçek ürün verisi bağlanınca içerik, uygunluk ve kullanım notları ayrıntılanacaktır.",
  };
}

export function getScoreLabelV44(score: number) {
  if (score >= 90) return "Çok güçlü eşleşme";
  if (score >= 85) return "Güçlü eşleşme";
  if (score >= 80) return "Uygun eşleşme";
  return "Temel eşleşme";
}
