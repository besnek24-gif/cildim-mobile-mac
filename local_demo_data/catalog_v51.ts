import { LOCAL_PRODUCTS, PRODUCT_CATEGORIES, type Concern, type LocalProduct, type ProductCategory } from "./products_v37";

export type CatalogCategoryV51 = {
  title: ProductCategory;
  count: number;
  topProduct: LocalProduct;
  scoreAverage: number;
};

export type ProductInsightV51 = {
  headline: string;
  reason: string;
  usage: string;
  routineRole: string;
  decisionScore: string;
  tags: string[];
};

export function getCatalogCategoriesV51(): CatalogCategoryV51[] {
  return PRODUCT_CATEGORIES
    .filter((category): category is ProductCategory => category !== "Tümü")
    .map((category) => {
      const products = LOCAL_PRODUCTS.filter((item) => item.category === category);
      const topProduct = [...products].sort((a, b) => b.score - a.score)[0] ?? LOCAL_PRODUCTS[0];
      const scoreAverage = products.length
        ? Math.round(products.reduce((sum, item) => sum + item.score, 0) / products.length)
        : topProduct.score;

      return {
        title: category,
        count: products.length,
        topProduct,
        scoreAverage,
      };
    });
}

export function buildProductInsightV51(product: LocalProduct, concern: Concern): ProductInsightV51 {
  return {
    headline: `${product.brand} ${product.category} kategorisinde ${concern} odağına yakın duruyor.`,
    reason: `${product.shortBenefit} Skoru ${product.score}; bu yüzden demo katalog içinde öne çıkan seçeneklerden biri.`,
    usage: product.usage,
    routineRole: `${product.routineStep} adımında konumlanır. Rutin içinde sade ve anlaşılır bir rol üstlenir.`,
    decisionScore: product.score >= 90 ? "Çok güçlü eşleşme" : product.score >= 85 ? "Güçlü eşleşme" : "Uygun eşleşme",
    tags: [product.category, product.segment, product.routineStep, `${product.score} skor`],
  };
}

export function getConcernShowcaseV51(concern: Concern) {
  const pool = LOCAL_PRODUCTS
    .filter((item) => item.concern.includes(concern))
    .sort((a, b) => b.score - a.score);

  return {
    title: `${concern} vitrini`,
    subtitle: `${pool.length} ürün bu endişeyle ilişkilendirildi.`,
    products: pool.slice(0, 4),
  };
}
