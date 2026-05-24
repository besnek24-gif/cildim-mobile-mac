/**
 * smartSearch.ts  — production-grade smart search engine
 * ─────────────────────────────────────────────────────────────────────────────
 * ADDITİF genişletme: mevcut arama sisteminin üstüne alias desteği,
 * önceden hesaplanmış index ve "bunu mu demek istediniz?" katmanı eklendi.
 *
 * Arama pipeline (skor önceliğine göre):
 *  1. Alias tam eşleşmesi            → 99   "aldermo"     → Alldermo
 *  2. Alias başlangıç eşleşmesi      → 88   "allderm"     → Alldermo
 *  3. Normalize tam eşleşme          → 100  "avene"       → Avène
 *  4. Normalize başlangıç            →  95  "cerav"       → CeraVe
 *  5. Compact başlangıç              →  90  "lar"         → La Roche-Posay
 *  6. Normalize içerme               →  80  "roche posay" → La Roche-Posay
 *  7. Compact içerme                 →  75  "laroche"     → La Roche-Posay
 *  8. Token eşleşmesi                →  65  "la roche"    → her token eşleşir
 *  9. Fuzzy Levenshtein (≥4 harf)    →  ≥30 "bioderrma"   → Bioderma
 *
 * GEÇMİŞ UYUMLULUK:
 *  smartSearchProducts(query, products)              — eski imza, çalışmaya devam eder
 *  smartSearchProducts(query, products, index)        — yeni hızlı yol (precomputed)
 *  smartSearchBrands  (query, products)              — eski imza, çalışmaya devam eder
 *  smartSearchBrands  (query, products, index)        — yeni hızlı yol
 */

import type { Product } from "@/types/product";
import { BRAND_ALIASES } from "./searchAliases";

// ── Normalizasyon ─────────────────────────────────────────────────────────────

const CHAR_MAP: Record<string, string> = {
  ğ:"g", Ğ:"g", ü:"u", Ü:"u", ş:"s", Ş:"s", ı:"i", İ:"i", ö:"o", Ö:"o", ç:"c", Ç:"c",
  à:"a", á:"a", â:"a", ã:"a", ä:"a", å:"a", æ:"ae",
  è:"e", é:"e", ê:"e", ë:"e",
  ì:"i", í:"i", î:"i", ï:"i",
  ò:"o", ó:"o", ô:"o", õ:"o", ø:"o",
  ù:"u", ú:"u", û:"u",
  ñ:"n", ý:"y", ÿ:"y", ß:"ss",
};

/** Küçük harf + TR/aksan dönüşümü + trim */
export function norm(s: string): string {
  let out = "";
  for (const c of s) out += CHAR_MAP[c] ?? CHAR_MAP[c.toLowerCase()] ?? c;
  return out.toLowerCase().trim();
}

/** Boşluk, tire, noktalama kaldır → bitişik yazım karşılaştırması */
export function compact(s: string): string {
  return norm(s).replace(/[\s\-_.,()/:;'"+*&%@!?]+/g, "");
}

// ── Levenshtein ───────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev);
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }
  return row[n];
}

// ── Precomputed Index ─────────────────────────────────────────────────────────

export interface IndexedProduct {
  product: Product;
  nameNorm: string;
  nameCompact: string;
  nameTokens: string[];
  brandNorm: string;
  brandCompact: string;
  brandTokens: string[];
  aliasNorms: string[];
  aliasCompacts: string[];
}

/**
 * Ürün listesini önceden indeksler. useMemo ile bir kere hesaplanır,
 * her sorgu için tekrar normalize edilmez.
 */
export function buildSearchIndex(products: Product[]): IndexedProduct[] {
  return products.map(p => {
    const name  = (p.name  ?? (p as any).isim  ?? "").trim();
    const brand = (p.brand ?? (p as any).marka ?? "").trim();
    const aliases = BRAND_ALIASES[brand] ?? [];
    return {
      product:       p,
      nameNorm:      norm(name),
      nameCompact:   compact(name),
      nameTokens:    norm(name).split(/\s+/).filter(Boolean),
      brandNorm:     norm(brand),
      brandCompact:  compact(brand),
      brandTokens:   norm(brand).split(/\s+/).filter(Boolean),
      aliasNorms:    aliases.map(a => norm(a)),
      aliasCompacts: aliases.map(a => compact(a)),
    };
  });
}

// ── Core Scoring — precomputed fields ─────────────────────────────────────────

