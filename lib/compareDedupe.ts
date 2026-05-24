/**
 * compareDedupe.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Compare candidate dedupe helpers.
 *
 * Purpose:
 *   The compare candidate screen merges 3 layers (strict / similar / loose)
 *   into a single pool that then gets split into "Aynı Amaç" and
 *   "Alternatifler". Layer dedupe by id alone is not enough — Supabase has
 *   duplicate rows for the same product with different size variants
 *   (40 ml vs 200 ml) or near-identical names that arePairsCompatible's
 *   getBaseName guard misses when the rows are NOT same brand. We also
 *   need to defend against the current product leaking back as a candidate
 *   when it appears under a slightly different id.
 *
 * Scope:
 *   - PURE helpers; no Supabase / UI / scoring side effects.
 *   - Additive — does NOT touch pairKey, arePairsCompatible, sameRawCategory,
 *     similar/loose layer logic, or the search engine.
 *   - tr-TR aware normalization (NFD strip + Turkish letter folding).
 */

import type { Product } from "@/types/product";

/* ─── Text normalization ─────────────────────────────────────────────────── */

/**
 * tr-TR tolerant normalize: NFD-strip diacritics, fold Turkish letters,
 * lowercase, collapse whitespace. Mirrors the conventions used by the
 * compare screen's local search but is safe for use as a dedup key
 * fragment.
 *
 *   "La Roche-Posay  Lipikar Huile Lavante AP+"
 *     → "la roche-posay lipikar huile lavante ap+"
 */
export function normalizeCompareText(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

/* ─── Size token stripping ───────────────────────────────────────────────── */

/**
 * Strip volume / weight / count / pack tokens from a normalized name.
 * Mirrors the patterns used by lib/pairKey.ts#getBaseName but operates
 * on already-normalized text (lowercase, ascii-folded).
 *
 * Removes:
 *   - "(50 ml)", "(2 x 30 g)" — parenthesized variant blocks
 *   - "40 ml", "30gr", "100 g", "1 kg", "10 adet", "20 tablet", "30 pack",
 *     "50 mg", "5 cl", "200 cc"
 *   - "x 2", "× 3", "2x"
 *   - "30'lu", "50'li", "10'lü", "20'li" — Turkish package count suffixes
 */
export function stripSizeTokens(input: string): string {
  if (!input) return "";
  let s = input;

  // Parenthesized variant blocks containing a size token.
  s = s.replace(
    /\s*\([^)]*\b\d+(?:[.,]\d+)?\s*(?:ml|cc|cl|l|g|gr|gram|mg|kg|adet|tablet|kapsul|kapsül|pack|pcs|li|lı|lu|lü)[^)]*\)/gi,
    " ",
  );

  // Bare size: "40 ml", "200g", "30 gr", "1 kg", "50 mg", "10 adet", "20 tablet", "5 cl", "200 cc", "1 l"
  s = s.replace(
    /\s*\b\d+(?:[.,]\d+)?\s*(?:ml|cc|cl|l|g|gr|gram|mg|kg|adet|tablet|kapsul|kapsül|pack|pcs)\b\.?/gi,
    " ",
  );

  // Multiplier patterns: "x 2", "× 3", "2x"
  s = s.replace(/\s*\b[xX×]\s*\d+\b/g, " ");
  s = s.replace(/\b\d+\s*[xX×]\s+/g, " ");

  // Turkish package suffix: "30'lu", "50'li", "10'lü"
  s = s.replace(/\s*\b\d+\s*['’]?\s*(?:lu|lü|li|lı)\b/gi, " ");

  // Cleanup whitespace + trailing punctuation
  s = s.replace(/\s+/g, " ").replace(/[.,;:\-]+$/, "").trim();
  return s;
}

/* ─── Canonical dedup key ────────────────────────────────────────────────── */

type DedupeAble = {
  id?: string | number | null;
  brand?: string | null;
  marka?: string | null;
  name?: string | null;
  isim?: string | null;
};

/**
 * Build the canonical dedup key for a product.
 *
 *   key = `<normalized brand>::<normalized name with size tokens stripped>`
 *
 * Same brand + same base product but different size variants → same key.
 * Different brands with identical names → different keys (safe).
 * Empty inputs → "" (caller should fall back to id).
 *
 * Examples:
 *   { brand: "La Roche-Posay", name: "Lipikar Huile Lavante AP+ 400 ml" }
 *     → "la roche-posay::lipikar huile lavante ap+"
 *
 *   { brand: "La Roche-Posay", name: "Lipikar Huile Lavante AP+ 200 ml" }
 *     → "la roche-posay::lipikar huile lavante ap+"   (same key — variant)
 *
 *   { brand: "Bioderma", name: "Atoderm Huile de Douche 1 L" }
 *     → "bioderma::atoderm huile de douche"
 */
export function getCompareDedupeKey(p: DedupeAble | null | undefined): string {
  if (!p) return "";
  const brand = normalizeCompareText(p.brand ?? p.marka ?? "");
  const nameNormalized = normalizeCompareText(p.name ?? p.isim ?? "");
  const nameNoSize = stripSizeTokens(nameNormalized);
  if (!brand && !nameNoSize) return "";
  return `${brand}::${nameNoSize}`;
}

/* ─── Dedupe a candidate list ────────────────────────────────────────────── */

/**
 * Dedupe a list of compare candidates by BOTH id and canonical key
 * (brand+name without size tokens). Optionally exclude the current product
 * by id and canonical key.
 *
 * Order is preserved (first-seen wins) — callers can pre-sort by priority.
 *
 * @param items list of `{ product }` shaped candidates (Layer 0/1/3 mix)
 * @param currentProduct optional — excluded by id AND canonical key
 * @returns deduped list (same order)
 */
export function dedupeCompareProducts<T extends { product: Product | DedupeAble }>(
  items: T[],
  currentProduct?: DedupeAble | null,
): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  if (currentProduct) {
    const curId = String(currentProduct.id ?? "").trim().toLowerCase();
    if (curId) seenIds.add(curId);
    const curKey = getCompareDedupeKey(currentProduct);
    if (curKey) seenKeys.add(curKey);
  }

  const out: T[] = [];
  for (const item of items) {
    const p = item?.product as DedupeAble | undefined;
    if (!p) continue;
    const id = String(p.id ?? "").trim().toLowerCase();
    const key = getCompareDedupeKey(p);
    if (id && seenIds.has(id)) continue;
    if (key && seenKeys.has(key)) continue;
    if (id) seenIds.add(id);
    if (key) seenKeys.add(key);
    out.push(item);
  }
  return out;
}
