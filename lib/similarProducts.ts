/**
 * similarProducts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Akıllı benzer ürün öneri motoru.
 *
 * Sıralama:
 *  1. Önerilen  — en yüksek similarity skoru (SADECE 1 tane işaretlenir)
 *  2. Aynı segment
 *  3. Ekonomik alternatif
 *  4. Premium alternatif
 *  5. Diğer
 */

import type { NormalizedProduct } from "./normalizeProduct";
import { normalizeProductData } from "./normalizeProduct";
import type { Product } from "@/types/product";

// ── Segment sıralaması ────────────────────────────────────────────────────────
const SEG_RANK: Record<string, number> = {
  ekonomik:    0,
  profesyonel: 1,
  seçkin:      2,
};

// ── Bölüm başlığı ─────────────────────────────────────────────────────────────

const CATEGORY_TITLE_MAP: Record<string, string> = {
  "güneş":        "Güneş koruması için alternatifler",
  "sunscreen":    "Güneş koruması için alternatifler",
  "spf":          "Güneş koruması için alternatifler",
  "nemlendirici": "Nemlendirme için alternatifler",
  "moisturizer":  "Nemlendirme için alternatifler",
  "moisturising": "Nemlendirme için alternatifler",
  "acne":         "Akne için alternatifler",
  "akne":         "Akne için alternatifler",
  "sivilce":      "Akne için alternatifler",
  "temizleyici":  "Cilt temizleme için alternatifler",
  "cleanser":     "Cilt temizleme için alternatifler",
  "serum":        "Serum alternatifleri",
  "toner":        "Toner alternatifleri",
  "krem":         "Krem alternatifleri",
  "cream":        "Krem alternatifleri",
  "şampuan":      "Saç bakımı için alternatifler",
  "shampoo":      "Saç bakımı için alternatifler",
  "bebek":        "Bebek bakımı için alternatifler",
  "baby":         "Bebek bakımı için alternatifler",
  "yağ":          "Yağ alternatifleri",
  "oil":          "Yağ alternatifleri",
};

export function resolveSectionTitle(
  category: string | null,
  shortBenefit: string | null,
): string {
  const haystack = [category, shortBenefit]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const [key, title] of Object.entries(CATEGORY_TITLE_MAP)) {
    if (haystack.includes(key)) return title;
  }

  if (category) {
    const cat = category.trim();
    return `${cat.charAt(0).toUpperCase()}${cat.slice(1)} alternatifleri`;
  }
  return "Alternatif ürünler";
}

// ── Yardımcı ──────────────────────────────────────────────────────────────────

function containsAny(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some(w => t.includes(w));
}

// ── Fark etiketi ──────────────────────────────────────────────────────────────

export function resolveDifferentiatorLabel(
  current: NormalizedProduct,
  candidate: NormalizedProduct,
): string {
  const curRank  = SEG_RANK[current.segment   ?? ""] ?? -1;
  const candRank = SEG_RANK[candidate.segment ?? ""] ?? -1;

  if (curRank !== -1 && candRank !== -1) {
    const diff = candRank - curRank;
    if (diff < -1) return "Çok daha ekonomik seçenek";
    if (diff === -1) return "Daha ekonomik seçenek";
    if (diff > 1)  return "Çok daha premium alternatif";
    if (diff === 1) return "Daha yoğun etki";
  }

  const candText = [
    candidate.name,
    candidate.shortBenefit,
    candidate.description,
    candidate.brand,
  ].filter(Boolean).join(" ");

  const curText = [
    current.name,
    current.shortBenefit,
    current.description,
  ].filter(Boolean).join(" ");

  if (
    containsAny(candText, ["parfümsüz", "fragrance-free", "parfüm içermeyen"]) &&
    !containsAny(curText, ["parfümsüz", "fragrance-free"])
  ) return "Parfümsüz alternatif";

  if (containsAny(candText, ["hassas", "sensitive", "hassas cilt"]))
    return "Hassas ciltler için daha uygun";

  if (containsAny(candText, ["vegan", "cruelty-free", "hayvansal içermez"]))
    return "Vegan & etik alternatif";

  if (
    containsAny(candText, ["bebek", "baby", "çocuk"]) &&
    !containsAny(curText, ["bebek", "baby"])
  ) return "Bebek/çocuk dostu formül";

  if (current.segment && candidate.segment && current.segment === candidate.segment)
    return "Benzer içerik ve performans";

  return "Aynı kategoride alternatif";
}

// ── Sort order ────────────────────────────────────────────────────────────────
// Önerilen ayrı yönetilir; bu sıralama geri kalan kartlar için

function sortOrder(curRank: number, candRank: number): number {
  if (curRank === -1 || candRank === -1) return 3;
  const diff = candRank - curRank;
  if (diff === 0)  return 0; // aynı segment
  if (diff < 0)   return 1; // daha ekonomik
  if (diff > 0)   return 2; // daha premium
  return 3;
}

// ── Benefit overlap ───────────────────────────────────────────────────────────

function benefitOverlap(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const hits = b.toLowerCase().split(/\W+/)
    .filter(w => w.length > 3 && wordsA.has(w)).length;
  return Math.min(hits * 5, 15);
}

function normCat(cat: string | null): string {
  return (cat ?? "").toLowerCase().trim();
}

// ── Ana tip ───────────────────────────────────────────────────────────────────