function scoreFields(
  qNorm: string,
  qCompact: string,
  tn: string,
  tc: string,
): number {
  if (!tn) return 0;

  // 1. Tam eşleşme
  if (tn === qNorm) return 100;

  // 2. Normalize başlangıç
  if (tn.startsWith(qNorm)) return 95;

  // 3. Compact başlangıç
  if (qCompact.length >= 2 && tc.startsWith(qCompact)) return 90;

  // 4. Normalize içerme
  if (tn.includes(qNorm)) return 80;

  // 5. Compact içerme
  if (qCompact.length >= 3 && tc.includes(qCompact)) return 75;

  // 6. Token eşleşmesi (çok kelimeli sorgu)
  const tokens = qNorm.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length >= 2) {
    const matched = tokens.filter(t => tn.includes(t) || tc.includes(compact(t)));
    if (matched.length === tokens.length) return 65;
    if (matched.length >= Math.ceil(tokens.length * 0.6)) return 45;
  }

  // 7. Fuzzy (sadece ≥4 harf)
  if (qCompact.length >= 4) {
    const distFull = levenshtein(qCompact, tc);
    const maxFull  = Math.max(qCompact.length, tc.length);
    const simFull  = (1 - distFull / maxFull) * 100;
    if (simFull >= 65) return Math.round(simFull * 0.60);

    const tcPre   = tc.slice(0, Math.min(tc.length, qCompact.length + 2));
    const distPre = levenshtein(qCompact, tcPre);
    if (distPre <= (qCompact.length <= 5 ? 1 : 2)) return 40;
  }

  return 0;
}

/** Alias listesine karşı skor — alias eşleşmesi en yüksek öncelik */
function scoreAliases(
  qNorm: string,
  qCompact: string,
  aliasNorms: string[],
  aliasCompacts: string[],
): number {
  for (let i = 0; i < aliasNorms.length; i++) {
    const aN = aliasNorms[i];
    const aC = aliasCompacts[i];

    // Tam alias eşleşmesi
    if (aN === qNorm || aC === qCompact) return 99;
    // Alias başlangıç
    if (aN.startsWith(qNorm) || aC.startsWith(qCompact)) return 88;
    // Alias içerme (kullanıcı kısa alias yazdıysa)
    if (qNorm.length >= 3 && (aN.includes(qNorm) || aC.includes(qCompact))) return 78;
    // Alias fuzzy (≥4 harf)
    if (qCompact.length >= 4) {
      const dist = levenshtein(qCompact, aC);
      const sim  = (1 - dist / Math.max(qCompact.length, aC.length)) * 100;
      if (sim >= 75) return Math.round(sim * 0.70);
    }
  }
  return 0;
}

/** İndexlenmiş ürün skoru — alias önce, sonra regular scoring */
function scoreIndexedItem(qNorm: string, qCompact: string, item: IndexedProduct): number {
  // Alias kontrolü (marka bazlı, yüksek öncelik)
  const aliasScore = scoreAliases(qNorm, qCompact, item.aliasNorms, item.aliasCompacts);
  if (aliasScore > 0) return aliasScore;

  // Marka ve isim skorlaması (precomputed fields)
  const brandScore = scoreFields(qNorm, qCompact, item.brandNorm, item.brandCompact);
  const nameScore  = scoreFields(qNorm, qCompact, item.nameNorm,  item.nameCompact);

  if (brandScore >= 80) return Math.max(nameScore, brandScore + 5);
  return Math.max(nameScore, brandScore);
}

// ── Eski scoreText/scoreProduct — backward compat ───────────────────────────

/** Ham metin skorlama (index olmadan). Fallback'te ve eski çağrılarda kullanılır. */
function scoreText(qNorm: string, qCompact: string, text: string): number {
  if (!text) return 0;
  return scoreFields(qNorm, qCompact, norm(text), compact(text));
}

