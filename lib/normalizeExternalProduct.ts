import type { Product } from "@/types/product";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeIngredients(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,•·;|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

export function normalizeExternalProduct(product: any): Product {
  const src = product ?? {};

  const id = asString(src.id) || (src.barcode ? `obf-${src.barcode}` : "");
  const barcode = asString(src.barcode);
  const name = asString(src.name) || asString(src.name_tr) || asString(src.product_name);
  const brand = asString(src.brand) || asString(src.brands);
  const category = asString(src.category) || "diger";
  const subcategory = asString(src.subcategory);
  const short_benefit = asString(src.short_benefit) || asString(src.short_description);
  const image_url =
    asString(src.image_url) ||
    asString(src.gorsel_url) ||
    asString(src.gorsel) ||
    asString(src.normalized_image_url) ||
    "";
  const thumbnail_url = asString(src.thumbnail_url) || image_url;

  const ingredients = normalizeIngredients(src.ingredients ?? src.icindekiler);
  const active_ingredients = normalizeIngredients(src.active_ingredients);

  const normalized: Record<string, any> = {
    ...src,
    id,
    barcode,
    name,
    brand,
    category,
    subcategory,
    short_benefit,
    image_url,
    thumbnail_url,
    ingredients,
    active_ingredients,
  };

  normalized.external_source = "obf";

  return normalized as Product;
}
