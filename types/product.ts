export type Product = {
  id?: string | number;
  name?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  segment?: string;
  image_url?: string | null;
  imageUrl?: string | null;
  thumbnail_url?: string | null;
  thumbnailUrl?: string | null;
  short_description?: string;
  shortDescription?: string;
  short_benefit?: string;
  shortBenefit?: string;
  full_description?: string;
  benefits?: string | string[];
  ingredients?: string | string[];
  rating?: number | string;
  score?: number;
  badges?: string[];
  features?: Record<string, unknown>;
  [key: string]: unknown;
};

export function resolveImageUrl(product?: Product | null): string {
  if (!product) return "";
  return (
    (product.image_url as string) ||
    (product.imageUrl as string) ||
    (product.thumbnail_url as string) ||
    (product.thumbnailUrl as string) ||
    ""
  );
}

export function resolveThumbnailUrl(product?: Product | null): string {
  if (!product) return "";
  return (
    (product.thumbnail_url as string) ||
    (product.thumbnailUrl as string) ||
    (product.image_url as string) ||
    (product.imageUrl as string) ||
    ""
  );
}

export function getProductTitle(product?: Product | null): string {
  if (!product) return "";
  return [product.brand, product.name].filter(Boolean).join(" ").trim();
}

export default Product;