/** Ürün skoru (index olmadan). Alias sözlüğüne de bakar. */
function scoreProduct(qNorm: string, qCompact: string, product: Product): number {
  const name  = product.name  ?? (product as any).isim  ?? "";
  const brand = product.brand ?? (product as any).marka ?? "";
  const aliases = BRAND_ALIASES[brand] ?? [];

  // Alias kontrolü
  const aliasNorms    = aliases.map(a => norm(a));
  const aliasCompacts = aliases.map(a => compact(a));
  const aliasScore    = scoreAliases(qNorm, qCompact, aliasNorms, aliasCompacts);
  if (aliasScore > 0) return aliasScore;

  const nameScore  = scoreText(qNorm, qCompact, name);
  const brandScore = scoreText(qNorm, qCompact, brand);

  if (brandScore >= 80) return Math.max(nameScore, brandScore + 5);
  return Math.max(nameScore, brandScore);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ürünleri akıllı arar. Precomputed index verilirse daha hızlı çalışır.
 * Index verilmezse geriye dönük uyumlu mod devreye girer.
 */
export function smartSearchProducts(
  query: string,
  products: Product[],
  index?: IndexedProduct[],
): Product[] {
  try {
    const q = (query ?? "").trim();
    if (q.length < 2) return [];

    const qNorm    = norm(q);
    const qCompact = compact(q);

    const scored: Array<{ p: Product; score: number }> = [];

    if (index && index.length > 0) {
      // Hızlı yol — precomputed fields
      for (const item of index) {
        const score = scoreIndexedItem(qNorm, qCompact, item);
        if (score > 0) scored.push({ p: item.product, score });
      }
    } else {
      // Eski yol — raw product list
      for (const p of products) {
        const score = scoreProduct(qNorm, qCompact, p);
        if (score > 0) scored.push({ p, score });
      }
    }

    scored.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : (a.p.name ?? "").localeCompare(b.p.name ?? ""),
    );

    return scored.map(s => s.p);
  } catch {
    // Fallback: klasik includes
    const q = query.trim().toLowerCase();
    return products.filter(p =>
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.brand ?? (p as any).marka ?? "").toLowerCase().includes(q),
    );
  }
}

/**
 * Markaları akıllı arar. Precomputed index verilirse daha hızlı çalışır.
 */
export function smartSearchBrands(
  query: string,
  products: Product[],
  index?: IndexedProduct[],
): string[] {
  try {
    const q = (query ?? "").trim();
    if (q.length < 2) return [];

    const qNorm    = norm(q);
    const qCompact = compact(q);

    const brandScores = new Map<string, number>();

    const scoreAndAdd = (brand: string, aliasNorms: string[], aliasCompacts: string[]) => {
      if (!brand) return;
      // Alias önce
      const aScore = scoreAliases(qNorm, qCompact, aliasNorms, aliasCompacts);
      const bScore = aScore > 0 ? aScore : scoreFields(qNorm, qCompact, norm(brand), compact(brand));
      if (bScore > 0) {
        const prev = brandScores.get(brand) ?? 0;
        if (bScore > prev) brandScores.set(brand, bScore);
      }
    };

    if (index && index.length > 0) {
      for (const item of index) {
        scoreAndAdd(
          item.product.brand ?? (item.product as any).marka ?? "",
          item.aliasNorms,
          item.aliasCompacts,
        );
      }
    } else {
      for (const p of products) {
        const brand   = (p.brand ?? (p as any).marka ?? "").trim();
        const aliases = BRAND_ALIASES[brand] ?? [];
        scoreAndAdd(brand, aliases.map(a => norm(a)), aliases.map(a => compact(a)));
      }
    }

    return Array.from(brandScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand);
  } catch {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    products.forEach(p => {
      const b = (p.brand ?? (p as any).marka ?? "").trim();
      if (b && b.toLowerCase().includes(q)) seen.add(b);
    });
    return Array.from(seen).sort();
  }
}

/**
 * "Bunu mu demek istediniz?" için geniş kapsamlı arama.
 * Düşük eşikle çalışır — yalnızca sonuç sıfır veya çok zayıfsa kullanılır.
 * Mevcut arama sistemini etkilemez.
 */
export function smartDidYouMean(
  query: string,
  products: Product[],
  index?: IndexedProduct[],
): Array<{ text: string; type: "brand" | "product" }> {
  try {
    const q = (query ?? "").trim();
    if (q.length < 2) return [];

    const qNorm    = norm(q);
    const qCompact = compact(q);
    const results: Array<{ text: string; type: "brand" | "product"; score: number }> = [];
    const seen = new Set<string>();

    const addBrand = (brand: string, aliasNorms: string[], aliasCompacts: string[]) => {
      if (!brand || seen.has(brand)) return;
      const aScore = scoreAliases(qNorm, qCompact, aliasNorms, aliasCompacts);
      const bScore = aScore > 0 ? aScore : scoreFields(qNorm, qCompact, norm(brand), compact(brand));
      if (bScore > 0) {
        seen.add(brand);
        results.push({ text: brand, type: "brand", score: bScore });
      }
    };

    if (index && index.length > 0) {
      for (const item of index) {
        const brand = item.product.brand ?? (item.product as any).marka ?? "";
        addBrand(brand, item.aliasNorms, item.aliasCompacts);
      }
    } else {
      for (const p of products) {
        const brand   = (p.brand ?? (p as any).marka ?? "").trim();
        const aliases = BRAND_ALIASES[brand] ?? [];
        addBrand(brand, aliases.map(a => norm(a)), aliases.map(a => compact(a)));
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(({ text, type }) => ({ text, type }));
  } catch {
    return [];
  }
}
