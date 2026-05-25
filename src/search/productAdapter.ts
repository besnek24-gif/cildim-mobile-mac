import type { Product } from "@/types/product";

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,\n;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function adaptLegacyProduct(input: any): Product {
  const p = input ?? {};

  const image =
    firstString(
      p.image_url,
      p.imageUrl,
      p.thumbnail_url,
      p.thumbnailUrl,
      p.image,
      p.photo,
      p.photo_url
    ) || "";

  const name = firstString(p.name, p.title, p.product_name, p.productName);
  const brand = firstString(p.brand, p.brand_name, p.brandName);

  return {
    ...p,
    id: p.id ?? p.barcode ?? p.sku ?? `${brand}-${name}`,
    name,
    brand,
    category: firstString(p.category, p.main_category, p.mainCategory),
    subcategory: firstString(p.subcategory, p.sub_category, p.subCategory),
    segment: firstString(p.segment, p.price_segment, p.priceSegment),
    image_url: image,
    imageUrl: image,
    thumbnail_url: firstString(p.thumbnail_url, p.thumbnailUrl, image),
    thumbnailUrl: firstString(p.thumbnailUrl, p.thumbnail_url, image),
    short_description: firstString(
      p.short_description,
      p.shortDescription,
      p.description,
      p.summary
    ),
    shortDescription: firstString(
      p.shortDescription,
      p.short_description,
      p.description,
      p.summary
    ),
    short_benefit: firstString(
      p.short_benefit,
      p.shortBenefit,
      p.benefit,
      p.primary_benefit
    ),
    shortBenefit: firstString(
      p.shortBenefit,
      p.short_benefit,
      p.benefit,
      p.primary_benefit
    ),
    full_description: firstString(
      p.full_description,
      p.fullDescription,
      p.long_description,
      p.description
    ),
    benefits: Array.isArray(p.benefits) ? p.benefits : toArray(p.benefits),
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : toArray(p.ingredients),
    rating: p.rating ?? p.score ?? undefined,
    score: toNumber(p.score ?? p.dermo_score ?? p.rating, 0),
    badges: Array.isArray(p.badges) ? p.badges : toArray(p.badges),
    features: p.features && typeof p.features === "object" ? p.features : {},
  };
}

export function adaptLegacyProducts(products: any[] = []): Product[] {
  return products.map(adaptLegacyProduct);
}

export function getProductSearchText(product: any): string {
  const p = adaptLegacyProduct(product);
  return [
    p.name,
    p.brand,
    p.category,
    p.subcategory,
    p.short_description,
    p.short_benefit,
    Array.isArray(p.benefits) ? p.benefits.join(" ") : p.benefits,
    Array.isArray(p.badges) ? p.badges.join(" ") : p.badges,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

export function semanticProductMatch(product: any, query?: string): boolean {
  const q = String(query ?? "").trim().toLocaleLowerCase("tr-TR");
  if (!q) return true;
  return getProductSearchText(product).includes(q);
}

export function semanticSearch(products: any[] = [], query?: string): Product[] {
  return products
    .map(adaptLegacyProduct)
    .filter((product) => semanticProductMatch(product, query));
}

export default adaptLegacyProduct;
