/**
 * allergyDetector.ts — Ürün–Alerji Çakışma Tespiti
 *
 * Kullanıcının AllergyKey[] ve allergyIngredients[] alanlarını
 * ürünün içerik/özellik alanlarıyla karşılaştırır.
 *
 * Sonuç:
 *   "danger"  — bilinen alerjen doğrudan eşleşti (yüksek uyarı)
 *   "warning" — kaçınılan bileşen eşleşti (orta uyarı)
 *   null      — çakışma yok
 */

import type { AllergyKey } from "./userPreferences";
import type { Product } from "@/types/product";

// ─── AllergyKey → aranacak anahtar kelimeler ────────────────────────────────

const ALLERGY_KEYWORDS: Record<AllergyKey, string[]> = {
  fragrance:     ["fragrance", "parfum", "parfüm", "perfume", "linalool", "limonene", "citronellol", "geraniol", "coumarin", "eugenol"],
  alcohol:       ["alcohol denat", "ethanol", "isopropyl alcohol", "sd alcohol", "denatured alcohol"],
  essential_oil: ["essential oil", "esansiyel yağ", "tea tree", "lavender oil", "peppermint oil", "eucalyptus", "rosemary oil", "clary sage"],
  paraben:       ["methylparaben", "propylparaben", "butylparaben", "ethylparaben", "paraben"],
  silicone:      ["dimethicone", "cyclopentasiloxane", "cyclomethicone", "phenyl trimethicone", "silicone"],
  sulfate:       ["sodium lauryl sulfate", "sls", "sodium laureth sulfate", "sles", "ammonium lauryl sulfate"],
  nut:           ["almond oil", "walnut", "hazelnut oil", "macadamia", "shea butter", "arachis oil", "peanut"],
  latex:         ["latex", "natural rubber", "hevea brasiliensis"],
  lanolin:       ["lanolin", "wool wax", "wool alcohol", "adeps lanae"],
  gluten:        ["wheat", "barley extract", "oat", "hydrolyzed wheat", "hordeum vulgare"],
  nickel:        ["nickel"],
};

// ─── Ürün metin alanlarını birleştir ────────────────────────────────────────

function buildProductHaystack(product: Product): string {
  const fields = [
    (product as any).ingredients,
    (product as any).icerikler,
    (product as any).allergy_info,
    (product as any).alerji_bilgisi,
    (product as any).features,
    (product as any).ozellikler,
    product.description,
    (product as any).aciklama,
    product.name,
    (product as any).isim,
    product.category,
    (product as any).kategori,
  ];
  return fields
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ─── Ana tespit fonksiyonu ───────────────────────────────────────────────────

export type AllergyConflictLevel = "danger" | "warning" | null;

export interface AllergyConflict {
  level: AllergyConflictLevel;
  matchedTerms: string[];
}

export function detectAllergyConflict(
  product: Product,
  allergyKeys: AllergyKey[],
  allergyIngredients: string[],
  avoidedIngredients: string[],
): AllergyConflict {
  // ─── Defensive normalization (BUGFIX) ──────────────────────────────────────
  // Bazı callsite'lar bu fonksiyonu eski/eksik imzayla çağırabiliyor (örn.
  // tum-urunler.tsx 2 arg ile çağırıyor) → 3-4. paramlar `undefined` gelince
  // `for (const ing of allergyIngredients)` "Cannot convert undefined value
  // to object" hatasıyla render'ı çökertiyor. Engine logic'ini değiştirmeden
  // tüm array paramlarını array'e normalize ediyoruz; ayrıca `product` ve
  // `allergyKeys` için de en hafif additive guard.
  const safeProduct = product ?? ({} as Product);
  const safeAllergyKeys = Array.isArray(allergyKeys) ? allergyKeys : [];
  const safeAllergyIngredients = Array.isArray(allergyIngredients)
    ? allergyIngredients
    : [];
  const safeAvoidedIngredients = Array.isArray(avoidedIngredients)
    ? avoidedIngredients
    : [];

  const haystack = buildProductHaystack(safeProduct);
  const matchedTerms: string[] = [];

  // 1. Kayıtlı alerji bileşenleri (serbest metin) — "danger"
  for (const ing of safeAllergyIngredients) {
    if (typeof ing !== "string") continue;
    const term = ing.trim().toLowerCase();
    if (term.length >= 2 && haystack.includes(term)) {
      matchedTerms.push(ing);
    }
  }

  // 2. AllergyKey listesi — "danger"
  for (const key of safeAllergyKeys) {
    const keywords = ALLERGY_KEYWORDS[key] ?? [];
    for (const kw of keywords) {
      if (haystack.includes(kw.toLowerCase())) {
        matchedTerms.push(kw);
        break;
      }
    }
  }

  if (matchedTerms.length > 0) {
    return { level: "danger", matchedTerms: [...new Set(matchedTerms)] };
  }

  // 3. Kaçınılan bileşenler — "warning"
  const warnTerms: string[] = [];
  for (const ing of safeAvoidedIngredients) {
    if (typeof ing !== "string") continue;
    const term = ing.trim().toLowerCase();
    if (term.length >= 2 && haystack.includes(term)) {
      warnTerms.push(ing);
    }
  }

  if (warnTerms.length > 0) {
    return { level: "warning", matchedTerms: [...new Set(warnTerms)] };
  }

  return { level: null, matchedTerms: [] };
}