export interface SimilarResult {
  product:        Product;
  normalized:     NormalizedProduct;
  similarity:     number;
  differentiator: string;
  sortOrder:      number;
  /** Listede yalnızca 1 tanesinde true — en dengeli / en yüksek similarity */
  isRecommended:  boolean;
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────

export function findSimilarProducts(
  current: NormalizedProduct,
  allProducts: Product[],
  limit = 5,
): SimilarResult[] {
  const currentCat = normCat(current.category);
  if (!currentCat) return [];

  const curRank = SEG_RANK[current.segment ?? ""] ?? -1;
  const raw: SimilarResult[] = [];

  for (const p of allProducts) {
    if (String(p.id) === current.id) continue;

    const norm = normalizeProductData(p);
    const pCat = normCat(norm.category);

    if (!pCat || pCat !== currentCat) continue;

    // Strict subcategory check: her iki üründe de subcategory varsa eşleşmeli
    if (
      current.subcategory && norm.subcategory &&
      current.subcategory.toLowerCase().trim() !== norm.subcategory.toLowerCase().trim()
    ) continue;

    let sim = 50;

    if (
      current.subcategory && norm.subcategory &&
      current.subcategory.toLowerCase().trim() === norm.subcategory.toLowerCase().trim()
    ) sim += 20;

    sim += benefitOverlap(current.shortBenefit, norm.shortBenefit);

    const candRank = SEG_RANK[norm.segment ?? ""] ?? -1;
    if (curRank !== -1 && candRank !== -1) {
      const diff = Math.abs(curRank - candRank);
      sim += diff === 0 ? 10 : diff === 1 ? 5 : 0;
    }

    raw.push({
      product:        p,
      normalized:     norm,
      similarity:     sim,
      differentiator: resolveDifferentiatorLabel(current, norm),
      sortOrder:      sortOrder(curRank, candRank),
      isRecommended:  false,
    });
  }

  if (raw.length === 0) return [];

  // ── "Önerilen" seç: en yüksek similarity (aynı segment öncelikli) ──
  // Önce aynı-segment içinde ara; yoksa globalden al
  const sameSegment = raw.filter(r => r.sortOrder === 0);
  const pool        = sameSegment.length > 0 ? sameSegment : raw;
  const bestIdx     = pool.reduce(
    (bi, r, i) => r.similarity > pool[bi].similarity ? i : bi, 0,
  );
  const bestId = pool[bestIdx].normalized.id;

  // Önerilen karta işaret et
  const recommended = raw.find(r => r.normalized.id === bestId)!;
  recommended.isRecommended = true;

  // Geri kalan kartları (önerilen hariç) sırala: aynı → ekonomik → premium → diğer
  const rest = raw
    .filter(r => r.normalized.id !== bestId)
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : b.similarity - a.similarity,
    );

  return [recommended, ...rest].slice(0, limit);
}

// ── Conversion helpers ────────────────────────────────────────────────────────

export interface TopBadge {
  label:       string;
  bg:          string;
  color:       string;
  borderColor: string;
}

/**
 * Fark etiketinden badge türetir.
 * Öncelik: ekonomik › güçlü › hassas › parfümsüz › vegan → null
 */
export function resolveTopBadge(differentiator: string): TopBadge | null {
  const d = differentiator.toLowerCase();
  if (d.includes("ekonomik"))
    return { label: "Daha ekonomik",          bg: "#F0FDF4", color: "#15803D", borderColor: "#BBF7D0" };
  if (d.includes("yoğun") || d.includes("premium") || d.includes("güçlü"))
    return { label: "Daha güçlü etki",         bg: "#F5F3FF", color: "#6D28D9", borderColor: "#DDD6FE" };
  if (d.includes("hassas"))
    return { label: "Hassas cilt için uygun", bg: "#FFF7ED", color: "#C2410C", borderColor: "#FED7AA" };
  if (d.includes("parfümsüz"))
    return { label: "Parfümsüz alternatif",   bg: "#EFF6FF", color: "#1D4ED8", borderColor: "#BFDBFE" };
  if (d.includes("vegan"))
    return { label: "Vegan alternatif",        bg: "#F0FDF4", color: "#15803D", borderColor: "#BBF7D0" };
  return null;
}

/**
 * Segment'e göre fiyat/kalite ipucu — çok küçük, baskı yaratmaz.
 * ekonomik → "Uygun fiyatlı" | seçkin → "Daha güçlü formül" | diğer → null
 */
export function resolveSegmentHint(segment: string | null): string | null {
  if (segment === "ekonomik") return "Uygun fiyatlı";
  if (segment === "seçkin")   return "Daha güçlü formül";
  return null;
}

/**
 * Karar hızlandırıcı alt satır — eski adı: resolveMicroTrust.
 * Daha spesifik yönlendirme metinleri.
 */
export function resolveMicroTrust(differentiator: string): string {
  const d = differentiator.toLowerCase();
  if (d.includes("ekonomik"))                                       return "Benzer etki, daha sade içerik";
  if (d.includes("yoğun") || d.includes("premium") || d.includes("güçlü")) return "Aynı amaç, daha güçlü formül";
  if (d.includes("hassas"))                                         return "Günlük kullanım için daha uygun";
  if (d.includes("parfümsüz"))                                      return "İrritasyon riski daha düşük";
  if (d.includes("vegan"))                                          return "Hayvan içermeyen formül";
  if (d.includes("benzer"))                                         return "Benzer içerik yapısı";
  return "Aynı amaç, farklı yaklaşım";
}
